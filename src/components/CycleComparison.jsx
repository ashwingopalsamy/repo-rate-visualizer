import { useState, useRef, useEffect, useMemo } from 'react';
import * as d3 from 'd3';
import { repoRateData, regimes } from '../data/dataLoader.js';

const MARGIN = { top: 24, right: 32, bottom: 48, left: 56 };

// Extract only easing and tightening cycles for comparison
const cycles = regimes.filter(r => r.type !== 'pause').map(r => {
  const rateData = repoRateData.filter(d => d.dateObj >= r.startObj && d.dateObj <= r.endObj);
  const totalBps = rateData.length > 1
    ? Math.round((rateData.at(-1).rate - rateData[0].rate) * 100)
    : 0;
  const durationMonths = Math.round((r.endObj - r.startObj) / (1000 * 60 * 60 * 24 * 30.44));
  return {
    ...r,
    rateData,
    totalBps,
    durationMonths,
    avgBpsPerMonth: durationMonths > 0 ? (totalBps / durationMonths).toFixed(1) : 0,
  };
});

export default function CycleComparison() {
  const [cycleA, setCycleA] = useState(0);
  const [cycleB, setCycleB] = useState(cycles.length - 1);
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const selectedA = cycles[cycleA];
  const selectedB = cycles[cycleB];

  // Normalize both cycles to t=0
  const normalizedA = useMemo(() => {
    if (!selectedA?.rateData.length) return [];
    const baseDate = selectedA.rateData[0].dateObj.getTime();
    const baseRate = selectedA.rateData[0].rate;
    return selectedA.rateData.map(d => ({
      dayOffset: (d.dateObj.getTime() - baseDate) / (1000 * 60 * 60 * 24),
      rateDelta: Math.round((d.rate - baseRate) * 100),
      rate: d.rate,
      date: d.date,
    }));
  }, [cycleA]);

  const normalizedB = useMemo(() => {
    if (!selectedB?.rateData.length) return [];
    const baseDate = selectedB.rateData[0].dateObj.getTime();
    const baseRate = selectedB.rateData[0].rate;
    return selectedB.rateData.map(d => ({
      dayOffset: (d.dateObj.getTime() - baseDate) / (1000 * 60 * 60 * 24),
      rateDelta: Math.round((d.rate - baseRate) * 100),
      rate: d.rate,
      date: d.date,
    }));
  }, [cycleB]);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;
    if (!normalizedA.length || !normalizedB.length) return;

    const { width, height } = dimensions;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;
    if (innerW <= 0 || innerH <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const maxDays = Math.max(
      d3.max(normalizedA, d => d.dayOffset) || 0,
      d3.max(normalizedB, d => d.dayOffset) || 0
    );

    const allDeltas = [...normalizedA.map(d => d.rateDelta), ...normalizedB.map(d => d.rateDelta)];
    const yMin = d3.min(allDeltas) - 15;
    const yMax = d3.max(allDeltas) + 15;

    const xScale = d3.scaleLinear().domain([0, maxDays]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]).nice();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Grid
    g.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat('').ticks(6));

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
      .attr('r', 3).attr('fill', 'var(--color-cut)');
    g.selectAll('.dot-b').data(normalizedB).join('circle')
      .attr('cx', d => xScale(d.dayOffset)).attr('cy', d => yScale(d.rateDelta))
      .attr('r', 3).attr('fill', 'var(--color-hike)');

    // X axis (days)
    g.append('g').attr('class', 'axis axis--x')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat(d => `${Math.round(d / 30.44)}m`).tickSizeOuter(0));

    // Y axis
    g.append('g').attr('class', 'axis axis--y')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => `${d > 0 ? '+' : ''}${d}`).tickSizeOuter(0));

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -42).attr('x', -innerH / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px').attr('font-weight', '500')
      .attr('font-family', 'var(--font-sans)')
      .text('Cumulative change (bps from t=0)');

  }, [dimensions, normalizedA, normalizedB]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
      {/* Selectors */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-cut)', display: 'inline-block' }} />
          <select
            value={cycleA}
            onChange={e => setCycleA(Number(e.target.value))}
            style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 600,
              background: 'var(--bg-control)', color: 'var(--text-primary)',
              border: '1px solid var(--border-control)', borderRadius: 'var(--radius-full)',
              padding: '6px 12px', cursor: 'pointer', outline: 'none',
            }}
          >
            {cycles.map((c, i) => (
              <option key={i} value={i}>{c.label} ({c.startDate.slice(0,4)}–{c.endDate.slice(0,4)})</option>
            ))}
          </select>
        </label>

        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>vs</span>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--color-hike)', display: 'inline-block' }} />
          <select
            value={cycleB}
            onChange={e => setCycleB(Number(e.target.value))}
            style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 600,
              background: 'var(--bg-control)', color: 'var(--text-primary)',
              border: '1px solid var(--border-control)', borderRadius: 'var(--radius-full)',
              padding: '6px 12px', cursor: 'pointer', outline: 'none',
            }}
          >
            {cycles.map((c, i) => (
              <option key={i} value={i}>{c.label} ({c.startDate.slice(0,4)}–{c.endDate.slice(0,4)})</option>
            ))}
          </select>
        </label>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{selectedA?.label}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-cut)' }}>{selectedA?.totalBps > 0 ? '+' : ''}{selectedA?.totalBps} bps</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{selectedA?.durationMonths}mo · {selectedA?.avgBpsPerMonth} bps/mo</div>
        </div>
        <div style={{ padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{selectedB?.label}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-hike)' }}>{selectedB?.totalBps > 0 ? '+' : ''}{selectedB?.totalBps} bps</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{selectedB?.durationMonths}mo · {selectedB?.avgBpsPerMonth} bps/mo</div>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-container" ref={containerRef} role="img" aria-label="Cycle comparison chart" style={{ minHeight: 380 }}>
        <svg ref={svgRef} className="chart-svg" width={dimensions.width} height={dimensions.height} />
      </div>
    </div>
  );
}
