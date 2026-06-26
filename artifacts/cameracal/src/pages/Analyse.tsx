import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useScan } from '../hooks/useScan';
import { useScanContext, SCAN_PROFILES, ScanProfile } from '../context/ScanContext';
import { CardType, CardGraphic } from '../components/CardGraphic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload, FolderOpen, Play, X, FileImage, Film, ShieldAlert,
  CheckCircle2, AlertTriangle, ScanLine, Info, HardDrive, RefreshCw,
  Lock, ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  isTauri, openCardFolderDialog, scanDirectoryNative,
  listVolumesNative, VolumeInfo, formatBytes, usedPercent,
} from '../lib/tauri-bridge';
import type { DiskFile } from '../lib/tauri-bridge';

const CARD_TYPES: CardType[] = ['SD', 'microSD', 'CF', 'CFast', 'XQD', 'CFexpress'];
const IN_TAURI = isTauri();

export default function Analyse() {
  const [selectedCardType, setSelectedCardType] = useState<CardType>('SD');
  const [selectedFiles, setSelectedFiles] = useState<FileList | File[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Native desktop state
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [nativeFiles, setNativeFiles] = useState<DiskFile[] | null>(null);
  const [nativePath, setNativePath] = useState<string | null>(null);
  const [volumesLoading, setVolumesLoading] = useState(false);

  const { startScan, startScanFromDisk, cancelScan, isScanning, progress, scannedFiles, totalFiles } = useScan();
  const { scanResult, settings, setSettings } = useScanContext();

  const activeProfile = SCAN_PROFILES.find(p => p.id === settings.scanProfile)!;

  // Load connected drives when running in Tauri
  const refreshVolumes = useCallback(async () => {
    if (!IN_TAURI) return;
    setVolumesLoading(true);
    try {
      const vols = await listVolumesNative();
      setVolumes(vols);
    } finally {
      setVolumesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (IN_TAURI) refreshVolumes();
  }, [refreshVolumes]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
      setNativeFiles(null);
      setNativePath(null);
    }
  };

  const handleNativePicker = async () => {
    const chosenPath = await openCardFolderDialog();
    if (!chosenPath) return;
    setNativePath(chosenPath);
    setSelectedFiles(null);
    const files = await scanDirectoryNative(chosenPath);
    setNativeFiles(files);
  };

  const handleScan = () => {
    if (nativeFiles && IN_TAURI) {
      startScanFromDisk(nativeFiles, selectedCardType);
    } else if (selectedFiles) {
      startScan(selectedFiles, selectedCardType);
    }
  };

  const filesReady = IN_TAURI ? nativeFiles !== null : selectedFiles !== null;
  const fileCount = IN_TAURI ? (nativeFiles?.length ?? 0) : (selectedFiles?.length ?? 0);

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analyse Memory Card</h1>
        <p className="text-muted-foreground mt-1.5">Select your card type, scan profile, and files to analyse.</p>
      </div>

      {/* Connected Drives — Tauri only */}
      {IN_TAURI && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold">Connected Drives</span>
              </div>
              <button
                onClick={refreshVolumes}
                disabled={volumesLoading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${volumesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {volumes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {volumesLoading ? 'Detecting drives…' : 'No drives detected. Insert a memory card and refresh.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {volumes.map(vol => {
                  const used = usedPercent(vol);
                  const isSelected = nativePath?.startsWith(vol.path);
                  return (
                    <button
                      key={vol.path}
                      onClick={async () => {
                        if (isScanning) return;
                        // Scan the root of this drive directly
                        setNativePath(vol.path);
                        setSelectedFiles(null);
                        const files = await scanDirectoryNative(vol.path);
                        setNativeFiles(files);
                      }}
                      disabled={isScanning}
                      className="text-left p-3 rounded-xl border-2 transition-all disabled:opacity-50"
                      style={{
                        borderColor: isSelected ? 'hsl(226 80% 60%)' : 'hsl(220 20% 18%)',
                        background: isSelected ? 'hsl(226 80% 60% / 0.10)' : 'hsl(222 28% 10%)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold truncate pr-2">{vol.name}</span>
                        {vol.isRemovable && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: 'hsl(226 80% 60% / 0.18)', color: 'hsl(226 80% 72%)' }}>
                            CARD
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2 font-mono truncate">{vol.path}</div>
                      <div className="w-full rounded-full overflow-hidden mb-1" style={{ height: 3, background: 'hsl(220 20% 18%)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${used}%`,
                            background: used > 90 ? 'hsl(0 72% 51%)' : used > 70 ? 'hsl(38 92% 50%)' : 'hsl(226 80% 60%)',
                          }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{formatBytes(vol.totalBytes - vol.availableBytes)} used</span>
                        <span>{formatBytes(vol.totalBytes)} total · {vol.filesystem}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardContent className="p-5 space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">Card Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {CARD_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedCardType(type)}
                      disabled={isScanning}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all disabled:opacity-50"
                      style={{
                        borderColor: selectedCardType === type ? 'hsl(226 80% 60%)' : 'hsl(220 20% 18%)',
                        background: selectedCardType === type ? 'hsl(226 80% 60% / 0.10)' : 'hsl(222 28% 10%)',
                        boxShadow: selectedCardType === type ? '0 0 14px hsl(226 80% 60% / 0.18)' : 'none',
                      }}
                    >
                      <div style={{ width: 52, height: 38 }}>
                        <CardGraphic type={type} style={{ width: '100%', height: '100%' }} />
                      </div>
                      <span
                        className="text-[11px] font-bold leading-tight text-center"
                        style={{ color: selectedCardType === type ? 'hsl(226 80% 72%)' : 'hsl(220 10% 50%)' }}
                      >
                        {type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl overflow-hidden flex items-center justify-center py-4"
                style={{ background: 'hsl(222 28% 10%)', border: '1px solid hsl(220 20% 16%)' }}>
                <CardGraphic type={selectedCardType} style={{ height: 110 }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Scan Profile</label>
              <div className="space-y-2">
                {SCAN_PROFILES.map(profile => (
                  <button
                    key={profile.id}
                    onClick={() => setSettings({ ...settings, scanProfile: profile.id })}
                    disabled={isScanning}
                    className="w-full text-left p-3 rounded-lg border-2 transition-all disabled:opacity-50"
                    style={{
                      borderColor: settings.scanProfile === profile.id ? 'hsl(226 80% 60%)' : 'hsl(220 20% 16%)',
                      background: settings.scanProfile === profile.id ? 'hsl(226 80% 60% / 0.08)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold"
                        style={{ color: settings.scanProfile === profile.id ? 'hsl(226 80% 72%)' : 'inherit' }}>
                        {profile.label}
                      </span>
                      {settings.scanProfile === profile.id && (
                        <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(226 80% 60%)' }} />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{profile.description}</p>
                  </button>
                ))}
              </div>
              {activeProfile && (
                <div className="flex items-start gap-2 text-[11px] text-muted-foreground px-1">
                  <Info className="w-3 h-3 shrink-0 mt-0.5 text-primary" />
                  <span>
                    {activeProfile.requireRaw && 'Checks RAW+JPEG pairs. '}
                    {activeProfile.strictVideo && 'Strict video validation. '}
                    {activeProfile.burstMode && 'Checks burst sequence gaps. '}
                    Warn threshold: {activeProfile.warningThreshold === 0 ? 'zero tolerance' : `>${activeProfile.warningThreshold}%`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              <label className="text-sm font-semibold block">
                {IN_TAURI ? 'Select Card or Folder' : 'Select Files to Scan'}
              </label>

              <div className="flex flex-col sm:flex-row gap-4">
                <input type="file" multiple className="hidden" ref={fileInputRef}
                  onChange={handleFileSelect} disabled={isScanning} />
                <input type="file"
                  // @ts-ignore
                  webkitdirectory="true" directory=""
                  className="hidden" ref={folderInputRef}
                  onChange={handleFileSelect} disabled={isScanning} />

                {/* Native folder picker — Tauri only */}
                {IN_TAURI && (
                  <button
                    className="flex-1 flex flex-col items-center justify-center gap-3 h-28 rounded-xl border-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: nativePath ? 'hsl(226 80% 60% / 0.7)' : 'hsl(220 20% 22%)',
                      background: nativePath ? 'hsl(226 80% 60% / 0.08)' : 'hsl(222 28% 11%)',
                    }}
                    onClick={handleNativePicker}
                    disabled={isScanning}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: 'hsl(226 80% 60% / 0.15)' }}>
                      <HardDrive className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-center px-3">
                      <div className="text-sm font-semibold">
                        {nativePath ? 'Change Folder' : 'Open Card Folder'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">
                        {nativePath ?? 'Native folder picker'}
                      </div>
                    </div>
                  </button>
                )}

                {/* Browser file pickers */}
                {!IN_TAURI && (
                  <>
                    <button
                      className="flex-1 flex flex-col items-center justify-center gap-3 h-28 rounded-xl border-2 border-dashed transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: 'hsl(220 20% 22%)', background: 'hsl(222 28% 11%)' }}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isScanning}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = 'hsl(226 80% 60% / 0.7)';
                        el.style.boxShadow = '0 0 18px hsl(226 80% 60% / 0.12)';
                        el.style.background = 'hsl(226 80% 60% / 0.06)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = 'hsl(220 20% 22%)';
                        el.style.boxShadow = 'none';
                        el.style.background = 'hsl(222 28% 11%)';
                      }}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'hsl(226 80% 60% / 0.15)' }}>
                        <Upload className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold">Select Files</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Choose individual files</div>
                      </div>
                    </button>

                    <button
                      className="flex-1 flex flex-col items-center justify-center gap-3 h-28 rounded-xl border-2 border-dashed transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: 'hsl(220 20% 22%)', background: 'hsl(222 28% 11%)' }}
                      onClick={() => folderInputRef.current?.click()}
                      disabled={isScanning}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = 'hsl(226 80% 60% / 0.7)';
                        el.style.boxShadow = '0 0 18px hsl(226 80% 60% / 0.12)';
                        el.style.background = 'hsl(226 80% 60% / 0.06)';
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.borderColor = 'hsl(220 20% 22%)';
                        el.style.boxShadow = 'none';
                        el.style.background = 'hsl(222 28% 11%)';
                      }}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'hsl(226 80% 60% / 0.15)' }}>
                        <FolderOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold">Select Folder</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Scan an entire directory</div>
                      </div>
                    </button>
                  </>
                )}
              </div>

              {filesReady && !isScanning && (
                <div className="rounded-xl p-4 flex items-center justify-between"
                  style={{ background: 'hsl(226 80% 60% / 0.08)', border: '1px solid hsl(226 80% 60% / 0.20)' }}>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: 'hsl(226 80% 60% / 0.20)', color: 'hsl(226 80% 70%)' }}>
                      {fileCount}
                    </span>
                    <span className="text-sm font-medium">
                      files ready · <span className="text-muted-foreground">{activeProfile.label} profile</span>
                      {IN_TAURI && nativePath && (
                        <span className="text-muted-foreground"> · native scan</span>
                      )}
                    </span>
                  </div>
                  <Button size="sm" onClick={handleScan} className="gap-2 font-semibold"
                    style={{ boxShadow: '0 0 14px hsl(226 80% 60% / 0.25)' }}>
                    <Play className="w-3.5 h-3.5" /> Run Scan
                  </Button>
                </div>
              )}

              {isScanning && (
                <div className="rounded-xl p-5 space-y-4"
                  style={{ background: 'hsl(226 80% 60% / 0.06)', border: '1px solid hsl(226 80% 60% / 0.18)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ScanLine className="w-4 h-4 text-primary animate-pulse" />
                      <span className="text-sm font-semibold text-primary">Scanning…</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{scannedFiles} / {totalFiles} files</span>
                  </div>
                  <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'hsl(220 20% 18%)' }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, hsl(226 80% 55%), hsl(260 70% 60%))',
                        boxShadow: '0 0 8px hsl(226 80% 60% / 0.5)',
                      }} />
                  </div>
                  <Button variant="destructive" size="sm" onClick={cancelScan} className="w-full gap-2">
                    <X className="w-4 h-4" /> Cancel Scan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {scanResult && !isScanning && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight border-b border-border pb-3">Scan Results</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Files', value: scanResult.totalFiles, color: 'hsl(220 20% 18%)', border: 'hsl(220 20% 22%)', textClass: '' },
                { label: 'Good', value: scanResult.good, color: 'hsl(142 71% 42% / 0.10)', border: 'hsl(142 71% 42% / 0.25)', textClass: 'text-success' },
                { label: 'Warnings', value: scanResult.warnings, color: 'hsl(38 92% 50% / 0.10)', border: 'hsl(38 92% 50% / 0.25)', textClass: scanResult.warnings > 0 ? 'text-warning' : '' },
                { label: 'Errors', value: scanResult.errors, color: 'hsl(0 72% 51% / 0.10)', border: 'hsl(0 72% 51% / 0.25)', textClass: scanResult.errors > 0 ? 'text-destructive' : '' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4"
                  style={{ background: s.color, border: `1px solid ${s.border}` }}>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{s.label}</div>
                  <div className={`text-2xl font-bold ${s.textClass}`}>{s.value}</div>
                </div>
              ))}
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-base">Detected Files</h3>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {scanResult.files.some(f => f.integrityChecks) && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                        style={{ background: 'hsl(226 80% 60% / 0.12)', color: 'hsl(226 80% 70%)' }}>
                        <Lock className="w-2.5 h-2.5" />
                        deep scan
                      </span>
                    )}
                    <span>{scanResult.totalFiles} files</span>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto border rounded-lg divide-y divide-border">
                  {scanResult.files.map((file, i) => (
                    <div key={i}
                      className="p-3 text-sm transition-colors hover:bg-muted/40"
                      style={{ background: i % 2 === 0 ? 'transparent' : 'hsl(222 28% 11% / 0.5)' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {file.status === 'good'
                            ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                            : file.status === 'warning'
                            ? <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                            : <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />}
                          <span className="truncate font-medium">{file.name}</span>
                          <Badge variant="outline" className="text-xs uppercase shrink-0">{file.category}</Badge>
                          {file.integrityChecks && (
                            <span title="Deep header validation ran"
                              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity">
                              {file.integrityChecks.every(c => c.passed)
                                ? <ShieldCheck className="w-3.5 h-3.5 text-success" />
                                : <Lock className="w-3.5 h-3.5 text-destructive" />}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 shrink-0 text-muted-foreground">
                          <span className="font-mono text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          {file.reason && <span className="text-xs max-w-[180px] truncate" title={file.reason}>{file.reason}</span>}
                        </div>
                      </div>
                      {/* Integrity check detail rows */}
                      {file.integrityChecks && file.integrityChecks.length > 0 && (
                        <div className="mt-2 pl-7 flex flex-wrap gap-1.5">
                          {file.integrityChecks.map((chk, j) => (
                            <span key={j} title={chk.detail}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                              style={{
                                background: chk.passed ? 'hsl(142 71% 42% / 0.12)' : 'hsl(0 72% 51% / 0.12)',
                                color: chk.passed ? 'hsl(142 71% 55%)' : 'hsl(0 72% 65%)',
                                border: `1px solid ${chk.passed ? 'hsl(142 71% 42% / 0.25)' : 'hsl(0 72% 51% / 0.25)'}`,
                              }}>
                              {chk.passed ? '✓' : '✗'} {chk.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Failed integrity checks summary */}
            {scanResult.files.some(f => f.integrityIssues?.length) && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-1 text-base flex items-center gap-2">
                    <Lock className="w-4 h-4 text-destructive" />
                    Failed Integrity Checks
                    <Badge variant="destructive">
                      {scanResult.files.filter(f => f.integrityIssues?.length).length}
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    These files failed byte-level header validation — structural corruption detected.
                  </p>
                  <div className="space-y-3">
                    {scanResult.files.filter(f => f.integrityIssues?.length).map((file, i) => (
                      <div key={i} className="rounded-xl p-4"
                        style={{ background: 'hsl(0 72% 51% / 0.06)', border: '1px solid hsl(0 72% 51% / 0.20)' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
                          <span className="text-sm font-semibold truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0 font-mono">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                        <div className="space-y-2">
                          {file.integrityChecks?.map((chk, j) => (
                            <div key={j} className="flex items-start gap-2 text-xs">
                              <span className={chk.passed ? 'text-success mt-px' : 'text-destructive mt-px'}>
                                {chk.passed ? '✓' : '✗'}
                              </span>
                              <div>
                                <span className="font-semibold">{chk.name}</span>
                                {chk.detail && (
                                  <span className="text-muted-foreground ml-2">{chk.detail}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {scanResult.files.some(f => f.thumbnailUrl && f.category !== 'video') && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-1 text-base flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-primary" /> Image Previews
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {scanResult.files.filter(f => f.thumbnailUrl && f.category !== 'video').length} previews generated.
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                    {scanResult.files.filter(f => f.thumbnailUrl && f.category !== 'video').map((file, i) => (
                      <div key={i} className="space-y-1">
                        <div className="aspect-square rounded-md overflow-hidden"
                          style={{ border: `2px solid ${file.status === 'error' ? 'hsl(0 72% 51%)' : file.status === 'warning' ? 'hsl(38 92% 50%)' : 'hsl(142 71% 42% / 0.5)'}` }}>
                          <img src={file.thumbnailUrl} alt={file.name} className="object-cover w-full h-full" />
                        </div>
                        <div className="text-[10px] text-center truncate text-muted-foreground" title={file.name}>{file.name}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {scanResult.files.some(f => f.category === 'video') && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-1 text-base flex items-center gap-2">
                    <Film className="w-4 h-4 text-primary" /> Video Files
                    <Badge variant="secondary">{scanResult.files.filter(f => f.category === 'video').length}</Badge>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {scanResult.files.filter(f => f.category === 'video').map((file, i) => (
                      <div key={i} className="rounded-xl overflow-hidden"
                        style={{ background: 'hsl(222 28% 14%)', border: `1px solid ${file.status === 'error' ? 'hsl(0 72% 51% / 0.5)' : file.status === 'warning' ? 'hsl(38 92% 50% / 0.4)' : 'hsl(220 20% 22%)'}` }}>
                        <div className="relative flex items-center justify-center" style={{ aspectRatio: '16/9', background: 'hsl(222 34% 10%)' }}>
                          {file.thumbnailUrl ? (
                            <>
                              <img src={file.thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                                <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                                  <Film className="w-5 h-5 text-white" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                              <Film className="w-9 h-9" />
                              <span className="text-[11px]">No poster frame</span>
                            </div>
                          )}
                          {file.durationEstimate && (
                            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                              style={{ background: 'hsl(222 40% 6% / 0.85)', color: 'white' }}>
                              {file.durationEstimate}
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold truncate">{file.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="uppercase font-semibold">{file.extension}</span>
                            <span>·</span>
                            <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
