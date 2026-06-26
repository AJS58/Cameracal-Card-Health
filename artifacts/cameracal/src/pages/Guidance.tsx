import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Monitor, ShieldAlert, BookOpen } from 'lucide-react';

export default function Guidance() {
  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Guidance & Information</h1>
        <p className="text-muted-foreground mt-1.5">Learn about app capabilities and memory card best practices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'hsl(226 80% 60% / 0.15)' }}>
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </div>
              Browser Version Capabilities
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>This web version runs entirely in your browser using standard web APIs. No data is uploaded to any server.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Reads file structures and checks for zero-byte anomalies</li>
              <li>Generates preview thumbnails for standard formats (JPEG, PNG)</li>
              <li>Flags known RAW formats for metadata existence</li>
              <li>Highlights missing or corrupted headers based on file size/type mismatch</li>
              <li>Calculates a surface-level health score</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'hsl(226 80% 60% / 0.15)' }}>
                <Monitor className="w-4 h-4 text-primary" />
              </div>
              Desktop Version (Coming Soon)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Our upcoming dedicated desktop app will provide deeper forensic capabilities:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>True deleted file recovery (carving)</li>
              <li>Deep sector-by-sector scanning</li>
              <li>Filesystem reconstruction (FAT32, exFAT, APFS)</li>
              <li>Card cloning and imaging prior to recovery</li>
              <li>Advanced RAW file decoding and header repair</li>
            </ul>
          </CardContent>
        </Card>

        <Card
          className="lg:col-span-2"
          style={{
            border: '1px solid hsl(0 72% 51% / 0.20)',
            borderLeft: '4px solid hsl(0 72% 51%)',
            background: 'hsl(0 72% 51% / 0.05)',
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-destructive">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'hsl(0 72% 51% / 0.15)' }}>
                <ShieldAlert className="w-4 h-4 text-destructive" />
              </div>
              Critical Recovery Safety
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="font-medium text-foreground">If you suspect card corruption or accidental deletion, follow these rules immediately:</p>
            <ol className="list-decimal pl-5 space-y-2 font-medium">
              <li>Stop using the card. Do not shoot any more photos on it.</li>
              <li>Do not format the card in-camera or on your computer.</li>
              <li>If you use recovery software, <strong>NEVER</strong> save the recovered files back to the affected card. Save them to your hard drive.</li>
              <li>Toggle the physical write-protect switch on SD cards to prevent accidental overwrites by your OS.</li>
            </ol>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'hsl(226 80% 60% / 0.15)' }}>
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              Card Care for Photographers
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Formatting</h4>
              <p>Always format your cards in-camera, not on your computer. This ensures the filesystem is structured exactly as your specific camera model expects.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Battery Management</h4>
              <p>Never pull a card out or let the battery die while the camera's write-indicator light is active. This is the #1 cause of FAT corruption.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Readers</h4>
              <p>Use high-quality, brand-name card readers. Cheap readers can cause voltage spikes or connection drops during transfer, corrupting the card.</p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Lifespan</h4>
              <p>Flash memory degrades over time. Consider retiring heavily used cards after 3-5 years of professional use, assigning them to non-critical personal work.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
