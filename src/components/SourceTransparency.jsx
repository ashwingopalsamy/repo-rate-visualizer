import { useState } from 'react';
import { Check, ChevronDown, Copy, Download, ExternalLink, FileText, Landmark, Scale, ShieldCheck } from 'lucide-react';
import { decisions, macroEvents, regimes, sources } from '../data/dataLoader.js';
import { buildDecisionCsv } from '../data/csvExport.js';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader } from './ui/card.jsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible.jsx';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.jsx';

function formatDate(value) {
  if (!value) return 'Not reported';
  return new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
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

const CATEGORY_LABELS = Object.freeze({
  'policy-archive': 'Policy archive',
  'policy-resolution': 'Policy resolution',
  'current-policy-rates': 'Current rates',
  'policy-minutes': 'Policy minutes',
  'historical-rate-series': 'Historical series',
  'secondary-historical-reference': 'Secondary reference',
});

function formatType(type = '') {
  return type.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
}

function compactType(type = '') {
  return CATEGORY_LABELS[type] || formatType(type);
}

function downloadCsv() {
  const csvContent = buildDecisionCsv({ decisions, sources, macroEvents, regimes, dateRange: {} });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rbi_repo_rate_decisions_all.csv';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function IntegrityPopover({ source, linkedCount }) {
  const [copied, setCopied] = useState(false);

  const copyChecksum = async () => {
    if (!source.checksum) return;
    try {
      await navigator.clipboard.writeText(source.checksum);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="source-integrity-trigger min-h-9 justify-start px-2 text-xs text-muted-foreground" size="sm" variant="ghost" aria-label={`Open integrity details for ${source.title}`}>
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          <span>Integrity</span>
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} collisionPadding={12} className="source-integrity-popover w-[min(360px,calc(100vw-2rem))]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="m-0 text-sm font-semibold text-foreground">Integrity &amp; retrieval</p>
            <p className="mt-1 mb-0 text-xs leading-5 text-muted-foreground">Technical provenance for this source record.</p>
          </div>
          <ShieldCheck className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Retrieved</dt>
            <dd className="mt-1 text-foreground">{formatTimestamp(source.retrievedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Linked</dt>
            <dd className="mt-1 tabular-nums text-foreground">{linkedCount} {linkedCount === 1 ? 'decision' : 'decisions'}</dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-border/80 pt-3">
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-5 text-foreground">{source.checksum || 'Checksum not reported'}</code>
            {source.checksum ? (
              <Button className="min-h-9 shrink-0 px-2 text-xs" size="sm" variant="outline" onClick={copyChecksum} aria-label={copied ? 'Checksum copied' : 'Copy checksum'}>
                {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function SourceTransparency() {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const coverageStart = decisions[0]?.date;
  const coverageEnd = decisions.at(-1)?.date;

  return (
    <section className="data-evidence" aria-labelledby="source-panel-title">
      <Card className="gap-0 overflow-hidden rounded-xl border border-border/70 bg-card py-0 shadow-none">
        <Collapsible className="data-evidence__collapsible" open={sourcesOpen} onOpenChange={setSourcesOpen}>
          <CardHeader className="data-evidence__masthead flex flex-col gap-4 border-b-0 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-7 sm:py-5">
            <div className="min-w-0 flex-1">
              <h2 id="source-panel-title" className="m-0 block text-base font-bold tracking-tight text-foreground sm:text-lg">Historical repo-rate series</h2>
              <p className="mt-1 mb-0 text-xs text-muted-foreground sm:text-sm">Official decisions and source records used to build the explorer.</p>
              <div className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                <span>{decisions.length} decisions</span>
                <span aria-hidden="true">·</span>
                <span>{sources.length} sources</span>
                <span aria-hidden="true">·</span>
                <span>Coverage {formatDate(coverageStart)} to {formatDate(coverageEnd)}</span>
              </div>
            </div>
            <div className="data-evidence__actions flex shrink-0 flex-wrap items-center gap-2">
              <CollapsibleTrigger asChild>
                <Button className="data-evidence__trigger h-9 gap-1.5" size="default" variant="outline" aria-controls="source-records">
                  <span>{sourcesOpen ? 'Hide sources' : 'View all sources'}</span>
                  <ChevronDown className="data-evidence__chevron size-4 text-muted-foreground" aria-hidden="true" />
                </Button>
              </CollapsibleTrigger>
              <Button className="data-evidence__download h-9" size="default" variant="outline" onClick={downloadCsv} aria-label="Download the complete repo-rate decision CSV">
                <Download className="size-4" aria-hidden="true" />
                Download CSV
              </Button>
            </div>
          </CardHeader>

          <CollapsibleContent id="source-records" className="data-evidence__content">
            <CardContent className="border-t border-border/70 px-0 py-0 sm:px-0">
              <div className="source-list" role="list">
                <Table className="source-table" aria-label="Source records">
                  <colgroup>
                    <col style={{ width: '19%' }} />
                    <col style={{ width: '43%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="border-border/70 bg-muted/40 hover:bg-muted/40">
                      <TableHead>Category</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead>Linked</TableHead>
                      <TableHead className="text-right">Integrity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sources.map(source => {
                      const linkedDecisions = decisions.filter(decision => decision.sourceIds.includes(source.id));
                      return (
                        <TableRow className="source-record border-border/70" data-source-id={source.id} key={source.id} role="listitem">
                          <TableCell data-label="Category" className="source-record__category min-w-0 align-top">
                            <Badge className="source-record__category-badge" variant="outline" title={formatType(source.type)} aria-label={`Category: ${formatType(source.type)}`}>
                              {compactType(source.type)}
                            </Badge>
                          </TableCell>
                          <TableCell data-label="Source" className="source-record__identity min-w-0 align-top">
                            <Button asChild className="source-record__title h-auto min-h-8 max-w-full justify-start whitespace-normal px-0 text-left text-sm font-semibold" variant="link">
                              <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Open source: ${source.title}`}>
                                <span className="source-record__title-text">{source.title}</span>
                                <ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                              </a>
                            </Button>
                          </TableCell>
                          <TableCell data-label="Published" className="source-record__published align-top text-sm tabular-nums text-foreground">{formatDate(source.publishedAt)}</TableCell>
                          <TableCell data-label="Linked" className="source-record__linked align-top text-sm tabular-nums text-muted-foreground">{linkedDecisions.length}</TableCell>
                          <TableCell data-label="Integrity" className="source-record__integrity align-top text-right"><IntegrityPopover source={source} linkedCount={linkedDecisions.length} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
        <aside className="data-evidence__attribution border-t border-border/70 bg-muted/15 px-4 py-4 sm:px-7 sm:py-5" role="note" aria-labelledby="attribution-title">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0 text-foreground" aria-hidden="true" />
                <h3 id="attribution-title" className="m-0 text-sm font-bold tracking-tight text-foreground">
                  Attribution &amp; Usage
                </h3>
              </div>
              <Badge variant="outline" className="border-border/80 bg-background/70 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                Independent Educational Reference
              </Badge>
            </div>

            <div className="grid grid-cols-1 divide-y divide-border/50 rounded-xl border border-border/60 bg-background/60 md:grid-cols-3 md:divide-y-0 md:divide-x dark:bg-card/40">
              <div className="flex flex-col p-3.5 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Landmark className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>Statutory Non-Affiliation</span>
                </div>
                <p className="mt-2 mb-0 text-xs leading-relaxed text-muted-foreground">
                  Independent educational reference. This project is not created by, affiliated with, authorised by, sponsored by, or endorsed by the Reserve Bank of India (RBI) or any government agency. No official relationship or representation should be inferred.
                </p>
              </div>

              <div className="flex flex-col p-3.5 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Scale className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>No Advisory or Fiduciary Relationship</span>
                </div>
                <p className="mt-2 mb-0 text-xs leading-relaxed text-muted-foreground">
                  Not registered with SEBI as an Investment Adviser or Research Analyst. Nothing here constitutes financial, investment, legal, tax, or accounting advice, an offer, recommendation, solicitation, or fiduciary relationship.
                </p>
              </div>

              <div className="flex flex-col p-3.5 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>Public Records &amp; Verification</span>
                </div>
                <p className="mt-2 mb-0 text-xs leading-relaxed text-muted-foreground">
                  Compiled from publicly available records under Indian fair dealing principles. Provided for research &quot;as is&quot; without warranties. Always verify every figure and policy stance against original publications before relying on them.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border/60 pt-3 text-[11px] leading-5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground">Reference material:</span>
                <Button asChild className="h-auto p-0 text-[11px] font-medium text-foreground underline-offset-4 hover:underline" size="sm" variant="link">
                  <a href="https://rbi.org.in/scripts/PublicationsView.aspx?Id=18086" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
                    <span>RBI data dissemination material</span>
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </Button>
              </div>
              <p className="m-0 text-muted-foreground/80">
                Source titles, marks, and publisher materials remain the property of their respective owners.
              </p>
            </div>
          </div>
        </aside>
      </Card>
    </section>
  );
}
