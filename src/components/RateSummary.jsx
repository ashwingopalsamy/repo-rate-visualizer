import { ExternalLink } from 'lucide-react';
import { currentRate, decisions, sources, snapshotMeta } from '../data/dataLoader.js';
import { formatBps, getTrend } from '../lib/trend.js';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent } from './ui/card.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.jsx';

const sourceById = new Map(sources.map(source => [source.id, source]));
const latestDecision = decisions.at(-1);
const latestDecisionSource = latestDecision?.sourceIds
  ?.map(sourceId => sourceById.get(sourceId))
  .find(Boolean);
function toDate(value) {
  return value ? new Date(`${value}${value.length === 10 ? 'T00:00:00.000Z' : ''}`) : null;
}

function formatDate(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not reported';
}

function formatTimestamp(value) {
  return value ? new Date(value).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }) : 'Not reported';
}

export default function RateSummary() {
  const trend = getTrend(latestDecision?.action);
  const stance = latestDecision?.stance || 'Stance not reported';

  return (
    <section className="rate-summary" aria-labelledby="rate-summary-title" data-trend={trend.key}>
      <Card className="overflow-hidden rounded-2xl border-border/80 bg-card shadow-none">
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
            <div className="min-w-0 p-6 sm:p-8 lg:p-10">
              <div className="mb-9 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                <Badge className="px-2.5 py-1" variant="outline">Current reference</Badge>
                <span className="text-muted-foreground">Snapshot <code className="font-mono text-foreground">{snapshotMeta.id}</code></span>
              </div>
              <p className="mb-3 text-sm font-medium text-muted-foreground">Repo rate</p>
              <h1 id="rate-summary-title" className="m-0 flex items-end gap-2 font-sans font-medium leading-[0.88] tracking-[-0.065em] text-foreground tabular-nums">
                <span className="text-[clamp(4.5rem,11vw,7.5rem)]">{currentRate.rate.toFixed(2)}</span>
                <span className="pb-[0.08em] text-[clamp(2.75rem,5vw,4.25rem)] font-normal tracking-[-0.04em] text-muted-foreground">%</span>
              </h1>
              <p className="mt-6 mb-0 text-sm text-muted-foreground">
                Stance <span className={`font-medium ${trend.textClass}`}>{stance}</span>
              </p>
            </div>

            <div className="min-w-0 border-t border-border/80 p-6 sm:p-8 lg:border-t-0 lg:border-l lg:p-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current trend</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={`m-0 text-3xl font-semibold tracking-[-0.055em] ${trend.textClass}`}>{trend.actionLabel}</h2>
                    {latestDecisionSource?.url ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button asChild className="size-9" size="icon" variant="outline" aria-label={`Open official source for the latest ${trend.actionLabel.toLowerCase()} decision`} title="Open official source">
                            <a href={latestDecisionSource.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-4" aria-hidden="true" />
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open official source</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </div>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
                  <span className={`size-2.5 rounded-full ${trend.dotClass}`} />
                </span>
              </div>

              <div className="mt-8 rounded-2xl border border-border/70 bg-muted/30 p-4 sm:p-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Latest official decision:</p>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                  <time dateTime={latestDecision?.date} className="font-medium text-foreground">{formatDate(latestDecision?.date)}</time>
                  <span aria-hidden="true" className="text-border-strong">·</span>
                  <span className="font-semibold tabular-nums text-foreground">{latestDecision?.repoRate.toFixed(2)}%</span>
                  <span aria-hidden="true" className="text-border-strong">·</span>
                  <span className={`font-mono font-semibold tabular-nums ${trend.textClass}`}>{formatBps(latestDecision?.changeBps || 0)}</span>
                </div>
                <p className="mt-3 mb-0 text-xs text-muted-foreground">
                  Last checked <strong className="font-medium text-foreground">{formatTimestamp(snapshotMeta.retrievedAt)}</strong>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
