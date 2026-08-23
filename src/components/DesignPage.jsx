import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Layers,
  Search,
  Share2,
  ShieldCheck,
  Sliders,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Badge } from './ui/badge.jsx';
import { Card } from './ui/card.jsx';
import { Separator } from './ui/separator.jsx';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover.jsx';
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
import ChartReadout from './ChartReadout.jsx';
import { VIEWS } from './viewConfig.js';

// Interactive Step Curve Specimen
function MiniStepChartSpecimen() {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [readout, setReadout] = useState(null);

  const samplePoints = useMemo(() => [
    { date: new Date('2019-02-07'), rate: 6.25, action: 'cut', changeBps: -25, label: 'Cut 25 bps' },
    { date: new Date('2019-04-04'), rate: 6.00, action: 'cut', changeBps: -25, label: 'Cut 25 bps' },
    { date: new Date('2019-06-06'), rate: 5.75, action: 'cut', changeBps: -25, label: 'Cut 25 bps' },
    { date: new Date('2019-08-07'), rate: 5.40, action: 'cut', changeBps: -35, label: 'Cut 35 bps' },
    { date: new Date('2019-10-04'), rate: 5.15, action: 'cut', changeBps: -25, label: 'Cut 25 bps' },
    { date: new Date('2020-03-27'), rate: 4.40, action: 'cut', changeBps: -75, label: 'COVID Cut 75 bps' },
    { date: new Date('2020-05-22'), rate: 4.00, action: 'cut', changeBps: -40, label: 'Cut 40 bps' },
    { date: new Date('2022-05-04'), rate: 4.40, action: 'hike', changeBps: 40, label: 'Off-cycle Hike 40 bps' },
    { date: new Date('2022-06-08'), rate: 4.90, action: 'hike', changeBps: 50, label: 'Hike 50 bps' },
    { date: new Date('2022-08-05'), rate: 5.40, action: 'hike', changeBps: 50, label: 'Hike 50 bps' },
    { date: new Date('2022-09-30'), rate: 5.90, action: 'hike', changeBps: 50, label: 'Hike 50 bps' },
    { date: new Date('2022-12-07'), rate: 6.25, action: 'hike', changeBps: 35, label: 'Hike 35 bps' },
    { date: new Date('2023-02-08'), rate: 6.50, action: 'hike', changeBps: 25, label: 'Peak 6.50%' },
    { date: new Date('2025-02-07'), rate: 6.25, action: 'cut', changeBps: -25, label: 'Easing 6.25%' },
    { date: new Date('2026-03-01'), rate: 5.25, action: 'cut', changeBps: -25, label: 'Current 5.25%' },
  ], []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: rect.width, height: rect.height });
    }
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const width = dimensions.width || 480;
    const height = dimensions.height || 180;
    const margin = { top: 16, right: 20, bottom: 26, left: 36 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    if (innerW <= 0 || innerH <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const defs = svg.append('defs');
    const grad = defs.append('linearGradient')
      .attr('id', 'specimen-area-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    grad.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'var(--color-line)')
      .attr('stop-opacity', '0.18');
    grad.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'var(--color-line)')
      .attr('stop-opacity', '0.00');

    const x = d3.scaleTime()
      .domain([samplePoints[0].date, samplePoints[samplePoints.length - 1].date])
      .range([0, innerW]);

    const y = d3.scaleLinear()
      .domain([3.5, 7.0])
      .range([innerH, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y).ticks(4).tickSize(-innerW).tickFormat(''));

    const line = d3.line()
      .curve(d3.curveStepAfter)
      .x(d => x(d.date))
      .y(d => y(d.rate));

    const area = d3.area()
      .curve(d3.curveStepAfter)
      .x(d => x(d.date))
      .y0(innerH)
      .y1(d => y(d.rate));

    g.append('path')
      .datum(samplePoints)
      .attr('fill', 'url(#specimen-area-gradient)')
      .attr('d', area);

    g.append('path')
      .datum(samplePoints)
      .attr('class', 'rate-line')
      .attr('d', line);

    // Axes
    const xAxis = d3.axisBottom(x)
      .ticks(5)
      .tickFormat(d3.timeFormat('%Y'))
      .tickSizeOuter(0);

    const yAxis = d3.axisLeft(y)
      .ticks(4)
      .tickFormat(d => `${d}%`)
      .tickSizeOuter(0);

    g.append('g')
      .attr('class', 'axis axis-x')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);

    g.append('g')
      .attr('class', 'axis axis-y')
      .call(yAxis);

    // Decision dots
    samplePoints.forEach(p => {
      const px = x(p.date);
      const py = y(p.rate);
      g.append('circle')
        .attr('cx', px)
        .attr('cy', py)
        .attr('r', 3.5)
        .attr('class', `cursor-pointer transition-transform hover:scale-150 ${p.action === 'cut' ? 'fill-cut stroke-background stroke-1' : 'fill-hike stroke-background stroke-1'}`)
        .on('mouseenter', () => {
          setReadout({
            datum: {
              date: p.date.toISOString().split('T')[0],
              rate: p.rate,
              changeBps: p.changeBps,
              action: p.action,
              title: p.label,
              stance: 'neutral',
              notes: 'Illustrative policy step point.',
            },
            anchor: { x: margin.left + px, y: margin.top + py },
          });
        });
    });

  }, [dimensions, samplePoints]);

  return (
    <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Live D3 Step Function (`curveStepAfter`)</span>
        <span className="text-xs font-mono font-bold text-cut tabular-nums">5.25% Active</span>
      </div>
      <div className="relative h-[180px] w-full" ref={containerRef}>
        <svg ref={svgRef} className="chart-svg w-full h-full" />
        <ChartReadout
          visible={Boolean(readout)}
          datum={readout?.datum}
          anchor={readout?.anchor}
          bounds={{ width: dimensions.width || 480, height: dimensions.height || 180 }}
          onDismiss={() => setReadout(null)}
        />
      </div>
      <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
        Discrete plateaus with 2.25px stroke, gradient fill, and obstacle-avoiding hover readouts.
      </p>
    </Card>
  );
}

// Interactive Diverging Bar Specimen
function MiniDivergingBarSpecimen() {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [readout, setReadout] = useState(null);

  const sampleMoves = useMemo(() => [
    { id: '1', date: '2020-03', changeBps: -75, action: 'cut', rate: 4.40 },
    { id: '2', date: '2020-05', changeBps: -40, action: 'cut', rate: 4.00 },
    { id: '3', date: '2022-05', changeBps: 40, action: 'hike', rate: 4.40 },
    { id: '4', date: '2022-06', changeBps: 50, action: 'hike', rate: 4.90 },
    { id: '5', date: '2022-08', changeBps: 50, action: 'hike', rate: 5.40 },
    { id: '6', date: '2022-09', changeBps: 50, action: 'hike', rate: 5.90 },
    { id: '7', date: '2022-12', changeBps: 35, action: 'hike', rate: 6.25 },
    { id: '8', date: '2023-02', changeBps: 25, action: 'hike', rate: 6.50 },
    { id: '9', date: '2025-02', changeBps: -25, action: 'cut', rate: 6.25 },
  ], []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: rect.width, height: rect.height });
    }
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const width = dimensions.width || 480;
    const height = dimensions.height || 180;
    const margin = { top: 16, right: 20, bottom: 26, left: 36 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    if (innerW <= 0 || innerH <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const x = d3.scaleBand()
      .domain(sampleMoves.map(d => d.id))
      .range([0, innerW])
      .padding(0.28);

    const y = d3.scaleLinear()
      .domain([-90, 70])
      .range([innerH, 0]);

    const zeroY = y(0);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Zero baseline
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', zeroY)
      .attr('y2', zeroY)
      .attr('stroke', 'var(--color-axis)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3');

    // Bars
    sampleMoves.forEach(d => {
      const isNegative = d.changeBps < 0;
      const barY = isNegative ? zeroY : y(d.changeBps);
      const barH = Math.abs(y(d.changeBps) - zeroY);
      const isBigMove = Math.abs(d.changeBps) >= 50;

      g.append('rect')
        .attr('x', x(d.id))
        .attr('y', barY)
        .attr('width', x.bandwidth())
        .attr('height', Math.max(2, barH))
        .attr('rx', 2)
        .attr('class', `${isNegative ? 'fill-cut' : 'fill-hike'} cursor-pointer transition-opacity hover:opacity-80`)
        .attr('stroke', isBigMove ? 'var(--foreground)' : 'none')
        .attr('stroke-width', isBigMove ? 1 : 0)
        .on('mouseenter', () => {
          setReadout({
            datum: {
              date: d.date,
              rate: d.rate,
              changeBps: d.changeBps,
              action: d.action,
              title: `${d.changeBps > 0 ? '+' : ''}${d.changeBps} bps ${d.action}`,
              stance: 'neutral',
              notes: 'Magnitude divergence on zero axis.',
            },
            anchor: { x: margin.left + x(d.id) + x.bandwidth() / 2, y: margin.top + (isNegative ? barY + barH : barY) },
          });
        });

      g.append('text')
        .attr('x', x(d.id) + x.bandwidth() / 2)
        .attr('y', innerH + 16)
        .attr('text-anchor', 'middle')
        .attr('class', 'text-[10px] font-mono fill-muted-foreground')
        .text(`'${d.date.slice(2, 4)}`);
    });

    const yAxis = d3.axisLeft(y)
      .ticks(4)
      .tickFormat(d => `${d > 0 ? '+' : ''}${d}`)
      .tickSizeOuter(0);

    g.append('g')
      .attr('class', 'axis axis-y')
      .call(yAxis);

  }, [dimensions, sampleMoves]);

  return (
    <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Diverging Basis-Point Shifts</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cut"><span className="size-1.5 rounded-full bg-cut" />Cuts (-bps)</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-hike"><span className="size-1.5 rounded-full bg-hike" />Hikes (+bps)</span>
        </div>
      </div>
      <div className="relative h-[180px] w-full" ref={containerRef}>
        <svg ref={svgRef} className="chart-svg w-full h-full" />
        <ChartReadout
          visible={Boolean(readout)}
          datum={readout?.datum}
          anchor={readout?.anchor}
          bounds={{ width: dimensions.width || 480, height: dimensions.height || 180 }}
          onDismiss={() => setReadout(null)}
        />
      </div>
      <p className="m-0 text-[11px] leading-relaxed text-muted-foreground">
        Zero-line centered layout isolating policy magnitude. Moves ≥ 50 bps receive a hairline border.
      </p>
    </Card>
  );
}

// Flat Tabular Numerals Specimen (No cards-in-card)
function TabularNumeralsDemo() {
  const [useTabular, setUseTabular] = useState(true);
  const [val, setVal] = useState(6.25);

  useEffect(() => {
    const interval = setInterval(() => {
      setVal(prev => {
        const next = prev === 6.25 ? 6.50 : prev === 6.50 ? 5.15 : prev === 5.15 ? 7.75 : 6.25;
        return next;
      });
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="rounded-xl border border-border/70 bg-card p-4 sm:p-5 flex flex-col gap-4 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <h3 className="m-0 text-sm font-bold text-foreground">Tabular (`tabular-nums`) vs Proportional Numerals</h3>
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant={useTabular ? 'default' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setUseTabular(true)}
          >
            Tabular (Active)
          </Button>
          <Button
            size="xs"
            variant={!useTabular ? 'default' : 'ghost'}
            className="h-7 text-xs"
            onClick={() => setUseTabular(false)}
          >
            Proportional
          </Button>
        </div>
      </div>

      {/* Flat 3-column metric strip divided by lines */}
      <div className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
        <div className="p-3 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Dynamic Rate Metric</span>
          <div className={`text-3xl font-bold text-foreground transition-all duration-200 ${useTabular ? 'tabular-nums' : ''}`}>
            {val.toFixed(2)}%
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">
            {useTabular ? 'Fixed width cells (Zero jitter)' : 'Variable width (Causes shift)'}
          </span>
        </div>

        <div className="p-3 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">Basis Point Shift</span>
          <div className={`text-3xl font-semibold ${val < 6 ? 'text-cut' : 'text-hike'} transition-all duration-200 ${useTabular ? 'tabular-nums' : ''}`}>
            {val < 6 ? '-25 bps' : '+50 bps'}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">
            Consistent digit alignment
          </span>
        </div>

        <div className="p-3 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">ISO Decision Date</span>
          <div className={`text-xl font-bold text-foreground transition-all duration-200 ${useTabular ? 'tabular-nums' : ''}`}>
            2025-02-07
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">
            Clean scanning in data tables
          </span>
        </div>
      </div>
    </Card>
  );
}

// Flat Color Swatch Component
function ColorSwatch({ name, token, lightVal, darkVal, bgClass, textClass, description }) {
  return (
    <Card className="flex flex-col rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs py-0 gap-0">
      <div className={`h-14 w-full ${bgClass} flex items-center justify-center p-3 border-b border-border/40`}>
        <span className={`text-xs font-bold ${textClass} px-2 py-0.5 rounded-md bg-background/80 shadow-2xs`}>
          {name}
        </span>
      </div>
      <div className="p-3.5 flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between">
          <code className="font-mono text-[11px] font-semibold text-foreground">{token}</code>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">OKLCH</Badge>
        </div>
        <p className="m-0 text-muted-foreground text-[11px] leading-relaxed">{description}</p>
        <div className="mt-1 pt-1.5 border-t border-border/40 flex flex-col gap-0.5 text-[10px] text-muted-foreground/80 font-mono">
          <span>Light: {lightVal}</span>
          <span>Dark:  {darkVal}</span>
        </div>
      </div>
    </Card>
  );
}

export default function DesignPage() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const [activeSpecimenView, setActiveSpecimenView] = useState('timeline');
  const [specimenPreset, setSpecimenPreset] = useState('ALL');

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

  const commands = useMemo(() => [
    {
      id: 'goto-home',
      group: 'Navigation',
      label: '← Return to Repo Rate Explorer',
      execute: () => { window.location.href = '/'; },
    },
    {
      id: 'goto-colophon',
      group: 'Navigation',
      label: 'View Technical Colophon (/colophon)',
      execute: () => { window.location.href = '/colophon'; },
    },
    ...VIEWS.map(v => ({
      id: `view-${v.id}`,
      group: 'Explorer Views',
      label: `Open ${v.label} view`,
      execute: () => { window.location.href = `/?view=${v.id}`; },
    })),
  ], []);

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
                <span className="truncate font-semibold tracking-tight text-foreground text-xs sm:hidden">Design System</span>
                <span className="hidden truncate font-semibold tracking-tight text-foreground text-sm sm:inline">India's Federal Repo Rate · Design System</span>
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
                <a href="/colophon" aria-label="Read Project Colophon">
                  <span className="hidden sm:inline">Colophon</span>
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

      {/* ── Main Design Document Canvas ── */}
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-4 pb-16 sm:px-6 lg:px-8">
        <main className="flex flex-col gap-8 py-6 sm:py-8">

          {/* ── 1. Clean Top Masthead (No cards-in-card) ── */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="m-0 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Design System &amp; Reference
              </h1>
              <Badge variant="outline" className="font-mono text-xs">v1.0.0 · Production</Badge>
            </div>
            <p className="m-0 text-sm leading-relaxed text-muted-foreground sm:text-base max-w-3xl">
              The design judgment behind the RBI Repo Rate Visualizer: stepped chart interpolations, semantic OKLCH monetary colors, tabular typography, and hairline spatial hierarchy.
            </p>

            {/* Flat 4-Stat Strip */}
            <div className="grid grid-cols-2 divide-y divide-border/60 rounded-xl border border-border/70 bg-muted/20 sm:grid-cols-4 sm:divide-y-0 sm:divide-x mt-2">
              <div className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Typography</span>
                <div className="mt-1 text-base sm:text-lg font-bold text-foreground">Inter &amp; JetBrains</div>
                <span className="text-xs text-muted-foreground">Variable Sans + Mono</span>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Color Space</span>
                <div className="mt-1 text-base sm:text-lg font-bold text-foreground">OKLCH / Oklab</div>
                <span className="text-xs text-muted-foreground">Perceptual parity</span>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Base Geometry</span>
                <div className="mt-1 text-base sm:text-lg font-bold text-foreground">14px Radius</div>
                <span className="text-xs text-muted-foreground">36px Control Rail</span>
              </div>
              <div className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">Visualization</span>
                <div className="mt-1 text-base sm:text-lg font-bold text-foreground">D3.js + Native SVG</div>
                <span className="text-xs text-muted-foreground">Stepped interpolations</span>
              </div>
            </div>
          </section>

          {/* ── 2. Design Philosophy ── */}
          <section id="philosophy" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              Design Philosophy
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-2">
                  <h3 className="m-0 text-sm font-bold text-foreground">1. Stepped Policy Mechanics</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Central bank policy rates are legal step functions, not analog curves. Rates are held constant across policy horizons and change instantaneously on MPC resolution dates.
                  </p>
                </div>
                <Badge variant="cut" className="w-fit text-[10px]">`curveStepAfter` enforced</Badge>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-2">
                  <h3 className="m-0 text-sm font-bold text-foreground">2. Provenance &amp; Verification</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Data is never anonymous. Every observation links to an official RBI resolution PDF, publication timestamp, and SHA-256 integrity checksum.
                  </p>
                </div>
                <Badge variant="source" className="w-fit text-[10px]">Cryptographic checksums</Badge>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-5 flex flex-col justify-between shadow-2xs gap-3">
                <div className="flex flex-col gap-2">
                  <h3 className="m-0 text-sm font-bold text-foreground">3. Hairline Spatial Restraint</h3>
                  <p className="m-0 text-xs leading-relaxed text-muted-foreground">
                    Depth is established through sub-pixel 1px hairline borders (`oklch` slates) and inset background wells (`--muted/20`), rather than heavy drop shadows.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit text-[10px]">1px Hairline Architecture</Badge>
              </Card>
            </div>
          </section>

          {/* ── 3. Typography & Tabular Numerals ── */}
          <section id="typography" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              Typography &amp; Tabular Numerals
            </h2>

            <TabularNumeralsDemo />

            {/* Type Scale Table */}
            <Card className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs py-0 gap-0">
              <div className="overflow-x-auto">
                <Table className="decision-table">
                  <TableHeader>
                    <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Role</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Specimen</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Font / Size</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tracking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-border/60">
                      <TableCell className="font-semibold text-xs text-muted-foreground">Hero Benchmark</TableCell>
                      <TableCell><span className="text-3xl sm:text-4xl font-bold text-foreground tabular-nums tracking-tight">6.25%</span></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">Inter Bold · 48–68px</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">-0.04em</TableCell>
                    </TableRow>
                    <TableRow className="border-border/60">
                      <TableCell className="font-semibold text-xs text-muted-foreground">Secondary Stat</TableCell>
                      <TableCell><span className="text-2xl font-semibold text-cut tabular-nums tracking-tight">-25 bps</span></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">Inter Semibold · 30–44px</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">-0.03em</TableCell>
                    </TableRow>
                    <TableRow className="border-border/60">
                      <TableCell className="font-semibold text-xs text-muted-foreground">Section Heading</TableCell>
                      <TableCell><span className="text-base font-bold text-foreground tracking-tight">Official Decision Record</span></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">Inter Bold · 16–18px</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">-0.02em</TableCell>
                    </TableRow>
                    <TableRow className="border-border/60">
                      <TableCell className="font-semibold text-xs text-muted-foreground">Kickers &amp; Overlines</TableCell>
                      <TableCell><span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">CURRENT REPO RATE</span></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">Inter Semibold · 11px</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">+0.14em</TableCell>
                    </TableRow>
                    <TableRow className="border-border/60">
                      <TableCell className="font-semibold text-xs text-muted-foreground">Integrity Hashes</TableCell>
                      <TableCell><code className="font-mono text-xs text-foreground bg-muted/60 px-1.5 py-0.5 rounded">e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</code></TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">JetBrains Mono · 11px</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">0.00em</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>
          </section>

          {/* ── 4. Semantic Palette (OKLCH) ── */}
          <section id="palette" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              Semantic Monetary Palette (OKLCH)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ColorSwatch
                name="Easing / Cut"
                token="--cut"
                lightVal="oklch(0.60 0.19 148)"
                darkVal="oklch(0.74 0.16 148)"
                bgClass="bg-cut"
                textClass="text-cut"
                description="Monetary accommodation, rate reductions, liquidity easing."
              />
              <ColorSwatch
                name="Tightening / Hike"
                token="--hike"
                lightVal="oklch(0.58 0.22 25)"
                darkVal="oklch(0.74 0.18 25)"
                bgClass="bg-hike"
                textClass="text-hike"
                description="Monetary restriction, inflation cooling, rate hikes."
              />
              <ColorSwatch
                name="Pause / Hold"
                token="--hold"
                lightVal="oklch(0.56 0.19 255)"
                darkVal="oklch(0.74 0.16 255)"
                bgClass="bg-hold"
                textClass="text-hold"
                description="Status quo maintenance, neutral stances, policy pause."
              />
              <ColorSwatch
                name="Provenance / Meta"
                token="--source"
                lightVal="oklch(0.34 0.010 240)"
                darkVal="oklch(0.84 0.006 240)"
                bgClass="bg-source"
                textClass="text-source"
                description="Official RBI citations, technical metadata, checksum badges."
              />
            </div>

            {/* Semantic Badges Showcase */}
            <Card className="rounded-xl border border-border/70 bg-card p-4 sm:p-5 shadow-2xs flex flex-col gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Component Badges &amp; Macro Context Indicators
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant="cut">
                  <span className="size-1.5 rounded-full bg-cut" />
                  Cut · -25 bps
                </Badge>
                <Badge variant="hike">
                  <span className="size-1.5 rounded-full bg-hike" />
                  Hike · +50 bps
                </Badge>
                <Badge variant="hold">
                  <span className="size-1.5 rounded-full bg-hold" />
                  Hold · 0 bps
                </Badge>
                <Badge variant="source">
                  <ShieldCheck className="size-3" />
                  Official RBI Resolution
                </Badge>
                <Badge variant="outline">
                  Neutral Stance
                </Badge>
                <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Fiscal Reform
                </span>
                <span className="inline-flex items-center rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                  External Shock
                </span>
                <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Policy Framework
                </span>
              </div>
            </Card>
          </section>

          {/* ── 5. Surfaces & Radii (Flat layout, No cards-in-card) ── */}
          <section id="surfaces" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              Surfaces &amp; Radii Geometry
            </h2>

            {/* Flat Surface Hierarchy Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Layer 0</span>
                <h4 className="m-0 text-sm font-bold text-foreground">Canvas Background</h4>
                <p className="m-0 text-xs text-muted-foreground mt-1">`--background` (Oklch 0.985 / 0.165)</p>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Layer 1</span>
                <h4 className="m-0 text-sm font-bold text-foreground">Structural Card</h4>
                <p className="m-0 text-xs text-muted-foreground mt-1">`--card` with 1px hairline border</p>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Layer 2</span>
                <h4 className="m-0 text-sm font-bold text-foreground">Inset Well</h4>
                <p className="m-0 text-xs text-muted-foreground mt-1">`--muted/20` to `30` sub-panels</p>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Layer 3</span>
                <h4 className="m-0 text-sm font-bold text-foreground">Floating Popover</h4>
                <p className="m-0 text-xs text-muted-foreground mt-1">`--popover` + ambient shadow</p>
              </Card>
            </div>

            {/* Radii Scale Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-1">
              <div className="rounded-sm border border-border/60 bg-muted/20 p-3 text-center">
                <span className="text-[10px] font-mono text-muted-foreground block">--radius-sm</span>
                <span className="text-sm font-bold text-foreground mt-0.5 block">8.4px</span>
                <span className="text-[10px] text-muted-foreground">Mini badges</span>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-center">
                <span className="text-[10px] font-mono text-muted-foreground block">--radius-md</span>
                <span className="text-sm font-bold text-foreground mt-0.5 block">11.2px</span>
                <span className="text-[10px] text-muted-foreground">Buttons / Tabs</span>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-center">
                <span className="text-[10px] font-mono text-muted-foreground block">--radius-lg</span>
                <span className="text-sm font-bold text-foreground mt-0.5 block">14.0px</span>
                <span className="text-[10px] text-muted-foreground">Header pill</span>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-center">
                <span className="text-[10px] font-mono text-muted-foreground block">--radius-xl</span>
                <span className="text-sm font-bold text-foreground mt-0.5 block">19.6px</span>
                <span className="text-[10px] text-muted-foreground">Workspace cards</span>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-center col-span-2 sm:col-span-1">
                <span className="text-[10px] font-mono text-muted-foreground block">--radius-2xl</span>
                <span className="text-sm font-bold text-foreground mt-0.5 block">25.2px</span>
                <span className="text-[10px] text-muted-foreground">Hero containers</span>
              </div>
            </div>
          </section>

          {/* ── 6. Controls Baseline (36px Rail) ── */}
          <section id="controls" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              Controls Baseline (36px Rail)
            </h2>

            <Card className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Interactive Specimen: The Unified 36px Rail
                </span>
                <Badge variant="outline" className="text-[10px]">Strict 36px (`h-9`)</Badge>
              </div>

              {/* The Live Rail (Flat) */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Segmented View Tabs */}
                <Tabs value={activeSpecimenView} onValueChange={setActiveSpecimenView}>
                  <TabsList className="h-9 gap-1">
                    <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
                    <TabsTrigger value="breakdown" className="text-xs">Breakdown</TabsTrigger>
                    <TabsTrigger value="rate-change" className="text-xs">Rate changes</TabsTrigger>
                    <TabsTrigger value="cycles" className="text-xs">Cycles</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="hidden h-5 w-px bg-border/80 lg:block" />

                {/* Preset Tabs */}
                <Tabs value={specimenPreset} onValueChange={setSpecimenPreset}>
                  <TabsList className="h-9 gap-1">
                    <TabsTrigger value="1Y" className="text-xs">1Y</TabsTrigger>
                    <TabsTrigger value="5Y" className="text-xs">5Y</TabsTrigger>
                    <TabsTrigger value="10Y" className="text-xs">10Y</TabsTrigger>
                    <TabsTrigger value="ALL" className="text-xs">Max</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="hidden h-5 w-px bg-border/80 lg:block" />

                {/* Popover Custom Date Trigger */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs rounded-lg border-border/80 bg-background/80 shadow-2xs">
                      <CalendarDays className="size-3.5" />
                      <span>Custom</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-3 text-xs">
                    <p className="font-semibold text-foreground m-0">Custom Range Popover</p>
                    <p className="text-muted-foreground mt-1 mb-0">Applies a transactionally validated time horizon.</p>
                  </PopoverContent>
                </Popover>

                {/* Export Buttons */}
                <Button variant="outline" size="icon" className="size-9 rounded-lg border-border/80 bg-background/80 shadow-2xs" title="Download chart">
                  <Download className="size-3.5" />
                </Button>

                <Button variant="outline" size="icon" className="size-9 rounded-lg border-border/80 bg-background/80 shadow-2xs" title="Share current view">
                  <Share2 className="size-3.5" />
                </Button>
              </div>

              {/* Button Variants Specimen */}
              <div className="flex flex-col gap-2 pt-3 border-t border-border/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Button Hierarchy &amp; Variants
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Button variant="default" size="sm">Primary / Default</Button>
                  <Button variant="outline" size="sm">Secondary Outline</Button>
                  <Button variant="secondary" size="sm">Muted Secondary</Button>
                  <Button variant="ghost" size="sm">Ghost Action</Button>
                  <Button variant="destructive" size="sm">Destructive</Button>
                  <Button variant="link" size="sm">Link Action</Button>
                </div>
              </div>
            </Card>
          </section>

          {/* ── 7. Data Visualization Language ── */}
          <section id="dataviz" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              D3 &amp; SVG Chart Grammar
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MiniStepChartSpecimen />
              <MiniDivergingBarSpecimen />
            </div>

            {/* Projection Summary Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-1">
              <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projection 1</span>
                  <h4 className="m-0 text-sm font-bold text-foreground mt-0.5">Timeline View</h4>
                  <p className="m-0 mt-1 text-xs text-muted-foreground">
                    Historical repo rate step series (`curveStepAfter`), regime bands, macro pins, and dynamic collision-avoiding tooltips.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit text-[10px]">Macro Context</Badge>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projection 2</span>
                  <h4 className="m-0 text-sm font-bold text-foreground mt-0.5">Breakdown View</h4>
                  <p className="m-0 mt-1 text-xs text-muted-foreground">
                    Stacked policy decomposition across regimes and calendar years, isolating hold-to-move ratios and bps move volume.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit text-[10px]">Stacked Volume</Badge>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projection 3</span>
                  <h4 className="m-0 text-sm font-bold text-foreground mt-0.5">Rate Changes</h4>
                  <p className="m-0 mt-1 text-xs text-muted-foreground">
                    Diverging zero-line bar chart highlighting decision magnitudes (+bps hikes vs -bps cuts) with borders on large moves.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit text-[10px]">Basis Point Shifts</Badge>
              </Card>

              <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projection 4</span>
                  <h4 className="m-0 text-sm font-bold text-foreground mt-0.5">Cycles Comparison</h4>
                  <p className="m-0 mt-1 text-xs text-muted-foreground">
                    Normalized overlay aligning historical tightening and easing cycles to t=0 to analyze monetary transmission velocity.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit text-[10px]">Transmission Velocity</Badge>
              </Card>
            </div>
          </section>

          {/* ── 8. Responsive Architecture ── */}
          <section id="responsive" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              Responsive Architecture
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Desktop Specimen Card */}
              <Card className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="m-0 text-sm font-bold text-foreground">Desktop Presentation (≥1024px)</h3>
                    <Badge variant="outline" className="text-[10px]">6-Column Table</Badge>
                  </div>
                  <p className="m-0 text-xs text-muted-foreground">
                    Full decision spine with date, action badge, tabular rate, basis point shift, stance, and external source link.
                  </p>
                </div>
                <div className="border-t border-border/40 pt-2 text-xs flex justify-between items-center font-mono text-muted-foreground">
                  <span>07 Feb 2025</span>
                  <Badge variant="cut" className="text-[9px] px-1.5 py-0">Cut</Badge>
                  <span className="font-bold text-foreground tabular-nums">6.25%</span>
                  <span className="text-cut font-semibold tabular-nums">-25 bps</span>
                </div>
              </Card>

              {/* Mobile Specimen Card */}
              <Card className="rounded-xl border border-border/70 bg-card p-5 shadow-2xs flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="m-0 text-sm font-bold text-foreground">Mobile Presentation (&lt;768px)</h3>
                    <Badge variant="outline" className="text-[10px]">2-Row Tap Card</Badge>
                  </div>
                  <p className="m-0 text-xs text-muted-foreground">
                    Single-tap card with top-row date/rate alignment, bottom-row action badge, and isolated source trigger.
                  </p>
                </div>
                <div className="border-t border-border/40 pt-2 text-xs flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold tabular-nums text-foreground">07 Feb 2025</span>
                    <Badge variant="cut" className="text-[9px] px-1.5 py-0">Cut</Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-foreground tabular-nums">6.25%</span>
                    <span className="text-cut font-semibold text-xs tabular-nums">-25 bps</span>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* ── 9. Consistency & Judgment Rules ── */}
          <section id="guardrails" className="scroll-mt-24 flex flex-col gap-3">
            <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-foreground">
              Consistency &amp; Judgment Rules
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* The DO's */}
              <Card className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-2xs flex flex-col gap-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>Intentional Patterns (Follow These)</span>
                </div>
                <ul className="m-0 p-0 pl-4 text-xs leading-relaxed text-muted-foreground flex flex-col gap-1.5 list-disc">
                  <li><strong>Always use step interpolations (`curveStepAfter`)</strong> for policy rate lines.</li>
                  <li><strong>Apply `tabular-nums`</strong> to every number, rate, bps delta, date, and tick.</li>
                  <li><strong>Preserve semantic monetary colors</strong>: Cut = Emerald, Hike = Crimson, Hold = Cobalt.</li>
                  <li><strong>Strict 36px control height (`h-9`)</strong> on desktop toolbars and inputs.</li>
                  <li><strong>Maintain provenance links</strong>: Every data point must tie to official RBI records.</li>
                  <li><strong>Use 1px hairline borders</strong> and single-tier cards without nested boxes.</li>
                </ul>
              </Card>

              {/* The DON'Ts */}
              <Card className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 shadow-2xs flex flex-col gap-3">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-sm">
                  <XCircle className="size-4 shrink-0" />
                  <span>Anti-Patterns (What Feels Wrong)</span>
                </div>
                <ul className="m-0 p-0 pl-4 text-xs leading-relaxed text-muted-foreground flex flex-col gap-1.5 list-disc">
                  <li><strong>NO triple-stacked headers</strong> (kicker + title + decorative subtitle).</li>
                  <li><strong>NO card-inside-card nesting</strong> (inner bordered boxes inside parent cards).</li>
                  <li><strong>NO smooth bezier splines</strong> or continuous curves for policy rate history.</li>
                  <li><strong>NO inverted stock-market color tropes</strong> (treating cuts as bad / hikes as good).</li>
                  <li><strong>NO heavy glossy gradients</strong>, glassmorphism blurs, or glow effects.</li>
                  <li><strong>NO proportional / wobbly digits</strong> in tables, stat cards, or chart axes.</li>
                </ul>
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
