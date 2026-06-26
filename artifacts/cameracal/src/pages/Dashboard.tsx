import React, { useEffect, useState } from 'react';
import { useScanContext } from '../context/ScanContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, ShieldCheck, AlertTriangle, FileCheck2, Activity, Files, TriangleAlert, XCircle, Camera, Film, ImageIcon, FileQuestion } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

function AnimatedHealthRing({ score }: { score: number }) {
  const [displayed, setDisplayed] = useState(0);
  const size = 130;
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    let frame: ReturnType<typeof requestAnimationFrame>;
    let start: number | null = null;
    const duration = 900;

    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const filled = (displayed / 100) * circumference;
  const gap = circumference - filled;

  let strokeColor = '#22c55e';
  if (score < 98 && score >= 90) strokeColor = 'hsl(226 80% 60%)';
  if (score < 90 && score >= 75) strokeColor = 'hsl(38 92% 50%)';
  if (score < 75) strokeColor = 'hsl(0 72% 51%)';

  let textColor = '#22c55e';
  if (score < 98 && score >= 90) textColor = 'hsl(226 80% 70%)';
  if (score < 90 && score >= 75) textColor = 'hsl(38 92% 60%)';
  if (score < 75) textColor = 'hsl(0 72% 60%)';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={radius} fill="none"
            stroke="hsl(220 20% 15%)" strokeWidth={strokeWidth} />
          <circle cx={size/2} cy={size/2} r={radius} fill="none"
            stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={`${filled} ${gap}`}
            style={{ filter: `drop-shadow(0 0 8px ${strokeColor}70)`, transition: 'none' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black leading-none" style={{ color: textColor }}>{displayed}%</span>
          <span className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase tracking-widest">Health</span>
        </div>
      </div>
    </div>
  );
}

const PIE_COLORS = {
  jpeg: 'hsl(226 80% 60%)',
  raw:  'hsl(260 70% 60%)',
  video:'hsl(142 71% 45%)',
  png:  'hsl(190 70% 50%)',
  other:'hsl(220 15% 40%)',
};

const PIE_LABELS: Record<string, string> = {
  jpeg: 'JPEG', raw: 'RAW', video: 'Video', png: 'PNG', other: 'Other',
};

export default function Dashboard() {
  const { scanResult } = useScanContext();

  if (!scanResult) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-20">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-32 h-32 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, hsl(226 80% 60% / 0.12), hsl(226 80% 60% / 0.04))',
            border: '2px solid hsl(226 80% 60% / 0.22)',
            boxShadow: '0 0 48px hsl(226 80% 60% / 0.10)',
          }}
        >
          <Activity className="w-14 h-14 text-primary opacity-70" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-sm space-y-3"
        >
          <h2 className="text-2xl font-bold tracking-tight">No Scan Data Yet</h2>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Scan a memory card to see its health score, file breakdown, and recovery urgency — all analysed locally on your machine.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
          <Link href="/analyse">
            <Button size="lg" className="gap-2 px-8 font-semibold"
              style={{ boxShadow: '0 0 24px hsl(226 80% 60% / 0.30)' }}>
              <FileCheck2 className="w-4 h-4" /> Start Analysis
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  const getUrgencyPanel = () => {
    const configs = {
      safe: {
        bg: 'hsl(142 71% 42% / 0.08)',
        border: 'hsl(142 71% 42% / 0.25)',
        accent: 'hsl(142 71% 42%)',
        icon: <ShieldCheck className="w-5 h-5 text-success" />,
        label: 'Safe',
        labelColor: 'text-success',
        msg: 'No immediate recovery concern detected. Back up before reusing the card.',
        iconBg: 'hsl(142 71% 42% / 0.15)',
      },
      caution: {
        bg: 'hsl(38 92% 50% / 0.08)',
        border: 'hsl(38 92% 50% / 0.25)',
        accent: 'hsl(38 92% 50%)',
        icon: <AlertTriangle className="w-5 h-5 text-warning" />,
        label: 'Caution',
        labelColor: 'text-warning',
        msg: 'Some items need review. Do not reuse the card until files are backed up and checked.',
        iconBg: 'hsl(38 92% 50% / 0.15)',
      },
      warning: {
        bg: 'hsl(0 72% 51% / 0.08)',
        border: 'hsl(0 72% 51% / 0.25)',
        accent: 'hsl(0 72% 51%)',
        icon: <ShieldAlert className="w-5 h-5 text-destructive" />,
        label: 'Warning / High Risk',
        labelColor: 'text-destructive',
        msg: 'Potential file or card issue detected. Stop using the card and avoid writing anything back to it.',
        iconBg: 'hsl(0 72% 51% / 0.15)',
      },
    };
    const c = configs[scanResult.urgency];
    return (
      <div className="rounded-xl p-5 flex gap-4 items-start"
        style={{ background: c.bg, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.accent}` }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.iconBg }}>
          {c.icon}
        </div>
        <div>
          <h3 className={`font-bold text-xs uppercase tracking-widest mb-1 ${c.labelColor}`}>{c.label}</h3>
          <p className="text-sm text-foreground">{c.msg}</p>
        </div>
      </div>
    );
  };

  const categoryCounts = scanResult.files.reduce<Record<string, number>>((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(categoryCounts)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0);

  const categoryIcons: Record<string, React.ReactNode> = {
    jpeg: <Camera className="w-3.5 h-3.5" />,
    png:  <ImageIcon className="w-3.5 h-3.5" />,
    raw:  <Camera className="w-3.5 h-3.5" />,
    video:<Film className="w-3.5 h-3.5" />,
    other:<FileQuestion className="w-3.5 h-3.5" />,
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1.5">Overview of your most recent memory card health check.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.0 }}>
          <Card className="overflow-hidden h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Health Score</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pb-5 pt-1">
              <AnimatedHealthRing score={scanResult.healthScore} />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
          <Card className="overflow-hidden h-full" style={{ borderLeft: '3px solid hsl(226 80% 60%)' }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'hsl(226 80% 60% / 0.15)' }}>
                  <Files className="w-3.5 h-3.5 text-primary" />
                </div>
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Scanned</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{scanResult.totalFiles.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">files analysed</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
          <Card className="overflow-hidden h-full"
            style={{ borderLeft: `3px solid hsl(38 92% 50% / ${scanResult.warnings > 0 ? '1' : '0.3'})` }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'hsl(38 92% 50% / 0.15)' }}>
                  <TriangleAlert className="w-3.5 h-3.5 text-warning" />
                </div>
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Warnings</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${scanResult.warnings > 0 ? 'text-warning' : ''}`}>
                {scanResult.warnings.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">need review</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <Card className="overflow-hidden h-full"
            style={{ borderLeft: `3px solid hsl(0 72% 51% / ${scanResult.errors > 0 ? '1' : '0.3'})` }}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'hsl(0 72% 51% / 0.15)' }}>
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                </div>
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Errors</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${scanResult.errors > 0 ? 'text-destructive' : ''}`}>
                {scanResult.errors.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">critical issues</div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recovery Urgency</h2>
          {getUrgencyPanel()}

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Scan Details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm divide-y divide-border">
              <div className="flex justify-between py-3">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{scanResult.scanDate ? format(scanResult.scanDate, 'PPpp') : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-muted-foreground">Card Type</span>
                <span className="font-semibold">{scanResult.cardType}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-muted-foreground">Good Files</span>
                <span className="font-semibold text-success">{scanResult.good.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-muted-foreground">Warnings</span>
                <span className={`font-semibold ${scanResult.warnings > 0 ? 'text-warning' : ''}`}>{scanResult.warnings}</span>
              </div>
              <div className="flex justify-between py-3">
                <span className="text-muted-foreground">Errors</span>
                <span className={`font-semibold ${scanResult.errors > 0 ? 'text-destructive' : ''}`}>{scanResult.errors}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">File Breakdown</h2>
          <Card>
            <CardContent className="p-5">
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={70}
                        paddingAngle={3} dataKey="value" animationBegin={200} animationDuration={700}>
                        {pieData.map((entry) => (
                          <Cell key={entry.name}
                            fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] || PIE_COLORS.other}
                            stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'hsl(222 34% 10%)', border: '1px solid hsl(220 20% 22%)', borderRadius: 8, fontSize: 12 }}
                        formatter={(value: number, name: string) => [value, PIE_LABELS[name] || name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-1">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: PIE_COLORS[d.name as keyof typeof PIE_COLORS] || PIE_COLORS.other }} />
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            {categoryIcons[d.name]}
                            {PIE_LABELS[d.name] || d.name}
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-xs">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-8">No file data</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-center p-3 rounded-lg text-xs text-muted-foreground border"
        style={{ background: 'hsl(142 71% 42% / 0.05)', borderColor: 'hsl(142 71% 42% / 0.15)' }}>
        <ShieldCheck className="w-3.5 h-3.5 mr-2 text-success" />
        All analysis runs locally on your machine. No data is transmitted.
      </div>
    </div>
  );
}
