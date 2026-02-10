import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { decisions, sources } from '../data/dataLoader.js';
import { getTrend, formatBps } from '../lib/trend.js';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.jsx';

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

function formatDateShort(value) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Mobile card row for a single decision - sleek 2-row split layout */
function DecisionCard({ decision, source, isActive, onSelect }) {
  const trend = getTrend(decision.action);
  return (
    <button
      type="button"
      className={`decision-card w-full text-left transition-all duration-150 rounded-xl border px-3.5 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isActive
          ? 'decision-card--active border-foreground/40 bg-accent/70 shadow-2xs'
          : 'border-border/60 bg-card hover:border-border-strong hover:bg-muted/30'
      }`}
      data-mobile-decision-id={decision.id}
      data-action={decision.action}
      aria-pressed={isActive}
      aria-label={`${trend.actionLabel} on ${formatDate(decision.date)}, repo rate ${decision.repoRate.toFixed(2)} percent, ${formatBps(decision.changeBps)}`}
      onClick={() => onSelect?.(decision.id)}
    >
      {/* Row 1: Left = Date & Stance; Right = Big Rate & Bps */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <time className="text-xs font-bold text-foreground tabular-nums whitespace-nowrap" dateTime={decision.date}>
            {formatDateShort(decision.date)}
          </time>
          {decision.stance ? (
            <span className="text-[11px] text-muted-foreground truncate font-normal">
              · {decision.stance}
            </span>
          ) : null}
        </div>

        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-base font-extrabold tabular-nums text-foreground leading-none">
            {decision.repoRate.toFixed(2)}%
          </span>
          <span className={`text-xs font-semibold tabular-nums ${trend.textClass}`}>
            {formatBps(decision.changeBps)}
          </span>
        </div>
      </div>

      {/* Row 2: Left = Action badge; Right = External source link */}
      <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-border/40">
        <Badge className="px-2 py-0.5 text-[10px] shrink-0" variant={trend.badgeVariant}>
          <span className={`size-1.5 rounded-full ${trend.dotClass}`} aria-hidden="true" />
          {trend.actionLabel}
        </Badge>

        {source ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open source for ${formatDate(decision.date)}`}
            title="Open official RBI source"
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <span>Source</span>
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </button>
  );
}

export default function DecisionTimelineList({ dateRange, activeDecisionId, onDecisionSelect }) {
  const filteredDecisions = visibleDecisions(dateRange);
  const selectedDecision = filteredDecisions.find(decision => decision.id === activeDecisionId);
  const selectedSource = selectedDecision?.sourceIds.map(sourceId => sourceById.get(sourceId)).find(Boolean);

  useEffect(() => {
    if (!activeDecisionId) return;
    const row = document.querySelector(`.decision-record [data-decision-id="${CSS.escape(activeDecisionId)}"], .decision-record [data-mobile-decision-id="${CSS.escape(activeDecisionId)}"]`);
    if (row) {
      const rect = row.getBoundingClientRect();
      if (rect.top < 96 || rect.bottom > window.innerHeight - 32) {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeDecisionId]);

  return (
    <section className="decision-record pt-6" aria-labelledby="timeline-decisions-title" data-decision-count={filteredDecisions.length}>
      <div className="decision-record__header flex items-baseline justify-between gap-3">
        <div>
          <h2 id="timeline-decisions-title" className="m-0 text-base font-bold tracking-tight text-foreground sm:text-lg">Official decision record</h2>
          <p className="mt-1 mb-0 text-xs text-muted-foreground">Every source-backed decision in the selected range, including holds.</p>
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">{filteredDecisions.length} decisions</span>
      </div>

      {selectedDecision ? (
        <div className="decision-selection mt-3 flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-xl border border-border/80 bg-muted/30 px-3.5 py-2 text-sm" role="status" aria-live="polite">
          <div className="flex items-center gap-2.5">
            <Badge className="px-2.5 py-0.5" variant={getTrend(selectedDecision.action).badgeVariant}>
              <span className={`size-1.5 rounded-full ${getTrend(selectedDecision.action).dotClass}`} aria-hidden="true" />
              Selected {getTrend(selectedDecision.action).actionLabel}
            </Badge>
            <span className="text-muted-foreground">{formatDate(selectedDecision.date)} · <strong className="font-semibold text-foreground tabular-nums">{selectedDecision.repoRate.toFixed(2)}%</strong> · {formatBps(selectedDecision.changeBps)}</span>
          </div>
          {selectedSource ? (
            <Button asChild className="h-7 px-2.5 text-xs" size="sm" variant="outline">
              <a href={selectedSource.url} target="_blank" rel="noopener noreferrer" aria-label={`Open selected source for ${formatDate(selectedDecision.date)}`}>
                Open source
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* ── MOBILE: stacked card feed (<sm) ── */}
      <div className={`${selectedDecision ? 'mt-3' : 'mt-4'} sm:hidden`}>
        <div className="decision-card-feed flex flex-col gap-2" role="list" aria-label="Official RBI decisions">
          {filteredDecisions.slice().reverse().map(decision => {
            const source = decision.sourceIds.map(sourceId => sourceById.get(sourceId)).find(Boolean);
            return (
              <div key={decision.id} role="listitem">
                <DecisionCard
                  decision={decision}
                  source={source}
                  isActive={activeDecisionId === decision.id}
                  onSelect={onDecisionSelect}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── DESKTOP: table (sm+) ── */}
      <div className={`${selectedDecision ? 'mt-3' : 'mt-4'} hidden sm:block decision-spine-list decision-table-wrap w-full overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xs`} role="list" aria-label="Official RBI decisions">
        <Table className="decision-table" aria-label="Official RBI decisions">
          <colgroup>
            <col style={{ width: '17%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '31%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Date</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Decision</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rate</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Change</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Stance</TableHead>
              <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDecisions.slice().reverse().map(decision => {
              const source = decision.sourceIds.map(sourceId => sourceById.get(sourceId)).find(Boolean);
              const trend = getTrend(decision.action);
              const isActive = activeDecisionId === decision.id;

              return (
                <TableRow className={`decision-spine-row transition-colors focus-visible:outline-none ${isActive ? 'decision-spine-row--active' : 'hover:bg-muted/30'}`} data-action={decision.action} data-decision-id={decision.id} key={decision.id} role="listitem" tabIndex="-1">
                  <TableCell data-label="Date" className="whitespace-nowrap">
                    <Button
                      className="decision-spine-select h-7 justify-start px-0 text-left text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      size="sm"
                      variant="link"
                      aria-pressed={isActive}
                      aria-label={`Select ${trend.actionLabel} on ${formatDate(decision.date)}, repo rate ${decision.repoRate.toFixed(2)} percent, ${formatBps(decision.changeBps)}`}
                      onClick={event => {
                        onDecisionSelect?.(decision.id);
                        event.currentTarget.closest('.decision-spine-row')?.focus({ preventScroll: true });
                      }}
                    >
                      <time dateTime={decision.date}>{formatDate(decision.date)}</time>
                    </Button>
                  </TableCell>
                  <TableCell data-label="Decision">
                    <Badge className="px-2 py-0.5" variant={trend.badgeVariant}>
                      <span className={`size-1.5 rounded-full ${trend.dotClass}`} aria-hidden="true" />
                      {trend.actionLabel}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Rate" className="font-bold tabular-nums text-foreground">{decision.repoRate.toFixed(2)}%</TableCell>
                  <TableCell data-label="Change" className={`text-xs font-semibold tabular-nums ${trend.textClass}`}>{formatBps(decision.changeBps)}</TableCell>
                  <TableCell data-label="Stance" className="whitespace-normal break-words text-xs text-muted-foreground">{decision.stance || 'Stance not reported'}</TableCell>
                  <TableCell data-label="Source" className="text-right">
                    {source ? (
                      <Button asChild className="size-7" size="icon-sm" variant="ghost">
                        <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${formatDate(decision.date)}`} title="Open source">
                          <ExternalLink className="size-3.5 text-muted-foreground hover:text-foreground" aria-hidden="true" />
                          <span className="sr-only">Source</span>
                        </a>
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">Unavailable</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
