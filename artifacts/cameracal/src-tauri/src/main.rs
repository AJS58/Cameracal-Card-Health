// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

// ── Data types ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: u64,
    pub extension: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VolumeInfo {
    pub name: String,
    pub path: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub filesystem: String,
    pub is_removable: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityIssue {
    pub check: String,
    pub detail: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityReport {
    pub path: String,
    pub passed: bool,
    pub issues: Vec<IntegrityIssue>,
}

// ── Recovery types ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecoveredFile {
    pub filename: String,
    pub format: String,
    pub size_bytes: u64,
    pub output_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecoverySummary {
    pub files_found: u32,
    pub bytes_scanned: u64,
    pub recovered: Vec<RecoveredFile>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryProgress {
    pub bytes_scanned: u64,
    pub total_bytes: u64,
    pub files_found: u32,
    pub current_action: String,
}

// ── Carving signatures ────────────────────────────────────────────────────────

struct CarveSig {
    header: &'static [u8],
    /// Bytes before the matched header within the file (0 for most; 4 for ftyp-based)
    header_offset: usize,
    ext: &'static str,
    label: &'static str,
    max_size: u64,
}

static CARVE_SIGS: &[CarveSig] = &[
    CarveSig { header: &[0xFF, 0xD8, 0xFF], header_offset: 0, ext: "jpg",  label: "JPEG",     max_size: 60  * 1024 * 1024 },
    CarveSig { header: &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], header_offset: 0, ext: "png",  label: "PNG",      max_size: 60  * 1024 * 1024 },
    CarveSig { header: b"FUJIFILM",                                          header_offset: 0, ext: "raf",  label: "RAF",      max_size: 160 * 1024 * 1024 },
    CarveSig { header: &[0x49, 0x49, 0x2A, 0x00],                          header_offset: 0, ext: "tif",  label: "RAW/TIFF", max_size: 160 * 1024 * 1024 },
    CarveSig { header: &[0x4D, 0x4D, 0x00, 0x2A],                          header_offset: 0, ext: "tif",  label: "RAW/TIFF", max_size: 160 * 1024 * 1024 },
    CarveSig { header: b"ftyp",                                              header_offset: 4, ext: "mp4",  label: "MP4/MOV",  max_size: 4   * 1024 * 1024 * 1024 },
];

/// Find the first signature match in `buf[from..]`.
/// Returns `(file_start_pos, sig_index)` where `file_start_pos` is the byte
/// position of the FILE start (may be before the matched header bytes for ftyp).
fn find_carve_sig(buf: &[u8], from: usize) -> Option<(usize, usize)> {
    let mut best: Option<(usize, usize)> = None;
    for (si, sig) in CARVE_SIGS.iter().enumerate() {
        for file_start in from..buf.len() {
            let hdr_pos = file_start + sig.header_offset;
            if hdr_pos + sig.header.len() > buf.len() {
                break;
            }
            if &buf[hdr_pos..hdr_pos + sig.header.len()] == sig.header {
                match best {
                    None => best = Some((file_start, si)),
                    Some((p, _)) if file_start < p => best = Some((file_start, si)),
                    _ => {}
                }
                break;
            }
        }
    }
    best
}

/// Find JPEG EOI (FF D9). Returns the position *after* the marker.
fn find_jpeg_eoi(buf: &[u8], from: usize) -> Option<usize> {
    let end = buf.len().saturating_sub(1);
    for i in from..end {
        if buf[i] == 0xFF && buf[i + 1] == 0xD9 {
            return Some(i + 2);
        }
    }
    None
}

/// Flush, close, and record (or discard) the current carve.
fn close_carve(
    writer: &mut Option<std::io::BufWriter<std::fs::File>>,
    path: &str,
    written: u64,
    label: &str,
    recovered: &mut Vec<RecoveredFile>,
) {
    if let Some(w) = writer.take() {
        drop(w);
        if written >= 4096 {
            recovered.push(RecoveredFile {
                filename: Path::new(path)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                format: label.to_string(),
                size_bytes: written,
                output_path: path.to_string(),
            });
        } else {
            std::fs::remove_file(path).ok();
        }
    }
}

// ── IPC commands ──────────────────────────────────────────────────────────────

#[tauri::command]
fn list_volumes() -> Vec<VolumeInfo> {
    use sysinfo::Disks;
    let disks = Disks::new_with_refreshed_list();
    let mut volumes: Vec<VolumeInfo> = disks
        .iter()
        .map(|disk| {
            let mount = disk.mount_point().to_string_lossy().to_string();
            let raw_name = disk.name().to_string_lossy().to_string();
            let name = if raw_name.is_empty() { mount.clone() } else { raw_name };
            VolumeInfo {
                name,
                path: mount,
                total_bytes: disk.total_space(),
                available_bytes: disk.available_space(),
                filesystem: disk.file_system().to_string_lossy().to_string(),
                is_removable: disk.is_removable(),
            }
        })
        .filter(|v| v.total_bytes > 0)
        .collect();
    volumes.sort_by(|a, b| b.is_removable.cmp(&a.is_removable).then(a.name.cmp(&b.name)));
    volumes
}

#[tauri::command]
fn get_volume_info(path: String) -> Result<VolumeInfo, String> {
    use sysinfo::Disks;
    let disks = Disks::new_with_refreshed_list();
    let p = Path::new(&path);
    let best = disks
        .iter()
        .filter(|d| p.starts_with(d.mount_point()))
        .max_by_key(|d| d.mount_point().to_string_lossy().len());
    match best {
        Some(disk) => {
            let mount = disk.mount_point().to_string_lossy().to_string();
            let raw_name = disk.name().to_string_lossy().to_string();
            Ok(VolumeInfo {
                name: if raw_name.is_empty() { mount.clone() } else { raw_name },
                path: mount,
                total_bytes: disk.total_space(),
                available_bytes: disk.available_space(),
                filesystem: disk.file_system().to_string_lossy().to_string(),
                is_removable: disk.is_removable(),
            })
        }
        None => Err(format!("No mounted volume found for path: {}", path)),
    }
}

#[tauri::command]
fn scan_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let p = Path::new(&path);
    if !p.exists() { return Err(format!("Path does not exist: {}", path)); }
    if !p.is_dir()  { return Err(format!("Path is not a directory: {}", path)); }

    let skip_dirs: &[&str] = &[
        ".Spotlight-V100", ".Trashes", ".fseventsd", ".TemporaryItems",
        "System Volume Information", "$RECYCLE.BIN", ".thumbnails",
        ".metadata_never_index",
    ];

    let mut entries: Vec<FileEntry> = Vec::new();
    for entry in WalkDir::new(p)
        .follow_links(false)
        .max_depth(10)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            if e.file_type().is_dir() {
                return !name.starts_with('.') && !skip_dirs.contains(&name.as_ref());
            }
            true
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name.starts_with("._") { continue; }
        let metadata = match entry.metadata() { Ok(m) => m, Err(_) => continue };
        let size = metadata.len();
        let modified = metadata.modified().unwrap_or(SystemTime::now())
            .duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64;
        let extension = entry.path().extension()
            .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
            .unwrap_or_default();
        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            size,
            modified,
            extension,
        });
    }
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(entries)
}

#[tauri::command]
fn check_files_integrity(paths: Vec<String>) -> Vec<IntegrityReport> {
    paths.iter().map(|path| check_integrity_one(path)).collect()
}

/// Return the raw device path for a mounted volume path.
/// macOS: runs diskutil to find the block device, then converts to rdisk (whole-disk raw).
/// Windows: derives the volume device path from the drive letter.
#[tauri::command]
fn get_device_for_volume(mount_path: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let out = std::process::Command::new("diskutil")
            .args(["info", &mount_path])
            .output()
            .map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            let t = line.trim();
            if t.starts_with("Device Node:") {
                let dev = t.splitn(2, ':').nth(1).unwrap_or("").trim();
                // /dev/disk2s1 → /dev/rdisk2  (whole-disk raw node, no partition suffix)
                let raw = dev.replace("/dev/disk", "/dev/rdisk");
                let raw = if let Some(s) = raw.rfind('s') {
                    if raw[s + 1..].chars().all(|c| c.is_ascii_digit()) {
                        raw[..s].to_string()
                    } else {
                        raw
                    }
                } else {
                    raw
                };
                return Ok(raw);
            }
        }
        Err("diskutil did not return a Device Node for that path".to_string())
    }
    #[cfg(target_os = "windows")]
    {
        let trimmed = mount_path.trim_end_matches(['\\', '/']);
        let letter = if trimmed.ends_with(':') {
            trimmed.to_string()
        } else {
            format!("{}:", trimmed)
        };
        Ok(format!("\\\\.\\{}", letter))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("Raw device access is not supported on this platform".to_string())
    }
}

/// Returns true if the app can open the raw device for reading.
/// A false result means Full Disk Access (macOS) or Administrator (Windows) is required.
#[tauri::command]
fn check_recovery_access(device_path: String) -> bool {
    std::fs::File::open(&device_path).is_ok()
}

/// Carve deleted/recoverable files from a raw device via byte-level signature scanning.
/// Emits "recovery-progress" events to the frontend while running.
#[tauri::command]
fn recover_files(
    device_path: String,
    output_dir: String,
    app: tauri::AppHandle,
) -> RecoverySummary {
    use std::io::{BufWriter, Write};
    use std::time::Instant;
    use tauri::Emitter;

    const CHUNK: usize = 4 * 1024 * 1024; // 4 MB read chunks
    const OVERLAP: usize = 512;            // bytes carried over to catch boundary signatures

    let out_dir = Path::new(&output_dir);
    if std::fs::create_dir_all(out_dir).is_err() {
        return RecoverySummary {
            files_found: 0,
            bytes_scanned: 0,
            recovered: vec![],
            error: Some("Failed to create output directory".into()),
        };
    }

    let mut device = match std::fs::File::open(&device_path) {
        Ok(f) => f,
        Err(e) => return RecoverySummary {
            files_found: 0,
            bytes_scanned: 0,
            recovered: vec![],
            error: Some(format!("Cannot open device: {e}")),
        },
    };

    let total_bytes = device.seek(SeekFrom::End(0)).unwrap_or(0);
    device.seek(SeekFrom::Start(0)).ok();

    let mut bytes_scanned: u64 = 0;
    let mut file_index: u32 = 0;
    let mut recovered: Vec<RecoveredFile> = Vec::new();
    let mut last_emit = Instant::now();

    // Active carve state
    let mut active_writer: Option<BufWriter<std::fs::File>> = None;
    let mut active_path = String::new();
    let mut active_written: u64 = 0;
    let mut active_sig: usize = 0;
    let mut active_label = String::new();

    let mut carry: Vec<u8> = Vec::new();

    loop {
        // Build work buffer: leftover carry bytes + fresh device read
        let mut work = Vec::with_capacity(carry.len() + CHUNK);
        work.extend_from_slice(&carry);
        let old_len = work.len();
        work.resize(old_len + CHUNK, 0);

        let n = match device.read(&mut work[old_len..]) {
            Ok(n) => n,
            Err(_) => break,
        };
        work.truncate(old_len + n);
        bytes_scanned += n as u64;

        let mut pos = 0;
        while pos < work.len() {
            if active_writer.is_some() {
                let sig = &CARVE_SIGS[active_sig];
                let max_remaining = sig.max_size.saturating_sub(active_written) as usize;

                // JPEG: detect end via EOI marker (FF D9)
                let eoi_pos = if active_sig == 0 && active_written > 4 {
                    find_jpeg_eoi(&work, pos)
                } else {
                    None
                };

                // After writing a safe minimum, also stop when any new signature appears.
                // Skip same-family TIFF signatures (LE/BE) that appear inside RAW bodies.
                let next_pos = if active_written > 65536 {
                    find_carve_sig(&work, pos).and_then(|(p, si)| {
                        let same_tiff = (active_sig == 3 || active_sig == 4)
                            && (si == 3 || si == 4);
                        if same_tiff { None } else { Some(p) }
                    })
                } else {
                    None
                };

                let stop = match (eoi_pos, next_pos) {
                    (Some(e), Some(n)) => Some(e.min(n)),
                    (Some(e), None)    => Some(e),
                    (None, Some(n))    => Some(n),
                    (None, None)       => None,
                };

                let write_end = match stop {
                    Some(s) => s.min(pos + max_remaining).min(work.len()),
                    None    => (pos + max_remaining).min(work.len()),
                };

                if let Some(ref mut w) = active_writer {
                    w.write_all(&work[pos..write_end]).ok();
                    active_written += (write_end - pos) as u64;
                }
                pos = write_end;

                let reached_stop = stop.map_or(false, |s| pos >= s.min(work.len()));
                if reached_stop || active_written >= sig.max_size {
                    close_carve(
                        &mut active_writer,
                        &active_path,
                        active_written,
                        &active_label,
                        &mut recovered,
                    );
                }
            } else {
                // Scanning for the next file signature
                match find_carve_sig(&work, pos) {
                    None => break,
                    Some((file_start, si)) => {
                        file_index += 1;
                        let sig = &CARVE_SIGS[si];
                        let fname = format!("recovered_{:04}.{}", file_index, sig.ext);
                        let fpath = out_dir.join(&fname);
                        let fpath_str = fpath.to_string_lossy().to_string();

                        match std::fs::OpenOptions::new()
                            .write(true)
                            .create(true)
                            .truncate(true)
                            .open(&fpath)
                        {
                            Ok(f) => {
                                active_writer  = Some(BufWriter::new(f));
                                active_path    = fpath_str;
                                active_written = 0;
                                active_sig     = si;
                                active_label   = sig.label.to_string();
                                pos = file_start;
                            }
                            Err(_) => { pos = file_start + 1; }
                        }
                    }
                }
            }
        }

        // Carry over last OVERLAP bytes to catch signatures that straddle chunk boundaries
        let carry_start = work.len().saturating_sub(OVERLAP);
        carry = work[carry_start..].to_vec();

        if last_emit.elapsed().as_millis() >= 600 {
            app.emit("recovery-progress", RecoveryProgress {
                bytes_scanned,
                total_bytes,
                files_found: file_index,
                current_action: format!("Scanning… {} files found so far", file_index),
            }).ok();
            last_emit = Instant::now();
        }

        if n == 0 { break; }
    }

    // Close any file that was still open at EOF
    close_carve(
        &mut active_writer,
        &active_path,
        active_written,
        &active_label,
        &mut recovered,
    );

    app.emit("recovery-progress", RecoveryProgress {
        bytes_scanned,
        total_bytes,
        files_found: file_index,
        current_action: "Complete".to_string(),
    }).ok();

    RecoverySummary {
        files_found: file_index,
        bytes_scanned,
        recovered,
        error: None,
    }
}

// ── Integrity helpers ─────────────────────────────────────────────────────────

fn check_integrity_one(path: &str) -> IntegrityReport {
    let p = Path::new(path);
    let ext = p.extension()
        .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
        .unwrap_or_default();

    let metadata = match std::fs::metadata(p) {
        Ok(m) => m,
        Err(e) => return IntegrityReport {
            path: path.to_string(), passed: false,
            issues: vec![IntegrityIssue { check: "File access".into(), detail: e.to_string() }],
        },
    };
    let size = metadata.len();

    let mut file = match std::fs::File::open(p) {
        Ok(f) => f,
        Err(e) => return IntegrityReport {
            path: path.to_string(), passed: false,
            issues: vec![IntegrityIssue { check: "File open".into(), detail: e.to_string() }],
        },
    };

    let mut header_buf = [0u8; 16];
    let header_len = file.read(&mut header_buf).unwrap_or(0);
    let header = &header_buf[..header_len];

    let tail_start = size.saturating_sub(12);
    let mut tail_buf = [0u8; 12];
    let tail_len = if file.seek(SeekFrom::Start(tail_start)).is_ok() {
        file.read(&mut tail_buf).unwrap_or(0)
    } else { 0 };
    let tail = &tail_buf[..tail_len];

    let sample_offset = (size as f64 * 0.3) as u64;
    let mut sample_buf = [0u8; 256];
    let sample_len = if file.seek(SeekFrom::Start(sample_offset)).is_ok() {
        file.read(&mut sample_buf).unwrap_or(0)
    } else { 0 };
    let sample = &sample_buf[..sample_len];

    let mut issues: Vec<IntegrityIssue> = Vec::new();

    if size > 512 && sample_len > 0 {
        let zeros = sample.iter().filter(|&&b| b == 0).count();
        if zeros as f64 / sample_len as f64 >= 0.95 {
            issues.push(IntegrityIssue {
                check: "Zero-fill".into(),
                detail: "Sampled region is >95% null bytes — card write failure during capture".into(),
            });
        }
    }

    match ext.as_str() {
        ".jpg" | ".jpeg" => validate_jpeg(header, tail, &mut issues),
        ".png"           => validate_png(header, tail, &mut issues),
        ".cr3"           => validate_cr3(header, &mut issues),
        ".raf"           => validate_raf(header, &mut issues),
        ".x3f"           => validate_x3f(header, &mut issues),
        ".mp4" | ".mov" | ".m4v" => validate_mp4(header, &mut issues),
        ".mxf"           => validate_mxf(header, &mut issues),
        e if is_tiff_raw(e) => validate_tiff_raw(e, header, &mut issues),
        _ => {}
    }

    IntegrityReport { path: path.to_string(), passed: issues.is_empty(), issues }
}

fn is_tiff_raw(ext: &str) -> bool {
    matches!(ext,
        ".cr2" | ".nef" | ".nrw" | ".arw" | ".sr2" | ".srf" | ".dng" |
        ".pef" | ".ptx" | ".srw" | ".mef" | ".dcr" | ".kdc" | ".erf" |
        ".rwl" | ".raw" | ".iiq" | ".cap" | ".3fr" | ".fff" | ".mrw" |
        ".orf" | ".rw2"
    )
}

fn match_bytes(data: &[u8], offset: usize, pattern: &[u8]) -> bool {
    if offset + pattern.len() > data.len() { return false; }
    data[offset..offset + pattern.len()] == *pattern
}

fn contains_pattern(data: &[u8], pattern: &[u8]) -> bool {
    data.windows(pattern.len()).any(|w| w == pattern)
}

fn hex_str(data: &[u8], start: usize, len: usize) -> String {
    data.get(start..(start + len).min(data.len()))
        .unwrap_or(&[])
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(" ")
}

fn validate_jpeg(header: &[u8], tail: &[u8], issues: &mut Vec<IntegrityIssue>) {
    if !match_bytes(header, 0, &[0xFF, 0xD8]) {
        issues.push(IntegrityIssue {
            check: "JPEG SOI marker".into(),
            detail: format!("Expected FF D8, got {}", hex_str(header, 0, 2)),
        });
        return;
    }
    let has_app = match_bytes(header, 2, &[0xFF, 0xE0]) || match_bytes(header, 2, &[0xFF, 0xE1]);
    if !has_app {
        issues.push(IntegrityIssue {
            check: "JPEG APP marker".into(),
            detail: format!("Expected FF E0 (JFIF) or FF E1 (EXIF), got {}", hex_str(header, 2, 2)),
        });
    }
    if !contains_pattern(tail, &[0xFF, 0xD9]) {
        issues.push(IntegrityIssue {
            check: "JPEG EOI marker".into(),
            detail: "FF D9 End of Image not found — file truncated during card write".into(),
        });
    }
}

fn validate_png(header: &[u8], tail: &[u8], issues: &mut Vec<IntegrityIssue>) {
    const PNG_SIG: &[u8] = &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if !match_bytes(header, 0, PNG_SIG) {
        issues.push(IntegrityIssue {
            check: "PNG signature".into(),
            detail: format!("Invalid PNG magic, got {}", hex_str(header, 0, 4)),
        });
        return;
    }
    const IEND: &[u8] = &[0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];
    if !contains_pattern(tail, IEND) {
        issues.push(IntegrityIssue {
            check: "PNG IEND chunk".into(),
            detail: "IEND chunk not found — file truncated during card write".into(),
        });
    }
}

fn validate_tiff_raw(ext: &str, header: &[u8], issues: &mut Vec<IntegrityIssue>) {
    let is_le = header.get(0) == Some(&0x49) && header.get(1) == Some(&0x49)
        && matches!(header.get(2), Some(&0x2A) | Some(&0x55) | Some(&0x52));
    let is_be = header.get(0) == Some(&0x4D) && header.get(1) == Some(&0x4D)
        && (matches!(header.get(3), Some(&0x2A)) || matches!(header.get(2), Some(&0x52)));
    if !is_le && !is_be {
        let label = ext.to_uppercase();
        let label = label.trim_start_matches('.');
        issues.push(IntegrityIssue {
            check: format!("{} TIFF header", label),
            detail: format!(
                "Expected TIFF magic (49 49 2A 00 or 4D 4D 00 2A), got {}",
                hex_str(header, 0, 4)
            ),
        });
    }
}

fn validate_cr3(header: &[u8], issues: &mut Vec<IntegrityIssue>) {
    if !match_bytes(header, 4, b"ftyp") {
        issues.push(IntegrityIssue {
            check: "CR3 ftyp box".into(),
            detail: format!(
                "ISO Base Media ftyp box not found at offset 4, got {}",
                hex_str(header, 4, 4)
            ),
        });
    }
}

fn validate_raf(header: &[u8], issues: &mut Vec<IntegrityIssue>) {
    if !match_bytes(header, 0, b"FUJIFILM") {
        issues.push(IntegrityIssue {
            check: "RAF FUJIFILM magic".into(),
            detail: format!("Expected ASCII \"FUJIFILM\", got {}", hex_str(header, 0, 8)),
        });
    }
}

fn validate_x3f(header: &[u8], issues: &mut Vec<IntegrityIssue>) {
    if !match_bytes(header, 0, b"FOVb") {
        issues.push(IntegrityIssue {
            check: "X3F FOVb magic".into(),
            detail: format!("Expected \"FOVb\", got {}", hex_str(header, 0, 4)),
        });
    }
}

fn validate_mp4(header: &[u8], issues: &mut Vec<IntegrityIssue>) {
    if !match_bytes(header, 4, b"ftyp") {
        issues.push(IntegrityIssue {
            check: "MP4 ftyp box".into(),
            detail: format!("ftyp box not found at offset 4, got {}", hex_str(header, 4, 4)),
        });
    }
}

fn validate_mxf(header: &[u8], issues: &mut Vec<IntegrityIssue>) {
    if !match_bytes(header, 0, &[0x06, 0x0E, 0x2B, 0x34]) {
        issues.push(IntegrityIssue {
            check: "MXF SMPTE key".into(),
            detail: format!(
                "Expected SMPTE Universal Label 06 0E 2B 34, got {}",
                hex_str(header, 0, 4)
            ),
        });
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            list_volumes,
            get_volume_info,
            scan_directory,
            check_files_integrity,
            get_device_for_volume,
            check_recovery_access,
            recover_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Cameracal Card Health");
}
