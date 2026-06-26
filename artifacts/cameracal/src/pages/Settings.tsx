import React from 'react';
import { useScanContext } from '../context/ScanContext';
import { useTheme } from '../context/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Bell, Moon, Sun, Info } from 'lucide-react';

export default function Settings() {
  const { settings, setSettings } = useScanContext();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-8 max-w-3xl pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1.5">Configure application preferences and defaults.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Appearance</CardTitle>
          <CardDescription>Choose how Cameracal looks on your display.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Light mode is easier in bright outdoor environments.
              </p>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-muted hover:bg-accent text-sm font-medium transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4" />
                  Light mode
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4" />
                  Dark mode
                </>
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Scan Preferences</CardTitle>
          <CardDescription>Adjust how files are processed during analysis.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-semibold">Thumbnail Preview Limit</Label>
              <span className="font-mono text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">{settings.thumbnailLimit}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Maximum number of image thumbnails to load. Higher numbers use more memory.
            </p>
            <Slider
              value={[settings.thumbnailLimit]}
              min={0} max={60} step={10}
              onValueChange={(val) => setSettings({ ...settings, thumbnailLimit: val[0] })}
            />
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Notifications</CardTitle>
          <CardDescription>Alert preferences for background operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-4 h-4 text-primary" />
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Desktop Notifications</Label>
                <p className="text-xs text-muted-foreground">Alert when a background scan completes.</p>
              </div>
            </div>
            <Switch
              checked={settings.notificationsEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, notificationsEnabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex justify-between border-b pb-3">
            <span>Version</span>
            <span className="font-mono font-semibold text-foreground">V6.0 · Desktop Preview</span>
          </div>
          <div className="flex justify-between border-b pb-3">
            <span>Platform</span>
            <span className="font-semibold text-foreground">macOS · Windows</span>
          </div>
          <div className="flex justify-between border-b pb-3">
            <span>Engine</span>
            <span className="font-semibold text-foreground">Tauri + Rust (planned)</span>
          </div>
          <p>
            Cameracal Card Health is a diagnostic tool for professional photographers to verify memory card integrity,
            detect counterfeit cards, benchmark performance, and safely recover files.
          </p>
          <div className="flex items-start gap-2 px-3 py-3 rounded-lg"
            style={{ background: 'hsl(226 80% 60% / 0.08)', border: '1px solid hsl(226 80% 60% / 0.20)' }}>
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs">
              <strong className="text-foreground">Privacy:</strong> All analysis runs locally on your machine.
              No files, metadata, or telemetry are ever transmitted to any server.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
