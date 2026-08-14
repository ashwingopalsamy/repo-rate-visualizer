import { useState } from 'react';
import { Check, ChevronDown, Copy, Download, ExternalLink, ShieldCheck } from 'lucide-react';
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
  const latestPublishedSource = [...sources]
    .filter(source => source.publishedAt)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0];

  return (
    <section className="data-evidence" aria-labelledby="source-panel-title">
      <Card className="gap-0 overflow-hidden rounded-2xl border-border/80 bg-card py-0 shadow-none">
        <Collapsible className="data-evidence__collapsible" open={sourcesOpen} onOpenChange={setSourcesOpen}>
          <CardHeader className="data-evidence__masthead flex flex-col gap-5 border-b-0 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
            <div className="min-w-0 flex-1">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Data &amp; evidence</span>
              <h2 id="source-panel-title" className="m-0 block text-lg font-semibold tracking-[-0.04em] text-foreground">Historical repo-rate series</h2>
              <span className="mt-1.5 block max-w-2xl text-sm leading-6 text-muted-foreground">Official decisions and source records used to build the explorer.</span>
              <span className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-muted-foreground">
                <span><strong className="font-medium text-foreground">{decisions.length}</strong> decisions</span>
                <span aria-hidden="true">·</span>
                <span><strong className="font-medium text-foreground">{sources.length}</strong> sources</span>
                <span aria-hidden="true">·</span>
                <span>Coverage <strong className="font-medium text-foreground">{formatDate(coverageStart)} – {formatDate(coverageEnd)}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Latest publication <strong className="font-medium text-foreground">{formatDate(latestPublishedSource?.publishedAt)}</strong></span>
              </span>
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
            <CardContent className="border-t border-border/80 px-5 py-0 sm:px-7">
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
                    <TableRow className="border-border/80 bg-muted/35 hover:bg-muted/35">
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
        <aside className="data-evidence__attribution border-t border-border/80 bg-muted/20 px-5 py-5 sm:px-7" role="note" aria-labelledby="attribution-title">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-hold" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 id="attribution-title" className="m-0 text-base font-semibold tracking-[-0.02em] text-foreground">Attribution &amp; Usage</h3>
              <div className="mt-3 w-full space-y-3 text-sm leading-6 text-muted-foreground">
                <p className="m-0">
                  This is an independent, non-official educational reference compiled from publicly available records published by the Reserve Bank of India and other cited publishers. Source titles, marks, and publisher materials remain with their respective owners; this project does not claim ownership of third-party material. This project is not created by, affiliated with, authorised by, sponsored by, or endorsed by the Reserve Bank of India; no official relationship, approval, or representation should be inferred.
                </p>
                <p className="m-0">
                  The information is provided for research and general information only, “as is” and without representation or warranty, express or implied, including as to accuracy, completeness, timeliness, availability, or fitness for a particular purpose, to the fullest extent permitted by applicable law. Verify every figure, interpretation, and update against the original publication before relying on it; this project should not be used as the sole basis for any decision.
                </p>
                <p className="m-0">
                  Nothing here constitutes financial, investment, legal, tax, accounting, or other professional advice, an offer, recommendation, solicitation, or fiduciary relationship. Links and citations are provided for identification and verification only, not as a licence to reproduce protected third-party content. Nothing in this notice limits any right or remedy that cannot lawfully be excluded.
                </p>
                <p className="m-0 text-xs leading-5 text-muted-foreground/80">
                  Reference material: <Button asChild className="h-auto px-0 text-xs text-foreground" size="sm" variant="link"><a href="https://rbi.org.in/scripts/PublicationsView.aspx?Id=18086" target="_blank" rel="noopener noreferrer">RBI data dissemination material</a></Button>.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </Card>
    </section>
  );
}
