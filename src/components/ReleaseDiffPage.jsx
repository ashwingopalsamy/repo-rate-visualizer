import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, ExternalLink } from 'lucide-react';
import { fetchManifest, loadSnapshotRelease, snapshotMeta } from '../data/dataLoader.js';
import { actionForRecord } from '../lib/evidence.js';
import { buildReleaseDiffCsv, buildReleaseDiffText, diffReleaseSnapshots } from '../lib/releaseDiff.js';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';

function formatDate(value) {
  if (!value) return 'Not reported';
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RecordList({ title, records, tone = '' }) {
  return (
    <section className="space-y-2">
      <h2 className={`m-0 text-sm font-semibold ${tone}`}>{title} <span className="font-normal text-muted-foreground">({records.length})</span></h2>
      {records.length ? <div className="divide-y divide-border/60 rounded-xl border border-border/70">{records.slice(0, 20).map(record => <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm"><span><span className="font-medium">{formatDate(record.date)}</span><span className="ml-2 text-muted-foreground">{record.repoRate.toFixed(2)}% · {actionForRecord(record)}</span></span><Button asChild size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs"><a href={`/decision/${encodeURIComponent(record.id)}?snapshot=${encodeURIComponent(snapshotMeta.releaseId)}`}>Dossier <ExternalLink className="size-3" /></a></Button></div>)}</div> : <p className="m-0 rounded-xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground">No records in this category.</p>}
      {records.length > 20 ? <p className="m-0 text-xs text-muted-foreground">Showing 20 of {records.length}; download the release artifacts for the complete diff.</p> : null}
    </section>
  );
}

export default function ReleaseDiffPage() {
  const [manifest, setManifest] = useState(null);
  const [fromId, setFromId] = useState(() => new URLSearchParams(window.location.search).get('from') || '');
  const [toId, setToId] = useState(() => new URLSearchParams(window.location.search).get('to') || snapshotMeta.releaseId);
  const [state, setState] = useState({ status: 'loading', error: '', from: null, to: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchManifest().then(next => {
      if (cancelled) return;
      const valid = (next?.snapshots || []).filter(entry => entry.releaseId && entry.artifactSha256);
      setManifest({ ...next, snapshots: valid });
      if (!fromId) {
        const previous = valid.filter(entry => entry.releaseId !== snapshotMeta.releaseId).at(-1);
        if (previous) setFromId(previous.releaseId);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!fromId || !toId) return undefined;
    let cancelled = false;
    setState(current => ({ ...current, status: 'loading', error: '' }));
    Promise.all([loadSnapshotRelease(fromId), loadSnapshotRelease(toId)])
      .then(([from, to]) => { if (!cancelled) setState({ status: 'ready', error: '', from, to }); })
      .catch(error => { if (!cancelled) setState({ status: 'error', error: error instanceof Error ? error.message : 'Release diff unavailable.', from: null, to: null }); });
    const query = new URLSearchParams({ from: fromId, to: toId });
    window.history.replaceState(null, '', `/releases?${query.toString()}`);
    return () => { cancelled = true; };
  }, [fromId, toId]);

  const diff = useMemo(() => state.status === 'ready' ? diffReleaseSnapshots(state.from.snapshot, state.to.snapshot) : null, [state]);
  const options = manifest?.snapshots || [];

  const downloadDiff = (format) => {
    if (!diff || state.status !== 'ready') return;
    const payload = format === 'json'
      ? JSON.stringify({ from: state.from.release, to: state.to.release, diff }, null, 2)
      : format === 'csv'
        ? buildReleaseDiffCsv({ diff, fromRelease: state.from.release, toRelease: state.to.release })
        : buildReleaseDiffText({ diff, fromRelease: state.from.release, toRelease: state.to.release });
    const mime = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/plain';
    const url = URL.createObjectURL(new Blob([payload], { type: `${mime};charset=utf-8` }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `rbi-release-diff--${state.from.release.releaseId}--${state.to.release.releaseId}.${format}`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const copyDiff = async () => {
    if (!diff || state.status !== 'ready') return;
    try {
      await navigator.clipboard.writeText(buildReleaseDiffText({ diff, fromRelease: state.from.release, toRelease: state.to.release }));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1080px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Button asChild variant="ghost" className="-ml-2 w-fit gap-1.5 px-2 text-xs"><a href="/"><ArrowLeft className="size-3.5" />Back to explorer</a></Button>
      <header><p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Release history</p><h1 className="mt-2 mb-0 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">What changed between releases?</h1><p className="mt-2 mb-0 max-w-3xl text-sm leading-6 text-muted-foreground">A content-addressed diff of records and sources. The current release is never silently substituted for a pinned selection.</p></header>
      <Card className="rounded-2xl border-border/70 shadow-2xs"><CardHeader><CardTitle className="text-base">Choose two releases</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">From<select className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm font-normal text-foreground" value={fromId} onChange={event => setFromId(event.target.value)}><option value="">Select an archived release</option>{options.map(entry => <option key={entry.releaseId} value={entry.releaseId}>{entry.releaseId} · {entry.date}</option>)}</select></label><label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">To<select className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm font-normal text-foreground" value={toId} onChange={event => setToId(event.target.value)}>{options.map(entry => <option key={entry.releaseId} value={entry.releaseId}>{entry.releaseId} · {entry.date}</option>)}</select></label></div></CardContent></Card>
      {state.status === 'loading' ? <div className="rounded-xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">Loading and verifying both release artifacts…</div> : null}
      {state.status === 'error' ? <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive" role="alert">{state.error}</div> : null}
      {diff && state.status === 'ready' ? <section className="space-y-5" aria-label="Release differences"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="m-0 text-xl font-semibold">Release differences</h2><div className="flex flex-wrap items-center gap-1.5"><Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void copyDiff()}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy text'}</Button><Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => downloadDiff('csv')}><Download className="size-3.5" />CSV</Button><Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => downloadDiff('json')}><Download className="size-3.5" />JSON</Button><Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => downloadDiff('txt')}><Download className="size-3.5" />Text</Button></div></div><div className="grid gap-3 sm:grid-cols-4"><div className="rounded-xl border border-border/70 bg-muted/20 p-3"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Added records</span><strong className="mt-1 block text-2xl tabular-nums">{diff.added.length}</strong></div><div className="rounded-xl border border-border/70 bg-muted/20 p-3"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Removed records</span><strong className="mt-1 block text-2xl tabular-nums">{diff.removed.length}</strong></div><div className="rounded-xl border border-border/70 bg-muted/20 p-3"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Changed records</span><strong className="mt-1 block text-2xl tabular-nums">{diff.changed.length}</strong></div><div className="rounded-xl border border-border/70 bg-muted/20 p-3"><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Changed sources</span><strong className="mt-1 block text-2xl tabular-nums">{diff.sourceChanges.length}</strong></div></div><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">From {state.from.release.releaseId}</Badge><span>→</span><Badge variant="outline">To {state.to.release.releaseId}</Badge><span>· {formatDate(state.to.release.retrievedAt)} retrieved</span></div><div className="grid gap-5 lg:grid-cols-2"><RecordList title="Added records" records={diff.added} tone="text-cut" /><RecordList title="Removed records" records={diff.removed} tone="text-destructive" /><RecordList title="Changed records" records={diff.changed.map(item => item.current)} tone="text-hike" /></div></section> : null}
    </main>
  );
}
