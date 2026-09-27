import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { formatCountryChange, formatCountryValue, getRecordAction } from '../data/countryModel.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'cut', label: 'Cuts' },
  { id: 'hike', label: 'Hikes' },
  { id: 'hold', label: 'Verified holds' },
  { id: 'framework', label: 'Framework' },
];

function formatDate(value, locale = 'en-US') {
  if (!value) return 'Not reported';
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function sourceFor(model, record) {
  return record.sourceIds?.map(id => model.sources.find(source => source.id === id)).find(Boolean) || null;
}

export default function CountryRecordList({ model, dateRange = {}, recordFilters = {}, onRecordFiltersChange, selectedRecordId = null, onRecordSelect }) {
  const [expanded, setExpanded] = useState(false);
  const visible = useMemo(() => model.records.filter(record => {
    if (dateRange.start && record.recordDate < dateRange.start) return false;
    if (dateRange.end && record.recordDate > dateRange.end) return false;
    return true;
  }), [model, dateRange.end, dateRange.start]);
  const filters = FILTERS.filter(({ id }) => id !== 'hold' || model.capabilities.holds).filter(({ id }) => id !== 'framework' || model.capabilities.framework);
  const counts = useMemo(() => Object.fromEntries(filters.map(({ id }) => [
    id,
    id === 'all' ? visible.length : visible.filter(record => getRecordAction(record) === id).length,
  ])), [filters, visible]);
  const filtered = useMemo(() => {
    const action = recordFilters.action || 'all';
    return visible.filter(record => action === 'all' || getRecordAction(record) === action).slice().reverse();
  }, [recordFilters.action, visible]);
  const shown = expanded ? filtered : filtered.slice(0, 10);
  const countLabel = filtered.length === 1 ? 'record' : 'records';

  useEffect(() => {
    if (!selectedRecordId) return;
    setExpanded(true);
    const frame = window.requestAnimationFrame(() => {
      const row = document.querySelector(`[data-record-id="${CSS.escape(selectedRecordId)}"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedRecordId]);

  return <section className="decision-record pt-6" aria-labelledby="country-rate-record-title" data-decision-count={visible.length}>
    <div className="decision-record__header flex flex-col gap-2.5 sm:flex-row sm:items-baseline sm:justify-between">
      <div><h2 id="country-rate-record-title" className="m-0 text-base font-bold tracking-tight text-foreground sm:text-lg">Rate record</h2>
        <p className="mt-0.5 mb-0 text-xs text-muted-foreground">{model.coverage.grain || `Published ${model.instrument} records from ${model.centralBank}. Omitted dates are not interpreted as unchanged policy.`}</p></div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{filtered.length} {countLabel}</span>
    </div>
    <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Filter records by published action">
      {filters.map(({ id, label }) => <button type="button" role="tab" aria-selected={(recordFilters.action || 'all') === id} key={id} onClick={() => onRecordFiltersChange?.({ ...recordFilters, action: id })}
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors shrink-0 ${(recordFilters.action || 'all') === id ? id === 'cut' ? 'bg-cut text-cut-foreground' : id === 'hike' ? 'bg-hike text-hike-foreground' : id === 'hold' ? 'bg-hold text-hold-foreground' : id === 'framework' ? 'bg-muted text-foreground' : 'bg-foreground text-background' : id === 'cut' ? 'bg-cut/10 text-cut hover:bg-cut/20' : id === 'hike' ? 'bg-hike/10 text-hike hover:bg-hike/20' : id === 'hold' ? 'bg-hold/10 text-hold hover:bg-hold/20' : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
        {label} ({counts[id]})</button>)}
    </div>
    <div className="decision-record__table-wrap mt-3 max-h-[560px] overflow-auto rounded-2xl border border-border/70 bg-card">
      <table className="w-full border-collapse text-sm" aria-label={`${model.name} target history records`}>
        <thead className="sticky top-0 z-10 bg-muted/50 text-left text-xs text-muted-foreground"><tr>
          <th className="px-4 py-3 font-semibold">Published date</th><th className="px-4 py-3 font-semibold">Record</th><th className="px-4 py-3 text-right font-semibold">Target</th><th className="px-4 py-3 text-right font-semibold">Change</th><th className="px-4 py-3 text-right font-semibold">Source</th>
        </tr></thead>
        <tbody>{shown.map(record => {
          const action = getRecordAction(record);
          const source = sourceFor(model, record);
          const color = action === 'cut' ? 'text-cut' : action === 'hike' ? 'text-hike' : 'text-muted-foreground';
          return <tr className={`border-t border-border/60 ${record.id === selectedRecordId ? 'bg-accent/60' : ''}`} key={record.id} data-action={action} data-record-id={record.id} aria-selected={record.id === selectedRecordId} tabIndex={0} onClick={() => onRecordSelect?.(record.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRecordSelect?.(record.id); } }}>
            <td className="whitespace-nowrap px-4 py-3.5 font-medium tabular-nums">{formatDate(record.recordDate, model.locale)}<span className="sr-only">; decision date {formatDate(record.decisionDate, model.locale)}; effective date {formatDate(record.effectiveDate, model.locale)}</span></td>
          <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${action === 'cut' ? 'border-cut/30 bg-cut/10 text-cut' : action === 'hike' ? 'border-hike/30 bg-hike/10 text-hike' : action === 'hold' ? 'border-hold/30 bg-hold/10 text-hold' : 'border-border bg-muted/50 text-muted-foreground'}`}><span className={`size-1.5 rounded-full ${action === 'cut' ? 'bg-cut' : action === 'hike' ? 'bg-hike' : action === 'hold' ? 'bg-hold' : 'bg-muted-foreground'}`} aria-hidden="true" />{action === 'cut' ? 'Cut' : action === 'hike' ? 'Hike' : action === 'hold' ? 'Verified hold' : action === 'framework' ? 'Framework' : 'Published change'}</span></td>
            <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums">{formatCountryValue(record.value)}</td>
            <td className={`whitespace-nowrap px-4 py-3.5 text-right font-medium tabular-nums ${color}`}>{formatCountryChange(record)}</td>
            <td className="whitespace-nowrap px-4 py-3.5 text-right">{source?.url ? <a className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${formatDate(record.recordDate, model.locale)}`} onClick={event => event.stopPropagation()}>Source <ExternalLink className="size-3" aria-hidden="true" /></a> : <span className="text-muted-foreground">Not reported</span>}</td>
          </tr>;
        })}</tbody>
      </table>
      {!filtered.length ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">No published changes match this filter.</p> : null}
    </div>
    {filtered.length > 10 ? <button type="button" className="mt-2.5 flex min-h-10 w-full items-center justify-center rounded-xl border border-border/60 bg-muted/10 px-4 text-xs font-medium text-muted-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Collapse published changes' : `Expand all ${filtered.length} published changes to full page`} <span aria-hidden="true" className="ml-2">{expanded ? '⌃' : '⌄'}</span></button> : null}
  </section>;
}
