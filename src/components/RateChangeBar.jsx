import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { rateChanges } from '../data/dataLoader.js';

const MARGIN = { top: 24, right: 32, bottom: 48, left: 56 };
const EXTREME_THRESHOLD = 50; // bps - highlight moves >= 50bps

export default function RateChangeBar({ dateRange }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;

    const { width, height } = dimensions;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;
    if (innerW <= 0 || innerH <= 0) return;

    let data = rateChanges;
    if (dateRange.start) {
      const start = new Date(dateRange.start);
      data = data.filter(d => d.dateObj >= start);
    }
    if (dateRange.end) {
      const end = new Date(dateRange.end);
      data = data.filter(d => d.dateObj <= end);
    }

    if (data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const xScale = d3.scaleBand()
      .domain(data.map(d => d.date))
      .range([0, innerW])
      .padding(0.3);

    const maxBps = d3.max(data, d => Math.abs(d.changeBps)) || 50;
    const yScale = d3.scaleLinear()
      .domain([-maxBps - 10, maxBps + 10])
      .range([innerH, 0])
      .nice();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Zero line
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', yScale(0)).attr('y2', yScale(0))
      .attr('stroke', 'var(--color-axis)').attr('stroke-width', 1);

    // Grid
    g.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat('').ticks(6));

    // Bars
    const tooltip = d3.select(tooltipRef.current);

    g.selectAll('.bar')
      .data(data)
      .join('rect')
      .attr('class', d => {
        let cls = d.changeBps > 0 ? 'bar-positive' : 'bar-negative';
        if (Math.abs(d.changeBps) >= EXTREME_THRESHOLD) cls += ' bar-extreme';
        return cls;
      })
      .attr('x', d => xScale(d.date))
      .attr('width', xScale.bandwidth())
      .attr('y', d => d.changeBps > 0 ? yScale(d.changeBps) : yScale(0))
      .attr('height', d => Math.abs(yScale(d.changeBps) - yScale(0)))
      .attr('rx', 2)
      .on('mouseenter', function(event, d) {
        const dateStr = d3.timeFormat('%b %d, %Y')(d.dateObj);
        const changeStr = d.changeBps > 0 ? `+${d.changeBps}` : `${d.changeBps}`;
        const changeClass = d.changeBps > 0 ? 'chart-tooltip__change--hike' : 'chart-tooltip__change--cut';
        tooltip.classed('chart-tooltip--visible', true)
          .html(`
            <div class="chart-tooltip__date">${dateStr}</div>
            <div class="chart-tooltip__rate">${d.rate.toFixed(2)}%</div>
            <div class="chart-tooltip__change ${changeClass}">${changeStr} bps</div>
            ${Math.abs(d.changeBps) >= EXTREME_THRESHOLD ? '<div class="chart-tooltip__regime">⚡ Extreme move</div>' : ''}
          `);
        const rect = containerRef.current.getBoundingClientRect();
        const [mx, my] = d3.pointer(event, containerRef.current);
        tooltip.style('left', `${mx + 16}px`).style('top', `${my - 40}px`);
      })
      .on('mouseleave', () => {
        tooltip.classed('chart-tooltip--visible', false);
      });

    // X axis - show every nth label
    const tickEvery = Math.max(1, Math.floor(data.length / 12));
    g.append('g').attr('class', 'axis axis--x')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale)
        .tickValues(data.filter((_, i) => i % tickEvery === 0).map(d => d.date))
        .tickFormat(d => d3.timeFormat('%Y')(new Date(d)))
        .tickSizeOuter(0));

    // Y axis
    g.append('g').attr('class', 'axis axis--y')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => `${d > 0 ? '+' : ''}${d}`).tickSizeOuter(0));

    // Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -42).attr('x', -innerH / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px').attr('font-weight', '500')
      .attr('font-family', 'var(--font-sans)')
      .text('Change (bps)');

  }, [dimensions, dateRange]);

  return (
    <div className="chart-container" ref={containerRef} role="img" aria-label="RBI Repo Rate changes in basis points">
      <svg ref={svgRef} className="chart-svg" width={dimensions.width} height={dimensions.height} />
      <div ref={tooltipRef} className="chart-tooltip" role="tooltip" />
    </div>
  );
}
