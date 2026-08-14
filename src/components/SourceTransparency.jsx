import { useState } from 'react';
import { decisions, macroEvents, regimes, sources } from '../data/dataLoader.js';
import { buildDecisionCsv } from '../data/csvExport.js';
import Icon from './ui/icon.jsx';
import { Button } from './ui/button.jsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible.jsx';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.jsx';

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
  URL.revokeObjectURL(url);
}

function SourceAction({ source }) {
  return (
    <a
      className="source-record__title group inline-flex min-w-0 items-start gap-2 text-sm font-medium text-foreground transition-colors hover:text-source focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open source: ${source.title}`}
    >
      <span className="min-w-0 text-pretty">{source.title}</span>
      <Icon name="external" size={14} className="mt-0.5 shrink-0 text-muted-foreground transition-colors group-hover:text-source" />
    </a>
  );
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
        <Button
          className="source-integrity-trigger min-h-10 justify-start px-2 text-xs text-muted-foreground hover:text-foreground"
          size="sm"
          variant="ghost"
          aria-label={`Open integrity details for ${source.title}`}
        >
          <Icon name="shield" size={13} />
          <span>Integrity</span>
          <Icon name="chevronDown" size={13} className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} collisionPadding={12} className="source-integrity-popover w-[min(360px,calc(100vw-2rem))] rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="m-0 text-sm font-medium text-foreground">Integrity &amp; retrieval</p>
            <p className="mt-1 mb-0 text-xs leading-5 text-muted-foreground">Technical provenance for this source record.</p>
          </div>
          <Icon name="shield" size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
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
        <div className="mt-4 border-t border-border/70 pt-3">
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-5 text-foreground">{source.checksum || 'Checksum not reported'}</code>
            {source.checksum ? (
              <Button className="min-h-9 shrink-0 px-2 text-xs" size="sm" variant="outline" onClick={copyChecksum} aria-label={copied ? 'Checksum copied' : 'Copy checksum'}>
                <Icon name={copied ? 'check' : 'copy'} size={13} />
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
        <div className="data-evidence__masthead">
          <CollapsibleTrigger asChild>
            <button type="button" className="data-evidence__trigger group flex min-w-0 items-start gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background">
              <span className="min-w-0 flex-1">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Data &amp; evidence</span>
                <strong id="source-panel-title" className="block text-lg font-semibold tracking-[-0.03em] text-foreground">Historical repo-rate series</strong>
                <span className="mt-1 block max-w-2xl text-sm leading-6 text-muted-foreground">Official decisions and source records used to build the explorer.</span>
                <span className="mt-3 block text-xs leading-5 text-muted-foreground">
                  <span className="tabular-nums text-foreground">{decisions.length} decisions</span>
                  <span aria-hidden="true"> · </span>
                  <span className="tabular-nums text-foreground">{sources.length} sources</span>
                  <span className="mx-2 text-border-strong" aria-hidden="true">|</span>
                  Coverage <span className="text-foreground">{formatDate(coverageStart)} – {formatDate(coverageEnd)}</span>
                  <span className="mx-2 text-border-strong" aria-hidden="true">|</span>
                  Latest publication <span className="text-foreground">{formatDate(latestPublishedSource?.publishedAt)}</span>
                </span>
              </span>
              <Icon name="chevronDown" size={17} className="data-evidence__chevron mt-1 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:text-foreground" aria-hidden="true" />
            </button>
          </CollapsibleTrigger>
          <Button className="data-evidence__download w-fit shrink-0" size="sm" variant="outline" onClick={downloadCsv} aria-label="Download the complete repo-rate decision CSV">
            <Icon name="download" size={14} />
            Download CSV
          </Button>
        </div>

        <CollapsibleContent className="data-evidence__content">
          <div className="source-list" role="list">
            <div className="source-list__header hidden text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground lg:grid" aria-hidden="true">
              <span>Source</span>
              <span>Published</span>
              <span>Linked</span>
              <span>Integrity</span>
            </div>
            {sources.map(source => {
              const linkedDecisions = decisions.filter(decision => decision.sourceIds.includes(source.id));
              const recentLinked = linkedDecisions.slice(-3).reverse();
              return (
                <article className="source-record" data-source-id={source.id} key={source.id} role="listitem">
                  <div className="source-record__identity min-w-0">
                    <span className="block text-xs font-medium text-source">{formatType(source.type)}</span>
                    <div className="mt-1.5"><SourceAction source={source} /></div>
                    <p className="mt-2 mb-0 max-w-2xl text-xs leading-5 text-muted-foreground">
                      {recentLinked.length > 0
                        ? `${linkedDecisions.length} linked ${linkedDecisions.length === 1 ? 'decision' : 'decisions'} · ${recentLinked.map(decision => `${decision.date} ${decision.action}`).join(' · ')}`
                        : 'No decision links in the canonical record.'}
                    </p>
                  </div>
                  <div className="source-record__published">
                    <span className="block text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Published</span>
                    <span className="mt-1 block text-sm tabular-nums text-foreground">{formatDate(source.publishedAt)}</span>
                  </div>
                  <div className="source-record__linked">
                    <span className="block text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Linked</span>
                    <span className="mt-1 block text-sm tabular-nums text-foreground">{linkedDecisions.length}</span>
                  </div>
                  <div className="source-record__integrity">
                    <IntegrityPopover source={source} linkedCount={linkedDecisions.length} />
                  </div>
                </article>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
