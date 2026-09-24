import { RotateCcw } from 'lucide-react';
import { snapshotMeta } from '../data/dataLoader.js';
import { EVIDENCE_FILTER_LABELS, formatRangeLabel, normalizeRecordFilters } from '../lib/analysisState.js';
import { Button } from './ui/button.jsx';

export default function AnalysisStateStrip({ dateRange, recordFilters, timelineMode, rateChangeState, breakdownState, activeDecisionId, cycleSelection, onReset }) {
  const filters = normalizeRecordFilters(recordFilters);
  const activeParts = [
    formatRangeLabel(dateRange),
    filters.action === 'all' ? 'All actions' : `${filters.action[0].toUpperCase()}${filters.action.slice(1)}s`,
    EVIDENCE_FILTER_LABELS[filters.evidence],
    timelineMode === 'changes' ? 'Changes only' : 'All recorded observations',
  ];
  if (activeDecisionId) activeParts.push('Record selected');
  if (cycleSelection?.a || cycleSelection?.b) activeParts.push('Cycle pair selected');
  if (rateChangeState?.sizeBand && rateChangeState.sizeBand !== 'all') activeParts.push(`${rateChangeState.sizeBand} bps band`);
  if (rateChangeState?.view === 'cumulative') activeParts.push('Cumulative moves');
  if (breakdownState?.group === 'year') activeParts.push('By year');
  if (breakdownState?.metric === 'bps') activeParts.push('Bps volume');

  return (
    <div className="analysis-state-strip flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs sm:px-6" role="status" aria-label="Current analysis state">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
        <span className="font-semibold text-foreground">Analysis</span>
        <span aria-hidden="true">·</span>
        <span>{activeParts.join(' · ')}</span>
        <span className="hidden text-muted-foreground/70 sm:inline" title={snapshotMeta.releaseId}>· {snapshotMeta.releaseId.slice(0, 20)}…</span>
      </div>
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onReset}>
        <RotateCcw className="size-3" aria-hidden="true" />
        Reset analysis
      </Button>
    </div>
  );
}
