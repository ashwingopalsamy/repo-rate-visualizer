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
    <section className="decision-record pt-8" aria-labelledby="timeline-decisions-title" data-decision-count={filteredDecisions.length}>
      <div className="decision-record__header flex w-full flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Decision spine</p>
          <h2 id="timeline-decisions-title" className="m-0 text-lg font-semibold tracking-[-0.035em] text-foreground sm:text-xl">Official decision record</h2>
          <p className="mt-1.5 mb-0 max-w-2xl text-sm leading-6 text-muted-foreground">Every source-backed decision in the selected range, including holds.</p>
          <p className="mt-2 mb-0 text-xs leading-5 text-muted-foreground"><strong className="font-medium text-foreground">{decisions.length} decisions</strong> · {formatDate(decisions[0]?.date)} – {formatDate(decisions.at(-1)?.date)}</p>
        </div>
        <Badge className="font-mono tabular-nums" variant="outline">{filteredDecisions.length} in range</Badge>
      </div>

      {selectedDecision ? (
        <div className="decision-selection mt-5 flex w-full flex-wrap items-center gap-x-3 gap-y-2 border-y border-border/80 py-3 text-sm" role="status" aria-live="polite">
          <Badge variant={getTrend(selectedDecision.action).badgeVariant}>
            <span className={`size-1.5 rounded-full ${getTrend(selectedDecision.action).dotClass}`} aria-hidden="true" />
            Selected {getTrend(selectedDecision.action).actionLabel}
          </Badge>
          <span className="text-muted-foreground">{formatDate(selectedDecision.date)} · <strong className="font-medium text-foreground tabular-nums">{selectedDecision.repoRate.toFixed(2)}%</strong> · {formatBps(selectedDecision.changeBps)}</span>
          {selectedSource ? (
            <Button asChild className="h-8 px-2 text-xs" size="sm" variant="ghost">
              <a href={selectedSource.url} target="_blank" rel="noopener noreferrer" aria-label={`Open selected source for ${formatDate(selectedDecision.date)}`}>
                Open source
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className={`${selectedDecision ? 'mt-4' : 'mt-6'} decision-spine-list decision-table-wrap w-full overflow-hidden rounded-2xl border border-border/80`} role="list" aria-label="Official RBI decisions">
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
            <TableRow className="border-border/80 bg-muted/35 hover:bg-muted/35">
              <TableHead>Date</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Stance</TableHead>
              <TableHead className="text-right">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDecisions.slice().reverse().map(decision => {
              const source = decision.sourceIds.map(sourceId => sourceById.get(sourceId)).find(Boolean);
              const trend = getTrend(decision.action);
              const isActive = activeDecisionId === decision.id;

              return (
                <TableRow className={`decision-spine-row focus-visible:outline-none ${isActive ? 'decision-spine-row--active' : ''}`} data-action={decision.action} data-decision-id={decision.id} key={decision.id} role="listitem" tabIndex="-1">
                  <TableCell data-label="Date" className="whitespace-nowrap">
                    <Button
                      className="decision-spine-select h-8 justify-start px-0 text-left text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
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
                    <Badge variant={trend.badgeVariant}>
                      <span className={`size-1.5 rounded-full ${trend.dotClass}`} aria-hidden="true" />
                      {trend.actionLabel}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Rate" className="font-semibold tabular-nums text-foreground">{decision.repoRate.toFixed(2)}%</TableCell>
                  <TableCell data-label="Change" className={`font-mono text-sm font-semibold tabular-nums ${trend.textClass}`}>{formatBps(decision.changeBps)}</TableCell>
                  <TableCell data-label="Stance" className="whitespace-normal break-words text-muted-foreground">{decision.stance || 'Stance not reported'}</TableCell>
                  <TableCell data-label="Source" className="text-right">
                    {source ? (
                      <Button asChild className="size-8" size="icon-sm" variant="ghost">
                        <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${formatDate(decision.date)}`} title="Open source">
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                          <span className="sr-only">Source</span>
                        </a>
                      </Button>
                    ) : <span className="text-sm text-muted-foreground">Unavailable</span>}
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
