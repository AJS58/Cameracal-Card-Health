import React from 'react';
import { useScanContext } from '../context/ScanContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, FileCode, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'wouter';

export default function Report() {
  const { scanResult } = useScanContext();

  if (!scanResult) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-16 animate-in fade-in">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'hsl(226 80% 60% / 0.12)', border: '1px solid hsl(226 80% 60% / 0.20)' }}
        >
          <FileText className="w-10 h-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">No Scan Data</h2>
          <p className="text-muted-foreground">Run a scan first to generate reports.</p>
        </div>
        <Link href="/analyse">
          <Button variant="outline">Go to Analyse</Button>
        </Link>
      </div>
    );
  }

  const handleExportTxt = () => {
    let content = `CAMERACAL CARD HEALTH - DIAGNOSTIC LOG\n`;
    content += `Date: ${scanResult.scanDate ? format(scanResult.scanDate, 'PPpp') : 'N/A'}\n`;
    content += `Card Type: ${scanResult.cardType}\n`;
    content += `Health Score: ${scanResult.healthScore}%\n`;
    content += `Urgency: ${scanResult.urgency.toUpperCase()}\n\n`;
    content += `Total Files: ${scanResult.totalFiles}\n`;
    content += `Good: ${scanResult.good}\n`;
    content += `Warnings: ${scanResult.warnings}\n`;
    content += `Errors: ${scanResult.errors}\n\n`;
    content += `FILE DETAILS:\n`;
    
    scanResult.files.forEach(f => {
      content += `[${f.status.toUpperCase()}] ${f.name} (${(f.size/1024/1024).toFixed(2)}MB) - ${f.category}`;
      if (f.reason) content += ` - Reason: ${f.reason}`;
      content += `\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cameracal-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportHtml = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cameracal Card Health Report</title>
        <style>
          body { font-family: system-ui, sans-serif; color: #1e293b; line-height: 1.5; padding: 2rem; max-width: 800px; margin: 0 auto; }
          h1 { color: #0f172a; }
          .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; background: #f8fafc; padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 2rem; }
          .stat { margin-bottom: 0.5rem; }
          .stat strong { display: block; color: #64748b; font-size: 0.875rem; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f8fafc; font-weight: 600; }
          .status-good { color: #16a34a; }
          .status-warning { color: #d97706; }
          .status-error { color: #dc2626; }
          .warning-box { background: #fef2f2; color: #991b1b; padding: 1rem; border-left: 4px solid #ef4444; margin-bottom: 2rem; }
        </style>
      </head>
      <body>
        <h1>Cameracal Diagnostic Report</h1>
        
        ${scanResult.errors > 0 || scanResult.warnings > 0 ? `
          <div class="warning-box">
            <strong>CRITICAL SAFETY WARNING:</strong> Stop using the card immediately. Do not format it or save recovered files back to the same card. Doing so will permanently overwrite recoverable data.
          </div>
        ` : ''}

        <div class="summary">
          <div class="stat"><strong>Date</strong> ${scanResult.scanDate ? format(scanResult.scanDate, 'PPpp') : 'N/A'}</div>
          <div class="stat"><strong>Card Type</strong> ${scanResult.cardType}</div>
          <div class="stat"><strong>Health Score</strong> ${scanResult.healthScore}%</div>
          <div class="stat"><strong>Urgency</strong> ${scanResult.urgency.toUpperCase()}</div>
          <div class="stat"><strong>Total Scanned</strong> ${scanResult.totalFiles}</div>
          <div class="stat"><strong>Good</strong> ${scanResult.good}</div>
          <div class="stat"><strong>Warnings</strong> ${scanResult.warnings}</div>
          <div class="stat"><strong>Errors</strong> ${scanResult.errors}</div>
        </div>

        <h2>First 50 Files Scanned</h2>
        <table>
          <thead>
            <tr>
              <th>Filename</th>
              <th>Type</th>
              <th>Size (MB)</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${scanResult.files.slice(0, 50).map(f => `
              <tr>
                <td>${f.name}</td>
                <td style="text-transform: uppercase">${f.category}</td>
                <td>${(f.size / 1024 / 1024).toFixed(2)}</td>
                <td class="status-${f.status}">${f.status.toUpperCase()}</td>
                <td>${f.reason || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cameracal-report-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report Export</h1>
        <p className="text-muted-foreground mt-1.5">Generate and download diagnostic logs for this scan session.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          className="h-24 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-all cursor-pointer"
          style={{ borderColor: 'hsl(220 20% 22%)', background: 'hsl(222 28% 11%)' }}
          onClick={handleExportHtml}
          data-testid="button-export-html"
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'hsl(226 80% 60% / 0.6)';
            (e.currentTarget as HTMLElement).style.background = 'hsl(226 80% 60% / 0.06)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'hsl(220 20% 22%)';
            (e.currentTarget as HTMLElement).style.background = 'hsl(222 28% 11%)';
          }}
        >
          <FileCode className="w-6 h-6 text-primary" />
          <span className="text-sm font-semibold">Export HTML Report</span>
        </button>
        <button
          className="h-24 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-all cursor-pointer"
          style={{ borderColor: 'hsl(220 20% 22%)', background: 'hsl(222 28% 11%)' }}
          onClick={handlePrint}
          data-testid="button-export-pdf"
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'hsl(226 80% 60% / 0.6)';
            (e.currentTarget as HTMLElement).style.background = 'hsl(226 80% 60% / 0.06)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'hsl(220 20% 22%)';
            (e.currentTarget as HTMLElement).style.background = 'hsl(222 28% 11%)';
          }}
        >
          <Printer className="w-6 h-6 text-primary" />
          <span className="text-sm font-semibold">Print / Save as PDF</span>
        </button>
        <button
          className="h-24 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-all cursor-pointer"
          style={{ borderColor: 'hsl(220 20% 22%)', background: 'hsl(222 28% 11%)' }}
          onClick={handleExportTxt}
          data-testid="button-export-txt"
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'hsl(226 80% 60% / 0.6)';
            (e.currentTarget as HTMLElement).style.background = 'hsl(226 80% 60% / 0.06)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'hsl(220 20% 22%)';
            (e.currentTarget as HTMLElement).style.background = 'hsl(222 28% 11%)';
          }}
        >
          <FileText className="w-6 h-6 text-primary" />
          <span className="text-sm font-semibold">Export TXT Log</span>
        </button>
      </div>

      <Card className="print:shadow-none print:border-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Report Summary Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Scan Date</div>
              <div className="font-medium" data-testid="text-scan-date">{scanResult.scanDate ? format(scanResult.scanDate, 'PPpp') : ''}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Card Type</div>
              <div className="font-medium" data-testid="text-card-type">{scanResult.cardType}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Health Score</div>
              <div className="font-medium" data-testid="text-health-score">{scanResult.healthScore}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Urgency</div>
              <div className="font-medium uppercase" data-testid="text-urgency">{scanResult.urgency}</div>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/20">
            <h4 className="font-semibold mb-3 text-sm">First 10 Files Scanned</h4>
            <div className="space-y-0 text-sm divide-y divide-border">
              {scanResult.files.slice(0, 10).map((f, i) => (
                <div key={i} className="flex justify-between py-2 last:pb-0" data-testid={`row-preview-file-${i}`}>
                  <span className="truncate pr-4 text-muted-foreground">{f.name}</span>
                  <span className={`font-semibold shrink-0 ${f.status === 'error' ? 'text-destructive' : f.status === 'warning' ? 'text-warning' : 'text-success'}`}>
                    {f.status.toUpperCase()}
                  </span>
                </div>
              ))}
              {scanResult.files.length > 10 && (
                <div className="text-center text-muted-foreground pt-3 text-xs">
                  …and {scanResult.files.length - 10} more files
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
