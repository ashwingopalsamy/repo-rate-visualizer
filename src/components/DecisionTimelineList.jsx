import { useEffect } from 'react';
import { decisions, sources } from '../data/dataLoader.js';
import { getTrend, formatBps } from '../lib/trend.js';
import Icon from './ui/icon.jsx';

const sourceById = new Map(sources.map(source => [source.id, source]));

function visibleDecisions(dateRange) {
  return decisions.filter(decision => {
    if (dateRange.start && decision.dateObj < new Date(dateRange.start)) return false;
    if (dateRange.end && decision.dateObj > new Date(dateRange.end)) return false;
    return true;
  });
}

function formatDate(value) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function DecisionTimelineList({ dateRange, activeDecisionId, onDecisionSelect }) {
  const filteredDecisions = visibleDecisions(dateRange);
  const selectedDecision = filteredDecisions.find(decision => decision.id === activeDecisionId);
  const selectedSource = selectedDecision?.sourceIds.map(sourceId => sourceById.get(sourceId)).find(Boolean);

  useEffect(() => {
    if (!activeDecisionId) return;
    const row = document.querySelector(`.decision-record [data-decision-id="${CSS.escape(activeDecisionId)}"]`);
    if (row) {
      const rect = row.getBoundingClientRect();
      if (rect.top < 96 || rect.bottom > window.innerHeight - 32) {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeDecisionId]);

  return (
    <section className="decision-record pt-7" aria-labelledby="timeline-decisions-title" data-decision-count={filteredDecisions.length}>
      <div className="decision-record__header grid max-w-[820px] gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Decision spine</p>
          <h2 id="timeline-decisions-title" className="m-0 text-base font-semibold tracking-[-0.02em] text-foreground">Official decision record</h2>
          <p className="mt-1 mb-0 text-sm leading-6 text-muted-foreground">Every source-backed decision in the selected range, including holds.</p>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground sm:pb-0.5">{filteredDecisions.length} decisions</span>
      </div>

      {selectedDecision ? (
        <div className="decision-selection mt-4 flex max-w-[820px] flex-wrap items-center gap-x-3 gap-y-1 border-y border-border/70 py-3 text-sm" role="status" aria-live="polite">
          <span className={`inline-flex items-center gap-2 font-medium ${getTrend(selectedDecision.action).textClass}`}>
            <span aria-hidden="true" className={`size-2 rounded-full ${getTrend(selectedDecision.action).dotClass}`} />
            Selected {getTrend(selectedDecision.action).actionLabel}
          </span>
          <span className="text-muted-foreground">{formatDate(selectedDecision.date)} · <strong className="font-medium text-foreground tabular-nums">{selectedDecision.repoRate.toFixed(2)}%</strong> · {formatBps(selectedDecision.changeBps)}</span>
          {selectedSource ? (
            <a className="inline-flex min-h-10 items-center gap-1.5 px-1 font-medium text-foreground transition-colors hover:text-source focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={selectedSource.url} target="_blank" rel="noopener noreferrer" aria-label={`Open selected source for ${formatDate(selectedDecision.date)}`}>
              Open source
              <Icon name="external" size={13} />
            </a>
          ) : null}
        </div>
      ) : null}

      <div className={`${selectedDecision ? 'mt-3' : 'mt-5'} decision-spine-list max-w-[860px]`} role="list" aria-label="Official RBI decisions">
        <div className="decision-spine-columns hidden grid-cols-[112px_86px_76px_82px_minmax(130px,1fr)_40px] gap-4 px-2 pb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:grid" aria-hidden="true">
          <span>Date</span>
          <span>Decision</span>
          <span>Rate</span>
          <span>Change</span>
          <span>Stance</span>
          <span className="text-right">Source</span>
        </div>
        {filteredDecisions.slice().reverse().map(decision => {
          const source = decision.sourceIds.map(sourceId => sourceById.get(sourceId)).find(Boolean);
          const trend = getTrend(decision.action);
          const isActive = activeDecisionId === decision.id;

          return (
            <div className={`decision-spine-row grid min-w-0 grid-cols-[minmax(0,1fr)_40px] items-center gap-2 border-b border-border/60 py-2.5 last:border-b-0 ${isActive ? 'decision-spine-row--active' : ''}`} data-action={decision.action} data-decision-id={decision.id} key={decision.id} role="listitem">
              <button
                type="button"
                className="decision-spine-select grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-control-hover focus-visible:bg-control-active sm:grid-cols-[112px_86px_76px_82px_minmax(130px,1fr)] sm:items-center sm:gap-4"
                aria-pressed={isActive}
                aria-label={`Select ${trend.actionLabel} on ${formatDate(decision.date)}, repo rate ${decision.repoRate.toFixed(2)} percent, ${formatBps(decision.changeBps)}`}
                onClick={() => onDecisionSelect?.(decision.id)}
              >
                <time className="text-sm text-muted-foreground" dateTime={decision.date}>{formatDate(decision.date)}</time>
                <span className={`inline-flex items-center gap-2 text-sm font-medium sm:justify-self-start ${trend.textClass}`}>
                  <span aria-hidden="true" className={`size-2 rounded-full ${trend.dotClass}`} />
                  {trend.actionLabel}
                </span>
                <strong className="font-semibold tabular-nums text-foreground">{decision.repoRate.toFixed(2)}%</strong>
                <span className={`font-medium tabular-nums ${trend.textClass}`}>{formatBps(decision.changeBps)}</span>
                <span className="col-span-2 min-w-0 truncate text-sm text-muted-foreground sm:col-span-1">{decision.stance || 'Stance not reported'}</span>
              </button>
              {source ? (
                <a className="inline-flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-control-hover hover:text-source focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${formatDate(decision.date)}`} title="Open source">
                  <Icon name="external" size={15} />
                  <span className="sr-only">Source</span>
                </a>
              ) : <span className="text-sm text-muted-foreground">Unavailable</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
