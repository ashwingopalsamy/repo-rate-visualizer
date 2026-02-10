import { ExternalLink } from 'lucide-react';
import { currentRate, decisions, sources, snapshotMeta } from '../data/dataLoader.js';
import { getTrend } from '../lib/trend.js';
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

function formatMonthYear(value) {
  const date = toDate(value);
  if (!date) return 'Not reported';
  const month = date.toLocaleDateString('en-IN', { month: 'short' });
  const year2 = date.toLocaleDateString('en-IN', { year: '2-digit' });
  return `${month} '${year2}`;
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

function formatBpsChange(changeBps, action) {
  if (action === 'cut') return `${changeBps < 0 ? changeBps : `-${changeBps}`} bps`;
  if (action === 'hike') return `+${changeBps} bps`;
  return '0 bps';
}

export default function RateSummary() {
  const trend = getTrend(latestDecision?.action);
  const stance = latestDecision?.stance || 'neutral';
  const changeBps = latestDecision?.changeBps || 0;
  const isCut = latestDecision?.action === 'cut';
  const isHike = latestDecision?.action === 'hike';

  const stanceLabel = stance ? `${stance.charAt(0).toUpperCase() + stance.slice(1)} stance` : 'Neutral stance';
  const cycleLabel = isCut ? 'New easing cycle' : isHike ? 'Tightening cycle' : stanceLabel;

  return (
    <section className="rate-summary" aria-labelledby="rate-summary-title" data-trend={trend.key}>
      <div className="hero-rate-card overflow-hidden rounded-2xl border border-border/70 bg-card flex flex-col gap-0">

        {/* Editorial header — inside the card */}
        <div className="px-5 pt-5 sm:px-6 sm:pt-6 pb-4 border-b border-border/50">
          <h2 className="m-0 text-sm sm:text-base font-bold tracking-tight text-foreground">
            Overview
          </h2>
          <p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Effective benchmark repo rate announced by the Reserve Bank of India, maintained under a {stance} stance by the Monetary Policy Committee.
          </p>
        </div>

        {/* MOBILE LAYOUT (below md) */}
        <div className="md:hidden px-5 py-5 flex flex-col gap-5">
          {/* 1. Current Repo Rate */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current Repo Rate
            </span>
            <div className="flex items-center gap-3">
              <div className="m-0 text-5xl font-bold tracking-tight leading-none rate-gradient-text tabular-nums" role="heading" aria-level="1">
                {currentRate.rate.toFixed(2)}%
              </div>
              <span
                className={`size-3 rounded-full ${trend.dotClass} shrink-0 ring-4 ring-background animate-pulse`}
                title={`${trend.actionLabel} (${stance} stance)`}
                aria-label={`${trend.actionLabel} (${stance} stance)`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border bg-muted/40 text-foreground border-border/60">
                <span className={`size-2 rounded-full ${trend.dotClass} shrink-0`} />
                <span>{cycleLabel}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Effective since {formatDate(latestDecision?.date)}
              </span>
            </div>
          </div>

          {/* 2. 2-col grid: Last MPC action + Current trend */}
          <div className="grid grid-cols-2 divide-x divide-border/50 rounded-xl border border-border/60 bg-muted/20">
            <div className="px-3.5 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Last MPC Action</span>
              <div className={`mt-1.5 text-2xl font-bold tracking-tight leading-none tabular-nums ${
                isCut ? 'text-cut' : isHike ? 'text-hike' : 'rate-gradient-text'
              }`}>
                {formatBpsChange(changeBps, latestDecision?.action)}
              </div>
            </div>
            <div className="px-3.5 py-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Current Trend</span>
              <div className="mt-1.5 text-sm font-semibold text-foreground leading-tight">{trend.actionLabel}</div>
            </div>
          </div>

          {/* 3. Provenance strip */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3 -mt-1">
            <div className="flex flex-col gap-0.5">
              <span><span className="font-semibold text-foreground/75">MPC decision</span> · {formatDate(latestDecision?.date)}</span>
              <span>Updated {formatDate(snapshotMeta.retrievedAt)}</span>
            </div>
            {latestDecisionSource?.url ? (
              <a
                href={latestDecisionSource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-3"
                aria-label="Open official RBI policy resolution"
              >
                <span>Resolution</span>
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>

        {/* DESKTOP LAYOUT (md+) */}
        <div className="hidden md:block px-6 py-6">

          {/* All three column headers on the same horizontal plane, all center-aligned */}
          <div className="grid grid-cols-3 gap-0 mb-3">
            <div className="px-6 text-center">
              <div className="flex h-6 items-center justify-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Last MPC Action
                </span>
              </div>
            </div>
            <div className="px-6 text-center">
              <div className="flex h-6 items-center justify-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Repo Rate
                </span>
              </div>
            </div>
            <div className="px-6 text-center">
              <div className="flex h-6 items-center justify-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Latest decision
                </span>
                {latestDecisionSource?.url ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={latestDecisionSource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Open official RBI policy resolution"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>Open official RBI resolution</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </div>
          </div>

          {/* Main data zones divided by vertical lines — all center aligned */}
          <div className="grid grid-cols-3 gap-0 divide-x divide-border/50">

            {/* 1. Left Zone: BPS + stance/trend */}
            <div className="flex flex-col justify-between gap-4 px-6 text-center">
              <div className="flex flex-1 items-center justify-center min-h-[4.25rem] lg:min-h-[4.75rem]">
                <span className={`text-3xl sm:text-4xl lg:text-[2.75rem] xl:text-[3rem] font-semibold tracking-tight leading-none tabular-nums ${
                  isCut ? 'text-cut' : isHike ? 'text-hike' : 'rate-gradient-text'
                }`}>
                  {formatBpsChange(changeBps, latestDecision?.action)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border bg-muted/40 text-foreground border-border/60">
                  <span className={`size-2 rounded-full ${trend.dotClass} shrink-0`} />
                  <span>{cycleLabel}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground/75">Current trend</span>: {trend.actionLabel}
                </div>
              </div>
            </div>

            {/* 2. Centre Zone: big rate + "Effective since" */}
            <div className="flex flex-col justify-between gap-4 px-6 text-center">
              <div className="flex flex-1 items-center justify-center min-h-[4.25rem] lg:min-h-[4.75rem] gap-3">
                <h1
                  id="rate-summary-title"
                  className="m-0 text-5xl lg:text-[4rem] xl:text-[4.25rem] font-bold tracking-tight leading-none rate-gradient-text tabular-nums"
                >
                  {currentRate.rate.toFixed(2)}%
                </h1>
                <span
                  className={`size-3 sm:size-3.5 rounded-full ${trend.dotClass} shrink-0 ring-4 ring-background animate-pulse`}
                  title={`${trend.actionLabel} (${stance} stance)`}
                  aria-label={`${trend.actionLabel} (${stance} stance)`}
                />
              </div>
              <div className="flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground">
                  Effective since {formatDate(latestDecision?.date)}
                </span>
              </div>
            </div>

            {/* 3. Right Zone: Date + Updated */}
            <div className="flex flex-col justify-between gap-4 px-6 text-center">
              <div className="flex flex-1 items-center justify-center min-h-[4.25rem] lg:min-h-[4.75rem]">
                <span className="text-3xl sm:text-4xl lg:text-[2.75rem] xl:text-[3rem] font-semibold tracking-tight leading-none text-foreground tabular-nums rate-gradient-text">
                  {formatMonthYear(latestDecision?.date)}
                </span>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-xs font-medium text-muted-foreground" title={formatTimestamp(snapshotMeta.retrievedAt)}>
                  Updated {formatDate(snapshotMeta.retrievedAt)}
                </span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
