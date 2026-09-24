import { useState } from 'react';
import { Check, Download, FileCode2, MoreHorizontal, Share2 } from 'lucide-react';
import { decisions, macroEvents, regimes, snapshotMeta, snapshotRelease, sources } from '../data/dataLoader.js';
import { buildDecisionCsv } from '../data/csvExport.js';
import { buildCitationBundle, citationFilename } from '../data/citationBundle.js';
import { downloadPng, downloadSvg } from '../lib/chartExport.js';
import { filterDecisions } from '../lib/analysisState.js';
import { Button } from './ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.jsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.jsx';

export default function ExportBar({ dateRange, activeView, layers, selectedDecisionId, cycleSelection, recordFilters, timelineMode, rateChangeState, breakdownState, className = '' }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState('');

  const buildBundle = () => buildCitationBundle({
    decisions: filterDecisions(decisions, { dateRange, recordFilters, timelineMode }),
    sources,
    macroEvents,
    regimes,
    dateRange,
    release: snapshotRelease,
    selectedDecisionId,
    scope: { view: activeView, layers: layers || null, cycleSelection: cycleSelection || null, recordFilters: recordFilters || null, timelineMode: timelineMode || 'all', rateChangeState: rateChangeState || null, breakdownState: breakdownState || null },
  });

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
    const csvContent = buildDecisionCsv({ decisions: filterDecisions(decisions, { dateRange, recordFilters, timelineMode }), sources, macroEvents, regimes, dateRange, snapshotMeta });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = citationFilename({ format: 'csv', view: activeView || 'records', dateRange, releaseId: snapshotMeta.releaseId });
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
      await downloadPng(getChartSvg(), citationFilename({ format: 'png', view: activeView || 'chart', dateRange, releaseId: snapshotMeta.releaseId }), {
        backgroundColor: chartBackground(),
        scale: 2,
        provenance: exportProvenance(),
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'PNG export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSvg = () => {
    setExportError('');
    try {
      downloadSvg(getChartSvg(), citationFilename({ format: 'svg', view: activeView || 'chart', dateRange, releaseId: snapshotMeta.releaseId }), {
        backgroundColor: chartBackground(),
        provenance: exportProvenance(),
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'SVG export failed.');
    }
  };

  const exportProvenance = () => {
    const bundle = buildBundle();
    return {
      title: `RBI repo rate — ${activeView || 'chart'}`,
      description: `Snapshot ${snapshotMeta.releaseId}; ${snapshotMeta.latestRecordedDate || 'latest recorded date'}; ${snapshotMeta.latestOfficialDate ? `latest direct RBI decision ${snapshotMeta.latestOfficialDate}` : 'direct decision date not reported'}; ${bundle.coverage.totalRecords} records from ${bundle.sources.length} sources.`,
      footer: `RBI Repo Rate Visualizer · ${snapshotMeta.releaseId} · ${dateRange.start || 'all'} to ${dateRange.end || 'all'} · ${bundle.coverage.totalRecords} records · ${bundle.sources.length} sources · retrieved ${snapshotMeta.retrievedAt || 'not reported'}`,
    };
  };

  const downloadJson = () => {
    const bundle = buildBundle();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = citationFilename({ format: 'json', view: activeView || 'records', dateRange, releaseId: snapshotMeta.releaseId });
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const copyCitation = async () => {
    const text = buildBundle().citationText;
    if (!text) {
      setExportError('Select a record before copying a citation.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setExportError('Citation could not be copied.');
    }
  };

  const downloadCitationText = () => {
    const text = buildBundle().citationText;
    if (!text) {
      setExportError('Select a record before downloading a citation.');
      return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = citationFilename({ format: 'txt', view: activeView || 'record', dateRange, releaseId: snapshotMeta.releaseId });
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className={`flex min-w-0 flex-wrap items-center justify-end gap-1.5 ${className}`} aria-label="Share and export actions">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="size-9 rounded-lg border border-border/60 bg-background/80 hover:bg-muted/60 transition-colors shadow-2xs" size="icon" variant={busy ? 'secondary' : 'outline'} disabled={busy} aria-label="Download chart" title={busy ? 'Rendering PNG' : 'Download chart'} aria-busy={busy}>
            <Download className="size-3.5" aria-hidden="true" />
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
          <Button className="size-9 rounded-lg border border-border/60 bg-background/80 hover:bg-muted/60 transition-colors shadow-2xs" size="icon" variant="outline" aria-label={copied ? 'Link copied' : 'Share current view'} onClick={handleCopyLink}>
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Share2 className="size-3.5" aria-hidden="true" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Link copied' : 'Copy link with current filters'}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="size-9 rounded-lg border border-border/60 bg-background/80 hover:bg-muted/60 transition-colors shadow-2xs" size="icon" variant="outline" aria-label="More export options" title="More export options">
            <MoreHorizontal className="size-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="w-48">
          <DropdownMenuLabel>More actions</DropdownMenuLabel>
          <DropdownMenuItem onSelect={downloadCSV}>
            <Download className="size-4" aria-hidden="true" />
            Download CSV
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={downloadJson}>
            <FileCode2 className="size-4" aria-hidden="true" />
            Download citation JSON
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={downloadCitationText}>
            <Share2 className="size-4" aria-hidden="true" />
            Download text citation
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copyCitation()}>
            <Check className="size-4" aria-hidden="true" />
            Copy citation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {exportError ? <span className="basis-full text-right text-xs text-destructive" role="alert">{exportError}</span> : null}
    </div>
  );
}
