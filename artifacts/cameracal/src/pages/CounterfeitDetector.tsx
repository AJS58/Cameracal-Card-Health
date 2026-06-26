import React, { useState, useMemo } from 'react';
import { useScanContext } from '../context/ScanContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import {
  ShieldAlert, ShieldCheck, AlertTriangle, FileSearch,
  HardDrive, Info, ChevronDown, ChevronUp, Layers,
} from 'lucide-react';
import { motion } from 'framer-motion';

// Nominal capacities in bytes for common card sizes
const CARD_SIZES_GB = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

function bytesFromGB(gb: number) {
  return gb * 1024 * 1024 * 1024;
}

function formatGB(bytes: number) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2);
}

function formatMB(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1);
}

interface CounterfeitResult {
  verdict: 'authentic' | 'suspect' | 'counterfeit' | 'insufficient';
  claimedGb: number | null;
  estimatedUsedBytes: number;
  totalFileBytes: number;
  fileCount: number;
  avgFileSizeMB: number;
  largestFileMB: number;
  riskScore: number; // 0-100, higher = more suspect
  signals: Signal[];
}

interface Signal {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'flag';
  detail: string;
  explanation: string;
}

function analyseCounterfeit(
  scanResult: NonNullable<ReturnType<typeof useScanContext>['scanResult']>,
  claimedGb: number | null
): CounterfeitResult {
  const { files, totalFiles } = scanResult;
  const signals: Signal[] = [];

  const totalFileBytes = files.reduce((sum, f) => sum + f.size, 0);
  const avgFileSizeMB = totalFiles > 0 ? totalFileBytes / totalFiles / 1024 / 1024 : 0;
  const largestFileMB = files.reduce((max, f) => Math.max(max, f.size), 0) / 1024 / 1024;

  let riskScore = 0;

  // ── Signal 1: File count vs claimed capacity ──────────────────────────────
  if (claimedGb && totalFiles > 0) {
    const claimedBytes = bytesFromGB(claimedGb);
    // Estimate card used capacity: files are typically stored at 95% of capacity before filling
    const estimatedUsedBytes = totalFileBytes;
    const usagePercent = (estimatedUsedBytes / claimedBytes) * 100;

    if (usagePercent > 110) {
      // Files claim to fit but total exceeds advertised capacity — classic fake card
      signals.push({
        id: 'capacity-exceeded',
        label: 'Total file size exceeds claimed capacity',
        status: 'flag',
        detail: `Files total ${formatGB(estimatedUsedBytes)} GB but card is labelled ${claimedGb} GB.`,
        explanation: 'Counterfeit cards use firmware tricks to report a larger capacity than the real flash storage. Files appear to write successfully but the data that exceeds real capacity is silently overwritten — typically the oldest files. This is the clearest sign of a fake card.',
      });
      riskScore += 60;
    } else if (usagePercent > 95) {
      signals.push({
        id: 'near-capacity',
        label: 'Card near full capacity',
        status: 'warn',
        detail: `${usagePercent.toFixed(0)}% of claimed ${claimedGb} GB is used.`,
        explanation: 'Card is near its stated capacity. This is not itself a counterfeit signal but increases the risk of data loss if the real flash is smaller than advertised.',
      });
      riskScore += 5;
    } else {
      signals.push({
        id: 'capacity-ok',
        label: 'File volume within declared capacity',
        status: 'ok',
        detail: `${formatGB(estimatedUsedBytes)} GB of files on a ${claimedGb} GB card (${usagePercent.toFixed(0)}% used).`,
        explanation: 'The total file size is comfortably within the card\'s labelled capacity. This does not guarantee authenticity, but rules out the most obvious capacity mismatch.',
      });
    }
  }

  // ── Signal 2: Suspiciously small average file size ─────────────────────────
  const mediaFiles = files.filter(f => ['jpeg', 'raw', 'video', 'png', 'webp'].includes(f.category));
  const mediaCount = mediaFiles.length;
  const avgMediaSizeMB = mediaCount > 0
    ? mediaFiles.reduce((s, f) => s + f.size, 0) / mediaCount / 1024 / 1024
    : 0;

  if (mediaCount > 5) {
    if (avgMediaSizeMB < 0.1) {
      signals.push({
        id: 'tiny-avg',
        label: 'Average media file size is abnormally tiny',
        status: 'flag',
        detail: `Average: ${avgMediaSizeMB.toFixed(3)} MB across ${mediaCount} media files.`,
        explanation: 'Counterfeit cards with inadequate real storage sometimes write only partial file data, resulting in extremely small files. Legitimate JPEGs are typically 3–25 MB; RAW files 20–80 MB.',
      });
      riskScore += 35;
    } else if (avgMediaSizeMB < 0.5) {
      signals.push({
        id: 'small-avg',
        label: 'Average media file size is unusually small',
        status: 'warn',
        detail: `Average: ${avgMediaSizeMB.toFixed(2)} MB across ${mediaCount} media files.`,
        explanation: 'Files are smaller than typical professional media. Could be web-sized JPEGs or thumbnails — or could indicate truncated writes on a fake card.',
      });
      riskScore += 15;
    } else {
      signals.push({
        id: 'avg-ok',
        label: 'Average file size is realistic',
        status: 'ok',
        detail: `Average: ${avgMediaSizeMB.toFixed(1)} MB across ${mediaCount} media files.`,
        explanation: 'File sizes are consistent with real camera-produced media, which rules out the truncated-write signature of many counterfeit cards.',
      });
    }
  } else if (totalFiles > 0) {
    signals.push({
      id: 'too-few',
      label: 'Too few files to assess file sizes',
      status: 'warn',
      detail: `Only ${mediaCount} recognised media files — need at least 5 for a reliable size analysis.`,
      explanation: 'Counterfeit detection requires a representative sample of files. Scan more files from the card for a meaningful assessment.',
    });
    riskScore += 5;
  }

  // ── Signal 3: Zero-byte cluster ───────────────────────────────────────────
  const zeroByteFiles = files.filter(f => f.size === 0);
  const zeroPct = totalFiles > 0 ? (zeroByteFiles.length / totalFiles) * 100 : 0;

  if (zeroPct > 20) {
    signals.push({
      id: 'zero-cluster',
      label: 'High proportion of zero-byte files',
      status: 'flag',
      detail: `${zeroByteFiles.length} zero-byte files (${zeroPct.toFixed(0)}% of all files).`,
      explanation: 'Counterfeit cards often appear to write data successfully but return zeros for any storage that exceeds their real capacity. A cluster of zero-byte files is a red flag.',
    });
    riskScore += 30;
  } else if (zeroPct > 5) {
    signals.push({
      id: 'some-zeros',
      label: 'Multiple zero-byte files detected',
      status: 'warn',
      detail: `${zeroByteFiles.length} zero-byte file${zeroByteFiles.length > 1 ? 's' : ''} (${zeroPct.toFixed(0)}% of all files).`,
      explanation: 'A small number of zero-byte files can occur from interrupted writes, but a notable proportion warrants investigation.',
    });
    riskScore += 15;
  } else if (zeroByteFiles.length === 0) {
    signals.push({
      id: 'no-zeros',
      label: 'No zero-byte files',
      status: 'ok',
      detail: 'Every file has a non-zero size.',
      explanation: 'The absence of zero-byte files is a positive signal. Counterfeit cards with fake capacity often silently produce zero-byte files for writes that exceed real storage.',
    });
  }

  // ── Signal 4: Sequential size drop (fake card signature) ─────────────────
  // Sort by lastModified and look for a sudden drop in file sizes
  const sortedByTime = [...files]
    .filter(f => f.lastModified && f.size > 0)
    .sort((a, b) => (a.lastModified ?? 0) - (b.lastModified ?? 0));

  if (sortedByTime.length >= 10) {
    const firstHalf = sortedByTime.slice(0, Math.floor(sortedByTime.length / 2));
    const secondHalf = sortedByTime.slice(Math.floor(sortedByTime.length / 2));
    const avgFirst = firstHalf.reduce((s, f) => s + f.size, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, f) => s + f.size, 0) / secondHalf.length;
    const dropRatio = avgFirst > 0 ? avgSecond / avgFirst : 1;

    if (dropRatio < 0.2) {
      signals.push({
        id: 'size-collapse',
        label: 'Sudden file size collapse over time',
        status: 'flag',
        detail: `Later files average ${formatMB(avgSecond)} MB vs earlier ${formatMB(avgFirst)} MB — an ${(100 - dropRatio * 100).toFixed(0)}% drop.`,
        explanation: 'Counterfeit cards write normally at first, then silently produce tiny or zero-byte files once real storage is exhausted. A dramatic size drop over shooting time is a strong counterfeit signature.',
      });
      riskScore += 40;
    } else if (dropRatio < 0.5) {
      signals.push({
        id: 'size-drop',
        label: 'Notable file size reduction over time',
        status: 'warn',
        detail: `Later files average ${formatMB(avgSecond)} MB vs earlier ${formatMB(avgFirst)} MB.`,
        explanation: 'File sizes decreased noticeably over time. This can be normal if you mixed shooting modes, but it can also be a sign of a counterfeit card running out of real storage.',
      });
      riskScore += 15;
    } else {
      signals.push({
        id: 'size-stable',
        label: 'File sizes consistent over time',
        status: 'ok',
        detail: `Earlier files: ~${formatMB(avgFirst)} MB avg. Later files: ~${formatMB(avgSecond)} MB avg.`,
        explanation: 'No suspicious size collapse was detected over the shooting timeline. Real counterfeit cards often show a dramatic size drop once their hidden storage limit is reached.',
      });
    }
  }

  // ── Determine verdict ────────────────────────────────────────────────────
  let verdict: CounterfeitResult['verdict'] = 'authentic';
  if (totalFiles < 3) {
    verdict = 'insufficient';
  } else if (riskScore >= 55) {
    verdict = 'counterfeit';
  } else if (riskScore >= 20) {
    verdict = 'suspect';
  }

  return {
    verdict,
    claimedGb,
    estimatedUsedBytes: totalFileBytes,
    totalFileBytes,
    fileCount: totalFiles,
    avgFileSizeMB,
    largestFileMB,
    riskScore,
    signals,
  };
}

const SIGNAL_ICONS = {
  ok: <ShieldCheck className="w-4 h-4 text-success" />,
  warn: <AlertTriangle className="w-4 h-4 text-warning" />,
  flag: <ShieldAlert className="w-4 h-4 text-destructive" />,
};

const SIGNAL_COLORS = {
  ok: 'hsl(142 71% 42%)',
  warn: 'hsl(38 92% 50%)',
  flag: 'hsl(0 72% 51%)',
};

function RiskMeter({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  let color = '#22c55e';
  if (clamped >= 55) color = 'hsl(0 72% 51%)';
  else if (clamped >= 20) color = 'hsl(38 92% 50%)';

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground font-medium">
        <span>Authenticity Risk</span>
        <span style={{ color }} className="font-bold">{clamped}/100</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'hsl(220 20% 18%)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            background: `linear-gradient(90deg, hsl(142 71% 42%), ${color})`,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Likely Genuine</span>
        <span>Suspect</span>
        <span>Counterfeit</span>
      </div>
    </div>
  );
}

function VerdictCard({ result }: { result: CounterfeitResult }) {
  const config = {
    authentic: {
      bg: 'hsl(142 71% 42% / 0.08)',
      border: 'hsl(142 71% 42% / 0.30)',
      color: 'hsl(142 71% 55%)',
      glow: 'hsl(142 71% 42% / 0.20)',
      icon: <ShieldCheck className="w-8 h-8" />,
      title: 'LIKELY GENUINE',
      sub: 'No counterfeit signatures detected.',
    },
    suspect: {
      bg: 'hsl(38 92% 50% / 0.08)',
      border: 'hsl(38 92% 50% / 0.30)',
      color: 'hsl(38 92% 60%)',
      glow: 'hsl(38 92% 50% / 0.18)',
      icon: <AlertTriangle className="w-8 h-8" />,
      title: 'SUSPECT',
      sub: 'Some anomalies detected — investigate further.',
    },
    counterfeit: {
      bg: 'hsl(0 72% 51% / 0.08)',
      border: 'hsl(0 72% 51% / 0.30)',
      color: 'hsl(0 72% 60%)',
      glow: 'hsl(0 72% 51% / 0.18)',
      icon: <ShieldAlert className="w-8 h-8" />,
      title: 'LIKELY COUNTERFEIT',
      sub: 'High-risk signals detected. Do not use for professional work.',
    },
    insufficient: {
      bg: 'hsl(226 80% 60% / 0.08)',
      border: 'hsl(226 80% 60% / 0.30)',
      color: 'hsl(226 80% 65%)',
      glow: 'hsl(226 80% 60% / 0.15)',
      icon: <Info className="w-8 h-8" />,
      title: 'INSUFFICIENT DATA',
      sub: 'Scan more files for a meaningful assessment.',
    },
  }[result.verdict];

  return (
    <div
      className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
      style={{
        background: config.bg,
        border: `2px solid ${config.border}`,
        boxShadow: `0 0 40px ${config.glow}`,
        color: config.color,
      }}
    >
      {config.icon}
      <div>
        <div className="text-2xl font-black tracking-widest">{config.title}</div>
        <div className="text-sm mt-1 opacity-80 font-medium">{config.sub}</div>
      </div>
    </div>
  );
}

export default function CounterfeitDetector() {
  const { scanResult } = useScanContext();
  const [claimedGbInput, setClaimedGbInput] = useState<string>('');
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);

  const claimedGb = useMemo(() => {
    const n = parseFloat(claimedGbInput);
    return isNaN(n) || n <= 0 ? null : n;
  }, [claimedGbInput]);

  const result = useMemo(() => {
    if (!scanResult) return null;
    return analyseCounterfeit(scanResult, claimedGb);
  }, [scanResult, claimedGb]);

  if (!scanResult) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in py-16">
        <div
          className="w-32 h-32 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, hsl(226 80% 60% / 0.15) 0%, hsl(260 70% 55% / 0.10) 100%)',
            border: '2px solid hsl(226 80% 60% / 0.25)',
            boxShadow: '0 0 40px hsl(226 80% 60% / 0.12)',
          }}
        >
          <Layers className="w-16 h-16 text-primary" />
        </div>
        <div className="max-w-md space-y-3">
          <h2 className="text-2xl font-bold tracking-tight">No Scan Data Yet</h2>
          <p className="text-muted-foreground leading-relaxed">
            Scan your card's files first. The counterfeit detector analyses file sizes, patterns, and capacity to identify fake cards.
          </p>
        </div>
        <Link href="/analyse">
          <Button size="lg" className="gap-2 px-8 font-semibold" style={{ boxShadow: '0 0 20px hsl(226 80% 60% / 0.30)' }}>
            <FileSearch className="w-4 h-4" /> Go to Analyse
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Counterfeit Card Detector</h1>
        <p className="text-muted-foreground mt-1.5">
          Analyses file size patterns and capacity against known counterfeit signatures — no other consumer tool does this.
        </p>
      </div>

      {/* How it works callout */}
      <button
        className="w-full text-left rounded-xl overflow-hidden transition-all"
        style={{
          border: '1px solid hsl(226 80% 60% / 0.20)',
          background: 'hsl(226 80% 60% / 0.05)',
        }}
        onClick={() => setShowHow(v => !v)}
      >
        <div className="flex items-center gap-3 p-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'hsl(226 80% 60% / 0.15)' }}>
            <Info className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">How counterfeit detection works</p>
            <p className="text-xs text-muted-foreground">Click to learn the four signals this tool checks</p>
          </div>
          {showHow ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
        {showHow && (
          <div className="px-4 pb-4 pt-0 text-sm text-muted-foreground space-y-2 border-t border-primary/10">
            <p className="pt-3">Fake memory cards use modified firmware to report a larger capacity than the actual flash storage. They write data that appears to succeed, but silently overwrite the oldest files once real storage runs out. Detection relies on four patterns:</p>
            <ol className="list-decimal pl-5 space-y-1.5">
              <li><strong className="text-foreground">Capacity mismatch</strong> — total file bytes vs labelled card size.</li>
              <li><strong className="text-foreground">File size anomalies</strong> — truncated files are far smaller than genuine camera output.</li>
              <li><strong className="text-foreground">Zero-byte clusters</strong> — counterfeit cards produce zero-byte files past their real capacity.</li>
              <li><strong className="text-foreground">Temporal size collapse</strong> — later files become dramatically smaller once real storage is exhausted.</li>
            </ol>
            <p className="text-xs pt-1 opacity-70">This is a heuristic analyser. A "likely genuine" result does not guarantee the card is authentic — it means none of the standard counterfeit signatures were found in this sample.</p>
          </div>
        )}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: inputs + verdict */}
        <div className="space-y-5">
          {/* Claimed capacity input */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-primary" />
                Labelled Card Capacity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Enter the GB printed on your card's label for capacity mismatch detection.</p>
              <div className="flex gap-2 flex-wrap">
                {[16, 32, 64, 128, 256, 512].map(gb => (
                  <button
                    key={gb}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
                    style={{
                      background: claimedGbInput === String(gb) ? 'hsl(226 80% 60% / 0.25)' : 'hsl(222 28% 14%)',
                      border: `1px solid ${claimedGbInput === String(gb) ? 'hsl(226 80% 60% / 0.5)' : 'hsl(220 20% 20%)'}`,
                      color: claimedGbInput === String(gb) ? 'hsl(226 80% 70%)' : 'hsl(220 10% 60%)',
                    }}
                    onClick={() => setClaimedGbInput(String(gb))}
                  >
                    {gb} GB
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className="flex-1 rounded-md px-3 py-2 text-sm bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Other (GB)…"
                  min="1"
                  max="2048"
                  value={claimedGbInput}
                  onChange={e => setClaimedGbInput(e.target.value)}
                />
                {claimedGbInput && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground px-2"
                    onClick={() => setClaimedGbInput('')}
                  >
                    Clear
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          {result && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">File Analysis Summary</div>
                {[
                  { label: 'Files scanned', value: result.fileCount.toLocaleString() },
                  { label: 'Total data', value: `${formatGB(result.totalFileBytes)} GB` },
                  { label: 'Avg file size', value: `${result.avgFileSizeMB.toFixed(1)} MB` },
                  { label: 'Largest file', value: `${result.largestFileMB.toFixed(1)} MB` },
                  ...(claimedGb ? [{ label: 'Claimed capacity', value: `${claimedGb} GB` }] : []),
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium font-mono">{row.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Verdict */}
          {result && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 180 }}>
              <VerdictCard result={result} />
              <div className="mt-4">
                <RiskMeter score={result.riskScore} />
              </div>
            </motion.div>
          )}
        </div>

        {/* Right: signals */}
        <div className="lg:col-span-2 space-y-3">
          {result && (
            <>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-4">
                Detection Signals ({result.signals.filter(s => s.status === 'flag').length} flags, {result.signals.filter(s => s.status === 'warn').length} warnings)
              </div>
              {result.signals.map((signal, i) => {
                const isExpanded = expandedSignal === signal.id;
                const color = SIGNAL_COLORS[signal.status];
                return (
                  <motion.div key={signal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <button
                      className="w-full text-left rounded-xl overflow-hidden transition-all"
                      style={{
                        border: `1px solid ${isExpanded ? color + '55' : 'hsl(220 20% 18%)'}`,
                        background: isExpanded ? color + '0a' : 'hsl(222 28% 11%)',
                      }}
                      onClick={() => setExpandedSignal(isExpanded ? null : signal.id)}
                    >
                      <div className="flex items-center gap-3 p-4">
                        {SIGNAL_ICONS[signal.status]}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-foreground">{signal.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{signal.detail}</div>
                        </div>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0"
                          style={{ background: color + '22', color }}
                        >
                          {signal.status === 'flag' ? 'FLAG' : signal.status === 'warn' ? 'WARN' : 'OK'}
                        </span>
                      </div>
                      {isExpanded && (
                        <div
                          className="px-4 pb-4 pt-0 text-sm text-muted-foreground border-t space-y-3"
                          style={{ borderColor: color + '33' }}
                        >
                          <div className="flex items-start gap-2 pt-3">
                            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <p>{signal.explanation}</p>
                          </div>
                          <div
                            className="rounded-lg px-3 py-2 text-xs font-medium"
                            style={{ background: color + '12', color, border: `1px solid ${color}30` }}
                          >
                            {signal.detail}
                          </div>
                        </div>
                      )}
                    </button>
                  </motion.div>
                );
              })}

              {result.verdict === 'counterfeit' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <Card style={{ border: '1px solid hsl(0 72% 51% / 0.3)', background: 'hsl(0 72% 51% / 0.05)' }}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> What to do now
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                      <ol className="list-decimal pl-4 space-y-1.5">
                        <li>Stop using the card immediately for any new work.</li>
                        <li>Back up all recoverable files — they may be overwritten if the card runs out of real storage.</li>
                        <li>Report the card to the retailer and platform (Amazon, eBay) if purchased there.</li>
                        <li>Buy replacement cards from authorised dealers (Sony, SanDisk, Lexar official stores).</li>
                        <li>Check the serial number against the manufacturer's verification tool if available.</li>
                      </ol>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
