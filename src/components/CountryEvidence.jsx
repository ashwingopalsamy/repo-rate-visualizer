import { useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import { downloadCountryCsv } from '../data/countryCsv.js';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader } from './ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.jsx';

function formatDate(value, locale = 'en-US') {
  if (!value) return 'Not reported';
  return new Date(value).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatTimestamp(value, locale = 'en-US') {
  if (!value) return 'Not reported';
  return new Date(value).toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' });
}

function MetadataValue({ label, value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-muted-foreground">Not reported</span>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
  };
  return <button type="button" onClick={() => void copy()} className="inline-flex max-w-full items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground" aria-label={copied ? `${label} copied` : `Copy ${label}`}>
    {copied ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : <Copy className="size-3.5 shrink-0" aria-hidden="true" />}
    <span className="truncate">{copied ? 'Copied' : value}</span>
  </button>;
}

export default function CountryEvidence({ model }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const sourceCounts = useMemo(() => {
    const counts = new Map(model.sources.map(source => [source.id, 0]));
    model.records.forEach(record => record.sourceIds.forEach(id => counts.set(id, (counts.get(id) || 0) + 1)));
    return counts;
  }, [model]);
  if (!model) return null;
  const locale = model.locale || 'en-US';
  const officialCount = model.records.filter(record => record.recordType === 'policy_decision').length;
  const observationCount = model.records.filter(record => record.recordType === 'rate_observation').length;

  return <section className="source-transparency" aria-labelledby="source-panel-title">
    <Card className="gap-0 overflow-hidden rounded-xl border border-border/70 bg-card py-0 shadow-none">
      <CardHeader className="data-evidence__masthead flex flex-col gap-4 border-b-0 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-7 sm:py-5">
        <div className="min-w-0 flex-1">
          <h2 id="source-panel-title" className="m-0 block text-base font-bold tracking-tight text-foreground sm:text-lg">{model.name} {model.instrument} evidence</h2>
          <p className="mt-1 mb-0 text-xs text-muted-foreground sm:text-sm">Source records and release metadata used to build this country’s policy-rate history.</p>
          <div className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span>{model.coverage.totalRecords} records</span><span aria-hidden="true">·</span>
            <span>{model.code === 'IN' ? `${officialCount} direct decisions · ${observationCount} observations` : `${model.records.filter(record => record.recordType === 'policy_change').length} published changes`}</span><span aria-hidden="true">·</span>
            <span>{model.sources.length} sources</span><span aria-hidden="true">·</span>
            <span>Coverage {formatDate(model.coverage.from, locale)} to {formatDate(model.coverage.through, locale)}</span>
          </div>
        </div>
        <div className="data-evidence__actions flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" className="h-9 gap-1.5" variant="outline" aria-expanded={sourcesOpen} onClick={() => setSourcesOpen(value => !value)}>{sourcesOpen ? 'Hide sources' : 'View all sources'}</Button>
          <Button className="data-evidence__download h-9" size="default" variant="outline" onClick={() => downloadCountryCsv(model)}><Download className="size-4" aria-hidden="true" />Download CSV</Button>
        </div>
      </CardHeader>

      <dl className="grid grid-cols-1 items-start gap-x-6 gap-y-3 border-t border-border/70 bg-muted/10 px-4 py-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4 sm:px-7">
        <div className="min-w-0"><dt className="font-semibold text-foreground">Release</dt><dd className="mt-1 mb-0 flex h-8 items-center"><MetadataValue label="release ID" value={model.release.releaseId} /></dd></div>
        <div className="min-w-0"><dt className="font-semibold text-foreground">Snapshot retrieved</dt><dd className="mt-1 mb-0 flex h-8 items-center">{formatTimestamp(model.release.retrievedAt, locale)}</dd></div>
        <div className="min-w-0"><dt className="font-semibold text-foreground">Latest published record</dt><dd className="mt-1 mb-0 flex h-8 items-center">{formatDate(model.coverage.through, locale)}</dd></div>
        <div className="min-w-0"><dt className="font-semibold text-foreground">Artifact SHA-256</dt><dd className="mt-1 mb-0 flex h-8 items-center"><MetadataValue label="SHA-256" value={model.release.artifactSha256} /></dd></div>
      </dl>

      {sourcesOpen ? <CardContent className="border-t border-border/70 px-0 py-0">
        <div className="source-list overflow-x-auto" role="list"><Table className="source-table min-w-[680px]" aria-label={`${model.name} source records`}>
          <TableHeader><TableRow className="border-border/70 bg-muted/40 hover:bg-muted/40"><TableHead>Category</TableHead><TableHead>Source</TableHead><TableHead>Published / retrieved</TableHead><TableHead>Linked</TableHead><TableHead className="text-right">Integrity</TableHead></TableRow></TableHeader>
          <TableBody>{model.sources.map(source => <TableRow className="source-record border-border/70" data-source-id={source.id} key={source.id} role="listitem">
            <TableCell><span className="source-record__category-badge">{(source.type || source.role || 'Primary source').replaceAll('-', ' ')}</span></TableCell>
            <TableCell className="align-top"><a className="inline-flex items-start gap-1.5 font-medium text-foreground hover:underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden="true" /></a>{source.role ? <p className="mb-0 mt-1 text-xs text-muted-foreground">{source.role}</p> : null}</TableCell>
            <TableCell>{source.publishedAt ? `Published ${formatDate(source.publishedAt, locale)}` : `Retrieved ${formatDate(source.retrievedAt, locale)}`}</TableCell><TableCell>{sourceCounts.get(source.id) || 0}</TableCell>
            <TableCell className="text-right"><details className="inline-block text-left"><summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" aria-hidden="true" />Integrity</summary><span className="mt-1 block max-w-64 break-all text-[10px] text-muted-foreground">{source.checksum || source.sha256 ? `SHA-256 ${source.checksum || source.sha256}` : 'Source checksum not reported.'}</span></details></TableCell>
          </TableRow>)}</TableBody>
        </Table></div>
      </CardContent> : null}

      <div className="border-t border-border/70 px-4 py-4 sm:px-7">
        <h3 className="m-0 text-sm font-semibold text-foreground">Reading this series</h3>
        <p className="mb-0 mt-2 max-w-4xl text-xs leading-5 text-muted-foreground">{model.code === 'IN'
          ? 'India records include historical repo-rate observations and directly evidenced policy decisions; their evidence types remain distinct in the record and export.'
          : model.code === 'US'
            ? 'Federal Reserve table dates are preserved as published. Decision dates and effective dates are not reported in this release. Rows do not represent every FOMC meeting. The point-to-range framework change is not treated as a numeric move, and no midpoint or unchanged meeting is inferred.'
            : `${model.centralBank} source dates are preserved as published. Decision dates and effective dates are not reported unless explicitly sourced. Published records do not represent every policy meeting. Framework transitions remain separate from numeric changes; no midpoint or unrecorded unchanged meeting is inferred.`}</p>
      </div>
    </Card>
  </section>;
}
