// Prevents additional console window on Windows in release
  #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

  use serde::{Deserialize, Serialize};
  use std::io::{Read, Seek, SeekFrom};
  use std::path::Path;
  use std::time::{SystemTime, UNIX_EPOCH};
  use walkdir::WalkDir;

  // ── Data types sent to the frontend ─────────────────────────────────────────

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

  // ── IPC Commands ─────────────────────────────────────────────────────────────

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
              name, path: entry.path().to_string_lossy().to_string(),
              size, modified, extension,
          });
      }
      entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
      Ok(entries)
  }

  #[tauri::command]
  fn check_files_integrity(paths: Vec<String>) -> Vec<IntegrityReport> {
      paths.iter().map(|path| check_integrity_one(path)).collect()
  }

  // ── Integrity checking ────────────────────────────────────────────────────────

  fn check_integrity_one(path: &str) -> IntegrityReport {
      let p = Path::new(path);
      let ext = p.extension()
          .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
          .unwrap_or_default();

      let metadata = match std::fs::metadata(p) {
          Ok(m) => m,
          Err(e) => return IntegrityReport {
              path: path.to_string(), passed: false,
              issues: vec![IntegrityIssue { check: "File access".to_string(), detail: e.to_string() }],
          },
      };
      let size = metadata.len();

      let mut file = match std::fs::File::open(p) {
          Ok(f) => f,
          Err(e) => return IntegrityReport {
              path: path.to_string(), passed: false,
              issues: vec![IntegrityIssue { check: "File open".to_string(), detail: e.to_string() }],
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
                  check: "Zero-fill".to_string(),
                  detail: "Sampled region is >95% null bytes — card write failure during capture".to_string(),
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
          .iter().map(|b| format!("{:02X}", b))
          .collect::<Vec<_>>().join(" ")
  }

  fn validate_jpeg(header: &[u8], tail: &[u8], issues: &mut Vec<IntegrityIssue>) {
      if !match_bytes(header, 0, &[0xFF, 0xD8]) {
          issues.push(IntegrityIssue {
              check: "JPEG SOI marker".to_string(),
              detail: format!("Expected FF D8, got {}", hex_str(header, 0, 2)),
          });
          return;
      }
      let has_app = match_bytes(header, 2, &[0xFF, 0xE0]) || match_bytes(header, 2, &[0xFF, 0xE1]);
      if !has_app {
          issues.push(IntegrityIssue {
              check: "JPEG APP marker".to_string(),
              detail: format!("Expected FF E0 (JFIF) or FF E1 (EXIF), got {}", hex_str(header, 2, 2)),
          });
      }
      if !contains_pattern(tail, &[0xFF, 0xD9]) {
          issues.push(IntegrityIssue {
              check: "JPEG EOI marker".to_string(),
              detail: "FF D9 End of Image not found — file truncated during card write".to_string(),
          });
      }
  }

  fn validate_png(header: &[u8], tail: &[u8], issues: &mut Vec<IntegrityIssue>) {
      const PNG_SIG: &[u8] = &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      if !match_bytes(header, 0, PNG_SIG) {
          issues.push(IntegrityIssue {
              check: "PNG signature".to_string(),
              detail: format!("Invalid PNG magic, got {}", hex_str(header, 0, 4)),
          });
          return;
      }
      const IEND: &[u8] = &[0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];
      if !contains_pattern(tail, IEND) {
          issues.push(IntegrityIssue {
              check: "PNG IEND chunk".to_string(),
              detail: "IEND chunk not found — file truncated during card write".to_string(),
          });
      }
  }

  fn validate_tiff_raw(ext: &str, header: &[u8], issues: &mut Vec<IntegrityIssue>) {
      let is_le = header.get(0) == Some(&0x49) && header.get(1) == Some(&0x49) &&
                  matches!(header.get(2), Some(&0x2A) | Some(&0x55) | Some(&0x52));
      let is_be = header.get(0) == Some(&0x4D) && header.get(1) == Some(&0x4D) &&
                  (matches!(header.get(3), Some(&0x2A)) || matches!(header.get(2), Some(&0x52)));
      if !is_le && !is_be {
          let label = ext.to_uppercase();
          let label = label.trim_start_matches('.');
          issues.push(IntegrityIssue {
              check: format!("{} TIFF header", label),
              detail: format!("Expected TIFF magic (49 49 2A 00 or 4D 4D 00 2A), got {}", hex_str(header, 0, 4)),
          });
      }
  }

  fn validate_cr3(header: &[u8], issues: &mut Vec<IntegrityIssue>) {
      if !match_bytes(header, 4, b"ftyp") {
          issues.push(IntegrityIssue {
              check: "CR3 ftyp box".to_string(),
              detail: format!("ISO Base Media ftyp box not found at offset 4, got {}", hex_str(header, 4, 4)),
          });
      }
  }

  fn validate_raf(header: &[u8], issues: &mut Vec<IntegrityIssue>) {
      if !match_bytes(header, 0, b"FUJIFILM") {
          issues.push(IntegrityIssue {
              check: "RAF FUJIFILM magic".to_string(),
              detail: format!("Expected ASCII \"FUJIFILM\", got {}", hex_str(header, 0, 8)),
          });
      }
  }

  fn validate_x3f(header: &[u8], issues: &mut Vec<IntegrityIssue>) {
      if !match_bytes(header, 0, b"FOVb") {
          issues.push(IntegrityIssue {
              check: "X3F FOVb magic".to_string(),
              detail: format!("Expected \"FOVb\", got {}", hex_str(header, 0, 4)),
          });
      }
  }

  fn validate_mp4(header: &[u8], issues: &mut Vec<IntegrityIssue>) {
      if !match_bytes(header, 4, b"ftyp") {
          issues.push(IntegrityIssue {
              check: "MP4 ftyp box".to_string(),
              detail: format!("ftyp box not found at offset 4, got {}", hex_str(header, 4, 4)),
          });
      }
  }

  fn validate_mxf(header: &[u8], issues: &mut Vec<IntegrityIssue>) {
      if !match_bytes(header, 0, &[0x06, 0x0E, 0x2B, 0x34]) {
          issues.push(IntegrityIssue {
              check: "MXF SMPTE key".to_string(),
              detail: format!("Expected SMPTE Universal Label 06 0E 2B 34, got {}", hex_str(header, 0, 4)),
          });
      }
  }

  // ── App entry point ──────────────────────────────────────────────────────────

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
          ])
          .run(tauri::generate_context!())
          .expect("error while running Cameracal Card Health");
  }
  