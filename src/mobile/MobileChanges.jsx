import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { rateChanges } from '../data/dataLoader.js';

const MARGIN = { top: 20, right: 16, bottom: 40, left: 40 };
const EXTREME_THRESHOLD = 50;

const RANGE_PRESETS = [
  { id: '1Y', label: '1Y', years: 1 },
  { id: '5Y', label: '5Y', years: 5 },
  { id: '10Y', label: '10Y', years: 10 },
  { id: 'ALL', label: 'All', years: null },
];

export default function MobileChanges({ dateRange, onDateRangeChange, activePreset, onPresetChange }) {
  const chartRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  const handlePreset = (preset) => {
    onPresetChange(preset.id);
    if (preset.years === null) {
      onDateRangeChange({ start: null, end: null });
    } else {
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - preset.years);
      onDateRangeChange({
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      });
    }
  };

  let data = rateChanges;
  if (dateRange.start) {
    const s = new Date(dateRange.start);
    data = data.filter(d => d.dateObj >= s);
  }
  if (dateRange.end) {
    const e = new Date(dateRange.end);
    data = data.filter(d => d.dateObj <= e);
  }

  const totalCuts = data.filter(d => d.changeBps < 0).length;
  const totalHikes = data.filter(d => d.changeBps > 0).length;
  const netBps = data.reduce((acc, d) => acc + d.changeBps, 0);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDims({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!dims.width || !dims.height) return;

    const { width, height } = dims;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;
    if (innerW <= 0 || innerH <= 0) return;

    if (data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const xScale = d3.scaleBand()
      .domain(data.map(d => d.date))
      .range([0, innerW])
      .padding(0.25);

    const maxBps = d3.max(data, d => Math.abs(d.changeBps)) || 50;
    const yScale = d3.scaleLinear()
      .domain([-maxBps - 10, maxBps + 10])
      .range([innerH, 0])
      .nice();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', yScale(0)).attr('y2', yScale(0))
      .attr('stroke', 'var(--color-axis)').attr('stroke-width', 1);

    const gridG = g.append('g')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat('').ticks(5));
    gridG.selectAll('line').attr('stroke', 'var(--color-grid)').attr('stroke-dasharray', '4,4');
    gridG.select('.domain').attr('stroke', 'none');

    const tooltip = d3.select(tooltipRef.current);

    g.selectAll('.bar')
      .data(data)
      .join('rect')
      .attr('x', d => xScale(d.date))
      .attr('width', xScale.bandwidth())
      .attr('y', d => d.changeBps > 0 ? yScale(d.changeBps) : yScale(0))
      .attr('height', d => Math.abs(yScale(d.changeBps) - yScale(0)))
      .attr('rx', 2)
      .attr('fill', d => d.changeBps > 0 ? 'var(--color-hike)' : 'var(--color-cut)')
      .attr('opacity', 0.8)
      .attr('stroke', d => Math.abs(d.changeBps) >= EXTREME_THRESHOLD ? 'var(--text-primary)' : 'none')
      .attr('stroke-width', d => Math.abs(d.changeBps) >= EXTREME_THRESHOLD ? 2 : 0);

    // Touch handler for bars
    const handleBarTouch = (event) => {
      event.preventDefault();
      const touch = event.touches?.[0] || event.changedTouches?.[0];
      if (!touch) return;

      const svgEl = svgRef.current;
      const rect = svgEl.getBoundingClientRect();
      const mx = touch.clientX - rect.left - MARGIN.left;

      const barData = data.find(d => {
        const bx = xScale(d.date);
        return mx >= bx && mx <= bx + xScale.bandwidth();
      });

      if (!barData) return;

      const dateStr = d3.timeFormat('%b %d, %Y')(barData.dateObj);
      const changeStr = barData.changeBps > 0 ? `+${barData.changeBps}` : `${barData.changeBps}`;
      const changeClass = barData.changeBps > 0 ? 'mobile-tooltip__change--hike' : 'mobile-tooltip__change--cut';

      tooltip.classed('mobile-tooltip--visible', true)
        .html(`
          <div class="mobile-tooltip__date">${dateStr}</div>
          <div class="mobile-tooltip__rate">${barData.rate.toFixed(2)}%</div>
          <div class="mobile-tooltip__change ${changeClass}">${changeStr} bps</div>
          ${Math.abs(barData.changeBps) >= EXTREME_THRESHOLD ? '<div class="mobile-tooltip__regime">⚡ Extreme move</div>' : ''}
        `);

      const bx = xScale(barData.date) + MARGIN.left + xScale.bandwidth() / 2;
      const tW = tooltipRef.current.offsetWidth;
      let tx = bx - tW / 2;
      if (tx < 8) tx = 8;
      if (tx + tW > dims.width - 8) tx = dims.width - tW - 8;

      tooltip.style('left', `${tx}px`).style('top', '8px');
    };

    const handleTouchEnd = () => {
      tooltip.classed('mobile-tooltip--visible', false);
    };

    const overlay = g.append('rect')
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'transparent');

    const overlayNode = overlay.node();
    overlayNode.addEventListener('touchstart', handleBarTouch, { passive: false });
    overlayNode.addEventListener('touchmove', handleBarTouch, { passive: false });
    overlayNode.addEventListener('touchend', handleTouchEnd);

    const tickEvery = Math.max(1, Math.floor(data.length / 8));
    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale)
        .tickValues(data.filter((_, i) => i % tickEvery === 0).map(d => d.date))
        .tickFormat(d => d3.timeFormat("'%y")(new Date(d)))
        .tickSizeOuter(0));
    xAxisG.selectAll('text').attr('fill', 'var(--text-tertiary)').attr('font-family', 'var(--font-mono)').attr('font-size', '11px');
    xAxisG.selectAll('line').attr('stroke', 'var(--color-axis)');
    xAxisG.select('.domain').attr('stroke', 'none');

    const yAxisG = g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d > 0 ? '+' : ''}${d}`).tickSizeOuter(0));
    yAxisG.selectAll('text').attr('fill', 'var(--text-tertiary)').attr('font-family', 'var(--font-mono)').attr('font-size', '11px');
    yAxisG.selectAll('line').attr('stroke', 'var(--color-axis)');
    yAxisG.select('.domain').attr('stroke', 'none');

    return () => {
      overlayNode.removeEventListener('touchstart', handleBarTouch);
      overlayNode.removeEventListener('touchmove', handleBarTouch);
      overlayNode.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dims, dateRange]);

  return (
    <div className="mobile-changes">
      <div className="mobile-status-header">
        <div>
          <div className="mobile-status-header__title">Rate Changes</div>
          <div className="mobile-status-header__subtitle">Basis Point Movements</div>
        </div>
      </div>

      <div className="mobile-chip-row">
        {RANGE_PRESETS.map(p => (
          <button
            key={p.id}
            className={`mobile-chip ${activePreset === p.id ? 'mobile-chip--active' : ''}`}
            onClick={() => handlePreset(p)}
            aria-pressed={activePreset === p.id}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mobile-changes__stats">
        <div className="mobile-changes__stat">
          <span className="mobile-changes__stat-value mobile-changes__stat-value--cut">{totalCuts}</span>
          <span className="mobile-changes__stat-label">Cuts</span>
        </div>
        <div className="mobile-changes__stat">
          <span className="mobile-changes__stat-value mobile-changes__stat-value--hike">{totalHikes}</span>
          <span className="mobile-changes__stat-label">Hikes</span>
        </div>
        <div className="mobile-changes__stat">
          <span className="mobile-changes__stat-value mobile-changes__stat-value--net">{netBps > 0 ? '+' : ''}{netBps}</span>
          <span className="mobile-changes__stat-label">Net bps</span>
        </div>
      </div>

      <div className="mobile-changes__chart-wrap" ref={chartRef}>
        <svg ref={svgRef} width={dims.width} height={dims.height} className="mobile-timeline__chart-svg" />
        <div ref={tooltipRef} className="mobile-tooltip" role="tooltip" />
      </div>
    </div>
  );
}
