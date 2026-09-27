import { Filter, RotateCcw } from 'lucide-react';
import { ACTION_FILTERS, EVIDENCE_FILTER_LABELS, EVIDENCE_FILTERS, normalizeRecordFilters } from '../lib/analysisState.js';
import { Button } from './ui/button.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.jsx';

const ACTION_LABELS = {
  all: 'All',
  cut: 'Cuts',
  hike: 'Hikes',
  hold: 'Unchanged',
  framework: 'Framework',
};

export default function AnalysisFilterRail({ recordFilters = {}, timelineMode = 'all', onRecordFiltersChange, onTimelineModeChange, actions = ACTION_FILTERS, showEvidence = true, showTimelineMode = true, evidenceLabel = null, holdLabel = ACTION_LABELS.hold }) {
  const filters = normalizeRecordFilters(recordFilters);
  const update = next => onRecordFiltersChange?.({ ...filters, ...next });

  return (
    <div className="analysis-filter-rail flex min-w-0 flex-wrap items-center gap-2" aria-label="Analysis filters">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Filter className="size-3.5" aria-hidden="true" />
        Filter
      </span>
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto scrollbar-none" role="group" aria-label="Filter by action">
        {actions.map(action => (
          <Button
            key={action}
            type="button"
            size="sm"
            variant={filters.action === action ? 'secondary' : 'ghost'}
            className="h-8 px-2.5 text-xs"
            aria-pressed={filters.action === action}
            onClick={() => update({ action })}
          >
            {action === 'hold' ? holdLabel : ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
      {showEvidence ? <Select value={filters.evidence} onValueChange={evidence => update({ evidence })}>
        <SelectTrigger className="h-8 w-auto min-w-[9.5rem] px-2.5 text-xs" aria-label="Filter by evidence class">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EVIDENCE_FILTERS.map(evidence => (
            <SelectItem key={evidence} value={evidence}>{EVIDENCE_FILTER_LABELS[evidence]}</SelectItem>
          ))}
        </SelectContent>
      </Select> : evidenceLabel ? <span className="inline-flex min-h-8 items-center rounded-lg border border-border/60 bg-muted/20 px-2.5 text-xs text-muted-foreground">{evidenceLabel}</span> : null}
      {showTimelineMode ? <Button
        type="button"
        size="sm"
        variant={timelineMode === 'changes' ? 'secondary' : 'ghost'}
        className="h-8 px-2.5 text-xs"
        aria-pressed={timelineMode === 'changes'}
        onClick={() => onTimelineModeChange?.(timelineMode === 'changes' ? 'all' : 'changes')}
      >
        Changes only
      </Button> : null}
      {(filters.action !== 'all' || filters.evidence !== 'all' || timelineMode !== 'all') ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => {
            onRecordFiltersChange?.({ action: 'all', evidence: 'all' });
            onTimelineModeChange?.('all');
          }}
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          Reset filters
        </Button>
      ) : null}
    </div>
  );
}
