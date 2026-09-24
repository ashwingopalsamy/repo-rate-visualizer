import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { decisions, snapshotMeta } from '../data/dataLoader.js';
import { filterDecisions, formatRangeLabel, windowSummary } from '../lib/analysisState.js';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';

const latestDate = snapshotMeta.latestRecordedDate || decisions.at(-1)?.date || '';
const earliestDate = decisions[0]?.date || '';

function defaultComparison() {
  const end = new Date(`${latestDate}T00:00:00.000Z`);
  const currentStart = new Date(end);
  currentStart.setFullYear(currentStart.getUTCFullYear() - 5);
  const previousEnd = new Date(currentStart);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCFullYear(previousStart.getUTCFullYear() - 5);
  return {
    aStart: currentStart.toISOString().slice(0, 10),
    aEnd: latestDate,
    bStart: previousStart.toISOString().slice(0, 10),
    bEnd: previousEnd.toISOString().slice(0, 10),
  };
}

function safeComparison(value) {
  return value?.aStart && value?.aEnd && value?.bStart && value?.bEnd ? value : defaultComparison();
}

function formatChange(value) {
  return `${value > 0 ? '+' : ''}${value} bps`;
}

function Summary({ label, summary, accent }) {
  return (
    <article className="rounded-xl border border-border/70 bg-muted/20 p-4" data-comparison-window={label.toLowerCase()}>
      <div className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>{label}</div>
      <div className="mt-1 text-sm text-muted-foreground">{formatRangeLabel(summary.dateRange)}</div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Opening rate</span><strong className="mt-1 block tabular-nums">{summary.first ? `${summary.first.repoRate.toFixed(2)}%` : '—'}</strong></div>
        <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Closing rate</span><strong className="mt-1 block tabular-nums">{summary.last ? `${summary.last.repoRate.toFixed(2)}%` : '—'}</strong></div>
        <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Recorded change</span><strong className="mt-1 block tabular-nums">{formatChange(summary.netBps)}</strong></div>
        <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Records</span><strong className="mt-1 block tabular-nums">{summary.totalRecords}</strong></div>
        <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Moves</span><strong className="mt-1 block tabular-nums">{summary.moveCount} <span className="font-normal text-muted-foreground">({summary.cutCount} cuts · {summary.hikeCount} hikes)</span></strong></div>
        <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Largest move</span><strong className="mt-1 block tabular-nums">{summary.largestMove ? formatChange(summary.largestMove.changeBps) : '—'}</strong></div>
      </div>
      <p className="mt-4 mb-0 text-xs text-muted-foreground">{summary.sourceCount} linked source records across this window.</p>
    </article>
  );
}

export default function WindowComparison({ comparison, onComparisonChange, recordFilters }) {
  const [draft, setDraft] = useState(() => safeComparison(comparison));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (comparison) setDraft(safeComparison(comparison));
  }, [comparison]);

  const sourceFilteredDecisions = useMemo(() => filterDecisions(decisions, { recordFilters }), [recordFilters]);
  const summaryA = useMemo(() => windowSummary(sourceFilteredDecisions, { start: draft.aStart, end: draft.aEnd }), [draft.aEnd, draft.aStart, sourceFilteredDecisions]);
  const summaryB = useMemo(() => windowSummary(sourceFilteredDecisions, { start: draft.bStart, end: draft.bEnd }), [draft.bEnd, draft.bStart, sourceFilteredDecisions]);

  const update = (key, value) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onComparisonChange?.(next);
  };

  const comparisonText = JSON.stringify({
    releaseId: snapshotMeta.releaseId,
    windows: { A: summaryA.dateRange, B: summaryB.dateRange },
    A: { records: summaryA.totalRecords, moves: summaryA.moveCount, netBps: summaryA.netBps },
    B: { records: summaryB.totalRecords, moves: summaryB.moveCount, netBps: summaryB.netBps },
  }, null, 2);

  const copyComparison = async () => {
    try {
      await navigator.clipboard.writeText(comparisonText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const downloadComparison = () => {
    const blob = new Blob([comparisonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rbi-repo-rate-comparison-${snapshotMeta.releaseId}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="space-y-5" data-comparison-workspace>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Research comparison</span>
        <h2 className="m-0 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Two windows, one release.</h2>
        <p className="mt-0.5 mb-0 max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">Compare recorded repo-rate paths without implying that the difference is causal. Both windows use the active evidence filters and the same immutable snapshot.</p>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/10 p-3 sm:grid-cols-2 sm:p-4">
        <fieldset className="min-w-0 space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-cut">Window A</legend>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" min={earliestDate} max={latestDate} value={draft.aStart} aria-label="Window A start" onChange={event => update('aStart', event.target.value)} />
            <Input type="date" min={earliestDate} max={latestDate} value={draft.aEnd} aria-label="Window A end" onChange={event => update('aEnd', event.target.value)} />
          </div>
        </fieldset>
        <fieldset className="min-w-0 space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider text-hike">Window B</legend>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" min={earliestDate} max={latestDate} value={draft.bStart} aria-label="Window B start" onChange={event => update('bStart', event.target.value)} />
            <Input type="date" min={earliestDate} max={latestDate} value={draft.bEnd} aria-label="Window B end" onChange={event => update('bEnd', event.target.value)} />
          </div>
        </fieldset>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Summary label="Window A" summary={summaryA} accent="text-cut" />
        <Summary label="Window B" summary={summaryB} accent="text-hike" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
        <p className="m-0 text-xs text-muted-foreground">Release <span className="font-mono">{snapshotMeta.releaseId.slice(0, 20)}…</span> · {summaryA.totalRecords + summaryB.totalRecords} window records counted.</p>
        <div className="flex items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void copyComparison()}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy comparison'}</Button>
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={downloadComparison}><Download className="size-3.5" />Download JSON</Button>
        </div>
      </div>
    </div>
  );
}
