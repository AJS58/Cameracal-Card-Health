import React, { useState, useEffect, useRef } from 'react';
import {
  HardDrive, FolderOpen, ShieldCheck, ShieldAlert, Play, CheckCircle2,
  AlertTriangle, Loader2, RefreshCw, FileImage, Film, FileQuestion,
  ChevronRight, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  isTauri,
  listVolumesNative,
  openCardFolderDialog,
  getDeviceForVolume,
  checkRecoveryAccess,
  recoverFiles,
  formatBytes,
  VolumeInfo,
  RecoveryProgress,
  RecoverySummary,
} from '@/lib/tauri-bridge';

const IN_TAURI = isTauri();

type Step = 'select-drive' | 'check-access' | 'select-output' | 'running' | 'done';

function StepIndicator({ current, step, label }: { current: Step; step: Step; label: string }) {
  const steps: Step[] = ['select-drive', 'check-access', 'select-output', 'running', 'done'];
  const ci = steps.indexOf(current);
  const si = steps.indexOf(step);
  const done    = si < ci;
  const active  = si === ci;
  const pending = si > ci;

  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
        style={{
          background: done
            ? 'hsl(142 71% 42%)'
            : active
              ? 'hsl(226 80% 60%)'
              : 'hsl(222 28% 18%)',
          color: pending ? 'hsl(226 30% 45%)' : 'white',
          border: active ? '2px solid hsl(226 80% 70%)' : '2px solid transparent',
        }}
      >
        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : si + 1}
      </div>
      <span
        className="text-sm font-medium"
        style={{ color: done ? 'hsl(142 71% 52%)' : active ? 'white' : 'hsl(226 20% 45%)' }}
      >
        {label}
      </span>
    </div>
  );
}

function FormatIcon({ format }: { format: string }) {
  if (format.includes('JPEG') || format.includes('PNG') || format.includes('RAW') || format.includes('RAF'))
    return <FileImage className="w-4 h-4 text-blue-400" />;
  if (format.includes('MP4') || format.includes('MOV'))
    return <Film className="w-4 h-4 text-purple-400" />;
  return <FileQuestion className="w-4 h-4 text-muted-foreground" />;
}

export default function FileRecovery() {
  const [step, setStep] = useState<Step>('select-drive');
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<VolumeInfo | null>(null);
  const [devicePath, setDevicePath] = useState('');
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [outputDir, setOutputDir] = useState('');
  const [progress, setProgress] = useState<RecoveryProgress | null>(null);
  const [result, setResult] = useState<RecoverySummary | null>(null);
  const [error, setError] = useState('');
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [loadingVolumes, setLoadingVolumes] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (IN_TAURI) loadVolumes();
    return () => { unlistenRef.current?.(); };
  }, []);

  async function loadVolumes() {
    setLoadingVolumes(true);
    try {
      const vols = await listVolumesNative();
      setVolumes(vols);
    } finally {
      setLoadingVolumes(false);
    }
  }

  async function handleSelectVolume(vol: VolumeInfo) {
    setSelectedVolume(vol);
    setHasAccess(null);
    setError('');
    try {
      const dev = await getDeviceForVolume(vol.path);
      setDevicePath(dev);
      setStep('check-access');
    } catch (e: unknown) {
      setError(`Could not determine device path: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleCheckAccess() {
    if (!devicePath) return;
    setCheckingAccess(true);
    setError('');
    try {
      const ok = await checkRecoveryAccess(devicePath);
      setHasAccess(ok);
      if (ok) setStep('select-output');
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setCheckingAccess(false);
    }
  }

  async function handlePickOutput() {
    const dir = await openCardFolderDialog();
    if (dir) {
      setOutputDir(dir);
    }
  }

  async function handleStartRecovery() {
    if (!devicePath || !outputDir) return;
    setStep('running');
    setError('');
    setProgress(null);
    setResult(null);

    // Subscribe to progress events
    try {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<RecoveryProgress>('recovery-progress', (event) => {
        setProgress(event.payload);
      });
      unlistenRef.current = unlisten;
    } catch {}

    try {
      const summary = await recoverFiles(devicePath, outputDir);
      setResult(summary);
      if (summary.error) setError(summary.error);
      setStep('done');
    } catch (e: unknown) {
      setError(`Recovery failed: ${e instanceof Error ? e.message : String(e)}`);
      setStep('done');
    } finally {
      unlistenRef.current?.();
    }
  }

  function handleReset() {
    setStep('select-drive');
    setSelectedVolume(null);
    setDevicePath('');
    setHasAccess(null);
    setOutputDir('');
    setProgress(null);
    setResult(null);
    setError('');
  }

  const pct = progress && progress.totalBytes > 0
    ? Math.round((progress.bytesScanned / progress.totalBytes) * 100)
    : 0;

  if (!IN_TAURI) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-16 animate-in fade-in">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'hsl(226 80% 60% / 0.12)', border: '1px solid hsl(226 80% 60% / 0.20)' }}
        >
          <HardDrive className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Desktop Only</h2>
          <p className="text-muted-foreground max-w-sm">
            File Recovery requires direct hardware access. Download the desktop app to use this feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">File Recovery</h1>
          <p className="text-muted-foreground mt-1.5">
            Scan a memory card sector-by-sector to recover deleted or corrupted photos and videos.
          </p>
        </div>
        {step !== 'select-drive' && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Start over
          </Button>
        )}
      </div>

      {/* Step tracker */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { step: 'select-drive'  as Step, label: 'Select card' },
          { step: 'check-access' as Step, label: 'Check access' },
          { step: 'select-output' as Step, label: 'Output folder' },
          { step: 'running'       as Step, label: 'Recover' },
          { step: 'done'          as Step, label: 'Done' },
        ].map((s, i, arr) => (
          <React.Fragment key={s.step}>
            <StepIndicator current={step} step={s.step} label={s.label} />
            {i < arr.length - 1 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step 1: Select drive ─────────────────────────────────────── */}
      {step === 'select-drive' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              Select your memory card
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose the card you want to recover files from. Removable drives are shown first.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingVolumes ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Detecting drives…
              </div>
            ) : volumes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No drives detected.</p>
            ) : (
              volumes.map((vol) => {
                const usedPct = vol.totalBytes > 0
                  ? Math.round(((vol.totalBytes - vol.availableBytes) / vol.totalBytes) * 100)
                  : 0;
                return (
                  <button
                    key={vol.path}
                    onClick={() => handleSelectVolume(vol)}
                    className="w-full text-left rounded-xl p-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{
                      background: 'hsl(222 28% 11%)',
                      border: vol.isRemovable
                        ? '1px solid hsl(226 80% 60% / 0.35)'
                        : '1px solid hsl(222 28% 18%)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <HardDrive className={`w-4 h-4 ${vol.isRemovable ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="font-semibold text-sm">{vol.name}</span>
                        {vol.isRemovable && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/40 text-primary">
                            Removable
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{vol.path}</span>
                    </div>
                    <div className="space-y-1">
                      <Progress value={usedPct} className="h-1.5" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{formatBytes(vol.totalBytes - vol.availableBytes)} used</span>
                        <span>{formatBytes(vol.totalBytes)} total · {vol.filesystem}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
            <Button variant="ghost" size="sm" onClick={loadVolumes} className="w-full mt-1">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh drives
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Check access ─────────────────────────────────────── */}
      {step === 'check-access' && selectedVolume && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Permission check
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Raw device access is required to recover deleted files from{' '}
              <span className="font-semibold text-foreground">{selectedVolume.name}</span>.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Device path display */}
            <div
              className="rounded-lg px-4 py-3 font-mono text-sm"
              style={{ background: 'hsl(222 28% 11%)', border: '1px solid hsl(222 28% 20%)' }}
            >
              <span className="text-muted-foreground text-xs uppercase tracking-wider block mb-1">Device</span>
              {devicePath}
            </div>

            {/* macOS instructions */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: 'hsl(226 80% 60% / 0.07)', border: '1px solid hsl(226 80% 60% / 0.18)' }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Info className="w-4 h-4 shrink-0" />
                macOS — Full Disk Access required
              </div>
              <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
                <li>Open <strong className="text-foreground">System Settings</strong> → <strong className="text-foreground">Privacy &amp; Security</strong></li>
                <li>Scroll to <strong className="text-foreground">Full Disk Access</strong></li>
                <li>Click <strong className="text-foreground">+</strong> and add <strong className="text-foreground">Cameracal Card Health</strong></li>
                <li>Return here and click <em>Check access</em> below</li>
              </ol>
              <p className="text-xs text-muted-foreground pt-1">
                Windows: right-click the app and choose <em>Run as administrator</em>, then restart.
              </p>
            </div>

            {hasAccess === false && (
              <div
                className="rounded-lg p-4 flex items-start gap-3"
                style={{ background: 'hsl(0 72% 51% / 0.08)', border: '1px solid hsl(0 72% 51% / 0.25)' }}
              >
                <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-destructive">Access denied</p>
                  <p className="text-muted-foreground mt-0.5">
                    The app cannot read <code className="text-xs">{devicePath}</code>. Follow the steps above, then try again.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              onClick={handleCheckAccess}
              disabled={checkingAccess}
              className="w-full"
            >
              {checkingAccess
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking…</>
                : <><ShieldCheck className="w-4 h-4 mr-2" /> Check access</>
              }
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Select output folder ─────────────────────────────── */}
      {step === 'select-output' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              Choose recovery output folder
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Recovered files will be saved here. Pick a folder on a different drive to the card being scanned.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="rounded-xl p-5 flex items-center gap-4 cursor-pointer hover:border-primary/40 transition-colors"
              style={{ background: 'hsl(222 28% 11%)', border: `1px solid ${outputDir ? 'hsl(142 71% 42% / 0.4)' : 'hsl(222 28% 20%)'}` }}
              onClick={handlePickOutput}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: outputDir ? 'hsl(142 71% 42% / 0.15)' : 'hsl(222 28% 18%)' }}
              >
                <FolderOpen className={`w-5 h-5 ${outputDir ? 'text-green-400' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {outputDir ? 'Folder selected' : 'Click to choose folder…'}
                </p>
                {outputDir && (
                  <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{outputDir}</p>
                )}
              </div>
              {outputDir && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
            </div>

            {/* Warning */}
            <div
              className="rounded-lg p-3 flex items-start gap-2"
              style={{ background: 'hsl(38 92% 50% / 0.07)', border: '1px solid hsl(38 92% 50% / 0.20)' }}
            >
              <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Recovery from a 64 GB card can take 20–40 minutes and produce several GB of data.
                Make sure there's enough space on the destination drive.
              </p>
            </div>

            <Button
              onClick={handleStartRecovery}
              disabled={!outputDir}
              className="w-full"
              size="lg"
            >
              <Play className="w-4 h-4 mr-2" />
              Start recovery scan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Running ──────────────────────────────────────────── */}
      {step === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Recovery in progress
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Scanning {devicePath} sector by sector. Do not eject the card.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {progress ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{progress.currentAction}</span>
                    <span className="font-mono font-semibold">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground font-mono">
                    <span>{formatBytes(progress.bytesScanned)} scanned</span>
                    <span>{formatBytes(progress.totalBytes)} total</span>
                  </div>
                </div>

                <div
                  className="rounded-xl p-4 flex items-center gap-4"
                  style={{ background: 'hsl(226 80% 60% / 0.08)', border: '1px solid hsl(226 80% 60% / 0.18)' }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'hsl(226 80% 60% / 0.15)' }}
                  >
                    <span className="text-xl font-black text-primary">{progress.filesFound}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Files found so far</p>
                    <p className="text-xs text-muted-foreground">Saving to: {outputDir}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting scan…
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 5: Done ────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="space-y-6">
          {/* Summary card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {result?.error || error
                  ? <ShieldAlert className="w-4 h-4 text-destructive" />
                  : <CheckCircle2 className="w-4 h-4 text-green-400" />
                }
                Recovery complete
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(result?.error || error) && (
                <div
                  className="rounded-lg p-3 text-sm"
                  style={{ background: 'hsl(0 72% 51% / 0.08)', border: '1px solid hsl(0 72% 51% / 0.25)', color: 'hsl(0 72% 65%)' }}
                >
                  {result?.error ?? error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Files found',    value: String(result?.filesFound ?? 0) },
                  { label: 'Data scanned',   value: formatBytes(result?.bytesScanned ?? 0) },
                  { label: 'Files saved',    value: String(result?.recovered.length ?? 0) },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl p-4 text-center"
                    style={{ background: 'hsl(222 28% 11%)', border: '1px solid hsl(222 28% 18%)' }}
                  >
                    <p className="text-2xl font-black text-primary">{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {result && result.recovered.length === 0 && !result.error && (
                <div
                  className="rounded-lg p-4 flex items-start gap-3"
                  style={{ background: 'hsl(38 92% 50% / 0.07)', border: '1px solid hsl(38 92% 50% / 0.20)' }}
                >
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    No files were found. The card data may have been overwritten, or the card
                    uses a format not yet supported (e.g. exFAT encrypted volumes).
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={handleReset}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Recover another card
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recovered file list */}
          {result && result.recovered.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Recovered files
                  <Badge variant="secondary">{result.recovered.length}</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Saved to: <span className="font-mono text-xs">{outputDir}</span>
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                  {result.recovered.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                      style={{ background: i % 2 === 0 ? 'hsl(222 28% 10%)' : 'transparent' }}
                    >
                      <FormatIcon format={file.format} />
                      <span className="flex-1 text-sm font-mono truncate">{file.filename}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{file.format}</Badge>
                      <span className="text-xs text-muted-foreground shrink-0 font-mono w-20 text-right">
                        {formatBytes(file.sizeBytes)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
