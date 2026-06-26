import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardType, CardGraphic } from '../components/CardGraphic';
import { AlertTriangle, ShieldAlert, CheckSquare, Square, HardDrive, CheckCircle2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CARD_TYPES: CardType[] = ['SD', 'microSD', 'CF', 'CFast', 'XQD', 'CFexpress'];

type FormatFS = 'exFAT' | 'FAT32';
type FormatPhase = 'idle' | 'confirming' | 'formatting' | 'done';

const FS_INFO: Record<FormatFS, { label: string; desc: string; recommended: string }> = {
  exFAT: {
    label: 'exFAT',
    desc: 'Recommended for cards larger than 32 GB. Supports files over 4 GB.',
    recommended: 'SD ≥64GB, CFast, XQD, CFexpress',
  },
  FAT32: {
    label: 'FAT32',
    desc: 'Maximum compatibility. Requires files to be under 4 GB.',
    recommended: 'SD ≤32GB, microSD ≤32GB',
  },
};

export default function SafeFormat() {
  const [cardType, setCardType] = useState<CardType>('SD');
  const [fs, setFs] = useState<FormatFS>('exFAT');
  const [phase, setPhase] = useState<FormatPhase>('idle');
  const [checkedBackup, setCheckedBackup] = useState(false);
  const [checkedRecovered, setCheckedRecovered] = useState(false);
  const [progress, setProgress] = useState(0);

  const canProceed = checkedBackup && checkedRecovered;

  const startFormat = () => {
    setPhase('formatting');
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 8 + 2;
      if (p >= 100) {
        setProgress(100);
        clearInterval(iv);
        setTimeout(() => setPhase('done'), 400);
      } else {
        setProgress(Math.round(p));
      }
    }, 120);
  };

  const reset = () => {
    setPhase('idle');
    setProgress(0);
    setCheckedBackup(false);
    setCheckedRecovered(false);
  };

  return (
    <div className="space-y-8 pb-12 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Safe Format</h1>
        <p className="text-muted-foreground mt-1.5">Format your memory card in the correct file system, with a safety confirmation step.</p>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-lg"
        style={{ background: 'hsl(0 72% 51% / 0.08)', border: '1px solid hsl(0 72% 51% / 0.25)' }}>
        <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-bold text-destructive">Formatting permanently erases all data on the card.</p>
          <p className="text-muted-foreground">
            Ensure all important files are backed up to at least two locations before proceeding.
            In the desktop version, this will directly format the physical card — this action cannot be undone.
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'done' ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <Card>
              <CardContent className="p-10 flex flex-col items-center text-center gap-5">
                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'hsl(142 71% 42% / 0.15)', border: '2px solid hsl(142 71% 42% / 0.4)' }}>
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Format Complete</h2>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {cardType} card formatted as {fs}. It's ready for use in-camera.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={reset} className="gap-2">
                    <RotateCcw className="w-4 h-4" /> Format Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : phase === 'formatting' ? (
          <motion.div key="formatting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardContent className="p-8 space-y-6">
                <div className="text-center space-y-2">
                  <HardDrive className="w-8 h-8 text-primary mx-auto animate-pulse" />
                  <h2 className="font-bold text-lg">Formatting {cardType} Card…</h2>
                  <p className="text-muted-foreground text-sm">Writing {fs} file system. Do not remove the card.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Progress</span>
                    <span className="font-mono">{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(220 20% 18%)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-150"
                      style={{
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, hsl(226 80% 55%), hsl(260 70% 60%))',
                        boxShadow: '0 0 8px hsl(226 80% 60% / 0.5)',
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">1. Select Card Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {CARD_TYPES.map(type => (
                    <button key={type} onClick={() => setCardType(type)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all"
                      style={{
                        borderColor: cardType === type ? 'hsl(226 80% 60%)' : 'hsl(220 20% 18%)',
                        background: cardType === type ? 'hsl(226 80% 60% / 0.10)' : 'hsl(222 28% 11%)',
                        boxShadow: cardType === type ? '0 0 16px hsl(226 80% 60% / 0.20)' : 'none',
                      }}>
                      <div style={{ width: 48, height: 36 }}>
                        <CardGraphic type={type} style={{ width: '100%', height: '100%' }} />
                      </div>
                      <span className="text-[11px] font-bold"
                        style={{ color: cardType === type ? 'hsl(226 80% 70%)' : 'hsl(220 10% 55%)' }}>
                        {type}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">2. Choose File System</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {(['exFAT', 'FAT32'] as FormatFS[]).map(f => (
                    <button key={f} onClick={() => setFs(f)}
                      className="p-4 rounded-xl border-2 text-left transition-all"
                      style={{
                        borderColor: fs === f ? 'hsl(226 80% 60%)' : 'hsl(220 20% 18%)',
                        background: fs === f ? 'hsl(226 80% 60% / 0.08)' : 'hsl(222 28% 11%)',
                      }}>
                      <div className="font-bold text-sm mb-1">{FS_INFO[f].label}</div>
                      <div className="text-xs text-muted-foreground">{FS_INFO[f].desc}</div>
                      <div className="text-[10px] mt-2 font-semibold" style={{ color: 'hsl(226 60% 60%)' }}>
                        Best for: {FS_INFO[f].recommended}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">3. Safety Confirmation</CardTitle>
                <CardDescription>You must confirm both statements before formatting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <button
                  onClick={() => setCheckedBackup(v => !v)}
                  className="w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all"
                  style={{
                    borderColor: checkedBackup ? 'hsl(142 71% 42% / 0.6)' : 'hsl(220 20% 18%)',
                    background: checkedBackup ? 'hsl(142 71% 42% / 0.08)' : 'hsl(222 28% 11%)',
                  }}>
                  {checkedBackup
                    ? <CheckSquare className="w-5 h-5 text-success shrink-0 mt-0.5" />
                    : <Square className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />}
                  <span className="text-sm font-medium">All files on this card have been backed up to at least two separate locations.</span>
                </button>

                <button
                  onClick={() => setCheckedRecovered(v => !v)}
                  className="w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all"
                  style={{
                    borderColor: checkedRecovered ? 'hsl(142 71% 42% / 0.6)' : 'hsl(220 20% 18%)',
                    background: checkedRecovered ? 'hsl(142 71% 42% / 0.08)' : 'hsl(222 28% 11%)',
                  }}>
                  {checkedRecovered
                    ? <CheckSquare className="w-5 h-5 text-success shrink-0 mt-0.5" />
                    : <Square className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />}
                  <span className="text-sm font-medium">I have reviewed the health scan results and recovered any critical files.</span>
                </button>

                <Button
                  onClick={() => setPhase('confirming')}
                  disabled={!canProceed}
                  variant="destructive"
                  className="w-full gap-2 font-semibold"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Format {cardType} Card as {fs}
                </Button>

                {phase === 'confirming' && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl p-5 space-y-4"
                    style={{ background: 'hsl(0 72% 51% / 0.10)', border: '2px solid hsl(0 72% 51% / 0.4)' }}>
                    <p className="font-bold text-destructive text-sm text-center">
                      Final confirmation — this will erase all data on the card.
                    </p>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => setPhase('idle')}>Cancel</Button>
                      <Button variant="destructive" className="flex-1 font-bold" onClick={startFormat}>
                        Yes, Format Now
                      </Button>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
