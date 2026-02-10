import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { repoRateData, macroEvents, regimes } from '../data/dataLoader.js';

const MARGIN = { top: 36, right: 32, bottom: 48, left: 56 };

const REGIME_FILLS = {
  easing: 'var(--color-easing)',
  tightening: 'var(--color-tightening)',
  pause: 'var(--color-pause)',
};

export default function TimelineChart({ dateRange }) {
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

    // Filter data by date range
    let data = repoRateData;
    let filteredRegimes = regimes;
    let filteredEvents = macroEvents;

    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      data = data.filter(d => d.dateObj >= startDate);
      filteredRegimes = filteredRegimes.filter(r => r.endObj >= startDate);
      filteredEvents = filteredEvents.filter(e => e.dateObj >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      data = data.filter(d => d.dateObj <= endDate);
      filteredRegimes = filteredRegimes.filter(r => r.startObj <= endDate);
      filteredEvents = filteredEvents.filter(e => e.dateObj <= endDate);
    }

    if (data.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Scales
    const xExtent = d3.extent(data, d => d.dateObj);
    const yExtent = d3.extent(data, d => d.rate);
    const yPad = (yExtent[1] - yExtent[0]) * 0.15 || 0.5;

    const xScale = d3.scaleTime().domain(xExtent).range([0, innerW]);
    const yScale = d3.scaleLinear()
      .domain([Math.max(0, yExtent[0] - yPad), yExtent[1] + yPad])
      .range([innerH, 0])
      .nice();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Accessibility: SVG hatching patterns for regime bands
    const defs = svg.append('defs');

    // Easing hatching: diagonal lines going one direction
    const hatchEasing = defs.append('pattern')
      .attr('id', 'hatch-easing').attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 8).attr('height', 8);
    hatchEasing.append('rect').attr('width', 8).attr('height', 8).attr('fill', 'var(--color-easing)');
    hatchEasing.append('line').attr('x1', 0).attr('y1', 8).attr('x2', 8).attr('y2', 0)
      .attr('stroke', 'var(--color-easing-border)').attr('stroke-width', 0.5);

    // Tightening hatching: opposite diagonal
    const hatchTight = defs.append('pattern')
      .attr('id', 'hatch-tightening').attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 8).attr('height', 8);
    hatchTight.append('rect').attr('width', 8).attr('height', 8).attr('fill', 'var(--color-tightening)');
    hatchTight.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 8).attr('y2', 8)
      .attr('stroke', 'var(--color-tightening-border)').attr('stroke-width', 0.5);

    // Pause: dots
    const hatchPause = defs.append('pattern')
      .attr('id', 'hatch-pause').attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 8).attr('height', 8);
    hatchPause.append('rect').attr('width', 8).attr('height', 8).attr('fill', 'var(--color-pause)');
    hatchPause.append('circle').attr('cx', 4).attr('cy', 4).attr('r', 0.8)
      .attr('fill', 'var(--color-pause-border)');

    // Grid lines
    g.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat('').ticks(8));

    // Regime bands
    g.selectAll('.regime-band')
      .data(filteredRegimes)
      .join('rect')
      .attr('class', 'regime-band')
      .attr('x', d => Math.max(0, xScale(d.startObj)))
      .attr('y', 0)
      .attr('width', d => {
        const x0 = Math.max(0, xScale(d.startObj));
        const x1 = Math.min(innerW, xScale(d.endObj));
        return Math.max(0, x1 - x0);
      })
      .attr('height', innerH)
      .attr('fill', d => `url(#hatch-${d.type})`)
      .attr('rx', 2)
      .append('title')
      .text(d => `${d.label} (${d.type})`);

    // Annotation lines and labels - collision-aware placement
    const LABEL_SLOTS = [-8, 26, 60, 94]; // Significantly wider spacing
    const placedLabels = []; // track {x, halfW, slotIdx} for collision detection

    const sortedEvents = [...filteredEvents].sort((a, b) => a.dateObj - b.dateObj);

    // 1. Draw all lines first (z-index: bottom)
    const validEvents = [];
    sortedEvents.forEach(evt => {
      const x = xScale(evt.dateObj);
      if (x < 0 || x > innerW) return;
      
      validEvents.push({ ...evt, x });

      g.append('line')
        .attr('class', 'annotation-line')
        .attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', innerH);
    });

    // 2. Draw all labels on top (z-index: top)
    validEvents.forEach(evt => {
      const { x, label } = evt;

      // Render off-screen to measure width
      const probe = g.append('text')
        .attr('class', 'annotation-label')
        .attr('x', -9999).attr('y', -9999)
        .text(label);
      const probeW = probe.node().getBBox().width;
      probe.remove();

      const halfW = probeW / 2 + 12; // More horizontal padding for collision check

      // Find first slot with no horizontal collision
      let chosenSlot = 0;
      for (let s = 0; s < LABEL_SLOTS.length; s++) {
        const collision = placedLabels.some(p =>
          p.slotIdx === s && Math.abs(p.x - x) < (p.halfW + halfW + 12) // Wider collision buffer
        );
        if (!collision) { chosenSlot = s; break; }
      }

      placedLabels.push({ x, halfW, slotIdx: chosenSlot });

      const labelY = LABEL_SLOTS[chosenSlot];
      
      // Draw background rect (behind text, but on top of lines)
      const text = g.append('text')
        .attr('class', 'annotation-label')
        .attr('x', x).attr('y', labelY)
        .text(label);

      const bbox = text.node().getBBox();
      g.insert('rect', `text[x="${x}"][y="${labelY}"]`) // Insert before this specific text node
        .attr('class', 'annotation-label-bg')
        .attr('x', bbox.x - 6).attr('y', bbox.y - 3)
        .attr('width', bbox.width + 12).attr('height', bbox.height + 6);
    });

    // Step-line
    const line = d3.line()
      .x(d => xScale(d.dateObj))
      .y(d => yScale(d.rate))
      .curve(d3.curveStepAfter);

    g.append('path').datum(data).attr('class', 'rate-line').attr('d', line);

    // Data dots
    g.selectAll('.rate-dot')
      .data(data)
      .join('circle')
      .attr('class', 'rate-dot')
      .attr('cx', d => xScale(d.dateObj))
      .attr('cy', d => yScale(d.rate))
      .attr('r', 3)
      .attr('role', 'img')
      .attr('aria-label', d => `${d.date}: ${d.rate}%`);

    // X axis
    const xTickInterval = innerW > 600 ? d3.timeYear.every(2) : d3.timeYear.every(5);
    g.append('g').attr('class', 'axis axis--x')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(xTickInterval).tickFormat(d3.timeFormat('%Y')).tickSizeOuter(0));

    // Y axis
    g.append('g').attr('class', 'axis axis--y')
      .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => `${d}%`).tickSizeOuter(0));

    // Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -42).attr('x', -innerH / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .attr('font-family', 'var(--font-sans)')
      .text('Repo Rate (%)');

    // Interactive overlay
    const tooltip = d3.select(tooltipRef.current);
    const bisect = d3.bisector(d => d.dateObj).left;

    const crosshairV = g.append('line').attr('class', 'crosshair-line').style('display', 'none');
    const crosshairH = g.append('line').attr('class', 'crosshair-line').style('display', 'none');
    const hoverDot = g.append('circle')
      .attr('r', 5)
      .attr('fill', 'var(--color-dot)')
      .attr('stroke', 'var(--color-dot-stroke)')
      .attr('stroke-width', 2)
      .style('display', 'none')
      .style('pointer-events', 'none');

    g.append('rect')
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mousemove', function(event) {
        const [mx] = d3.pointer(event);
        const dateAtCursor = xScale.invert(mx);
        const idx = bisect(data, dateAtCursor, 1);
        const d0 = data[idx - 1];
        const d1 = data[idx];
        if (!d0) return;
        const d = d1 && (dateAtCursor - d0.dateObj > d1.dateObj - dateAtCursor) ? d1 : d0;

        const x = xScale(d.dateObj);
        const y = yScale(d.rate);

        crosshairV.style('display', null).attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', innerH);
        crosshairH.style('display', null).attr('x1', 0).attr('x2', innerW).attr('y1', y).attr('y2', y);
        hoverDot.style('display', null).attr('cx', x).attr('cy', y);

        const regime = filteredRegimes.find(r => d.dateObj >= r.startObj && d.dateObj <= r.endObj);
        const dateStr = d3.timeFormat('%b %d, %Y')(d.dateObj);
        const changeStr = d.changeBps > 0 ? `+${d.changeBps} bps` : d.changeBps < 0 ? `${d.changeBps} bps` : 'Unchanged';
        const changeClass = d.changeBps > 0 ? 'chart-tooltip__change--hike' : d.changeBps < 0 ? 'chart-tooltip__change--cut' : 'chart-tooltip__change--unchanged';

        tooltip.classed('chart-tooltip--visible', true)
          .html(`
            <div class="chart-tooltip__date">${dateStr}</div>
            <div class="chart-tooltip__rate">${d.rate.toFixed(2)}%</div>
            <div class="chart-tooltip__change ${changeClass}">${changeStr}</div>
            ${regime ? `<div class="chart-tooltip__regime">${regime.label}</div>` : ''}
            <div class="chart-tooltip__source">${d.source || 'RBI'}</div>
          `);

        const containerRect = containerRef.current.getBoundingClientRect();
        const tooltipNode = tooltipRef.current;
        const tW = tooltipNode.offsetWidth;
        const tH = tooltipNode.offsetHeight;

        let tx = x + MARGIN.left + 16;
        let ty = y + MARGIN.top - tH / 2;
        if (tx + tW > width - 16) tx = x + MARGIN.left - tW - 16;
        if (ty < 8) ty = 8;
        if (ty + tH > height - 8) ty = height - tH - 8;

        tooltip.style('left', `${tx}px`).style('top', `${ty}px`);
      })
      .on('mouseleave', function() {
        crosshairV.style('display', 'none');
        crosshairH.style('display', 'none');
        hoverDot.style('display', 'none');
        tooltip.classed('chart-tooltip--visible', false);
      });

  }, [dimensions, dateRange]);

  return (
    <div className="chart-container" ref={containerRef} role="img" aria-label="RBI Repo Rate timeline chart">
      <svg ref={svgRef} className="chart-svg" width={dimensions.width} height={dimensions.height} />
      <div ref={tooltipRef} className="chart-tooltip" role="tooltip" />
    </div>
  );
}
