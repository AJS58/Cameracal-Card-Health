import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  Activity, HardDrive, Download, AlertTriangle, Settings, FileSearch,
  ShieldCheck, CheckSquare, Layers, History, Gauge, Trash2, Sun, Moon, RefreshCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import logoUrl from '/cameracal-logo.png';
import { useTheme } from '../context/ThemeContext';
import { isTauri } from '@/lib/tauri-bridge';

const IN_TAURI = isTauri();

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();

  const navSections = [
    {
      label: 'Analysis',
      items: [
        { href: '/',          icon: Activity,     label: 'Dashboard' },
        { href: '/analyse',   icon: FileSearch,   label: 'Analyse / Check' },
        { href: '/recovery',  icon: HardDrive,    label: 'Recovery Preview' },
        { href: '/history',   icon: History,      label: 'Scan History' },
      ],
    },
    {
      label: 'Pro Tools',
      items: [
        { href: '/file-recovery', icon: RefreshCcw,  label: 'File Recovery',        badge: 'NEW' as const },
        { href: '/readiness',   icon: CheckSquare, label: 'Readiness Check',     badge: 'NEW' as const },
        { href: '/counterfeit', icon: Layers,      label: 'Counterfeit Detector', badge: 'NEW' as const },
        { href: '/benchmark',   icon: Gauge,       label: 'Benchmark',            badge: 'NEW' as const },
        { href: '/format',      icon: Trash2,      label: 'Safe Format',          badge: 'NEW' as const },
      ],
    },
    {
      label: 'Reports & Info',
      items: [
        { href: '/report',    icon: Download,      label: 'Report' },
        { href: '/guidance',  icon: AlertTriangle, label: 'Guidance' },
        { href: '/settings',  icon: Settings,      label: 'Settings' },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      <aside
        className="w-64 flex flex-col flex-shrink-0 border-r border-sidebar-border"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--sidebar)) 0%, hsl(222 34% 6%) 100%)',
        }}
      >
        <div
          className="px-4 border-b border-sidebar-border"
          style={{ paddingTop: IN_TAURI ? 40 : 16, paddingBottom: 16 }}
          {...(IN_TAURI ? { 'data-tauri-drag-region': true } : {})}
        >
          <div style={{ background: 'hsl(0 0% 97%)', borderRadius: 10, padding: '7px 12px 5px' }}>
            <img
              src={logoUrl}
              alt="Cameracal Services"
              style={{ width: '100%', height: 'auto', maxHeight: 38, objectFit: 'contain', objectPosition: 'left center' }}
              draggable={false}
            />
          </div>
          <p style={{
            marginTop: 6, fontSize: 9, fontWeight: 600, letterSpacing: '0.22em',
            textTransform: 'uppercase', color: 'hsl(226 40% 55%)', paddingLeft: 2,
          }}>
            Card Health
          </p>
        </div>

        <nav className="flex-1 py-3 px-3 overflow-y-auto space-y-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/30">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm font-medium overflow-hidden",
                        isActive
                          ? "text-white"
                          : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      )}
                      style={isActive ? {
                        background: 'linear-gradient(90deg, hsl(226 80% 60% / 0.22) 0%, hsl(226 80% 60% / 0.06) 100%)',
                      } : undefined}
                    >
                      {isActive && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
                          style={{ background: 'hsl(226 80% 60%)' }}
                        />
                      )}
                      <item.icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/38")} />
                      <span className="flex-1 text-[13px]">{item.label}</span>
                      {'badge' in item && item.badge && (
                        <span
                          className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
                          style={{
                            background: 'hsl(260 70% 55% / 0.22)',
                            color: 'hsl(260 70% 78%)',
                            border: '1px solid hsl(260 70% 55% / 0.32)',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-3">
          <div className="flex items-center justify-center">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: 'hsl(142 71% 42% / 0.10)',
                border: '1px solid hsl(142 71% 42% / 0.22)',
                color: 'hsl(142 71% 52%)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: 'hsl(142 71% 55%)', boxShadow: '0 0 6px hsl(142 71% 55% / 0.8)' }} />
              <ShieldCheck className="w-3 h-3" />
              Private by design
            </div>
          </div>
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5" />
                Light mode
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" />
                Dark mode
              </>
            )}
          </button>
          <p className="text-center text-[10px] text-sidebar-foreground/28 leading-relaxed">
            © {new Date().getFullYear()} Cameracal Services.<br />All rights reserved.
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
