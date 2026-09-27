import { ExternalLink } from 'lucide-react';
import { formatCountryChange, formatCountryValue, getRecordAction } from '../data/countryModel.js';
import { getTrend } from '../lib/trend.js';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.jsx';

const ACTION_LABEL = { cut: 'Cut', hike: 'Hike', hold: 'Hold', framework: 'Framework change', initial: 'Baseline', observation: 'Observation' };

function formatDate(value, locale = 'en-US') {
  if (!value) return 'Not reported';
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function monthLabel(value, locale = 'en-US') {
  if (!value) return 'Not reported';
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(' ', " '");
}

function sourceFor(model, record) {
  return record?.sourceIds?.map(id => model.sources.find(source => source.id === id)).find(Boolean) || null;
}

function formatIndiaChange(record) {
  const action = getRecordAction(record);
  if (action === 'initial') return 'Baseline';
  if (action === 'cut') return `${record.changeBps < 0 ? record.changeBps : -record.changeBps} bps`;
  if (action === 'hike') return `+${record.changeBps} bps`;
  return '0 bps';
}

function IndiaOverview({ model }) {
  const latest = model.latestRecorded;
  const latestDecision = model.latestDecision;
  const currentValue = model.getCurrentValue();
  const trend = getTrend(latest?.action);
  const stanceCopy = latest?.stance ? `${latest.stance} stance` : 'no stance reported';
  const cycleLabel = latest?.action === 'cut' ? 'Latest action: cut' : latest?.action === 'hike' ? 'Latest action: hike' : latest?.action === 'hold' ? 'Latest action: hold' : 'Initial observation';
  const change = formatIndiaChange(latest);
  const source = sourceFor(model, latestDecision);
  const locale = 'en-IN';
  return <section className="rate-summary" aria-labelledby="rate-summary-title" data-trend={trend.key}>
    <div className="hero-rate-card overflow-hidden rounded-2xl border border-border/70 bg-card flex flex-col gap-0">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6 pb-4 border-b border-border/50">
        <h2 className="m-0 text-sm sm:text-base font-bold tracking-tight text-foreground">Overview</h2>
        <p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">Latest recorded repo rate from the RBI policy-rate series; the current record has {stanceCopy}.</p>
      </div>
      <div className="md:hidden px-5 py-5 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Latest Recorded Repo Rate</span>
          <div className="flex items-center gap-3">
            <div className="m-0 text-5xl font-bold tracking-tight leading-none rate-gradient-text tabular-nums" role="heading" aria-level="1">{currentValue.lowBps === currentValue.highBps ? `${(currentValue.lowBps / 100).toFixed(2)}%` : formatCountryValue(currentValue)}</div>
            <span className={`size-3 rounded-full ${trend.dotClass} shrink-0 ring-4 ring-background animate-pulse`} title={`${trend.actionLabel} (${stanceCopy})`} aria-label={`${trend.actionLabel} (${stanceCopy})`} />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border bg-muted/40 text-foreground border-border/60"><span className={`size-2 rounded-full ${trend.dotClass} shrink-0`} /><span>{cycleLabel}</span></div>
            <span className="text-xs text-muted-foreground">Recorded on {formatDate(latest?.recordDate, locale)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 rounded-xl border border-border/60 bg-muted/20"><div className="px-3.5 py-3"><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">Latest Recorded Action</span><div className={`mt-1.5 text-2xl font-bold tracking-tight leading-none tabular-nums ${latest?.action === 'cut' ? 'text-cut' : latest?.action === 'hike' ? 'text-hike' : 'rate-gradient-text'}`}>{change}</div></div></div>
        {source?.url ? <div className="flex items-center justify-end text-xs text-muted-foreground border-t border-border/50 pt-3 -mt-1"><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-3" aria-label="Open latest RBI policy source"><span>Open resolution</span><ExternalLink className="size-3" aria-hidden="true" /></a></div> : null}
      </div>
      <div className="hidden md:block px-6 py-6">
        <div className="grid grid-cols-3 gap-0 mb-3">
          <div className="px-6 text-center"><div className="flex h-6 items-center justify-center"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Latest Recorded Action</span></div></div>
          <div className="px-6 text-center"><div className="flex h-6 items-center justify-center"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current Repo Rate</span></div></div>
          <div className="px-6 text-center"><div className="flex h-6 items-center justify-center gap-1.5"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Latest decision</span>{source?.url ? <Tooltip><TooltipTrigger asChild><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors" aria-label="Open latest RBI policy source"><ExternalLink className="size-3" aria-hidden="true" /></a></TooltipTrigger><TooltipContent>Open official RBI resolution</TooltipContent></Tooltip> : null}</div></div>
        </div>
        <div className="grid grid-cols-3 gap-0 divide-x divide-border/50">
          <div className="flex flex-col justify-between gap-4 px-6 text-center"><div className="flex flex-1 items-center justify-center min-h-[4.25rem] lg:min-h-[4.75rem]"><span className={`text-3xl sm:text-4xl lg:text-[2.75rem] xl:text-[3rem] font-semibold tracking-tight leading-none tabular-nums ${latest?.action === 'cut' ? 'text-cut' : latest?.action === 'hike' ? 'text-hike' : 'rate-gradient-text'}`}>{change}</span></div><div className="flex items-center justify-center gap-2 flex-wrap"><div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border bg-muted/40 text-foreground border-border/60"><span className={`size-2 rounded-full ${trend.dotClass} shrink-0`} /><span>{cycleLabel}</span></div></div></div>
          <div className="flex flex-col justify-between gap-4 px-6 text-center"><div className="flex flex-1 items-center justify-center min-h-[4.25rem] lg:min-h-[4.75rem] gap-3"><h1 id="rate-summary-title" className="m-0 text-5xl lg:text-[4rem] xl:text-[4.25rem] font-bold tracking-tight leading-none rate-gradient-text tabular-nums">{currentValue.lowBps === currentValue.highBps ? `${(currentValue.lowBps / 100).toFixed(2)}%` : formatCountryValue(currentValue)}</h1><span className={`size-3 sm:size-3.5 rounded-full ${trend.dotClass} shrink-0 ring-4 ring-background animate-pulse`} title={`${trend.actionLabel} (${stanceCopy})`} aria-label={`${trend.actionLabel} (${stanceCopy})`} /></div><div className="flex items-center justify-center"><span className="text-xs font-medium text-muted-foreground">Recorded on {formatDate(latest?.recordDate, locale)}</span></div></div>
          <div className="flex flex-col justify-between gap-4 px-6 text-center"><div className="flex flex-1 items-center justify-center min-h-[4.25rem] lg:min-h-[4.75rem]"><span className="text-3xl sm:text-4xl lg:text-[2.75rem] xl:text-[3rem] font-semibold tracking-tight leading-none text-foreground tabular-nums rate-gradient-text">{monthLabel(latestDecision?.decisionDate || latestDecision?.recordDate, locale)}</span></div></div>
        </div>
      </div>
    </div>
  </section>;
}

function CountryOverviewCard({ model }) {
  const latest = model.latestRecorded;
  const currentValue = model.getCurrentValue();
  const action = getRecordAction(latest);
  const source = sourceFor(model, latest);
  const change = formatCountryChange(latest);
  const locale = model.locale || 'en-US';
  const hasRange = currentValue?.kind === 'range' && currentValue.lowBps !== currentValue.highBps;
  const lower = currentValue ? `${(currentValue.lowBps / 100).toFixed(2)}%` : 'Not reported';
  const upper = currentValue ? `${(currentValue.highBps / 100).toFixed(2)}%` : 'Not reported';

  return <section className="rate-summary" aria-labelledby="rate-summary-title" data-trend={action}>
    <div className="hero-rate-card overflow-hidden rounded-2xl border border-border/70 bg-card flex flex-col gap-0">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6 pb-4 border-b border-border/50">
        <h2 className="m-0 text-sm sm:text-base font-bold tracking-tight text-foreground">Overview</h2>
        <p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">Latest published {model.instrument.toLowerCase()} value and source-backed change record.</p>
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-0 mb-3">
          <div className="px-0 md:px-6 text-center"><div className="flex min-h-6 items-center justify-center"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Latest published change</span></div><strong className={`mt-4 block text-3xl sm:text-4xl lg:text-[2.75rem] xl:text-[3rem] font-semibold tracking-tight leading-none tabular-nums ${action === 'cut' ? 'text-cut' : action === 'hike' ? 'text-hike' : 'text-foreground'}`}>{change}</strong><span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-xs font-semibold"><span className={`size-2 rounded-full ${action === 'cut' ? 'bg-cut' : action === 'hike' ? 'bg-hike' : 'bg-muted-foreground'}`} aria-hidden="true" />{ACTION_LABEL[action] || 'Published change'}</span></div>
          <div className="border-y border-border/50 py-4 text-center md:border-y-0 md:border-x md:px-6 md:py-0"><div className="flex min-h-6 items-center justify-center"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current {model.instrument}</span></div><div className="mt-4 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1"><h1 id="rate-summary-title" className="m-0 whitespace-nowrap text-[clamp(2rem,10vw,3.5rem)] lg:text-[4rem] xl:text-[4.25rem] font-bold tracking-tight leading-none rate-gradient-text tabular-nums">{hasRange ? `${lower}–${upper}` : lower}</h1>{hasRange ? <span className="text-sm font-semibold">%</span> : null}</div><div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><span>{hasRange ? `Lower ${lower}` : 'Point target'}</span>{hasRange ? <span>Upper {upper}</span> : null}</div><span className="mt-3 block text-xs font-medium text-muted-foreground">Published {formatDate(latest?.recordDate, locale)}</span></div>
          <div className="px-0 pt-1 text-center md:px-6 md:pt-0"><div className="flex min-h-6 items-center justify-center gap-1.5"><span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Latest published record</span>{source?.url ? <Tooltip><TooltipTrigger asChild><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex text-muted-foreground hover:text-foreground" aria-label={`Open ${model.name} policy source`}><ExternalLink className="size-3" aria-hidden="true" /></a></TooltipTrigger><TooltipContent>Open primary source</TooltipContent></Tooltip> : null}</div><span className="mt-4 block text-3xl sm:text-4xl lg:text-[2.75rem] xl:text-[3rem] font-semibold tracking-tight leading-none text-foreground tabular-nums">{monthLabel(latest?.recordDate, locale)}</span><span className="mt-3 block text-xs font-medium text-muted-foreground">Decision date · {formatDate(latest?.decisionDate, locale)}</span></div>
        </div>
      </div>
    </div>
  </section>;
}

export default function CountryOverview({ model }) {
  if (!model) return null;
  return model.code === 'IN' ? <IndiaOverview model={model} /> : <CountryOverviewCard model={model} />;
}
