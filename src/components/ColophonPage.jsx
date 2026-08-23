import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Check,
  Code2,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  FileCode2,
  Layers,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { snapshotMeta, decisions, sources } from '../data/dataLoader.js';
import { Button } from './ui/button.jsx';
import { Badge } from './ui/badge.jsx';
import { Card } from './ui/card.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import CommandDialog from './ui/command-dialog.jsx';
import DataCitation from './DataCitation.jsx';
import { VIEWS } from './viewConfig.js';

export default function ColophonPage() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    const handleShortcut = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      } else if (event.key === '/' && !isTyping) {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const commands = useMemo(() => [
    {
      id: 'goto-home',
      group: 'Navigation',
      label: '← Return to Repo Rate Explorer',
      execute: () => { window.location.href = '/'; },
    },
    {
      id: 'goto-design',
      group: 'Navigation',
      label: 'View Design System & Tokens (/design)',
      execute: () => { window.location.href = '/design'; },
    },
    ...VIEWS.map(v => ({
      id: `view-${v.id}`,
      group: 'Explorer Views',
      label: `Open ${v.label} view`,
      execute: () => { window.location.href = `/?view=${v.id}`; },
    })),
  ], []);

  const machineSurfaces = [
    {
      id: 'json-snapshot',
      name: 'Canonical Snapshot JSON',
      path: '/src/data/snapshot.json',
      format: 'JSON',
      formatVariant: 'cut',
      description: 'Full chronological ledger of all RBI decisions, verified sources, and macro event layers.',
      actionType: 'copy',
      copyValue: 'import snapshot from "./src/data/snapshot.json";',
    },
    {
      id: 'design-spec',
      name: 'Design Specification',
      path: '/DESIGN.md',
      format: 'MD',
      formatVariant: 'secondary',
      description: 'Comprehensive 11-section design engineering document and token reference.',
      actionType: 'copy',
      copyValue: 'DESIGN.md',
    },
    {
      id: 'hf-dataset',
      name: 'Hugging Face Dataset',
      path: 'ashwingopalsamy/india-repo-rate-dataset',
      format: 'PARQUET',
      formatVariant: 'hold',
      description: 'Canonical open-data mirror formatted for ML, Python analytics, and Hugging Face Hub.',
      actionType: 'link',
      url: 'https://huggingface.co/datasets/ashwingopalsamy/india-repo-rate-dataset',
    },
    {
      id: 'github-repo',
      name: 'GitHub Source Code',
      path: 'ashwingopalsamy/repo-rate-visualizer',
      format: 'GIT',
      formatVariant: 'outline',
      description: 'Full open-source repository containing scraping scripts, test suites, and components.',
      actionType: 'link',
      url: 'https://github.com/ashwingopalsamy/repo-rate-visualizer',
    },
  ];

  return (
    <div className="chartbook-app flex min-h-screen w-full flex-col bg-background text-foreground">
      {/* ── Fixed Floating Header ── */}
      <header className="site-header pointer-events-none sticky top-0 z-40 w-full pt-3 sm:pt-4 pb-1">
        <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6 lg:px-8">
          <div className="site-header__navbar pointer-events-auto flex w-full items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-2 sm:py-2.5">
            <Button asChild className="brand-link group h-9 min-w-0 gap-2.5 px-2 hover:bg-muted/60 rounded-lg" variant="ghost">
              <a href="/" aria-label="RBI Repo Rate home" className="flex items-center gap-2.5">
                <span className="brand-mark flex size-8 shrink-0 items-center justify-center rounded-md border border-black bg-black font-bold text-xs tracking-tight text-white shadow-2xs transition-transform group-hover:scale-105 dark:border-white dark:bg-white dark:text-black">
                  RBI
                </span>
                <span className="truncate font-semibold tracking-tight text-foreground text-xs sm:hidden">Colophon</span>
                <span className="hidden truncate font-semibold tracking-tight text-foreground text-sm sm:inline">India's Federal Repo Rate · Colophon</span>
              </a>
            </Button>

            <div className="site-header__actions flex shrink-0 items-center gap-2">
              <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs rounded-lg border-border/80 bg-card shadow-2xs">
                <a href="/" aria-label="Back to main explorer">
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Explorer</span>
                </a>
              </Button>

              <Button asChild variant="outline" size="sm" className="h-9 text-xs rounded-lg border-border/80 bg-card shadow-2xs">
                <a href="/design" aria-label="Read Design Specification">
                  <span className="hidden sm:inline">Design System</span>
                </a>
              </Button>

              <Button
                aria-label="Open command menu"
                className="header-control hidden h-9 items-center gap-2 rounded-lg border border-border/80 bg-card hover:bg-muted/80 px-3 text-xs text-muted-foreground shadow-2xs hover:text-foreground transition-colors sm:inline-flex"
                size="sm"
                variant="ghost"
                onClick={() => setCommandOpen(true)}
              >
                <Search className="size-3.5" aria-hidden="true" />
                <span>Search</span>
                <kbd className="pointer-events-none ml-0.5 inline-flex items-center rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground/80">
                  ⌘K
                </kbd>
              </Button>

              <Button
                aria-label="Open command menu"
                className="size-9 rounded-lg border border-border/80 bg-card hover:bg-muted/80 shadow-2xs text-foreground sm:hidden"
                size="icon"
                variant="ghost"
                onClick={() => setCommandOpen(true)}
              >
                <Search className="size-4" aria-hidden="true" />
              </Button>

              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Colophon Document Canvas ── */}
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-4 pb-16 sm:px-6 lg:px-8">
        <main className="flex flex-col gap-8 py-6 sm:py-8">

          {/* ── 1. Clean Top Masthead ── */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="m-0 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Colophon
              </h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">v{snapshotMeta?.schemaVersion || '2.0.0'}</Badge>
                <Badge variant="cut" className="font-mono text-xs">Production Verified</Badge>
              </div>
            </div>
            <p className="m-0 text-sm leading-relaxed text-muted-foreground sm:text-base max-w-3xl">
              What this is, and how it is made. Technical architecture, data pipelines, cryptographic provenance proofs, and machine-readable surfaces for India's repo rate observatory.
            </p>

            {/* Flat 4-Stat Strip (No cards-in-card) */}
            <div className="grid grid-cols-2 divide-y divide-border/60 rounded-xl border border-border/70 bg-muted/20 sm:grid-cols-4 sm:divide-y-0 sm:divide-x mt-2">
              <div className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Ledger</span>
                <div className="mt-1 text-lg sm:text-xl font-bold text-foreground tabular-nums">{decisions.length} Decisions</div>
                <span className="text-xs text-muted-foreground">2000 to present</span>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Official Sources</span>
                <div className="mt-1 text-lg sm:text-xl font-bold text-foreground tabular-nums">{sources.length} Documents</div>
                <span className="text-xs text-muted-foreground">RBI Resolutions &amp; DBIE</span>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Integrity</span>
                <div className="mt-1 text-lg sm:text-xl font-bold text-foreground font-mono">SHA-256</div>
                <span className="text-xs text-muted-foreground">Cryptographic proofs</span>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Bundle Budget</span>
                <div className="mt-1 text-lg sm:text-xl font-bold text-foreground font-mono">&lt; 65 KB</div>
                <span className="text-xs text-muted-foreground">Gzip · Zero trackers</span>
              </div>
            </div>
          </section>

          {/* ── 2. Built With ── */}
          <section id="built-with" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              Built with
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-1.5">
                  <h3 className="m-0 text-sm font-bold text-foreground">Core Runtime</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Vite 6 and React 18 for lean client-side rendering. Self-hosted typography via <code className="font-mono text-[11px]">@fontsource-variable/inter</code> and <code className="font-mono text-[11px]">jetbrains-mono</code>.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline" className="text-[10px]">Vite 6</Badge>
                  <Badge variant="outline" className="text-[10px]">React 18</Badge>
                  <Badge variant="outline" className="text-[10px]">Tree-Shaken</Badge>
                </div>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-1.5">
                  <h3 className="m-0 text-sm font-bold text-foreground">Visualization Engine</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Bespoke D3.js (v7) mathematical scales bound to hardware-accelerated SVG. Enforces <code className="font-mono text-[11px]">d3.curveStepAfter</code> for policy rate step mechanics and dynamic bounding-box obstacle avoidance.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline" className="text-[10px]">D3.js v7</Badge>
                  <Badge variant="cut" className="text-[10px]">curveStepAfter</Badge>
                  <Badge variant="outline" className="text-[10px]">Native SVG</Badge>
                </div>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-1.5">
                  <h3 className="m-0 text-sm font-bold text-foreground">Style &amp; Primitives</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Tailwind CSS v4 token system with native OKLCH monetary gamut. Radix UI headless components, Vaul bottom drawer, and 160ms GPU View Transitions API crossfading.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="outline" className="text-[10px]">Tailwind v4</Badge>
                  <Badge variant="outline" className="text-[10px]">Radix UI</Badge>
                  <Badge variant="outline" className="text-[10px]">View Transitions</Badge>
                </div>
              </Card>
            </div>
          </section>

          {/* ── 3. Data Pipeline & Provenance ── */}
          <section id="provenance" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              Data pipeline &amp; provenance
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-2">
                  <h3 className="m-0 text-sm font-bold text-foreground">Automated Ingestion Streams</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Historical series are scraped and cross-validated against the RBI Database on Indian Economy (DBIE). From 2016 onward, official Monetary Policy Committee resolution PDFs and voting statements are parsed directly from <code className="font-mono text-[11px]">rbi.org.in</code>.
                  </p>
                </div>
                <ul className="m-0 p-0 pl-4 text-xs text-muted-foreground flex flex-col gap-1 list-disc">
                  <li><strong className="text-foreground">DBIE Archives (2000–2016)</strong>: Validated historical rate series.</li>
                  <li><strong className="text-foreground">MPC Resolutions (2016–Present)</strong>: Resolution PDFs, statements, voting.</li>
                </ul>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-2">
                  <h3 className="m-0 text-sm font-bold text-foreground">Cryptographic Verification</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Deterministic JSON snapshot serialization with automated validation test suites. Every official document record stores its retrieval timestamp and SHA-256 hash to guarantee archival immutability.
                  </p>
                </div>
                <div className="flex flex-col gap-1 text-xs font-mono text-muted-foreground border-t border-border/50 pt-2">
                  <div className="flex justify-between">
                    <span>Validation Suite</span>
                    <span className="text-foreground font-semibold">23 Data Tests Passed</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Source Citations</span>
                    <span className="text-foreground font-semibold">RBI Official Domains Only</span>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* ── 4. Performance & Footprint ── */}
          <section id="performance" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              Performance &amp; footprint
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-1.5">
                  <h3 className="m-0 text-sm font-bold text-foreground">0 Trackers</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Zero third-party trackers, analytics cookies, or invasive telemetry scripts. Requests stay between client and edge server.
                  </p>
                </div>
                <Badge variant="cut" className="w-fit text-[10px]">100% Private</Badge>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-1.5">
                  <h3 className="m-0 text-sm font-bold text-foreground">&lt; 65 KB Gzip</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    The entire client bundle, visualization scales, and 25-year monetary snapshot deliver in under 65 KB gzipped.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit text-[10px]">Minimal Carbon</Badge>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-1.5">
                  <h3 className="m-0 text-sm font-bold text-foreground">Offline Portable</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Historical records are statically baked into the build, allowing the observatory to function without network connectivity.
                  </p>
                </div>
                <Badge variant="secondary" className="w-fit text-[10px]">Static Portability</Badge>
              </Card>
            </div>
          </section>

          {/* ── 5. For Machines & Agents ── */}
          <section id="machines" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              For machines &amp; agents
            </h2>

            <Card className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs py-0 gap-0">
              <div className="overflow-x-auto">
                <Table className="decision-table">
                  <TableHeader>
                    <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Resource</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Format</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Description</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {machineSurfaces.map((surface) => (
                      <TableRow key={surface.id} className="border-border/60">
                        <TableCell className="font-semibold text-xs text-foreground">
                          <div className="flex flex-col">
                            {surface.url ? (
                              <a
                                href={surface.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline flex items-center gap-1 w-fit text-foreground"
                              >
                                <span>{surface.name}</span>
                                <ExternalLink className="size-3 text-muted-foreground" />
                              </a>
                            ) : (
                              <span>{surface.name}</span>
                            )}
                            <code className="text-[11px] font-mono text-muted-foreground">{surface.path}</code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={surface.formatVariant} className="font-mono text-[10px]">
                            {surface.format}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-sm">
                          {surface.description}
                        </TableCell>
                        <TableCell className="text-right">
                          {surface.actionType === 'copy' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs rounded-lg border-border/80 bg-card shadow-2xs"
                              onClick={() => copyText(surface.copyValue, surface.id)}
                            >
                              {copiedKey === surface.id ? (
                                <>
                                  <Check className="size-3 text-cut" />
                                  <span className="text-cut">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3 text-muted-foreground" />
                                  <span>Copy</span>
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs rounded-lg border-border/80 bg-card shadow-2xs"
                            >
                              <a href={surface.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${surface.name}`}>
                                <span>Open</span>
                                <ExternalLink className="size-3 text-muted-foreground" />
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </section>

          {/* ── 6. Statutory Notice & Attribution ── */}
          <section id="statutory" className="scroll-mt-24">
            <Card className="rounded-xl border border-border/70 bg-muted/20 p-5 flex flex-col gap-2 shadow-2xs">
              <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                <ShieldCheck className="size-4 text-foreground shrink-0" />
                <span>Statutory Notice &amp; Attribution</span>
              </div>
              <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                Independent educational reference created by <a href="https://ashwingopalsamy.in" target="_blank" rel="noopener noreferrer" className="text-foreground font-semibold underline underline-offset-4 hover:text-primary">Ashwin Gopalsamy</a>. This project is not created by, affiliated with, authorised by, sponsored by, or endorsed by the Reserve Bank of India (RBI) or any government agency. Not registered with SEBI as an Investment Adviser or Research Analyst. Nothing here constitutes financial, investment, legal, tax, or accounting advice.
              </p>
            </Card>
          </section>

          {/* ── 7. Source & Thanks ── */}
          <section id="source-thanks" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              Source &amp; thanks
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-1.5">
                  <h3 className="m-0 text-sm font-bold text-foreground">Open Source Repository</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Public repository under the MIT license. Review code, test suites, or clone the dataset.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="w-fit h-9 gap-1.5 text-xs rounded-lg border-border/80 bg-card shadow-2xs">
                  <a href="https://github.com/ashwingopalsamy/repo-rate-visualizer" target="_blank" rel="noopener noreferrer">
                    <FileCode2 className="size-3.5" />
                    <span>View GitHub Repository</span>
                  </a>
                </Button>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-1.5">
                  <h3 className="m-0 text-sm font-bold text-foreground">Institutional Lineage</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Inspired by statistical publications of the Bank for International Settlements (BIS), the St. Louis Fed (FRED), Financial Times visual journalism, and the creators of D3.js and Radix UI.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="w-fit h-9 gap-1.5 text-xs rounded-lg border-border/80 bg-card shadow-2xs">
                  <a href="/design">
                    <Sparkles className="size-3.5" />
                    <span>Explore Design System (/design)</span>
                  </a>
                </Button>
              </Card>
            </div>
          </section>

        </main>

        <DataCitation />
      </div>

      <CommandDialog commands={commands} open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
