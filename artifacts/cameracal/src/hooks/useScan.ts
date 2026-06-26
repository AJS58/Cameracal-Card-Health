import { useState, useCallback, useRef } from 'react';
import { useScanContext, FileResult, ScanResult, ScanProfileConfig, SCAN_PROFILES } from '../context/ScanContext';
import { validateBrowserFile } from '../lib/fileIntegrity';
import { checkFilesIntegrityNative } from '../lib/tauri-bridge';
import type { DiskFile } from '../lib/tauri-bridge';

const PREVIEWABLE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

const RAW_EXTS = [
  '.cr2', '.cr3', '.crw',
  '.nef', '.nrw',
  '.arw', '.sr2', '.srf',
  '.raf',
  '.rw2',
  '.orf',
  '.pef', '.ptx',
  '.srw',
  '.3fr', '.fff',
  '.iiq', '.cap',
  '.rwl', '.raw',
  '.x3f',
  '.mrw',
  '.mef',
  '.dcr', '.kdc',
  '.erf',
  '.r3d',
  '.dng',
];

const VIDEO_NATIVE_EXTS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.3gp'];
const VIDEO_PRO_EXTS = ['.mxf', '.braw', '.mts', '.m2ts', '.mp2t', '.ts', '.prores', '.hevc', '.lrv'];
const VIDEO_EXTS = [...VIDEO_NATIVE_EXTS, ...VIDEO_PRO_EXTS];

// Extensions we can byte-validate in the browser
const INTEGRITY_CHECKABLE_EXTS = new Set([
  '.jpg', '.jpeg', '.png',
  '.cr2', '.cr3', '.nef', '.nrw', '.arw', '.sr2', '.srf', '.dng',
  '.pef', '.ptx', '.srw', '.mef', '.dcr', '.kdc', '.erf',
  '.rwl', '.raw', '.iiq', '.cap', '.3fr', '.fff', '.mrw', '.orf', '.rw2',
  '.raf', '.x3f',
  '.mp4', '.mov', '.m4v', '.mxf',
]);

const VIDEO_MIN_BYTES: Record<string, number> = {
  '.mp4': 50_000, '.mov': 50_000, '.avi': 50_000, '.mkv': 50_000,
  '.webm': 20_000, '.mxf': 200_000, '.braw': 500_000,
  '.mts': 100_000, '.m2ts': 100_000,
};

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return 'Unknown';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function generateImageThumbnail(file: File): string {
  return URL.createObjectURL(file);
}

function generateVideoThumbnail(file: File): Promise<{ thumbnailUrl?: string; durationEstimate?: string }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => { try { URL.revokeObjectURL(url); } catch { /* ignore */ } };
    const timeoutId = setTimeout(() => { cleanup(); resolve({}); }, 8000);
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1.5, video.duration * 0.08);
    };
    video.onseeked = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 240; canvas.height = 135;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, 240, 135);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.75);
          cleanup();
          resolve({ thumbnailUrl, durationEstimate: formatDuration(video.duration) });
        } else {
          cleanup();
          resolve({ durationEstimate: formatDuration(video.duration) });
        }
      } catch { cleanup(); resolve({}); }
    };
    video.onerror = () => { clearTimeout(timeoutId); cleanup(); resolve({}); };
    video.src = url;
  });
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function getCategory(ext: string): FileResult['category'] {
  if (['.jpg', '.jpeg'].includes(ext)) return 'jpeg';
  if (ext === '.png') return 'png';
  if (ext === '.webp') return 'webp';
  if (RAW_EXTS.includes(ext)) return 'raw';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  return 'other';
}

function getExtension(filename: string): string {
  return filename.slice((Math.max(0, filename.lastIndexOf('.')) || Infinity)).toLowerCase();
}

function analyseFileMeta(
  name: string,
  size: number,
  ext: string,
  profile: ScanProfileConfig,
): { status: FileResult['status']; reason: string } {
  const category = getCategory(ext);
  let status: FileResult['status'] = 'good';
  let reason = '';

  if (size === 0) {
    status = 'error';
    reason = 'Zero-byte file — no data present';
  } else if (category === 'jpeg') {
    const burstMinBytes = profile.burstMode ? 800_000 : 10_240;
    if (size < burstMinBytes) {
      status = profile.burstMode ? 'error' : 'warning';
      reason = profile.burstMode
        ? `Burst frame too small (${(size / 1024).toFixed(0)} KB) — possible truncation`
        : 'File unusually small for a JPEG';
    }
  } else if (category === 'raw') {
    if (!profile.requireRaw) {
      status = 'warning';
      reason = 'RAW file — byte-level header validation runs separately';
    }
  } else if (category === 'video') {
    const minSize = VIDEO_MIN_BYTES[ext];
    if (minSize && size < minSize) {
      status = profile.strictVideo ? 'error' : 'warning';
      reason = `File too small for a valid ${ext.toUpperCase()} clip — likely truncated`;
    } else if (VIDEO_PRO_EXTS.includes(ext)) {
      status = profile.strictVideo ? 'error' : 'warning';
      reason = profile.strictVideo
        ? `${ext.toUpperCase()} — professional format; Video profile requires header validation`
        : `${ext.toUpperCase()} — professional format; full container validation below`;
    }
  }

  return { status, reason };
}

function applyWeddingPairing(results: FileResult[]) {
  const rawBases = new Set(
    results.filter(r => r.category === 'raw')
      .map(r => r.name.replace(/\.[^.]+$/, '').toLowerCase())
  );
  results.forEach(r => {
    if (r.category === 'jpeg' && r.status === 'good') {
      const base = r.name.replace(/\.[^.]+$/, '').toLowerCase();
      if (!rawBases.has(base)) {
        r.status = 'warning';
        r.reason = 'No matching RAW file found for this JPEG (Wedding profile expects RAW+JPEG pairs)';
      }
    }
  });
}

function applyBurstGapDetection(results: FileResult[]) {
  const groups = new Map<string, Array<{ idx: number; num: number }>>();
  results.forEach((r, idx) => {
    const m = r.name.match(/^([A-Za-z_\-]*?)(\d{3,})\b/);
    if (m) {
      const prefix = m[1].toLowerCase();
      const num = parseInt(m[2], 10);
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix)!.push({ idx, num });
    }
  });
  groups.forEach(entries => {
    if (entries.length < 3) return;
    entries.sort((a, b) => a.num - b.num);
    for (let i = 1; i < entries.length; i++) {
      const gap = entries[i].num - entries[i - 1].num;
      if (gap > 1 && gap <= 20) {
        const missing = gap - 1;
        const r = results[entries[i].idx];
        if (r.status === 'good') {
          r.status = 'warning';
          r.reason = `Burst sequence gap — ${missing} frame${missing > 1 ? 's' : ''} missing before this file`;
        }
      }
    }
  });
}

function calculateScoreAndUrgency(
  good: number, warnings: number, errors: number, total: number,
  profile: ScanProfileConfig,
) {
  if (total === 0) return { score: 0, urgency: 'safe' as const };
  const warningWeight = profile.errorThreshold === 0 ? 0.2 : 0.5;
  let score = ((good + warnings * warningWeight) / total) * 100;
  score -= errors * (profile.errorThreshold === 0 ? 10 : 5);
  score = Math.max(0, Math.min(100, Math.round(score)));
  let urgency: 'safe' | 'caution' | 'warning' = 'safe';
  if (errors > 0) urgency = 'warning';
  else if (warnings > 0) {
    urgency = (profile.warningThreshold === 0 || warnings > profile.warningThreshold) ? 'caution' : 'safe';
  }
  return { score, urgency };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useScan() {
  const { setScanResult, addToHistory, settings } = useScanContext();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scannedFiles, setScannedFiles] = useState<number>(0);
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const cancelledRef = useRef(false);

  const processFile = async (
    file: File,
    profile: ScanProfileConfig,
    imageThumbnailsLeft: { count: number },
    videoThumbnailsLeft: { count: number }
  ): Promise<FileResult> => {
    const ext = getExtension(file.name);
    const category = getCategory(ext);
    let { status, reason } = analyseFileMeta(file.name, file.size, ext, profile);

    let thumbnailUrl: string | undefined;
    let durationEstimate: string | undefined;
    let integrityChecks: FileResult['integrityChecks'];
    let integrityIssues: FileResult['integrityIssues'];

    // Deep byte-level integrity check (runs for supported formats)
    if (file.size > 0 && INTEGRITY_CHECKABLE_EXTS.has(ext)) {
      try {
        const integrity = await validateBrowserFile(file);
        integrityChecks = integrity.checks;
        if (!integrity.passed) {
          integrityIssues = integrity.issues;
          // Integrity failures override metadata-only status
          status = 'error';
          reason = integrity.issues[0] ?? reason;
        } else if (category === 'raw' && status === 'warning' && reason?.includes('byte-level')) {
          // Header validated OK — clear the placeholder warning for RAW files
          status = 'good';
          reason = '';
        }
      } catch {
        // Integrity check failed to run — don't block the scan
      }
    }

    // Thumbnail generation (after integrity check so we know it's structurally valid)
    if ((category === 'jpeg' || category === 'png' || category === 'webp') && imageThumbnailsLeft.count > 0) {
      try {
        thumbnailUrl = generateImageThumbnail(file);
        imageThumbnailsLeft.count--;
      } catch {
        if (status === 'good') { status = 'warning'; reason = 'Could not generate preview'; }
      }
    } else if (category === 'video' && videoThumbnailsLeft.count > 0 && VIDEO_NATIVE_EXTS.includes(ext)) {
      const result = await generateVideoThumbnail(file);
      thumbnailUrl = result.thumbnailUrl;
      durationEstimate = result.durationEstimate;
      if (thumbnailUrl) videoThumbnailsLeft.count--;
    }

    return {
      name: file.name, size: file.size, extension: ext, category,
      status, reason, thumbnailUrl, durationEstimate,
      lastModified: file.lastModified,
      integrityChecks, integrityIssues,
    };
  };

  /** Browser scan — takes File objects from <input type="file"> */
  const startScan = useCallback(async (files: FileList | File[], cardType: string) => {
    cancelledRef.current = false;
    setIsScanning(true);
    setProgress(0);
    setScannedFiles(0);
    setTotalFiles(files.length);

    const activeProfile = SCAN_PROFILES.find(p => p.id === settings.scanProfile) ?? SCAN_PROFILES[0];
    const results: FileResult[] = [];
    const BATCH_SIZE = 10;
    const imageThumbnailsLeft = { count: settings.thumbnailLimit };
    const videoThumbnailsLeft = { count: 8 };

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      if (cancelledRef.current) break;
      const batch = Array.from(files).slice(i, i + BATCH_SIZE);
      for (const file of batch) {
        if (cancelledRef.current) break;
        const result = await processFile(file, activeProfile, imageThumbnailsLeft, videoThumbnailsLeft);
        results.push(result);
      }
      setScannedFiles(results.length);
      setProgress((results.length / files.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (activeProfile.requireRaw) applyWeddingPairing(results);
    if (activeProfile.burstMode) applyBurstGapDetection(results);
    finaliseScan(results, cardType, activeProfile);
  }, [setScanResult, addToHistory, settings]);

  /**
   * Native desktop scan — takes DiskFile[] from Rust scan_directory.
   * Runs a batch integrity check (reads header/tail/sample from disk via Rust).
   */
  const startScanFromDisk = useCallback(async (diskFiles: DiskFile[], cardType: string) => {
    cancelledRef.current = false;
    setIsScanning(true);
    setProgress(0);
    setScannedFiles(0);
    setTotalFiles(diskFiles.length);

    const activeProfile = SCAN_PROFILES.find(p => p.id === settings.scanProfile) ?? SCAN_PROFILES[0];
    const results: FileResult[] = [];
    const BATCH_SIZE = 50;

    // Phase 1: metadata pass
    for (let i = 0; i < diskFiles.length; i += BATCH_SIZE) {
      if (cancelledRef.current) break;
      const batch = diskFiles.slice(i, i + BATCH_SIZE);
      for (const df of batch) {
        if (cancelledRef.current) break;
        const { status, reason } = analyseFileMeta(df.name, df.size, df.extension, activeProfile);
        const category = getCategory(df.extension);
        results.push({
          name: df.name, size: df.size, extension: df.extension, category,
          status, reason, lastModified: df.modified,
        });
      }
      setScannedFiles(Math.min(results.length, Math.floor(diskFiles.length * 0.5)));
      setProgress((results.length / diskFiles.length) * 50);
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Phase 2: batch integrity check via Rust (reads actual file bytes)
    if (!cancelledRef.current) {
      const checkablePaths = diskFiles
        .filter(df => INTEGRITY_CHECKABLE_EXTS.has(df.extension) && df.size > 0)
        .map(df => df.path);

      try {
        const reports = await checkFilesIntegrityNative(checkablePaths);
        const reportByPath = new Map(reports.map(r => [r.path, r]));

        results.forEach((r, idx) => {
          const df = diskFiles[idx];
          const report = reportByPath.get(df.path);
          if (!report) return;
          r.integrityChecks = report.issues.map(i => ({ name: i.check, passed: false, detail: i.detail }));
          r.integrityIssues = report.issues.map(i => i.detail);
          if (!report.passed) {
            r.status = 'error';
            r.reason = report.issues[0]?.detail ?? r.reason;
          } else if (r.category === 'raw' && r.status === 'warning' && r.reason?.includes('byte-level')) {
            r.status = 'good';
            r.reason = '';
          }
        });
      } catch {
        // Integrity check failed — keep metadata-only results
      }
    }

    setScannedFiles(results.length);
    setProgress(100);

    if (activeProfile.requireRaw) applyWeddingPairing(results);
    if (activeProfile.burstMode) applyBurstGapDetection(results);
    finaliseScan(results, cardType, activeProfile);
  }, [setScanResult, addToHistory, settings]);

  const finaliseScan = (results: FileResult[], cardType: string, profile: ScanProfileConfig) => {
    let good = 0, warnings = 0, errors = 0;
    results.forEach(r => {
      if (r.status === 'good') good++;
      else if (r.status === 'warning') warnings++;
      else errors++;
    });
    const { score, urgency } = calculateScoreAndUrgency(good, warnings, errors, results.length, profile);
    const finalResult: ScanResult = {
      id: `scan-${Date.now()}`, files: results, totalFiles: results.length,
      good, warnings, errors, healthScore: score, urgency, scanDate: new Date(), cardType,
    };
    setScanResult(finalResult);
    addToHistory(finalResult);
    setIsScanning(false);
  };

  const cancelScan = useCallback(() => {
    cancelledRef.current = true;
    setIsScanning(false);
  }, []);

  return { startScan, startScanFromDisk, cancelScan, isScanning, progress, scannedFiles, totalFiles };
}
