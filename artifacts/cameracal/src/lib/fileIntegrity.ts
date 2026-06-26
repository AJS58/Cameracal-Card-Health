/**
 * Deep file integrity validation — reads a tiny slice of bytes from each file
 * (header + tail + a mid-file sample) and checks format-specific magic numbers.
 *
 * Works in both browser mode (File objects) and Tauri native mode
 * (IntegrityReport returned by the Rust check_files_integrity command).
 *
 * Total bytes read per file: ≤ 284 bytes regardless of file size.
 */

export interface IntegrityCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface IntegrityResult {
  passed: boolean;
  issues: string[];
  checks: IntegrityCheck[];
}

/** Shape of the report returned by the Rust check_files_integrity command. */
export interface NativeIntegrityReport {
  path: string;
  passed: boolean;
  issues: Array<{ check: string; detail: string }>;
}

// ── Byte helpers ──────────────────────────────────────────────────────────────

function matchAt(bytes: Uint8Array, offset: number, pattern: number[]): boolean {
  if (offset + pattern.length > bytes.length) return false;
  return pattern.every((b, i) => bytes[offset + i] === b);
}

function containsPattern(bytes: Uint8Array, pattern: number[]): boolean {
  outer: for (let i = 0; i <= bytes.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (bytes[i + j] !== pattern[j]) continue outer;
    }
    return true;
  }
  return false;
}

function hex(bytes: Uint8Array, start: number, len: number): string {
  return Array.from(bytes.slice(start, Math.min(start + len, bytes.length)))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

function isZeroFilled(bytes: Uint8Array, threshold = 0.95): boolean {
  if (bytes.length === 0) return false;
  const zeros = bytes.reduce((n, b) => n + (b === 0 ? 1 : 0), 0);
  return zeros / bytes.length >= threshold;
}

async function readSlice(file: File, start: number, len: number): Promise<Uint8Array> {
  const end = Math.min(start + len, file.size);
  if (start >= file.size || end <= start) return new Uint8Array(0);
  const buf = await file.slice(start, end).arrayBuffer();
  return new Uint8Array(buf);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate a browser File object by reading ≤ 284 bytes from it.
 * Fast enough to run on every file in a scan batch.
 */
export async function validateBrowserFile(file: File): Promise<IntegrityResult> {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const header = await readSlice(file, 0, 16);
  const tail = await readSlice(file, Math.max(0, file.size - 12), 12);
  const sampleOffset = Math.floor(file.size * 0.3);
  const sample = await readSlice(file, sampleOffset, 256);
  return validateBytes(ext, file.size, header, tail, sample);
}

/**
 * Core validation logic — format-agnostic entry point that accepts
 * pre-read byte slices. Used by both browser and (indirectly) native modes.
 */
export function validateBytes(
  ext: string,
  size: number,
  header: Uint8Array,
  tail: Uint8Array,
  sample: Uint8Array,
): IntegrityResult {
  const checks: IntegrityCheck[] = [];
  const issues: string[] = [];

  // Zero-fill detection (all formats)
  if (size > 512 && isZeroFilled(sample)) {
    const msg = 'File interior is zero-filled — card write failure during capture';
    issues.push(msg);
    checks.push({ name: 'Zero-fill', passed: false, detail: 'Sampled region is >95% null bytes — typical of an interrupted card write' });
  }

  switch (ext) {
    case '.jpg':
    case '.jpeg': validateJpeg(header, tail, checks, issues); break;
    case '.png':  validatePng(header, tail, checks, issues);  break;
    case '.cr3':  validateCr3(header, checks, issues);        break;
    case '.raf':  validateRaf(header, checks, issues);        break;
    case '.x3f':  validateX3f(header, checks, issues);        break;
    case '.mp4':
    case '.mov':
    case '.m4v':  validateMp4(header, checks, issues);        break;
    case '.mxf':  validateMxf(header, checks, issues);        break;
    default:
      if (TIFF_RAW_EXTS.has(ext)) validateTiffRaw(ext, header, checks, issues);
  }

  return { passed: issues.length === 0, issues, checks };
}

// ── Format validators ─────────────────────────────────────────────────────────

function validateJpeg(
  header: Uint8Array, tail: Uint8Array,
  checks: IntegrityCheck[], issues: string[],
) {
  if (!matchAt(header, 0, [0xFF, 0xD8])) {
    const got = hex(header, 0, 2);
    issues.push(`Invalid JPEG header (got ${got}, expected FF D8)`);
    checks.push({ name: 'JPEG SOI marker', passed: false, detail: `File does not begin with FF D8 — got ${got}` });
    return;
  }
  checks.push({ name: 'JPEG SOI marker', passed: true, detail: 'FF D8 — Start of Image present' });

  // APP0 (JFIF) or APP1 (EXIF) immediately after SOI
  const hasApp = matchAt(header, 2, [0xFF, 0xE0]) || matchAt(header, 2, [0xFF, 0xE1]);
  if (!hasApp) {
    const got = hex(header, 2, 2);
    issues.push(`Missing JFIF/EXIF application header (got ${got})`);
    checks.push({ name: 'JPEG APP marker', passed: false, detail: `Expected FF E0 (JFIF) or FF E1 (EXIF) after SOI, got ${got}` });
  } else {
    const kind = matchAt(header, 2, [0xFF, 0xE0]) ? 'JFIF (FF E0)' : 'EXIF (FF E1)';
    checks.push({ name: 'JPEG APP marker', passed: true, detail: kind });
  }

  // EOI FF D9 must appear somewhere in the last 12 bytes
  if (!containsPattern(tail, [0xFF, 0xD9])) {
    issues.push('Missing JPEG EOI (FF D9) — file was truncated during write to card');
    checks.push({ name: 'JPEG EOI marker', passed: false, detail: 'FF D9 End of Image not found — file truncated during card write' });
  } else {
    checks.push({ name: 'JPEG EOI marker', passed: true, detail: 'FF D9 — End of Image present' });
  }
}

function validatePng(
  header: Uint8Array, tail: Uint8Array,
  checks: IntegrityCheck[], issues: string[],
) {
  const PNG_SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  if (!matchAt(header, 0, PNG_SIG)) {
    issues.push(`Invalid PNG signature (got ${hex(header, 0, 4)})`);
    checks.push({ name: 'PNG signature', passed: false, detail: 'File does not begin with the 8-byte PNG magic number' });
    return;
  }
  checks.push({ name: 'PNG signature', passed: true, detail: '89 50 4E 47 0D 0A 1A 0A — valid PNG magic' });

  // IEND chunk: 49 45 4E 44 AE 42 60 82
  const IEND = [0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];
  if (!containsPattern(tail, IEND)) {
    issues.push('Missing PNG IEND chunk — file was truncated during write to card');
    checks.push({ name: 'PNG IEND chunk', passed: false, detail: 'IEND chunk (49 45 4E 44 AE 42 60 82) not found — truncated write' });
  } else {
    checks.push({ name: 'PNG IEND chunk', passed: true, detail: 'IEND chunk present — file complete' });
  }
}

const TIFF_RAW_EXTS = new Set([
  '.cr2', '.nef', '.nrw', '.arw', '.sr2', '.srf', '.dng',
  '.pef', '.ptx', '.srw', '.mef', '.dcr', '.kdc', '.erf',
  '.rwl', '.raw', '.iiq', '.cap', '.3fr', '.fff', '.mrw',
  '.orf', '.rw2',
]);

function validateTiffRaw(
  ext: string, header: Uint8Array,
  checks: IntegrityCheck[], issues: string[],
) {
  // Little-endian TIFF variants: 49 49 + (2A|55|52) + any
  // Big-endian TIFF: 4D 4D 00 2A, or ORF big-endian: 4D 4D 52 4F
  const isLE = header[0] === 0x49 && header[1] === 0x49 &&
               (header[2] === 0x2A || header[2] === 0x55 || header[2] === 0x52);
  const isBE = header[0] === 0x4D && header[1] === 0x4D &&
               (header[3] === 0x2A || header[2] === 0x52);

  const label = ext.toUpperCase().slice(1);
  if (!isLE && !isBE) {
    const got = hex(header, 0, 4);
    issues.push(`Invalid ${label} header — expected TIFF magic bytes, got ${got}`);
    checks.push({ name: `${label} TIFF header`, passed: false, detail: `Expected 49 49 2A 00 (LE) or 4D 4D 00 2A (BE), got ${got}` });
  } else {
    checks.push({ name: `${label} TIFF header`, passed: true, detail: `Valid TIFF base (${isLE ? 'little-endian' : 'big-endian'})` });
  }
}

function validateCr3(header: Uint8Array, checks: IntegrityCheck[], issues: string[]) {
  // CR3 is ISO Base Media (MPEG-4): size (4 bytes) + "ftyp"
  const FTYP = [0x66, 0x74, 0x79, 0x70];
  if (!matchAt(header, 4, FTYP)) {
    issues.push(`Invalid CR3 header — ftyp box not found (got ${hex(header, 4, 4)})`);
    checks.push({ name: 'CR3 ftyp box', passed: false, detail: 'CR3 files must contain an ISO Base Media ftyp box at offset 4' });
  } else {
    checks.push({ name: 'CR3 ftyp box', passed: true, detail: 'ISO Base Media ftyp box present' });
  }
}

function validateRaf(header: Uint8Array, checks: IntegrityCheck[], issues: string[]) {
  // Fujifilm RAF: "FUJIFILM" at offset 0
  const FUJI = [0x46, 0x55, 0x4A, 0x49, 0x46, 0x49, 0x4C, 0x4D];
  if (!matchAt(header, 0, FUJI)) {
    issues.push(`Invalid RAF header — expected "FUJIFILM", got ${hex(header, 0, 8)}`);
    checks.push({ name: 'RAF FUJIFILM magic', passed: false, detail: 'RAF files must begin with ASCII "FUJIFILM"' });
  } else {
    checks.push({ name: 'RAF FUJIFILM magic', passed: true, detail: '"FUJIFILM" magic string present' });
  }
}

function validateX3f(header: Uint8Array, checks: IntegrityCheck[], issues: string[]) {
  // Sigma X3F: "FOVb" at offset 0
  const X3F = [0x46, 0x4F, 0x56, 0x62];
  if (!matchAt(header, 0, X3F)) {
    issues.push(`Invalid X3F header — expected "FOVb", got ${hex(header, 0, 4)}`);
    checks.push({ name: 'X3F FOVb magic', passed: false, detail: 'Sigma X3F files must begin with "FOVb"' });
  } else {
    checks.push({ name: 'X3F FOVb magic', passed: true, detail: '"FOVb" magic string present' });
  }
}

function validateMp4(header: Uint8Array, checks: IntegrityCheck[], issues: string[]) {
  const FTYP = [0x66, 0x74, 0x79, 0x70];
  if (!matchAt(header, 4, FTYP)) {
    issues.push(`Invalid MP4/MOV header — ftyp box not found (got ${hex(header, 4, 4)})`);
    checks.push({ name: 'MP4 ftyp box', passed: false, detail: 'MP4/MOV files must have an ftyp box at byte offset 4' });
  } else {
    checks.push({ name: 'MP4 ftyp box', passed: true, detail: 'ISO ftyp box present' });
  }
}

function validateMxf(header: Uint8Array, checks: IntegrityCheck[], issues: string[]) {
  // SMPTE MXF Universal Label: 06 0E 2B 34
  const MXF = [0x06, 0x0E, 0x2B, 0x34];
  if (!matchAt(header, 0, MXF)) {
    issues.push(`Invalid MXF header — expected SMPTE key 06 0E 2B 34, got ${hex(header, 0, 4)}`);
    checks.push({ name: 'MXF SMPTE key', passed: false, detail: 'MXF files must begin with SMPTE Universal Label 06 0E 2B 34' });
  } else {
    checks.push({ name: 'MXF SMPTE key', passed: true, detail: 'SMPTE Universal Label 06 0E 2B 34 present' });
  }
}
