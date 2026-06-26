import React, { useState } from 'react';
import { useScanContext } from '../context/ScanContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import {
  CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldAlert,
  FileCheck2, FileSearch, HardDrive, Zap, RefreshCw, ChevronRight,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CheckItem {
  id: string;
  label: string;
  description: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  detail: string;
  weight: 'critical' | 'major' | 'minor';
}

type Verdict = 'GO' | 'CAUTION' | 'NO-GO';

function verdictFromChecks(checks: CheckItem[]): Verdict {
  const hasFail = checks.some(c => c.status === 'fail' && c.weight === 'critical');
  const hasMajorFail = checks.some(c => c.status === 'fail' && c.weight === 'major');
  const warnCount = checks.filter(c => c.status === 'warn').length;
  if (hasFail) return 'NO-GO';
  if (hasMajorFail || warnCount >= 2) return 'CAUTION';
  if (warnCount === 1) return 'CAUTION';
  return 'GO';
}

function runChecks(scanResult: NonNullable<ReturnType<typeof useScanContext>['scanResult']>): CheckItem[] {
  const { files, totalFiles, errors, warnings, good, healthScore } = scanResult;
  const checks: CheckItem[] = [];

  // 1. Zero-byte / corrupted files
  const zeroByteFiles = files.filter(f => f.size === 0);
  checks.push({
    id: 'zero-byte',
    label: 'Zero-byte files',
    description: 'Files with zero bytes are a strong indicator of card corruption or write failure.',
    status: zeroByteFiles.length > 0 ? 'fail' : 'pass',
    detail: zeroByteFiles.length > 0
      ? `${zeroByteFiles.length} zero-byte file${zeroByteFiles.length > 1 ? 's' : ''} detected: ${zeroByteFiles.slice(0, 3).map(f => f.name).join(', ')}${zeroByteFiles.length > 3 ? '…' : ''}`
      : 'No zero-byte files found.',
    weight: 'critical',
  });

  // 2. Error rate
  const errorRate = totalFiles > 0 ? errors / totalFiles : 0;
  checks.push({
    id: 'error-rate',
    label: 'Error rate',
    description: 'High error rate signals a card that may be failing. Even 1 error warrants caution.',
    status: errors > 0 ? (errorRate > 0.05 ? 'fail' : 'warn') : 'pass',
    detail: errors > 0
      ? `${errors} error${errors > 1 ? 's' : ''} across ${totalFiles} files (${(errorRate * 100).toFixed(1)}%)`
      : `0 errors detected across ${totalFiles} files.`,
    weight: errors > 3 ? 'critical' : 'major',
  });

  // 3. Warning volume
  const warnRate = totalFiles > 0 ? warnings / totalFiles : 0;
  checks.push({
    id: 'warnings',
    label: 'Warning volume',
    description: 'A high number of warnings (small files, unreadable headers) may indicate sector problems.',
    status: warnRate > 0.3 ? 'warn' : warnRate > 0 ? 'info' : 'pass',
    detail: warnings > 0
      ? `${warnings} warning${warnings > 1 ? 's' : ''} (${(warnRate * 100).toFixed(0)}% of files)`
      : 'No warnings detected.',
    weight: 'minor',
  });

  // 4. Health score threshold
  checks.push({
    id: 'health-score',
    label: 'Overall health score',
    description: 'A score below 90% suggests the card is not suitable for a critical shoot.',
    status: healthScore >= 95 ? 'pass' : healthScore >= 85 ? 'warn' : 'fail',
    detail: `Health score: ${healthScore}%. ${healthScore >= 95 ? 'Excellent — card is healthy.' : healthScore >= 85 ? 'Acceptable, but monitor closely.' : 'Below safe threshold for professional use.'}`,
    weight: 'major',
  });

  // 5. File variety (mix of types is expected for a real card)
  const categories = new Set(files.map(f => f.category));
  const hasMedia = categories.has('jpeg') || categories.has('raw') || categories.has('video') || categories.has('png') || categories.has('webp');
  checks.push({
    id: 'file-types',
    label: 'Known media file types',
    description: 'All files should be recognised media formats. Unknown file types may indicate filesystem issues.',
    status: hasMedia ? 'pass' : totalFiles === 0 ? 'warn' : 'info',
    detail: hasMedia
      ? `Recognised types: ${[...categories].filter(c => c !== 'other').join(', ')}.`
      : totalFiles === 0
        ? 'No files were scanned. Select files to run a readiness check.'
        : `Only unrecognised file types found. Ensure you selected the card's media folder.`,
    weight: 'minor',
  });

  // 6. Suspicious tiny JPEGs (possible truncated writes)
  const tinyJpegs = files.filter(f => (f.category === 'jpeg') && f.size > 0 && f.size < 10240);
  checks.push({
    id: 'tiny-jpegs',
    label: 'Truncated JPEG files',
    description: 'JPEG files under 10 KB are almost certainly truncated — they lost data mid-write.',
    status: tinyJpegs.length > 0 ? 'fail' : 'pass',
    detail: tinyJpegs.length > 0
      ? `${tinyJpegs.length} suspiciously small JPEG${tinyJpegs.length > 1 ? 's' : ''} found (< 10 KB each).`
      : 'No truncated JPEGs detected.',
    weight: 'critical',
  });

  // 7. RAW file presence (positive signal for pro shoot readiness)
  const rawFiles = files.filter(f => f.category === 'raw');
  const jpegFiles = files.filter(f => f.category === 'jpeg');
  checks.push({
    id: 'raw-coverage',
    label: 'RAW file coverage',
    description: 'For professional shoots, RAW files should be present. Mismatched RAW/JPEG counts may mean missed shots.',
    status: rawFiles.length > 0
      ? (jpegFiles.length > 0 && Math.abs(rawFiles.length - jpegFiles.length) > rawFiles.length * 0.1 ? 'warn' : 'pass')
      : 'info',
    detail: rawFiles.length > 0
      ? `${rawFiles.length} RAW file${rawFiles.length !== 1 ? 's' : ''}, ${jpegFiles.length} JPEG${jpegFiles.length !== 1 ? 's' : ''}${jpegFiles.length > 0 && Math.abs(rawFiles.length - jpegFiles.length) > rawFiles.length * 0.1 ? ' — counts differ by more than 10%.' : '.'}`
      : 'No RAW files present (JPEG-only or no media detected).',
    weight: 'minor',
  });

  return checks;
}

const statusIcon = (status: CheckItem['status']) => {
  switch (status) {
    case 'pass': return <CheckCircle2 className="w-5 h-5 text-success shrink-0" />;
    case 'warn': return <AlertTriangle className="w-5 h-5 text-warning shrink-0" />;
    case 'fail': return <XCircle className="w-5 h-5 text-destructive shrink-0" />;
    case 'info': return <Info className="w-5 h-5 text-primary shrink-0" />;
  }
};

const statusColor = {
  pass: 'hsl(142 71% 42%)',
  warn: 'hsl(38 92% 50%)',
  fail: 'hsl(0 72% 51%)',
  info: 'hsl(226 80% 60%)',
};

const weightLabel: Record<CheckItem['weight'], string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
};

const weightColors: Record<CheckItem['weight'], string> = {
  critical: 'hsl(0 72% 51%)',
  major: 'hsl(38 92% 50%)',
  minor: 'hsl(226 80% 60%)',
};

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const config = {
    GO: {
      bg: 'hsl(142 71% 42% / 0.12)',
      border: 'hsl(142 71% 42% / 0.35)',
      color: 'hsl(142 71% 55%)',
      glow: 'hsl(142 71% 42% / 0.25)',
      icon: <ShieldCheck className="w-8 h-8" />,
      title: 'GO',
      sub: 'Card is ready for your next shoot.',
    },
    CAUTION: {
      bg: 'hsl(38 92% 50% / 0.10)',
      border: 'hsl(38 92% 50% / 0.35)',
      color: 'hsl(38 92% 60%)',
      glow: 'hsl(38 92% 50% / 0.20)',
      icon: <AlertTriangle className="w-8 h-8" />,
      title: 'CAUTION',
      sub: 'Review warnings before your next shoot.',
    },
    'NO-GO': {
      bg: 'hsl(0 72% 51% / 0.10)',
      border: 'hsl(0 72% 51% / 0.35)',
      color: 'hsl(0 72% 60%)',
      glow: 'hsl(0 72% 51% / 0.20)',
      icon: <ShieldAlert className="w-8 h-8" />,
      title: 'NO-GO',
      sub: 'Do not use this card. Back up data immediately.',
    },
  }[verdict];

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
        <div className="text-3xl font-black tracking-widest">{config.title}</div>
        <div className="text-sm mt-1 opacity-80 font-medium">{config.sub}</div>
      </div>
    </div>
  );
}

export default function ReadinessCheck() {
  const { scanResult } = useScanContext();
  const [expanded, setExpanded] = useState<string | null>(null);

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
          <FileCheck2 className="w-16 h-16 text-primary" />
        </div>
        <div className="max-w-md space-y-3">
          <h2 className="text-2xl font-bold tracking-tight">No Scan Data Yet</h2>
          <p className="text-muted-foreground leading-relaxed">
            Run an analysis first. This tool evaluates your scan results against a professional pre-shoot readiness checklist.
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

  const checks = runChecks(scanResult);
  const verdict = verdictFromChecks(checks);
  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pre-Shoot Readiness Check</h1>
        <p className="text-muted-foreground mt-1.5">
          A professional checklist that evaluates your scan against {checks.length} criteria and gives a clear go/no-go verdict.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Verdict panel */}
        <div className="space-y-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
            <VerdictBadge verdict={verdict} />
          </motion.div>

          {/* Score summary */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Check Summary</div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-success"><CheckCircle2 className="w-4 h-4" /> Passed</span>
                <span className="font-bold text-success">{passCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-warning"><AlertTriangle className="w-4 h-4" /> Warnings</span>
                <span className="font-bold text-warning">{warnCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-destructive"><XCircle className="w-4 h-4" /> Failed</span>
                <span className="font-bold text-destructive">{failCount}</span>
              </div>
              <div className="h-px bg-border my-1"/>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Card scanned</span>
                <Badge variant="outline" className="text-xs">{scanResult.cardType}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Files checked</span>
                <span className="font-medium">{scanResult.totalFiles.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Link href="/analyse">
            <Button variant="outline" className="w-full gap-2 text-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Re-scan Card
            </Button>
          </Link>
        </div>

        {/* Checklist */}
        <div className="lg:col-span-2 space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-4">Readiness Checklist</div>
          <AnimatePresence>
            {checks.map((check, i) => {
              const isExpanded = expanded === check.id;
              const color = statusColor[check.status];
              return (
                <motion.div
                  key={check.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <button
                    className="w-full text-left rounded-xl overflow-hidden transition-all"
                    style={{
                      border: `1px solid ${isExpanded ? color + '55' : 'hsl(220 20% 18%)'}`,
                      background: isExpanded ? color + '0a' : 'hsl(222 28% 11%)',
                    }}
                    onClick={() => setExpanded(isExpanded ? null : check.id)}
                  >
                    <div className="flex items-center gap-3 p-4">
                      {statusIcon(check.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{check.label}</span>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                            style={{ background: weightColors[check.weight] + '22', color: weightColors[check.weight] }}
                          >
                            {weightLabel[check.weight]}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{check.detail}</p>
                      </div>
                      <ChevronRight
                        className="w-4 h-4 text-muted-foreground shrink-0 transition-transform"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                      />
                    </div>
                    {isExpanded && (
                      <div
                        className="px-4 pb-4 pt-0 text-sm text-muted-foreground border-t"
                        style={{ borderColor: color + '33' }}
                      >
                        <div className="flex items-start gap-2 pt-3">
                          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <p>{check.description}</p>
                        </div>
                        <div
                          className="mt-3 rounded-lg px-3 py-2 text-xs font-medium"
                          style={{ background: color + '12', color, border: `1px solid ${color}30` }}
                        >
                          {check.detail}
                        </div>
                      </div>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Actionable advice based on verdict */}
          {verdict !== 'GO' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card style={{
                border: verdict === 'NO-GO' ? '1px solid hsl(0 72% 51% / 0.3)' : '1px solid hsl(38 92% 50% / 0.3)',
                background: verdict === 'NO-GO' ? 'hsl(0 72% 51% / 0.05)' : 'hsl(38 92% 50% / 0.05)',
              }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: verdict === 'NO-GO' ? 'hsl(0 72% 60%)' : 'hsl(38 92% 60%)' }}>
                    <Zap className="w-4 h-4" />
                    {verdict === 'NO-GO' ? 'Immediate Actions Required' : 'Recommended Actions'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  {verdict === 'NO-GO' ? (
                    <ol className="list-decimal pl-4 space-y-1.5">
                      <li>Stop using this card immediately — do not shoot any more frames.</li>
                      <li>Back up any existing files to at least two separate destinations before anything else.</li>
                      <li>Do not format the card — formatting destroys the data recovery map.</li>
                      <li>Use the desktop version for sector-level diagnostics and recovery.</li>
                      <li>Retire the card from professional use.</li>
                    </ol>
                  ) : (
                    <ol className="list-decimal pl-4 space-y-1.5">
                      <li>Back up all existing files before the next shoot.</li>
                      <li>Consider formatting in-camera for a clean start.</li>
                      <li>Monitor the card closely — run another check after the next shoot.</li>
                      <li>Keep a spare card on the job in case issues worsen.</li>
                    </ol>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
