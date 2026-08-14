import { currentRate, decisions, sources, snapshotMeta } from '../data/dataLoader.js';
import { formatBps, getTrend } from '../lib/trend.js';
import { Badge } from './ui/badge.jsx';
import Icon from './ui/icon.jsx';

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

function conciseSourceLabel(source, date) {
  return source ? `${sourceTypeLabel(source.type)} · ${formatDate(source.publishedAt || date)}` : 'Official RBI decision source';
}

function SourceAction({ source, children, label }) {
  if (!source?.url) return null;
  return (
    <a
      className="group inline-flex min-h-10 min-w-0 items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-source focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label || `Open ${source.title}`}
    >
      <span className="min-w-0 break-words">{children}</span>
      <Icon name="external" size={14} className="shrink-0 text-muted-foreground transition-colors group-hover:text-source" />
    </a>
  );
}

export default function RateSummary() {
  const trend = getTrend(latestDecision?.action);
  const stance = latestDecision?.stance || 'Stance not reported';

  return (
    <section className="rate-summary border-y border-border/80 py-7 sm:py-8 lg:py-9" aria-labelledby="rate-summary-title" data-trend={trend.key}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)] lg:gap-12">
        <div className="min-w-0">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Repo rate</p>
          <h1 id="rate-summary-title" className="m-0 flex items-end gap-3 font-sans font-medium leading-[0.88] tracking-[-0.045em] text-foreground proportional-nums">
            <span className="text-[clamp(4.25rem,10vw,6.5rem)]">{currentRate.rate.toFixed(2)}</span>
            <span className="pb-[0.08em] text-[clamp(2.5rem,5vw,3.75rem)] font-normal tracking-[-0.03em] text-muted-foreground">%</span>
          </h1>
          <p className="mt-5 mb-0 text-sm text-muted-foreground">
            Effective <time dateTime={currentRate.date} className="font-medium text-foreground">{formatDate(currentRate.date)}</time>
            <span aria-hidden="true" className="mx-2 text-border-strong">·</span>
            <span>{stance}</span>
          </p>
        </div>

        <div className="min-w-0 border-t border-border/70 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span aria-hidden="true" className={`size-2 rounded-full ${trend.dotClass}`} />
            Current trend
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <h2 className={`m-0 text-2xl font-semibold tracking-[-0.04em] ${trend.textClass}`}>{trend.label}</h2>
            <Badge variant={trend.badgeVariant}>{trend.actionLabel}</Badge>
            <span className={`text-sm font-medium tabular-nums ${trend.textClass}`}>{formatBps(latestDecision?.changeBps || 0)}</span>
          </div>
          <p className="mt-4 mb-0 text-sm leading-6 text-muted-foreground">
            Latest official decision: <time dateTime={latestDecision?.date} className="font-medium text-foreground">{formatDate(latestDecision?.date)}</time> at <span className="font-medium tabular-nums text-foreground">{latestDecision?.repoRate.toFixed(2)}%</span>.
          </p>
          <div className="mt-3">
            <SourceAction source={latestDecisionSource} label={`Open latest official decision source: ${latestDecisionSource?.title || 'RBI source'}`}>
              {conciseSourceLabel(latestDecisionSource, latestDecision?.date)}
            </SourceAction>
          </div>
        </div>
      </div>

      <div className="rate-summary__provenance mt-7 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/70 pt-4 text-xs text-muted-foreground sm:mt-8">
        <span>Source published <strong className="font-medium text-foreground">{formatDate(latestPublishedSource?.publishedAt || snapshotMeta.latestSourcePublishedAt)}</strong></span>
        <span aria-hidden="true" className="hidden size-1 rounded-full bg-border-strong sm:block" />
        <span>Verified <strong className="font-medium text-foreground">{formatTimestamp(snapshotMeta.retrievedAt)}</strong></span>
        <span aria-hidden="true" className="hidden size-1 rounded-full bg-border-strong sm:block" />
        <span>Snapshot <code className="font-mono font-medium text-foreground">{snapshotMeta.id}</code></span>
      </div>

      {latestPublishedSource?.title ? (
        <span className="sr-only">Latest published source: {latestPublishedSource.title}</span>
      ) : null}
    </section>
  );
}
