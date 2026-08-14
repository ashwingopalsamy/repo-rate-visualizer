import { ExternalLink, ShieldCheck } from 'lucide-react';
import { currentRate, decisions, sources, snapshotMeta } from '../data/dataLoader.js';
import { formatBps, getTrend } from '../lib/trend.js';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent } from './ui/card.jsx';
import { Separator } from './ui/separator.jsx';

const sourceById = new Map(sources.map(source => [source.id, source]));
const latestDecision = decisions.at(-1);
const latestDecisionSource = latestDecision?.sourceIds
  ?.map(sourceId => sourceById.get(sourceId))
  .find(Boolean);
const latestPublishedSource = [...sources]
  .filter(source => source.publishedAt)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0]
  || latestDecisionSource;

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

function sourceTypeLabel(type = '') {
  if (type === 'policy-resolution') return 'MPC resolution';
  if (type === 'policy-minutes') return 'MPC minutes';
  if (type === 'current-policy-rates') return 'RBI policy rates';
  if (type === 'historical-rate-series') return 'Historical rate series';
  return 'Official source';
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
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h2 className={`m-0 text-3xl font-semibold tracking-[-0.055em] ${trend.textClass}`}>{trend.label}</h2>
                    <Badge variant={trend.badgeVariant}>{trend.actionLabel}</Badge>
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
              </div>

              {latestDecisionSource?.url ? (
                <Button asChild className="mt-8 w-fit px-0 text-sm" size="sm" variant="link">
                  <a href={latestDecisionSource.url} target="_blank" rel="noopener noreferrer" aria-label={`Open latest official decision source: ${latestDecisionSource.title}`}>
                    {sourceTypeLabel(latestDecisionSource.type)}
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>

          <Separator />
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 text-xs sm:px-8 lg:px-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="size-3.5 text-hold" aria-hidden="true" />
              <span>Source-backed snapshot</span>
            </div>
            <p className="m-0 text-muted-foreground">
              Last checked <strong className="font-medium text-foreground">{formatTimestamp(snapshotMeta.retrievedAt)}</strong>
            </p>
          </div>
        </CardContent>
      </Card>
      {latestPublishedSource?.title ? <span className="sr-only">Latest published source: {latestPublishedSource.title}</span> : null}
    </section>
  );
}
