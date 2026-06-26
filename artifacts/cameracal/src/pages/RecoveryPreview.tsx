import React, { useState } from 'react';
import { useScanContext, FileResult } from '../context/ScanContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ShieldAlert, AlertTriangle, ShieldCheck, Film, Camera, FileQuestion, ZoomIn, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function statusColor(status: FileResult['status']) {
  if (status === 'error') return 'hsl(0 72% 51%)';
  if (status === 'warning') return 'hsl(38 92% 50%)';
  return 'hsl(142 71% 42%)';
}

function statusGlow(status: FileResult['status']) {
  if (status === 'error') return 'hsl(0 72% 51% / 0.5)';
  if (status === 'warning') return 'hsl(38 92% 50% / 0.5)';
  return 'hsl(142 71% 42% / 0.35)';
}

function CategoryIcon({ category, className }: { category: FileResult['category']; className?: string }) {
  if (category === 'video') return <Film className={className} />;
  if (category === 'raw') return <Camera className={className} />;
  return <FileQuestion className={className} />;
}

interface LightboxProps {
  files: FileResult[];
  startIndex: number;
  onClose: () => void;
}

function Lightbox({ files, startIndex, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(startIndex);
  const file = files[idx];

  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(files.length - 1, i + 1));

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'hsl(222 40% 4% / 0.95)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>

      <div className="flex items-center gap-4 w-full max-w-5xl px-4" onClick={e => e.stopPropagation()}>
        <button
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30"
          onClick={prev}
          disabled={idx === 0}
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>

        <div className="flex-1 flex flex-col items-center gap-4">
          <div
            className="rounded-xl overflow-hidden"
            style={{
              maxHeight: '70vh',
              maxWidth: '100%',
              border: `2px solid ${statusColor(file.status)}`,
              boxShadow: `0 0 30px ${statusGlow(file.status)}`,
            }}
          >
            {file.thumbnailUrl ? (
              file.category === 'video' ? (
                <div className="relative">
                  <img
                    src={file.thumbnailUrl}
                    alt={file.name}
                    style={{ display: 'block', maxHeight: '70vh', objectFit: 'contain' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center">
                      <Film className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={file.thumbnailUrl}
                  alt={file.name}
                  style={{ display: 'block', maxHeight: '70vh', objectFit: 'contain' }}
                />
              )
            ) : (
              <div
                className="w-80 h-52 flex flex-col items-center justify-center gap-3"
                style={{ background: 'hsl(222 28% 14%)' }}
              >
                <CategoryIcon category={file.category} className="w-12 h-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No preview available</p>
              </div>
            )}
          </div>

          <div className="text-center space-y-1">
            <p className="font-semibold text-sm text-white">{file.name}</p>
            <div className="flex items-center justify-center gap-3 text-xs text-white/50">
              <span className="uppercase">{file.category}</span>
              <span>·</span>
              <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              {file.durationEstimate && <><span>·</span><span>{file.durationEstimate}</span></>}
            </div>
            {file.reason && (
              <p className="text-xs font-medium" style={{ color: statusColor(file.status) }}>{file.reason}</p>
            )}
          </div>

          <p className="text-xs text-white/30">{idx + 1} / {files.length}</p>
        </div>

        <button
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-30"
          onClick={next}
          disabled={idx === files.length - 1}
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
}

export default function RecoveryPreview() {
  const { scanResult } = useScanContext();
  const [lightbox, setLightbox] = useState<{ files: FileResult[]; index: number } | null>(null);

  if (!scanResult) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-16 animate-in fade-in">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'hsl(226 80% 60% / 0.12)', border: '1px solid hsl(226 80% 60% / 0.20)' }}
        >
          <ShieldCheck className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">No Scan Data</h2>
          <p className="text-muted-foreground">Run a scan first to see the integrity map and media gallery.</p>
        </div>
        <Link href="/analyse">
          <Button variant="outline">Go to Analyse</Button>
        </Link>
      </div>
    );
  }

  const hasIssues = scanResult.errors > 0 || scanResult.warnings > 0;

  const mediaFiles = scanResult.files.filter(f =>
    f.category === 'jpeg' || f.category === 'png' || f.category === 'webp' || f.category === 'video'
  );
  const previewableFiles = mediaFiles.filter(f => f.thumbnailUrl);
  const videoFiles = scanResult.files.filter(f => f.category === 'video');
  const imageFiles = scanResult.files.filter(f =>
    f.category === 'jpeg' || f.category === 'png' || f.category === 'webp'
  );

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recovery Preview</h1>
        <p className="text-muted-foreground mt-1.5">
          Visual integrity map, image thumbnails, and video poster frames from scanned files.
        </p>
      </div>

      {/* Stats strip */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Images', count: imageFiles.length, color: 'hsl(226 80% 60%)' },
          { label: 'Videos', count: videoFiles.length, color: 'hsl(260 70% 60%)' },
          { label: 'With Preview', count: previewableFiles.length, color: 'hsl(142 71% 42%)' },
        ].map(({ label, count, color }) => (
          <div
            key={label}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: `${color}18`, border: `1px solid ${color}30`, color }}
          >
            {count} {label}
          </div>
        ))}
      </div>

      {hasIssues && (
        <div
          className="rounded-lg p-5 flex items-start gap-4"
          style={{
            background: 'hsl(0 72% 51% / 0.08)',
            border: '1px solid hsl(0 72% 51% / 0.20)',
            borderLeftWidth: '4px',
            borderLeftColor: 'hsl(0 72% 51%)',
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'hsl(0 72% 51% / 0.15)' }}
          >
            <ShieldAlert className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-bold text-destructive text-xs uppercase tracking-widest mb-1">Critical Safety Warning</h3>
            <p className="text-sm font-medium text-foreground mt-1">
              Stop using the card immediately. Do not format it or write any files back to it — doing so overwrites recoverable data permanently.
            </p>
          </div>
        </div>
      )}

      {/* Integrity grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">File Integrity Map</CardTitle>
          <p className="text-sm text-muted-foreground">
            Each tile represents one file. Click an image tile to preview it. Hover any tile for details.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {scanResult.files.map((file, i) => {
              const color = statusColor(file.status);
              const glow = statusGlow(file.status);
              const hasThumb = !!file.thumbnailUrl;
              const isClickable = hasThumb;

              return (
                <HoverCard key={i} openDelay={200} closeDelay={80}>
                  <HoverCardTrigger asChild>
                    <div
                      className="relative overflow-hidden transition-all"
                      style={{
                        width: hasThumb ? 48 : 20,
                        height: hasThumb ? 48 : 20,
                        borderRadius: hasThumb ? 8 : 4,
                        background: hasThumb ? 'transparent' : color,
                        border: `2px solid ${color}`,
                        cursor: isClickable ? 'pointer' : 'default',
                        flexShrink: 0,
                      }}
                      onClick={() => {
                        if (isClickable) {
                          setLightbox({ files: previewableFiles, index: previewableFiles.indexOf(file) });
                        }
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 10px ${glow}`;
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                      }}
                    >
                      {hasThumb && (
                        <>
                          <img
                            src={file.thumbnailUrl}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                          {file.category === 'video' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Film className="w-4 h-4 text-white drop-shadow" />
                            </div>
                          )}
                          {isClickable && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition-opacity">
                              <ZoomIn className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {file.status === 'good' && <ShieldCheck className="w-4 h-4 text-success shrink-0" />}
                        {file.status === 'warning' && <AlertTriangle className="w-4 h-4 text-warning shrink-0" />}
                        {file.status === 'error' && <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />}
                        <h4 className="font-medium text-sm truncate">{file.name}</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</div>
                        <div className="uppercase">Type: {file.category}</div>
                        {file.durationEstimate && (
                          <div className="col-span-2">Duration: {file.durationEstimate}</div>
                        )}
                      </div>
                      {file.reason && (
                        <div className="text-xs font-medium text-foreground bg-muted p-2 rounded">
                          {file.reason}
                        </div>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            {[
              { label: 'Good', count: scanResult.good, color: 'hsl(142 71% 42%)' },
              { label: 'Warning', count: scanResult.warnings, color: 'hsl(38 92% 50%)' },
              { label: 'Error', count: scanResult.errors, color: 'hsl(0 72% 51%)' },
            ].map(({ label, count, color }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: `${color}1a`, border: `1px solid ${color}40` }}
              >
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="text-xs font-medium">{label} <span className="text-muted-foreground">({count})</span></span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Image gallery */}
      {imageFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              Image Files
              <Badge variant="secondary">{imageFiles.length}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {previewableFiles.filter(f => f.category !== 'video').length} of {imageFiles.length} previews generated. Click any to enlarge.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-3">
              {imageFiles.map((file, i) => (
                <div
                  key={i}
                  className="space-y-1 group"
                  style={{ cursor: file.thumbnailUrl ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (file.thumbnailUrl) {
                      const imgPreviews = previewableFiles.filter(f => f.category !== 'video');
                      setLightbox({ files: imgPreviews, index: imgPreviews.indexOf(file) });
                    }
                  }}
                >
                  <div
                    className="aspect-square rounded-lg overflow-hidden relative flex items-center justify-center"
                    style={{
                      background: 'hsl(222 28% 14%)',
                      border: `2px solid ${statusColor(file.status)}`,
                      boxShadow: file.status !== 'good' ? `0 0 8px ${statusGlow(file.status)}` : undefined,
                    }}
                  >
                    {file.thumbnailUrl ? (
                      <>
                        <img src={file.thumbnailUrl} alt={file.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn className="w-5 h-5 text-white" />
                        </div>
                      </>
                    ) : (
                      <FileQuestion className="w-6 h-6 text-muted-foreground/40" />
                    )}
                    {file.status !== 'good' && (
                      <div
                        className="absolute top-1 right-1 w-2 h-2 rounded-full"
                        style={{ background: statusColor(file.status) }}
                      />
                    )}
                  </div>
                  <div className="text-[10px] text-center truncate text-muted-foreground leading-tight" title={file.name}>
                    {file.name}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video gallery */}
      {videoFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              Video Files
              <Badge variant="secondary">{videoFiles.length}</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Poster frames captured from browser-compatible clips (.mp4, .mov). Professional formats show metadata only.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videoFiles.map((file, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden group"
                  style={{
                    background: 'hsl(222 28% 14%)',
                    border: `1px solid ${statusColor(file.status)}40`,
                    cursor: file.thumbnailUrl ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (file.thumbnailUrl) {
                      const vidPreviews = previewableFiles.filter(f => f.category === 'video');
                      setLightbox({ files: vidPreviews, index: vidPreviews.indexOf(file) });
                    }
                  }}
                >
                  {/* Poster */}
                  <div
                    className="relative w-full flex items-center justify-center"
                    style={{ aspectRatio: '16/9', background: 'hsl(222 34% 10%)' }}
                  >
                    {file.thumbnailUrl ? (
                      <>
                        <img
                          src={file.thumbnailUrl}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-black/80 transition-colors">
                            <Film className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
                        <Film className="w-10 h-10" />
                        <span className="text-xs">No poster frame</span>
                      </div>
                    )}
                    {/* Status badge */}
                    <div
                      className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                      style={{
                        background: `${statusColor(file.status)}30`,
                        border: `1px solid ${statusColor(file.status)}60`,
                        color: statusColor(file.status),
                      }}
                    >
                      {file.status}
                    </div>
                    {file.durationEstimate && (
                      <div
                        className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                        style={{ background: 'hsl(222 40% 6% / 0.85)', color: 'white' }}
                      >
                        {file.durationEstimate}
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="p-3 space-y-1.5">
                    <p className="text-sm font-semibold truncate" title={file.name}>{file.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="uppercase font-semibold">{file.extension}</span>
                      <span>·</span>
                      <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                      {file.durationEstimate && (
                        <><span>·</span><span>{file.durationEstimate}</span></>
                      )}
                    </div>
                    {file.reason && (
                      <p
                        className="text-[11px] font-medium leading-tight"
                        style={{ color: statusColor(file.status) }}
                      >
                        {file.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          files={lightbox.files}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
