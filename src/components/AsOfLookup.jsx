import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Search } from 'lucide-react';
import { loadSnapshotRelease, snapshotMeta } from '../data/dataLoader.js';
import { actionForRecord, enrichDecision } from '../lib/evidence.js';
import { asOfLookup } from '../lib/analysisState.js';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Input } from './ui/input.jsx';

function sourceFor(decision, sources) {
  return decision?.sourceIds?.map(id => sources.find(source => source.id === id)).find(Boolean) || null;
}

function formatDate(value) {
  if (!value) return 'Not reported';
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RecordSummary({ title, decision, sources, releaseId, emptyCopy }) {
  if (!decision) return <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">{emptyCopy}</div>;
  const source = sourceFor(decision, sources);
  return (
    <article className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold text-foreground">{title}</h2>
        <Badge variant="outline">{decision.evidenceLabel}</Badge>
      </div>
      <p className="mt-3 mb-0 text-xl font-bold tabular-nums text-foreground">{decision.repoRate.toFixed(2)}%</p>
      <p className="mt-1 mb-0 text-sm text-muted-foreground">{formatDate(decision.date)} · {actionForRecord(decision)} · {decision.recordType === 'policy_decision' ? 'Policy decision' : 'Rate observation'}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5"><a href={`/decision/${encodeURIComponent(decision.id)}?snapshot=${encodeURIComponent(releaseId)}`}>Open dossier <ExternalLink className="size-3" /></a></Button>
        {source ? <a className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={source.url} target="_blank" rel="noopener noreferrer">Source <ExternalLink className="size-3" /></a> : null}
      </div>
    </article>
  );
}

export default function AsOfLookup() {
  const initialParams = new URLSearchParams(window.location.search);
  const [date, setDate] = useState(() => initialParams.get('date') || '');
  const [draft, setDraft] = useState(date);
  const [requestedReleaseId, setRequestedReleaseId] = useState(() => initialParams.get('snapshot') || snapshotMeta.releaseId);
  const [releaseState, setReleaseState] = useState({ status: 'loading', decisions: [], sources: [], release: null, error: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReleaseState(current => ({ ...current, status: 'loading', error: '' }));
    loadSnapshotRelease(requestedReleaseId)
      .then(loaded => {
        if (cancelled) return;
        const releaseSources = loaded.release.sources || [];
        const releaseDecisions = loaded.snapshot.decisions
          .map(decision => enrichDecision(decision, releaseSources))
          .map(decision => ({ ...decision, dateObj: new Date(`${decision.date}T00:00:00.000Z`) }));
        setReleaseState({ status: 'ready', decisions: releaseDecisions, sources: releaseSources, release: loaded.release, error: '' });
      })
      .catch(error => {
        if (!cancelled) setReleaseState({ status: 'error', decisions: [], sources: [], release: null, error: error instanceof Error ? error.message : 'Pinned release unavailable.' });
      });
    return () => { cancelled = true; };
  }, [requestedReleaseId]);

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const nextDate = params.get('date') || '';
      setDate(nextDate);
      setDraft(nextDate);
      setRequestedReleaseId(params.get('snapshot') || snapshotMeta.releaseId);
    };
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const result = useMemo(() => asOfLookup(releaseState.decisions, date), [date, releaseState.decisions]);
  const release = releaseState.release || snapshotMeta;
  const releaseId = release.releaseId || snapshotMeta.releaseId;
  const citationText = result?.preceding
    ? `RBI repo rate recorded on or before ${date}: ${result.preceding.repoRate.toFixed(2)}% (${result.preceding.date}, ${result.preceding.evidenceLabel}). RBI Repo Rate Visualizer, ${releaseId}, retrieved ${release.retrievedAt || 'not reported'}. ${window.location.origin}/as-of?date=${encodeURIComponent(date)}&snapshot=${encodeURIComponent(releaseId)}`
    : '';

  const submit = event => {
    event.preventDefault();
    const next = draft && /^\d{4}-\d{2}-\d{2}$/.test(draft) ? draft : '';
    const query = next ? `?date=${encodeURIComponent(next)}&snapshot=${encodeURIComponent(releaseId)}` : `?snapshot=${encodeURIComponent(releaseId)}`;
    window.history.pushState(null, '', `/as-of${query}`);
    setDate(next);
  };

  const latestRecordDate = release.latestRecordedDate || releaseState.decisions.at(-1)?.date || '';

  const copyCitation = async () => {
    if (!citationText) return;
    try {
      await navigator.clipboard.writeText(citationText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[980px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Button asChild variant="ghost" className="-ml-2 w-fit gap-1.5 px-2 text-xs"><a href="/"><ArrowLeft className="size-3.5" />Back to explorer</a></Button>
      <header>
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Research lookup</p>
        <h1 className="mt-2 mb-0 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">What rate was recorded on this date?</h1>
        <p className="mt-2 mb-0 max-w-2xl text-sm leading-6 text-muted-foreground">This answers from the selected immutable release. A date with no exact record uses the latest preceding observation and shows the next known record separately.</p>
      </header>
      <Card className="rounded-2xl border-border/70 shadow-2xs">
        <CardHeader><CardTitle className="text-base">Choose a date</CardTitle></CardHeader>
        <CardContent>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
            <Input type="date" value={draft} min={releaseState.decisions[0]?.date} max={latestRecordDate} onChange={event => setDraft(event.target.value)} aria-label="Date for rate lookup" />
            <Button type="submit" className="gap-1.5"><Search className="size-4" />Look up</Button>
            <Button type="button" variant="outline" onClick={() => { setDraft(latestRecordDate); setDate(latestRecordDate); window.history.pushState(null, '', `/as-of?date=${latestRecordDate}&snapshot=${encodeURIComponent(releaseId)}`); }}>Latest record</Button>
          </form>
        </CardContent>
      </Card>
      {releaseState.status === 'loading' ? <div className="rounded-xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">Loading and verifying the pinned release…</div> : null}
      {releaseState.status === 'error' ? <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive" role="alert">{releaseState.error}</div> : null}
      {result && releaseState.status === 'ready' ? (
        <section className="space-y-3" aria-labelledby="as-of-results-title">
          <div><h2 id="as-of-results-title" className="m-0 text-lg font-semibold">{formatDate(result.date)}</h2><p className="mt-1 mb-0 text-sm text-muted-foreground">Release {releaseId} · exact date {result.exact ? 'recorded' : 'not separately recorded'}</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <RecordSummary title={result.exact ? 'Exact recorded observation' : 'Latest preceding recorded rate'} decision={result.preceding} sources={releaseState.sources} releaseId={releaseId} emptyCopy="No preceding record exists in this release." />
            <RecordSummary title="Next known record" decision={result.next} sources={releaseState.sources} releaseId={releaseId} emptyCopy="No later record exists in this release." />
          </div>
          {citationText ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-3"><p className="m-0 max-w-3xl text-xs leading-5 text-muted-foreground">{citationText}</p><Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={() => void copyCitation()}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy citation'}</Button></div> : null}
        </section>
      ) : <div className="rounded-xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">Choose a date to inspect the nearest recorded rate.</div>}
    </main>
  );
}
