import { useState, useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { decisions, regimes, snapshotMeta } from '../data/dataLoader.js';
import { filterDecisions, normalizeRecordFilters } from '../lib/analysisState.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.jsx';
import { isWithinRegime } from '../lib/dateBoundaries.js';

const DESKTOP_MARGIN = { top: 24, right: 32, bottom: 48, left: 56 };
const MOBILE_MARGIN = { top: 20, right: 16, bottom: 44, left: 44 };

function safeCycleIndex(value, fallback, length) {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= length) return fallback;
  return index;
}

// Extract only easing and tightening cycles for comparison. The rate points
// come directly from canonical decisions, never from a second hand-maintained
// cycle dataset.
const cycles = regimes
  .map((regime, index) => ({ regime, index }))
  .filter(({ regime }) => regime.type !== 'pause')
  .map(({ regime: r, index }) => {
  const rateData = decisions
    .filter(d => isWithinRegime(d.dateObj, r, index === regimes.length - 1))
    .map(d => ({ ...d, rate: d.repoRate }));
  const baseline = decisions.filter(d => d.dateObj < r.startObj).at(-1);
  const baselineRate = baseline?.repoRate ?? rateData[0]?.rate ?? null;
  const totalBps = rateData.length > 0 && baselineRate !== null
    ? Math.round((rateData.at(-1).rate - baselineRate) * 100)
    : 0;
  const durationMonths = Math.round((r.endObj - r.startObj) / (1000 * 60 * 60 * 24 * 30.44));
  return {
    ...r,
    rateData,
    baselineRate,
    totalBps,
    durationMonths,
    avgBpsPerMonth: durationMonths > 0 ? (totalBps / durationMonths).toFixed(1) : 0,
  };
  });

export default function CycleComparison({ cycleSelection, onCycleSelectionChange, recordFilters, onDecisionSelect, onViewChange }) {
  const filters = normalizeRecordFilters(recordFilters);
  const visibleCycles = useMemo(() => cycles.map(cycle => {
    const visibleRateData = filterDecisions(cycle.rateData, { recordFilters: filters });
    const moves = visibleRateData.filter(decision => ['cut', 'hike'].includes(decision.action));
    const totalBps = visibleRateData.length > 0 && cycle.baselineRate !== null
      ? Math.round((visibleRateData.at(-1).rate - cycle.baselineRate) * 100)
      : 0;
    const largestMove = moves.slice().sort((a, b) => Math.abs(b.changeBps) - Math.abs(a.changeBps))[0] || null;
    return {
      ...cycle,
      rateData: visibleRateData,
      totalBps,
      largestMove,
      moveCount: moves.length,
    };
  }), [filters.action, filters.evidence]);
  const defaultA = safeCycleIndex(cycleSelection?.a, 0, cycles.length);
  const defaultB = safeCycleIndex(cycleSelection?.b, cycles.length - 1, cycles.length);
  const [cycleA, setCycleA] = useState(defaultA);
  const [cycleB, setCycleB] = useState(defaultB);
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setCycleA(safeCycleIndex(cycleSelection?.a, 0, cycles.length));
    setCycleB(safeCycleIndex(cycleSelection?.b, cycles.length - 1, cycles.length));
  }, [cycleSelection?.a, cycleSelection?.b]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
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

  const selectedA = visibleCycles[cycleA];
  const selectedB = visibleCycles[cycleB];

  // Normalize both cycles to t=0
  const normalizedA = useMemo(() => {
    if (!selectedA?.rateData.length) return [];
    const baseDate = selectedA.rateData[0].dateObj.getTime();
    const baseRate = selectedA.baselineRate ?? selectedA.rateData[0].rate;
    return selectedA.rateData.map(d => ({
      dayOffset: (d.dateObj.getTime() - baseDate) / (1000 * 60 * 60 * 24),
      rateDelta: Math.round((d.rate - baseRate) * 100),
      rate: d.rate,
      date: d.date,
      decisionId: d.id,
      action: d.action,
    }));
  }, [cycleA, selectedA]);

  const normalizedB = useMemo(() => {
    if (!selectedB?.rateData.length) return [];
    const baseDate = selectedB.rateData[0].dateObj.getTime();
    const baseRate = selectedB.baselineRate ?? selectedB.rateData[0].rate;
    return selectedB.rateData.map(d => ({
      dayOffset: (d.dateObj.getTime() - baseDate) / (1000 * 60 * 60 * 24),
      rateDelta: Math.round((d.rate - baseRate) * 100),
      rate: d.rate,
      date: d.date,
      decisionId: d.id,
      action: d.action,
    }));
  }, [cycleB, selectedB]);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (!normalizedA.length || !normalizedB.length) return;

    const { width, height } = dimensions;
    const isMobile = width < 540;
    const margin = isMobile ? MOBILE_MARGIN : DESKTOP_MARGIN;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    if (innerW <= 0 || innerH <= 0) return;

    const maxDays = Math.max(
      d3.max(normalizedA, d => d.dayOffset) || 0,
      d3.max(normalizedB, d => d.dayOffset) || 0
    );

    const allDeltas = [...normalizedA.map(d => d.rateDelta), ...normalizedB.map(d => d.rateDelta)];
    const yMin = d3.min(allDeltas) - 15;
    const yMax = d3.max(allDeltas) + 15;

    const xScale = d3.scaleLinear().domain([0, maxDays]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]).nice();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid
    g.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat('').ticks(isMobile ? 4 : 6));

    // Zero line
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', yScale(0)).attr('y2', yScale(0))
      .attr('stroke', 'var(--color-axis)').attr('stroke-width', 1);

    // Cycle A line
    const lineA = d3.line().x(d => xScale(d.dayOffset)).y(d => yScale(d.rateDelta)).curve(d3.curveStepAfter);
    g.append('path').datum(normalizedA).attr('d', lineA)
      .attr('fill', 'none').attr('stroke', 'var(--color-cut)').attr('stroke-width', 2).attr('opacity', 0.8);

    // Cycle B line
    const lineB = d3.line().x(d => xScale(d.dayOffset)).y(d => yScale(d.rateDelta)).curve(d3.curveStepAfter);
    g.append('path').datum(normalizedB).attr('d', lineB)
      .attr('fill', 'none').attr('stroke', 'var(--color-hike)').attr('stroke-width', 2).attr('opacity', 0.8);

    // Dots
    g.selectAll('.dot-a').data(normalizedA).join('circle')
      .attr('cx', d => xScale(d.dayOffset)).attr('cy', d => yScale(d.rateDelta))
      .attr('r', isMobile ? 2.5 : 3).attr('fill', 'var(--color-cut)')
      .attr('role', 'button').attr('tabindex', 0)
      .attr('aria-label', d => `Open ${d.date} record, ${d.rate.toFixed(2)} percent`)
      .attr('cursor', 'pointer')
      .on('pointerup keydown', (event, datum) => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onDecisionSelect?.(datum.decisionId);
        onViewChange?.('timeline');
      });
    g.selectAll('.dot-b').data(normalizedB).join('circle')
      .attr('cx', d => xScale(d.dayOffset)).attr('cy', d => yScale(d.rateDelta))
      .attr('r', isMobile ? 2.5 : 3).attr('fill', 'var(--color-hike)')
      .attr('role', 'button').attr('tabindex', 0)
      .attr('aria-label', d => `Open ${d.date} record, ${d.rate.toFixed(2)} percent`)
      .attr('cursor', 'pointer')
      .on('pointerup keydown', (event, datum) => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onDecisionSelect?.(datum.decisionId);
        onViewChange?.('timeline');
      });

    // X axis (days)
    g.append('g').attr('class', 'axis axis--x')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(isMobile ? 5 : 8).tickFormat(d => `${Math.round(d / 30.44)}m`).tickSizeOuter(0));

    // Y axis
    g.append('g').attr('class', 'axis axis--y')
      .call(d3.axisLeft(yScale).ticks(isMobile ? 4 : 6).tickFormat(d => `${d > 0 ? '+' : ''}${d}`).tickSizeOuter(0));

    if (!isMobile) {
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -42).attr('x', -innerH / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--muted-foreground)')
        .attr('font-size', '11px').attr('font-weight', '500')
        .attr('font-family', 'var(--font-sans)')
        .text('Cumulative change (bps from t=0)');
    }

  }, [dimensions, normalizedA, normalizedB, onDecisionSelect, onViewChange]);

  const cycleLink = decision => decision
    ? `/decision/${encodeURIComponent(decision.id)}?snapshot=${encodeURIComponent(snapshotMeta.releaseId)}`
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Comparative Policy Dynamics · Normalized Trajectories
        </span>
        <h2 className="m-0 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {cycles.length} policy cycles.
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Normalizing easing and tightening phases to t=0 shows recorded rate changes, elapsed time, and adjustment pace across historical regimes.
        </p>
      </div>

      {/* Cycle selectors — vertical stack on mobile, horizontal on sm+ */}
      <div className="flex flex-col gap-2.5 border-y border-border/70 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2 flex-1">
          <span className="size-2.5 rounded-full bg-cut shrink-0" aria-hidden="true" />
            <Select value={String(cycleA)} onValueChange={value => {
              const next = safeCycleIndex(value, 0, cycles.length);
              setCycleA(next);
              onCycleSelectionChange?.({ a: String(next), b: String(cycleB) });
            }}>
            <SelectTrigger className="h-9 min-w-0 flex-1 sm:flex-none sm:w-[210px]">
              <SelectValue aria-label="First policy cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c, i) => (
                <SelectItem key={i} value={String(i)}>{c.label} ({c.startDate.slice(0, 4)}–{c.endDate.slice(0, 4)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="hidden sm:block px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">vs</span>
        <span className="sm:hidden text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground pl-5">vs</span>

        <div className="flex min-w-0 items-center gap-2 flex-1">
          <span className="size-2.5 rounded-full bg-hike shrink-0" aria-hidden="true" />
            <Select value={String(cycleB)} onValueChange={value => {
              const next = safeCycleIndex(value, cycles.length - 1, cycles.length);
              setCycleB(next);
              onCycleSelectionChange?.({ a: String(cycleA), b: String(next) });
            }}>
            <SelectTrigger className="h-9 min-w-0 flex-1 sm:flex-none sm:w-[210px]">
              <SelectValue aria-label="Second policy cycle" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c, i) => (
                <SelectItem key={i} value={String(i)}>{c.label} ({c.startDate.slice(0, 4)}–{c.endDate.slice(0, 4)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cycle summary — stacked on mobile, 2-col on sm+ */}
      <div id="cycle-comparison-summary" className="grid gap-2.5 border-b border-border/70 pb-3 text-sm grid-cols-1 sm:grid-cols-2 sm:gap-x-6" role="status" aria-live="polite">
        <div className="min-w-0 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:rounded-none">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-cut"><span className="size-1.5 rounded-full bg-cut" aria-hidden="true" />{selectedA?.label}</div>
          <p className="mt-1.5 mb-0 text-foreground"><strong className="font-semibold tabular-nums">{selectedA?.totalBps > 0 ? '+' : ''}{selectedA?.totalBps} bps</strong><span className="ml-2 text-xs text-muted-foreground">{selectedA?.durationMonths}mo · {selectedA?.moveCount || 0} recorded moves</span></p>
          {selectedA?.rateData.length ? <a className="mt-2 inline-block text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={cycleLink(selectedA.rateData.at(-1))}>Open latest record</a> : null}
        </div>
        <div className="min-w-0 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:rounded-none">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-hike"><span className="size-1.5 rounded-full bg-hike" aria-hidden="true" />{selectedB?.label}</div>
          <p className="mt-1.5 mb-0 text-foreground"><strong className="font-semibold tabular-nums">{selectedB?.totalBps > 0 ? '+' : ''}{selectedB?.totalBps} bps</strong><span className="ml-2 text-xs text-muted-foreground">{selectedB?.durationMonths}mo · {selectedB?.moveCount || 0} recorded moves</span></p>
          {selectedB?.rateData.length ? <a className="mt-2 inline-block text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={cycleLink(selectedB.rateData.at(-1))}>Open latest record</a> : null}
        </div>
      </div>

      <div className="chart-container" ref={containerRef} role="group" aria-labelledby="cycle-comparison-summary">
        <svg ref={svgRef} className="chart-svg" width={dimensions.width} height={dimensions.height} />
      </div>
    </div>
  );
}
