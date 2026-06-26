import React from 'react';
import { useScanContext } from '../context/ScanContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { History, Trash2, ShieldCheck, AlertTriangle, ShieldAlert, FileSearch } from 'lucide-react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

function UrgencyBadge({ urgency }: { urgency: 'safe' | 'caution' | 'warning' }) {
  if (urgency === 'safe') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
      style={{ background: 'hsl(142 71% 42% / 0.15)', color: 'hsl(142 71% 55%)' }}>
      <ShieldCheck className="w-3 h-3" /> Safe
    </span>
  );
  if (urgency === 'caution') return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
      style={{ background: 'hsl(38 92% 50% / 0.15)', color: 'hsl(38 92% 55%)' }}>
      <AlertTriangle className="w-3 h-3" /> Caution
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
      style={{ background: 'hsl(0 72% 51% / 0.15)', color: 'hsl(0 72% 60%)' }}>
      <ShieldAlert className="w-3 h-3" /> Warning
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const size = 44;
  const sw = 5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const color = score >= 98 ? '#22c55e' : score >= 90 ? 'hsl(226 80% 60%)' : score >= 75 ? 'hsl(38 92% 50%)' : 'hsl(0 72% 51%)';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(220 20% 18%)" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${(score/100)*circ} ${circ - (score/100)*circ}`}
          style={{ filter: `drop-shadow(0 0 4px ${color}80)` }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold" style={{ color }}>{score}%</span>
      </div>
    </div>
  );
}

export default function ScanHistory() {
  const { history: scanHistory, clearHistory, setScanResult } = useScanContext();

  if (scanHistory.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-8 py-24">
        <div className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{ background: 'hsl(226 80% 60% / 0.10)', border: '2px solid hsl(226 80% 60% / 0.20)' }}>
          <History className="w-12 h-12 text-primary opacity-50" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-xl font-bold">No Scan History</h2>
          <p className="text-muted-foreground text-sm">Completed scans will appear here. Run your first analysis to get started.</p>
        </div>
        <Link href="/analyse">
          <Button className="gap-2" style={{ boxShadow: '0 0 20px hsl(226 80% 60% / 0.25)' }}>
            <FileSearch className="w-4 h-4" /> Start Analysis
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scan History</h1>
          <p className="text-muted-foreground mt-1.5">{scanHistory.length} scan{scanHistory.length !== 1 ? 's' : ''} recorded in this session.</p>
        </div>
        <Button variant="outline" size="sm" onClick={clearHistory} className="gap-2 text-destructive hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" /> Clear History
        </Button>
      </div>

      <div className="space-y-3">
        {scanHistory.map((scan, i) => (
          <motion.div
            key={scan.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className="overflow-hidden hover:border-primary/30 transition-colors">
              <CardContent className="p-0">
                <div className="flex items-center gap-5 p-5">
                  <ScoreRing score={scan.healthScore} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-sm">{scan.cardType} Card</span>
                      <UrgencyBadge urgency={scan.urgency} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {scan.scanDate ? format(scan.scanDate, 'PPpp') : 'Unknown date'}
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-6 text-sm shrink-0">
                    <div className="text-center">
                      <div className="font-bold">{scan.totalFiles.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Files</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-success">{scan.good.toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Good</div>
                    </div>
                    <div className="text-center">
                      <div className={`font-bold ${scan.warnings > 0 ? 'text-warning' : ''}`}>{scan.warnings}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Warn</div>
                    </div>
                    <div className="text-center">
                      <div className={`font-bold ${scan.errors > 0 ? 'text-destructive' : ''}`}>{scan.errors}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Errors</div>
                    </div>
                  </div>

                  <Button
                    size="sm" variant="outline"
                    onClick={() => setScanResult(scan)}
                    className="shrink-0"
                  >
                    Load
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
