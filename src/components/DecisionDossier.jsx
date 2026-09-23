import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, ExternalLink } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { loadSnapshotRelease } from '../data/dataLoader.js';
import { buildCitationBundle, citationFilename } from '../data/citationBundle.js';
import { actionForRecord, classifyEvidence, coverageSummary, EVIDENCE_STATUS } from '../lib/evidence.js';

function formatDate(value) {
  if (!value) return 'Not reported';
  return new Date(`${value}${String(value).length === 10 ? 'T00:00:00.000Z' : ''}`).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimestamp(value) {
  if (!value) return 'Not reported';
  return new Date(value).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatChange(decision) {
  if (decision.action === 'initial') return 'Baseline observation';
  if (decision.action === 'cut') return `${decision.changeBps} bps`;
  if (decision.action === 'hike') return `+${decision.changeBps} bps`;
  return '0 bps';
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function sourceLabel(status) {
  if (status === EVIDENCE_STATUS.PRIMARY_DECISION) return 'Direct RBI policy-resolution evidence';
  if (status === EVIDENCE_STATUS.HISTORICAL_SECONDARY) return 'Historical rate observation';
  if (status === EVIDENCE_STATUS.MIXED) return 'Mixed evidence record';
  return 'Official RBI context';
}

function publisherForSource(source) {
  try {
    const hostname = new URL(source.url).hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'rbi.org.in' || hostname.endsWith('.rbi.org.in')) return 'Reserve Bank of India';
    if (hostname === 'reuters.com' || hostname.endsWith('.reuters.com')) return 'Reuters';
    if (hostname === 'shriramfinance.in' || hostname.endsWith('.shriramfinance.in')) return 'Shriram Finance';
    return hostname;
  } catch {
    return 'Publisher not reported';
  }
}

export default function DecisionDossier({ recordId, requestedReleaseId }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', data: null, error: '' });
    loadSnapshotRelease(requestedReleaseId)
      .then(({ snapshot, release }) => {
        if (cancelled) return;
        const sources = snapshot.sources || [];
        const decisions = snapshot.decisions.map(decision => ({
          ...decision,
          ...classifyEvidence(decision, sources),
          dateObj: new Date(`${decision.date}T00:00:00.000Z`),
        }));
        const decision = decisions.find(item => item.id === recordId);
        if (!decision) {
          setState({ status: 'error', data: null, error: `Record ${recordId} is not present in this snapshot.` });
          return;
        }
        const regimes = (snapshot.regimes || []).map(regime => ({
          ...regime,
          startObj: new Date(`${regime.startDate}T00:00:00.000Z`),
          endObj: new Date(`${regime.endDate}T00:00:00.000Z`),
        }));
        const bundle = buildCitationBundle({
          decisions,
          sources,
          macroEvents: snapshot.events || [],
          regimes,
          release,
          selectedDecisionId: decision.id,
          scope: { route: 'decision-dossier' },
        });
        setState({
          status: 'ready',
          error: '',
          data: {
            decision,
            sources,
            release,
            bundle,
            coverage: coverageSummary(decisions, sources),
          },
        });
      })
      .catch(error => {
        if (!cancelled) setState({ status: 'error', data: null, error: error instanceof Error ? error.message : 'This snapshot could not be verified.' });
      });
    return () => {
      cancelled = true;
    };
  }, [recordId, requestedReleaseId]);

  const data = state.data;
  const sourceById = useMemo(() => new Map((data?.sources || []).map(source => [source.id, source])), [data?.sources]);
  const selectedSources = data?.decision?.sourceIds.map(sourceId => sourceById.get(sourceId)).filter(Boolean) || [];

  const copyCitation = async () => {
    if (!data?.bundle.citationText) return;
    try {
      await navigator.clipboard.writeText(data.bundle.citationText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (state.status === 'loading') {
    return <DossierShell><p className="text-sm text-muted-foreground" role="status">Verifying snapshot and loading record…</p></DossierShell>;
  }

  if (state.status === 'error') {
    return (
      <DossierShell>
        <Card className="rounded-2xl border-border/70 bg-card">
          <CardContent className="flex flex-col gap-3 p-6">
            <h1 autoFocus className="m-0 text-2xl font-bold tracking-tight text-foreground">Citable record unavailable</h1>
            <p className="m-0 text-sm leading-relaxed text-muted-foreground">{state.error}</p>
            <p className="m-0 text-xs leading-relaxed text-muted-foreground">The requested snapshot was not replaced with a newer one. Check the release identifier or return to the explorer.</p>
            <Button asChild className="w-fit" variant="outline"><a href="/">Back to explorer</a></Button>
          </CardContent>
        </Card>
      </DossierShell>
    );
  }

  const { decision, release, bundle, coverage } = data;
  const statusLabel = sourceLabel(decision.evidenceStatus);
  const isHistorical = decision.evidenceStatus === EVIDENCE_STATUS.HISTORICAL_SECONDARY;
  const publicationDate = selectedSources.find(source => source.publishedAt)?.publishedAt || null;

  return (
    <DossierShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" className="-ml-2 h-9 gap-1.5 px-2 text-xs">
          <a href="/" aria-label="Back to explorer"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to explorer</a>
        </Button>
        <Badge variant="outline" className="font-mono text-[10px]">{release.releaseId}</Badge>
      </div>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={decision.evidenceStatus === EVIDENCE_STATUS.PRIMARY_DECISION ? 'cut' : 'outline'}>{statusLabel}</Badge>
          <span className="text-xs text-muted-foreground">{decision.recordType === 'policy_decision' ? 'Policy decision' : 'Rate observation'}</span>
        </div>
        <h1 autoFocus className="m-0 max-w-4xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {decision.recordType === 'policy_decision' ? 'RBI policy decision' : 'Repo-rate observation'} · {formatDate(decision.date)}
        </h1>
        <p className="m-0 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {decision.repoRate.toFixed(2)}% repo rate · {actionForRecord(decision)} · {formatChange(decision)}
        </p>
      </header>

      {isHistorical ? (
        <aside className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground" role="note">
          This is a historical rate observation backed by secondary historical evidence. It is not a direct RBI decision-resolution citation.
        </aside>
      ) : null}

      <Card className="rounded-2xl border-border/70 bg-card shadow-2xs">
        <CardHeader className="border-b border-border/60 px-5 py-4 sm:px-6">
          <h2 className="m-0 text-base font-bold tracking-tight text-foreground">Record facts</h2>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <Fact label="Observation date" value={formatDate(decision.date)} />
          <Fact label="Decision date" value={formatDate(decision.decisionDate)} />
          <Fact label="Effective date" value={formatDate(decision.effectiveDate)} />
          <Fact label="Source publication date" value={formatDate(publicationDate)} />
          <Fact label="Repo rate" value={`${decision.repoRate.toFixed(2)}%`} />
          <Fact label="Recorded change" value={formatChange(decision)} />
          <Fact label="Stance" value={decision.stance || 'Not reported'} />
        </CardContent>
      </Card>

      {decision.summary ? (
        <Card className="rounded-2xl border-border/70 bg-card shadow-2xs">
          <CardHeader className="border-b border-border/60 px-5 py-4 sm:px-6"><h2 className="m-0 text-base font-bold tracking-tight text-foreground">Source summary</h2></CardHeader>
          <CardContent className="p-5 text-sm leading-relaxed text-muted-foreground sm:p-6">{decision.summary}</CardContent>
        </Card>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="dossier-sources-title">
        <h2 id="dossier-sources-title" className="m-0 text-base font-bold tracking-tight text-foreground">Supporting sources</h2>
        {selectedSources.map(source => (
          <Card className="rounded-2xl border-border/70 bg-card shadow-2xs" key={source.id}>
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div className="min-w-0">
                <p className="m-0 text-sm font-semibold text-foreground">{source.title}</p>
                <p className="mt-1 mb-0 text-xs text-muted-foreground">Publisher: {publisherForSource(source)} · {source.type}</p>
                <p className="mt-1 mb-0 text-xs text-muted-foreground">Published {formatDate(source.publishedAt)} · retrieved {formatTimestamp(source.retrievedAt)}</p>
                <a className="mt-1 block break-all text-xs text-muted-foreground underline decoration-border underline-offset-2 hover:text-foreground" href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a>
                <p className="mt-1 mb-0 text-xs text-muted-foreground">Evidence: {decision.evidenceLabel}</p>
                <code className="mt-2 block break-all text-[10px] leading-4 text-muted-foreground">{source.checksum || 'Checksum not reported'}</code>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0"><a href={source.url} target="_blank" rel="noopener noreferrer">Open source <ExternalLink className="size-3.5" aria-hidden="true" /></a></Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-2xl border-border/70 bg-muted/15 shadow-none">
        <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
          <div>
            <h2 className="m-0 text-base font-bold tracking-tight text-foreground">Snapshot and coverage</h2>
            <p className="mt-1 mb-0 text-xs leading-relaxed text-muted-foreground">{coverage.totalRecords} records · {coverage.directDecisionRecords} direct RBI decisions · {coverage.historicalObservationRecords} historical observations.</p>
          </div>
          <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <Fact label="Release" value={release.releaseId} mono />
            <Fact label="Artifact SHA-256" value={release.artifactSha256 || 'Not reported'} mono />
            <Fact label="Snapshot retrieved" value={formatTimestamp(release.retrievedAt)} />
            <Fact label="Latest direct decision" value={formatDate(release.latestOfficialDate)} />
          </dl>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card shadow-2xs">
        <CardHeader className="border-b border-border/60 px-5 py-4 sm:px-6"><h2 className="m-0 text-base font-bold tracking-tight text-foreground">How to cite</h2></CardHeader>
        <CardContent className="flex flex-col gap-3 p-5 sm:p-6">
          <p className="m-0 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-5 text-foreground">{bundle.citationText}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void copyCitation()}>{copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}{copied ? 'Copied' : 'Copy citation'}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadText(JSON.stringify(bundle, null, 2), citationFilename({ format: 'json', view: 'decision', releaseId: release.releaseId }), 'application/json;charset=utf-8;')}><Download className="size-3.5" aria-hidden="true" />Download JSON</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadText(bundle.citationText, citationFilename({ format: 'txt', view: 'decision', releaseId: release.releaseId }), 'text/plain;charset=utf-8;')}><Download className="size-3.5" aria-hidden="true" />Download text</Button>
          </div>
          <p className="m-0 text-[11px] leading-5 text-muted-foreground" role="status">{copied ? 'Citation copied to the clipboard.' : 'The citation includes the record, source, and verified snapshot identity.'}</p>
        </CardContent>
      </Card>
    </DossierShell>
  );
}

function Fact({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-semibold text-foreground ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</dd>
    </div>
  );
}

function DossierShell({ children }) {
  return (
    <div className="chartbook-app min-h-screen w-full bg-background text-foreground">
      <main className="mx-auto flex w-full max-w-[920px] flex-col gap-6 px-4 py-5 pb-16 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
