/**
 * Tauri bridge — provides native desktop APIs with safe browser fallbacks.
 * All imports from @tauri-apps are dynamic so the browser bundle doesn't break.
 */

/** True when the app is running inside a Tauri native window. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// ── Types (mirror Rust structs) ───────────────────────────────────────────────

export interface DiskFile {
  name: string;
  path: string;
  size: number;
  modified: number; // Unix ms
  extension: string;
}

export interface VolumeInfo {
  name: string;
  path: string;
  totalBytes: number;
  availableBytes: number;
  filesystem: string;
  isRemovable: boolean;
}

// ── Commands ─────────────────────────────────────────────────────────────────

/**
 * Open a native folder picker and return the chosen path.
 * Returns null if cancelled or not in Tauri.
 */
export async function openCardFolderDialog(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({
    directory: true,
    multiple: false,
    title: 'Select Memory Card or Folder',
  });
  return typeof result === 'string' ? result : null;
}

/**
 * Recursively scan a directory path on disk and return file metadata.
 * Only available in Tauri — returns [] in browser.
 */
export async function scanDirectoryNative(path: string): Promise<DiskFile[]> {
  if (!isTauri()) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<DiskFile[]>('scan_directory', { path });
}

/**
 * List all mounted volumes / drives.
 * Removable drives (card readers) come first.
 */
export async function listVolumesNative(): Promise<VolumeInfo[]> {
  if (!isTauri()) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<VolumeInfo[]>('list_volumes');
}

/**
 * Return capacity and space info for the volume containing `path`.
 */
export async function getVolumeInfoNative(path: string): Promise<VolumeInfo | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<VolumeInfo>('get_volume_info', { path });
  } catch {
    return null;
  }
}

/**
 * Batch-check file headers for a list of absolute paths.
 * Reads ≤ 284 bytes per file (header + tail + mid-sample).
 * Returns [] in browser mode.
 */
export async function checkFilesIntegrityNative(
  paths: string[],
): Promise<import('./fileIntegrity').NativeIntegrityReport[]> {
  if (!isTauri() || paths.length === 0) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<import('./fileIntegrity').NativeIntegrityReport[]>('check_files_integrity', { paths });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format bytes as a human-readable string (KB / MB / GB). */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Return the percentage of disk space used (0–100). */
export function usedPercent(info: VolumeInfo): number {
  if (info.totalBytes === 0) return 0;
  return Math.round(((info.totalBytes - info.availableBytes) / info.totalBytes) * 100);
}
