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

function formatType(type = '') {
  return type.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
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
  const coverageStart = decisions[0]?.date;
  const coverageEnd = decisions.at(-1)?.date;
  const latestPublishedSource = [...sources]
    .filter(source => source.publishedAt)
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0];

  return (
    <section className="data-evidence" aria-labelledby="source-panel-title">
      <Collapsible className="data-evidence__collapsible">
        <Card className="overflow-hidden rounded-2xl border-border/80 bg-card shadow-none">
          <CardHeader className="data-evidence__masthead flex flex-col gap-4 border-b-0 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7">
            <CollapsibleTrigger asChild>
              <button type="button" className="data-evidence__trigger group flex min-w-0 flex-1 items-start gap-4 text-left focus-visible:outline-none" aria-controls="source-records">
                <span className="min-w-0 flex-1">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Data &amp; evidence</span>
                  <strong id="source-panel-title" className="block text-lg font-semibold tracking-[-0.04em] text-foreground">Historical repo-rate series</strong>
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
                </span>
                <ChevronDown className="data-evidence__chevron mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-hover:text-foreground" aria-hidden="true" />
              </button>
            </CollapsibleTrigger>
            <Button className="data-evidence__download w-fit shrink-0" size="sm" variant="outline" onClick={downloadCsv} aria-label="Download the complete repo-rate decision CSV">
              <Download className="size-4" aria-hidden="true" />
              Download CSV
            </Button>
          </CardHeader>

          <CollapsibleContent id="source-records" className="data-evidence__content">
            <CardContent className="border-t border-border/80 px-5 py-0 sm:px-7">
              <div className="source-list" role="list">
                <Table className="source-table" aria-label="Source records">
                  <colgroup>
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '48%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '13%' }} />
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
                            <Badge className="max-w-full whitespace-normal text-left leading-4" variant="outline">{formatType(source.type)}</Badge>
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
        </Card>
      </Collapsible>
    </section>
  );
}
