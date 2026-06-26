import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface FileResult {
  name: string;
  size: number;
  extension: string;
  category: 'jpeg' | 'png' | 'webp' | 'raw' | 'video' | 'other';
  status: 'good' | 'warning' | 'error';
  reason?: string;
  thumbnailUrl?: string;
  durationEstimate?: string;
  lastModified?: number;
  /** Deep header/tail integrity checks — populated when byte-level validation runs. */
  integrityChecks?: Array<{ name: string; passed: boolean; detail?: string }>;
  /** Human-readable integrity issues found during byte-level validation. */
  integrityIssues?: string[];
}

export interface ScanResult {
  files: FileResult[];
  totalFiles: number;
  good: number;
  warnings: number;
  errors: number;
  healthScore: number;
  urgency: 'safe' | 'caution' | 'warning';
  scanDate: Date | null;
  cardType: string;
  id: string;
}

export type ScanProfile = 'general' | 'wedding' | 'video' | 'sport';

export interface ScanProfileConfig {
  id: ScanProfile;
  label: string;
  description: string;
  warningThreshold: number;
  errorThreshold: number;
  requireRaw: boolean;
  strictVideo: boolean;
  burstMode: boolean;
}

export const SCAN_PROFILES: ScanProfileConfig[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Balanced scan for everyday photography',
    warningThreshold: 5,
    errorThreshold: 2,
    requireRaw: false,
    strictVideo: false,
    burstMode: false,
  },
  {
    id: 'wedding',
    label: 'Wedding',
    description: 'Strict — checks RAW+JPEG pairs, zero tolerance for errors',
    warningThreshold: 1,
    errorThreshold: 0,
    requireRaw: true,
    strictVideo: false,
    burstMode: false,
  },
  {
    id: 'video',
    label: 'Video / Cinema',
    description: 'Strict video integrity — truncation, size, and pro format checks',
    warningThreshold: 2,
    errorThreshold: 1,
    requireRaw: false,
    strictVideo: true,
    burstMode: false,
  },
  {
    id: 'sport',
    label: 'Sport / Wildlife',
    description: 'Burst mode — checks sequential gaps and truncated burst frames',
    warningThreshold: 3,
    errorThreshold: 1,
    requireRaw: false,
    strictVideo: false,
    burstMode: true,
  },
];

interface ScanSettings {
  thumbnailLimit: number;
  scanProfile: ScanProfile;
  theme: 'dark' | 'light';
  notificationsEnabled: boolean;
}

interface ScanContextValue {
  scanResult: ScanResult | null;
  setScanResult: (r: ScanResult) => void;
  history: ScanResult[];
  addToHistory: (r: ScanResult) => void;
  clearHistory: () => void;
  settings: ScanSettings;
  setSettings: (s: ScanSettings) => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [settings, setSettings] = useState<ScanSettings>({
    thumbnailLimit: 40,
    scanProfile: 'general',
    theme: 'dark',
    notificationsEnabled: true,
  });

  const addToHistory = (r: ScanResult) => {
    setHistory(prev => [r, ...prev].slice(0, 50));
  };

  const clearHistory = () => setHistory([]);

  return (
    <ScanContext.Provider value={{ scanResult, setScanResult, history, addToHistory, clearHistory, settings, setSettings }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScanContext() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error('useScanContext must be used inside ScanProvider');
  return ctx;
}
