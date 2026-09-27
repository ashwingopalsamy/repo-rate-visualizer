import { useEffect, useMemo, useState } from 'react';
import { RangeChart } from './CountryAtlas.jsx';
import { formatCountryChange, formatCountryValue, getRecordAction } from '../data/countryModel.js';

function inDateRange(record, dateRange = {}) {
  return (!dateRange.start || record.recordDate >= dateRange.start) && (!dateRange.end || record.recordDate <= dateRange.end);
}

function included(record, filters = {}) {
  const action = filters.action || 'all';
  return action === 'all' || getRecordAction(record) === action;
}

function formatDate(value, locale = 'en-US') {
  if (!value) return 'Not reported';
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function ViewFrame({ eyebrow, title, description, children }) {
  return <section className="rounded-xl border border-border/60 bg-card p-4 sm:p-5" aria-label={title}>
    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
    <h3 className="m-0 text-lg font-bold tracking-tight text-foreground">{title}</h3>
    <p className="mb-0 mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{description}</p>
    <div className="mt-5">{children}</div>
  </section>;
}

export function CountryTimeline({ model, dateRange, recordFilters, showBand = true }) {
  const records = useMemo(() => model.records.filter(record => inDateRange(record, dateRange)), [model, dateRange.end, dateRange.start]);
  return <>
    <div className="mb-4 grid grid-cols-2 overflow-hidden rounded-xl border border-border/70 bg-muted/10 md:grid-cols-4">
      <div className="border-b border-border/70 px-3.5 py-3 md:border-b-0"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Records in range</span><strong className="mt-1 block text-xl tabular-nums">{records.length}</strong></div>
      <div className="border-b border-l border-border/70 px-3.5 py-3 md:border-b-0"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cuts</span><strong className="mt-1 block text-xl tabular-nums text-cut">{records.filter(r => getRecordAction(r) === 'cut').length}</strong></div>
      <div className="px-3.5 py-3 md:border-l md:border-border/70"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hikes</span><strong className="mt-1 block text-xl tabular-nums text-hike">{records.filter(r => getRecordAction(r) === 'hike').length}</strong></div>
      <div className="border-l border-border/70 px-3.5 py-3"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Framework changes</span><strong className="mt-1 block text-xl tabular-nums">{records.filter(r => getRecordAction(r) === 'framework').length}</strong></div>
    </div>
    <RangeChart records={records} title={model.instrument} view="timeline" showBand={showBand} locale={model.locale} />
    <p className="mt-3 mb-0 text-xs leading-5 text-muted-foreground">The chart shows all published {model.instrument} levels in this date range. The action filter affects the record list. Table dates are shown as published; the chart does not assert decision or effective dates.</p>
  </>;
}

export function CountryYearBreakdown({ model, dateRange, recordFilters }) {
  const rows = useMemo(() => {
    const groups = new Map();
    model.records.filter(record => inDateRange(record, dateRange) && included(record, recordFilters)).forEach(record => {
      const year = record.recordDate.slice(0, 4);
      if (!groups.has(year)) groups.set(year, { year, cuts: 0, hikes: 0, framework: 0, netBps: 0, total: 0 });
      const row = groups.get(year);
      const action = getRecordAction(record);
      row.total += 1;
      if (action === 'cut') { row.cuts += 1; row.netBps += record.changeBps; }
      if (action === 'hike') { row.hikes += 1; row.netBps += record.changeBps; }
      if (action === 'framework') row.framework += 1;
    });
    return [...groups.values()].sort((a, b) => b.year.localeCompare(a.year));
  }, [model, dateRange.end, dateRange.start, recordFilters.action]);
  const maxCount = Math.max(1, ...rows.map(row => row.total));
  return <ViewFrame eyebrow="PUBLISHED CHANGE COUNTS" title="Breakdown by year" description={`Counts group published cuts, hikes, and framework changes by the ${model.centralBank} table date. Framework changes are excluded from numeric basis-point totals.`}>
    {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[580px] border-collapse text-sm" aria-label={`Published ${model.instrument} changes by year`}><thead><tr className="border-b border-border/70 text-left text-xs text-muted-foreground"><th className="py-2 pr-4 font-semibold">Year</th><th className="py-2 px-3 font-semibold">Published records</th><th className="py-2 px-3 text-right font-semibold">Cuts</th><th className="py-2 px-3 text-right font-semibold">Hikes</th><th className="py-2 px-3 text-right font-semibold">Framework</th><th className="py-2 pl-3 text-right font-semibold">Net published moves</th></tr></thead><tbody>{rows.map(row => <tr key={row.year} className="border-b border-border/50"><th scope="row" className="py-3 pr-4 text-left font-semibold tabular-nums">{row.year}</th><td className="px-3 py-3"><div className="flex h-2 min-w-40 overflow-hidden rounded-full bg-muted" aria-label={`${row.total} published records`}><span className="h-full bg-cut" style={{ width: `${(row.cuts / maxCount) * 100}%` }} /><span className="h-full bg-hike" style={{ width: `${(row.hikes / maxCount) * 100}%` }} /><span className="h-full bg-muted-foreground/50" style={{ width: `${(row.framework / maxCount) * 100}%` }} /></div><span className="sr-only">{row.total} records</span></td><td className="px-3 py-3 text-right font-medium tabular-nums text-cut">{row.cuts}</td><td className="px-3 py-3 text-right font-medium tabular-nums text-hike">{row.hikes}</td><td className="px-3 py-3 text-right font-medium tabular-nums">{row.framework}</td><td className={`py-3 pl-3 text-right font-medium tabular-nums ${row.netBps < 0 ? 'text-cut' : row.netBps > 0 ? 'text-hike' : 'text-muted-foreground'}`}>{row.netBps > 0 ? '+' : ''}{row.netBps} bps</td></tr>)}</tbody></table></div> : <p className="m-0 text-sm text-muted-foreground">No published records match this range and action filter.</p>}
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span><i className="mr-1.5 inline-block size-2 rounded-full bg-cut" />Cuts</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-hike" />Hikes</span><span><i className="mr-1.5 inline-block size-2 rounded-full bg-muted-foreground/50" />Framework changes</span></div>
  </ViewFrame>;
}

export function CountryRateChanges({ model, dateRange, recordFilters }) {
  const records = useMemo(() => model.records.filter(record => inDateRange(record, dateRange) && included(record, recordFilters) && Number.isInteger(record.changeBps)), [model, dateRange.end, dateRange.start, recordFilters.action]);
  return <>
    <ViewFrame eyebrow="PUBLISHED MOVES" title="Rate changes" description={`Numeric changes use the published ${model.instrument} movement in basis points. Framework transitions are excluded from the numeric scale.`}>
      <RangeChart records={records} title={`Published ${model.instrument} changes`} view="changes" showBand={false} locale={model.locale} />
      <p className="mt-3 mb-0 text-xs leading-5 text-muted-foreground">Framework changes remain visible in the record list and are not assigned a basis-point value.</p>
    </ViewFrame>
  </>;
}

function publishedMoveRuns(records) {
  const runs = [];
  let run = null;
  const flush = () => { if (run) runs.push(run); run = null; };
  records.forEach(record => {
    const action = getRecordAction(record);
    if (action !== 'cut' && action !== 'hike') { flush(); return; }
    if (!run || run.action !== action) {
      flush();
      run = { action, records: [], totalBps: 0 };
    }
    run.records.push(record);
    run.totalBps += record.changeBps;
  });
  flush();
  return runs;
}

export function CountryMoveRuns({ model, dateRange, recordFilters }) {
  const runs = useMemo(() => publishedMoveRuns(model.records.filter(record => inDateRange(record, dateRange))).filter(run => (recordFilters.action || 'all') === 'all' || run.action === recordFilters.action).reverse(), [model, dateRange.end, dateRange.start, recordFilters.action]);
  return <ViewFrame eyebrow="PUBLISHED MOVE RUNS" title="Consecutive published moves" description="Each run groups consecutive published changes in the same direction. A framework change interrupts a run. This does not infer meeting-by-meeting stance or periods without a recorded change.">
    {runs.length ? <div className="grid gap-2 sm:grid-cols-2">{runs.map((run, index) => {
      const first = run.records[0];
      const last = run.records.at(-1);
      return <article className="rounded-xl border border-border/60 bg-muted/10 p-3.5" key={`${first.id}-${last.id}`}>
        <div className="flex items-start justify-between gap-3"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${run.action === 'cut' ? 'border-cut/30 bg-cut/10 text-cut' : 'border-hike/30 bg-hike/10 text-hike'}`}><span className={`size-1.5 rounded-full ${run.action === 'cut' ? 'bg-cut' : 'bg-hike'}`} />{run.action === 'cut' ? 'Easing' : 'Tightening'} · published moves</span><span className="text-xs tabular-nums text-muted-foreground">{run.records.length} {run.records.length === 1 ? 'move' : 'moves'}</span></div>
        <p className="mb-0 mt-3 text-sm font-semibold tabular-nums">{formatDate(first.recordDate, model.locale)} – {formatDate(last.recordDate, model.locale)}</p>
        <div className="mt-2 flex items-baseline justify-between gap-3"><span className={`text-xl font-bold tabular-nums ${run.action === 'cut' ? 'text-cut' : 'text-hike'}`}>{run.totalBps > 0 ? '+' : ''}{run.totalBps} bps</span><span className="text-xs text-muted-foreground">Published {model.instrument} moves</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-2 text-xs"><div><span className="block text-muted-foreground">First published value</span><strong className="mt-0.5 block font-semibold tabular-nums">{formatCountryValue(first.value)}</strong></div><div><span className="block text-muted-foreground">Last published value</span><strong className="mt-0.5 block font-semibold tabular-nums">{formatCountryValue(last.value)}</strong></div></div>
      </article>;
    })}</div> : <p className="m-0 text-sm text-muted-foreground">No consecutive published move runs match this range and action filter.</p>}
  </ViewFrame>;
}

function defaultWindows(model) {
  const start = model.coverage.from;
  const end = model.coverage.through;
  const mid = new Date((new Date(`${start}T00:00:00Z`).getTime() + new Date(`${end}T00:00:00Z`).getTime()) / 2).toISOString().slice(0, 10);
  const after = new Date(`${mid}T00:00:00Z`);
  after.setUTCDate(after.getUTCDate() + 1);
  return { aStart: start, aEnd: mid, bStart: after.toISOString().slice(0, 10), bEnd: end };
}

function summarizeWindow(model, start, end) {
  const records = model.records.filter(record => record.recordDate >= start && record.recordDate <= end);
  const cuts = records.filter(record => getRecordAction(record) === 'cut').length;
  const hikes = records.filter(record => getRecordAction(record) === 'hike').length;
  const framework = records.filter(record => getRecordAction(record) === 'framework').length;
  const first = records[0] || null;
  const last = records.at(-1) || null;
  let movement = 'No published changes in this window';
  if (first && last) {
    if (framework || records.some(record => record.value.kind !== first.value.kind) || first.value.kind !== last.value.kind) movement = 'Framework changed; rate endpoints are not directly comparable';
    else if (first.value.kind === 'range') movement = `Lower ${last.value.lowBps - first.value.lowBps > 0 ? '+' : ''}${last.value.lowBps - first.value.lowBps} bps · upper ${last.value.highBps - first.value.highBps > 0 ? '+' : ''}${last.value.highBps - first.value.highBps} bps`;
    else movement = `${last.value.lowBps - first.value.lowBps > 0 ? '+' : ''}${last.value.lowBps - first.value.lowBps} bps`;
  }
  return { start, end, records, first, last, cuts, hikes, framework, movement };
}

function WindowCard({ label, range, summary, onChange, min, max, accent }) {
  return <fieldset className="min-w-0 rounded-xl border border-border/70 p-3.5">
    <legend className={`px-1 text-xs font-semibold ${accent}`}>{label}</legend>
    <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs text-muted-foreground">Start <input className="h-9 min-w-0 rounded-md border border-border bg-background px-2 text-sm tabular-nums text-foreground" aria-label={`${label} start date`} type="date" min={min} max={max} value={range.start} onChange={event => onChange('Start', event.target.value)} /></label><label className="grid gap-1 text-xs text-muted-foreground">End <input className="h-9 min-w-0 rounded-md border border-border bg-background px-2 text-sm tabular-nums text-foreground" aria-label={`${label} end date`} type="date" min={min} max={max} value={range.end} onChange={event => onChange('End', event.target.value)} /></label></div>
    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/60 pt-3 text-xs"><span className="text-muted-foreground">Published records</span><strong className="text-right tabular-nums">{summary.records.length}</strong><span className="text-muted-foreground">Cuts · hikes · framework</span><strong className="text-right tabular-nums">{summary.cuts} · {summary.hikes} · {summary.framework}</strong><span className="text-muted-foreground">First published value</span><strong className="text-right tabular-nums">{summary.first ? formatCountryValue(summary.first.value) : '—'}</strong><span className="text-muted-foreground">Last published value</span><strong className="text-right tabular-nums">{summary.last ? formatCountryValue(summary.last.value) : '—'}</strong></div>
    <p className="mb-0 mt-3 text-xs font-medium leading-5 text-foreground">Endpoint change: {summary.movement}</p>
  </fieldset>;
}

export function CountryWindowCompare({ model, comparison, onComparisonChange }) {
  const [draft, setDraft] = useState(() => comparison || defaultWindows(model));
  useEffect(() => setDraft(comparison || defaultWindows(model)), [comparison, model]);
  const update = (key, value) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (next.aStart && next.aEnd && next.bStart && next.bEnd && next.aStart <= next.aEnd && next.bStart <= next.bEnd) onComparisonChange?.(next);
  };
  const summaryA = summarizeWindow(model, draft.aStart, draft.aEnd);
  const summaryB = summarizeWindow(model, draft.bStart, draft.bEnd);
  return <ViewFrame eyebrow="PUBLISHED RECORD WINDOWS" title="Compare two periods" description={`Compare counts and the first and last published ${model.instrument} values in each selected table-date window. Decision and effective dates are not reported.`}>
    <div className="grid gap-3 lg:grid-cols-2"><WindowCard label="Window A" range={{ start: draft.aStart, end: draft.aEnd }} summary={summaryA} onChange={(field, value) => update(field === 'Start' ? 'aStart' : 'aEnd', value)} min={model.coverage.from} max={model.coverage.through} accent="text-cut" /><WindowCard label="Window B" range={{ start: draft.bStart, end: draft.bEnd }} summary={summaryB} onChange={(field, value) => update(field === 'Start' ? 'bStart' : 'bEnd', value)} min={model.coverage.from} max={model.coverage.through} accent="text-hike" /></div>
  </ViewFrame>;
}
