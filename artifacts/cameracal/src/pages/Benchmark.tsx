import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardType, CardGraphic } from '../components/CardGraphic';
import { Gauge, Play, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CARD_SPECS: Record<CardType, { readMb: number; writeMb: number; label: string }> = {
  SD:        { readMb: 180,  writeMb: 130,  label: 'UHS-I V30 typical' },
  microSD:   { readMb: 160,  writeMb: 90,   label: 'UHS-I V30 typical' },
  CF:        { readMb: 120,  writeMb: 85,   label: 'UDMA 7 typical' },
  CFast:     { readMb: 525,  writeMb: 450,  label: 'CFast 2.0 typical' },
  XQD:       { readMb: 440,  writeMb: 400,  label: 'XQD G-Series typical' },
  CFexpress: { readMb: 1700, writeMb: 1200, label: 'CFexpress Type B typical' },
};

type Phase = 'idle' | 'read' | 'write' | 'done';

function SpeedBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-mono font-bold">{value > 0 ? `${value.toLocaleString()} MB/s` : '—'}</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'hsl(220 20% 18%)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
        />
      </div>
    </div>
  );
}

function RatingBadge({ actual, spec }: { actual: number; spec: number }) {
  const ratio = actual / spec;
  if (ratio >= 0.9) return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
      style={{ background: 'hsl(142 71% 42% / 0.12)', border: '1px solid hsl(142 71% 42% / 0.3)', color: 'hsl(142 71% 55%)' }}>
      <CheckCircle2 className="w-4 h-4" /> Meets specification
    </div>
  );
  if (ratio >= 0.7) return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
      style={{ background: 'hsl(38 92% 50% / 0.12)', border: '1px solid hsl(38 92% 50% / 0.3)', color: 'hsl(38 92% 55%)' }}>
      <AlertTriangle className="w-4 h-4" /> Below specification
    </div>
  );
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold"
      style={{ background: 'hsl(0 72% 51% / 0.12)', border: '1px solid hsl(0 72% 51% / 0.3)', color: 'hsl(0 72% 60%)' }}>
      <AlertTriangle className="w-4 h-4" /> Significantly below spec — possible counterfeit
    </div>
  );
}

const CARD_TYPES: CardType[] = ['SD', 'microSD', 'CF', 'CFast', 'XQD', 'CFexpress'];

export default function Benchmark() {
  const [cardType, setCardType] = useState<CardType>('SD');
  const [phase, setPhase] = useState<Phase>('idle');
  const [readSpeed, setReadSpeed] = useState(0);
  const [writeSpeed, setWriteSpeed] = useState(0);
  const [displayRead, setDisplayRead] = useState(0);
  const [displayWrite, setDisplayWrite] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spec = CARD_SPECS[cardType];

  const runBenchmark = () => {
    setPhase('read');
    setReadSpeed(0);
    setWriteSpeed(0);
    setDisplayRead(0);
    setDisplayWrite(0);

    const targetRead = Math.round(spec.readMb * (0.82 + Math.random() * 0.18));
    const targetWrite = Math.round(spec.writeMb * (0.78 + Math.random() * 0.20));

    let elapsed = 0;
    intervalRef.current = setInterval(() => {
      elapsed += 80;
      if (elapsed <= 2000) {
        setDisplayRead(Math.round((elapsed / 2000) * targetRead * (0.9 + Math.random() * 0.2)));
      } else if (elapsed === 2080) {
        setReadSpeed(targetRead);
        setDisplayRead(targetRead);
        setPhase('write');
      } else if (elapsed <= 4000) {
        setDisplayWrite(Math.round(((elapsed - 2000) / 2000) * targetWrite * (0.9 + Math.random() * 0.2)));
      } else {
        setWriteSpeed(targetWrite);
        setDisplayWrite(targetWrite);
        setPhase('done');
        clearInterval(intervalRef.current!);
      }
    }, 80);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const maxSpeed = Math.max(spec.readMb, spec.writeMb) * 1.1;

  return (
    <div className="space-y-8 pb-12 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Speed Benchmark</h1>
        <p className="text-muted-foreground mt-1.5">Measure actual read/write performance and compare against card specification.</p>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 rounded-lg text-sm"
        style={{ background: 'hsl(226 80% 60% / 0.08)', border: '1px solid hsl(226 80% 60% / 0.20)' }}>
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          <strong className="text-foreground">Desktop version:</strong> This will benchmark the actual inserted card via native disk I/O.
          The simulated preview below shows what to expect — real results will vary by card reader and USB speed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">1. Select Card Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {CARD_TYPES.map(type => (
              <button
                key={type}
                onClick={() => { setCardType(type); setPhase('idle'); setDisplayRead(0); setDisplayWrite(0); }}
                disabled={phase === 'read' || phase === 'write'}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all"
                style={{
                  borderColor: cardType === type ? 'hsl(226 80% 60%)' : 'hsl(220 20% 18%)',
                  background: cardType === type ? 'hsl(226 80% 60% / 0.10)' : 'hsl(222 28% 11%)',
                  boxShadow: cardType === type ? '0 0 16px hsl(226 80% 60% / 0.20)' : 'none',
                }}
              >
                <div style={{ width: 48, height: 36 }}>
                  <CardGraphic type={type} style={{ width: '100%', height: '100%' }} />
                </div>
                <span className="text-[11px] font-bold text-center leading-tight"
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
          <CardTitle className="text-base font-semibold">2. Run Benchmark</CardTitle>
          <CardDescription>{spec.label}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <SpeedBar value={phase === 'idle' ? 0 : displayRead} max={maxSpeed} color="hsl(226 80% 60%)" label="Sequential Read" />
            <SpeedBar value={phase === 'idle' || phase === 'read' ? 0 : displayWrite} max={maxSpeed} color="hsl(260 70% 60%)" label="Sequential Write" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg p-4 text-center" style={{ background: 'hsl(222 28% 14%)', border: '1px solid hsl(220 20% 20%)' }}>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Spec Read</div>
              <div className="text-xl font-bold text-primary">{spec.readMb.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">MB/s</span></div>
            </div>
            <div className="rounded-lg p-4 text-center" style={{ background: 'hsl(222 28% 14%)', border: '1px solid hsl(220 20% 20%)' }}>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Spec Write</div>
              <div className="text-xl font-bold" style={{ color: 'hsl(260 70% 65%)' }}>{spec.writeMb.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">MB/s</span></div>
            </div>
          </div>

          <AnimatePresence>
            {phase === 'done' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <RatingBadge actual={readSpeed} spec={spec.readMb} />
                <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <div>Read: <strong className="text-foreground">{Math.round((readSpeed/spec.readMb)*100)}%</strong> of spec</div>
                  <div>Write: <strong className="text-foreground">{Math.round((writeSpeed/spec.writeMb)*100)}%</strong> of spec</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={runBenchmark}
            disabled={phase === 'read' || phase === 'write'}
            className="w-full gap-2 font-semibold"
            style={{ boxShadow: phase === 'idle' || phase === 'done' ? '0 0 16px hsl(226 80% 60% / 0.25)' : 'none' }}
          >
            {phase === 'read' && <><Gauge className="w-4 h-4 animate-spin" /> Testing read speed…</>}
            {phase === 'write' && <><Gauge className="w-4 h-4 animate-spin" /> Testing write speed…</>}
            {(phase === 'idle' || phase === 'done') && <><Play className="w-4 h-4" /> {phase === 'done' ? 'Run Again' : 'Start Benchmark'}</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
