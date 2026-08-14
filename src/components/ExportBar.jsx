import { useState } from 'react';
import { decisions, macroEvents, regimes, sources } from '../data/dataLoader.js';
import { buildDecisionCsv } from '../data/csvExport.js';
import { downloadPng, downloadSvg } from '../lib/chartExport.js';
import Icon from './ui/icon.jsx';
import { Button } from './ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
      <Button
        className="h-9 rounded-md px-3"
        size="sm"
        variant="outline"
        onClick={handlePng}
        disabled={busy}
        aria-label={busy ? 'Rendering PNG' : 'Download PNG'}
        title={busy ? 'Rendering PNG' : 'Download PNG'}
      >
        <Icon name="download" size={14} />
        <span className="workspace-export-actions__png-label">{busy ? 'Rendering…' : 'Download PNG'}</span>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button className="size-9 rounded-md" size="icon" variant="ghost" aria-label={copied ? 'Link copied' : 'Share current view'} onClick={handleCopyLink}>
            <Icon name={copied ? 'link' : 'share'} size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Link copied' : 'Copy link with current filters'}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="size-9 rounded-md" size="icon" variant="ghost" aria-label="More export options" title="More export options">
            <Icon name="more" size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="w-48 rounded-xl">
          <DropdownMenuItem onSelect={downloadCSV}>
            <Icon name="download" size={14} />
            Download CSV
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleSvg}>
            <Icon name="download" size={14} />
            Download SVG
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {exportError ? <span className="basis-full text-right text-xs text-destructive" role="alert">{exportError}</span> : null}
    </div>
  );
}
