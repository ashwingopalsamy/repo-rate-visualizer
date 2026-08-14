import { useState } from 'react';
import { Check, Download, FileCode2, MoreHorizontal, Share2 } from 'lucide-react';
import { decisions, macroEvents, regimes, sources } from '../data/dataLoader.js';
import { buildDecisionCsv } from '../data/csvExport.js';
import { downloadPng, downloadSvg } from '../lib/chartExport.js';
import { Button } from './ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.jsx';

export default function ExportBar({ dateRange, activeView, className = '' }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState('');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const downloadCSV = () => {
    const csvContent = buildDecisionCsv({ decisions, sources, macroEvents, regimes, dateRange });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rbi_repo_rate_${dateRange.start || 'all'}_${dateRange.end || 'all'}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const getChartSvg = () => {
    const svg = document.querySelector('.chart-svg');
    if (!svg) throw new Error('The chart is not ready to export.');
    return svg;
  };

  const chartBackground = () => window.getComputedStyle(document.body).backgroundColor || '#ffffff';

  const handlePng = async () => {
    setBusy(true);
    setExportError('');
    try {
      await downloadPng(getChartSvg(), `rbi_repo_rate_${activeView || 'chart'}.png`, { backgroundColor: chartBackground(), scale: 2 });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'PNG export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSvg = () => {
    setExportError('');
    try {
      downloadSvg(getChartSvg(), `rbi_repo_rate_${activeView || 'chart'}.svg`, { backgroundColor: chartBackground() });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'SVG export failed.');
    }
  };

  return (
    <div className={`flex min-w-0 flex-wrap items-center justify-end gap-1.5 ${className}`} aria-label="Share and export actions">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="size-9" size="icon" variant={busy ? 'secondary' : 'ghost'} disabled={busy} aria-label="Download chart" title={busy ? 'Rendering PNG' : 'Download chart'} aria-busy={busy}>
            <Download className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="w-48">
          <DropdownMenuLabel>Chart export</DropdownMenuLabel>
          <DropdownMenuItem onSelect={handleSvg}>
            <FileCode2 className="size-4" aria-hidden="true" />
            Download SVG
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handlePng()}>
            <Download className="size-4" aria-hidden="true" />
            Download PNG
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button className="size-9" size="icon" variant="ghost" aria-label={copied ? 'Link copied' : 'Share current view'} onClick={handleCopyLink}>
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Link copied' : 'Copy link with current filters'}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="size-9" size="icon" variant="ghost" aria-label="More export options" title="More export options">
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="w-48">
          <DropdownMenuLabel>More actions</DropdownMenuLabel>
          <DropdownMenuItem onSelect={downloadCSV}>
            <Download className="size-4" aria-hidden="true" />
            Download CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {exportError ? <span className="basis-full text-right text-xs text-destructive" role="alert">{exportError}</span> : null}
    </div>
  );
}
