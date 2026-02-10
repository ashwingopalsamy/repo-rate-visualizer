import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { repoRateData, macroEvents, regimes } from '../data/dataLoader.js';

const MARGIN = { top: 24, right: 16, bottom: 40, left: 40 };

const RANGE_PRESETS = [
  { id: '1Y', label: '1Y', years: 1 },
  { id: '5Y', label: '5Y', years: 5 },
  { id: '10Y', label: '10Y', years: 10 },
  { id: 'ALL', label: 'All', years: null },
];

const formatEventDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });

export default function MobileTimeline({ dateRange, onDateRangeChange, activePreset, onPresetChange }) {
  const chartRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [eventsOpen, setEventsOpen] = useState(true);

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

    let data = repoRateData;
    let filteredRegimes = regimes;

    if (dateRange.start) {
      const s = new Date(dateRange.start);
      data = data.filter(d => d.dateObj >= s);
      filteredRegimes = filteredRegimes.filter(r => r.endObj >= s);
    }
    if (dateRange.end) {
      const e = new Date(dateRange.end);
      data = data.filter(d => d.dateObj <= e);
      filteredRegimes = filteredRegimes.filter(r => r.startObj <= e);
    }

    if (data.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const xExtent = d3.extent(data, d => d.dateObj);
    const yExtent = d3.extent(data, d => d.rate);
    const yPad = (yExtent[1] - yExtent[0]) * 0.15 || 0.5;

    const xScale = d3.scaleTime().domain(xExtent).range([0, innerW]);
    const yScale = d3.scaleLinear()
      .domain([Math.max(0, yExtent[0] - yPad), yExtent[1] + yPad])
      .range([innerH, 0])
      .nice();

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const defs = svg.append('defs');

    const hatchEasing = defs.append('pattern')
      .attr('id', 'mob-hatch-easing').attr('patternUnits', 'userSpaceOnUse').attr('width', 8).attr('height', 8);
    hatchEasing.append('rect').attr('width', 8).attr('height', 8).attr('fill', 'var(--color-easing)');
    hatchEasing.append('line').attr('x1', 0).attr('y1', 8).attr('x2', 8).attr('y2', 0)
      .attr('stroke', 'var(--color-easing-border)').attr('stroke-width', 0.5);

    const hatchTight = defs.append('pattern')
      .attr('id', 'mob-hatch-tightening').attr('patternUnits', 'userSpaceOnUse').attr('width', 8).attr('height', 8);
    hatchTight.append('rect').attr('width', 8).attr('height', 8).attr('fill', 'var(--color-tightening)');
    hatchTight.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 8).attr('y2', 8)
      .attr('stroke', 'var(--color-tightening-border)').attr('stroke-width', 0.5);

    const hatchPause = defs.append('pattern')
      .attr('id', 'mob-hatch-pause').attr('patternUnits', 'userSpaceOnUse').attr('width', 8).attr('height', 8);
    hatchPause.append('rect').attr('width', 8).attr('height', 8).attr('fill', 'var(--color-pause)');
    hatchPause.append('circle').attr('cx', 4).attr('cy', 4).attr('r', 0.8).attr('fill', 'var(--color-pause-border)');

    const areaGradient = defs.append('linearGradient')
      .attr('id', 'mob-area-gradient').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', 'var(--color-line)').attr('stop-opacity', 0.15);
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', 'var(--color-line)').attr('stop-opacity', 0);

    const gridG = g.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat('').ticks(5));
    gridG.selectAll('line').attr('stroke', 'var(--color-grid)').attr('stroke-dasharray', '4,4');
    gridG.select('.domain').attr('stroke', 'none');

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
      .attr('fill', d => `url(#mob-hatch-${d.type})`)
      .attr('rx', 2);

    const area = d3.area()
      .x(d => xScale(d.dateObj))
      .y0(innerH)
      .y1(d => yScale(d.rate))
      .curve(d3.curveStepAfter);
    g.append('path').datum(data).attr('d', area)
      .attr('fill', 'url(#mob-area-gradient)')
      .attr('opacity', 0.6)
      .style('pointer-events', 'none');

    const line = d3.line()
      .x(d => xScale(d.dateObj))
      .y(d => yScale(d.rate))
      .curve(d3.curveStepAfter);

    const path = g.append('path').datum(data).attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', 'var(--color-line)')
      .attr('stroke-width', 2.5)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round');

    const totalLength = path.node().getTotalLength();
    path
      .attr('stroke-dasharray', totalLength + ' ' + totalLength)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    g.selectAll('.rate-dot')
      .data(data)
      .join('circle')
      .attr('cx', d => xScale(d.dateObj))
      .attr('cy', d => yScale(d.rate))
      .attr('r', 2)
      .attr('fill', 'var(--bg-card)')
      .attr('stroke', 'var(--color-line)')
      .attr('stroke-width', 1.5);

    const xTickInterval = innerW > 300 ? d3.timeYear.every(3) : d3.timeYear.every(5);
    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(xTickInterval).tickFormat(d3.timeFormat("'%y")).tickSizeOuter(0));
    xAxisG.selectAll('text').attr('fill', 'var(--text-tertiary)').attr('font-family', 'var(--font-mono)').attr('font-size', '11px');
    xAxisG.selectAll('line').attr('stroke', 'var(--color-axis)');
    xAxisG.select('.domain').attr('stroke', 'none');

    const yAxisG = g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}%`).tickSizeOuter(0));
    yAxisG.selectAll('text').attr('fill', 'var(--text-tertiary)').attr('font-family', 'var(--font-mono)').attr('font-size', '11px');
    yAxisG.selectAll('line').attr('stroke', 'var(--color-axis)');
    yAxisG.select('.domain').attr('stroke', 'none');

    // Touch-based tooltip
    const tooltip = d3.select(tooltipRef.current);
    const bisect = d3.bisector(d => d.dateObj).left;

    const hoverDot = g.append('circle')
      .attr('r', 6)
      .attr('fill', 'var(--bg-card)')
      .attr('stroke', 'var(--color-primary)')
      .attr('stroke-width', 2)
      .style('display', 'none')
      .style('pointer-events', 'none');

    const crosshairV = g.append('line')
      .attr('stroke', 'var(--color-crosshair)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4')
      .style('pointer-events', 'none')
      .style('display', 'none');

    const handleTouch = (event) => {
      event.preventDefault();
      const touch = event.touches?.[0] || event.changedTouches?.[0];
      if (!touch) return;

      const svgEl = svgRef.current;
      const rect = svgEl.getBoundingClientRect();
      const mx = touch.clientX - rect.left - MARGIN.left;

      if (mx < 0 || mx > innerW) return;

      const dateAtCursor = xScale.invert(mx);
      const idx = bisect(data, dateAtCursor, 1);
      const d0 = data[idx - 1];
      const d1 = data[idx];
      if (!d0) return;
      const d = d1 && (dateAtCursor - d0.dateObj > d1.dateObj - dateAtCursor) ? d1 : d0;

      const x = xScale(d.dateObj);
      const y = yScale(d.rate);

      crosshairV.style('display', null).attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', innerH);
      hoverDot.style('display', null).attr('cx', x).attr('cy', y);

      const regime = filteredRegimes.find(r => d.dateObj >= r.startObj && d.dateObj <= r.endObj);
      const dateStr = d3.timeFormat('%b %d, %Y')(d.dateObj);
      const changeStr = d.changeBps > 0 ? `+${d.changeBps} bps` : d.changeBps < 0 ? `${d.changeBps} bps` : 'Unchanged';
      const changeClass = d.changeBps > 0 ? 'mobile-tooltip__change--hike' : d.changeBps < 0 ? 'mobile-tooltip__change--cut' : 'mobile-tooltip__change--unchanged';

      tooltip.classed('mobile-tooltip--visible', true)
        .html(`
          <div class="mobile-tooltip__date">${dateStr}</div>
          <div class="mobile-tooltip__rate">${d.rate.toFixed(2)}%</div>
          <div class="mobile-tooltip__change ${changeClass}">${changeStr}</div>
          ${regime ? `<div class="mobile-tooltip__regime">${regime.label}</div>` : ''}
          <div class="mobile-tooltip__source">${d.source || 'RBI'}</div>
        `);

      const chartRect = chartRef.current.getBoundingClientRect();
      const tooltipNode = tooltipRef.current;
      const tW = tooltipNode.offsetWidth;

      let tx = x + MARGIN.left + 12;
      if (tx + tW > dims.width - 8) tx = x + MARGIN.left - tW - 12;
      let ty = y + MARGIN.top - 80;
      if (ty < 8) ty = 8;

      tooltip.style('left', `${tx}px`).style('top', `${ty}px`);
    };

    const handleTouchEnd = () => {
      crosshairV.style('display', 'none');
      hoverDot.style('display', 'none');
      tooltip.classed('mobile-tooltip--visible', false);
    };

    const overlayRect = g.append('rect')
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'transparent');

    const overlayNode = overlayRect.node();
    overlayNode.addEventListener('touchstart', handleTouch, { passive: false });
    overlayNode.addEventListener('touchmove', handleTouch, { passive: false });
    overlayNode.addEventListener('touchend', handleTouchEnd);

    // Also support mouse for desktop testing
    overlayRect
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
        hoverDot.style('display', null).attr('cx', x).attr('cy', y);

        const regime = filteredRegimes.find(r => d.dateObj >= r.startObj && d.dateObj <= r.endObj);
        const dateStr = d3.timeFormat('%b %d, %Y')(d.dateObj);
        const changeStr = d.changeBps > 0 ? `+${d.changeBps} bps` : d.changeBps < 0 ? `${d.changeBps} bps` : 'Unchanged';
        const changeClass = d.changeBps > 0 ? 'mobile-tooltip__change--hike' : d.changeBps < 0 ? 'mobile-tooltip__change--cut' : 'mobile-tooltip__change--unchanged';

        tooltip.classed('mobile-tooltip--visible', true)
          .html(`
            <div class="mobile-tooltip__date">${dateStr}</div>
            <div class="mobile-tooltip__rate">${d.rate.toFixed(2)}%</div>
            <div class="mobile-tooltip__change ${changeClass}">${changeStr}</div>
            ${regime ? `<div class="mobile-tooltip__regime">${regime.label}</div>` : ''}
            <div class="mobile-tooltip__source">${d.source || 'RBI'}</div>
          `);

        let tx = x + MARGIN.left + 12;
        const tW = tooltipRef.current.offsetWidth;
        if (tx + tW > dims.width - 8) tx = x + MARGIN.left - tW - 12;
        let ty = y + MARGIN.top - 80;
        if (ty < 8) ty = 8;

        tooltip.style('left', `${tx}px`).style('top', `${ty}px`);
      })
      .on('mouseleave', handleTouchEnd);

    return () => {
      overlayNode.removeEventListener('touchstart', handleTouch);
      overlayNode.removeEventListener('touchmove', handleTouch);
      overlayNode.removeEventListener('touchend', handleTouchEnd);
    };

  }, [dims, dateRange]);

  // Filter events for feed
  let events = macroEvents;
  if (dateRange.start) {
    const s = new Date(dateRange.start);
    events = events.filter(e => e.dateObj >= s);
  }
  if (dateRange.end) {
    const e = new Date(dateRange.end);
    events = events.filter(ev => ev.dateObj <= e);
  }

  return (
    <div className="mobile-timeline">
      {/* Status Header */}
      <div className="mobile-status-header">
        <div>
          <div className="mobile-status-header__title">Timeline</div>
          <div className="mobile-status-header__subtitle">RBI Repo Rate History</div>
        </div>
      </div>

      {/* Date Range Chips */}
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

      {/* Legend */}
      <div className="mobile-timeline__legend" role="list" aria-label="Chart legend">
        <div className="mobile-timeline__legend-item" role="listitem">
          <span className="mobile-timeline__legend-swatch mobile-timeline__legend-swatch--easing" />
          Easing
        </div>
        <div className="mobile-timeline__legend-item" role="listitem">
          <span className="mobile-timeline__legend-swatch mobile-timeline__legend-swatch--tightening" />
          Tightening
        </div>
        <div className="mobile-timeline__legend-item" role="listitem">
          <span className="mobile-timeline__legend-swatch mobile-timeline__legend-swatch--pause" />
          Pause
        </div>
        <div className="mobile-timeline__legend-item" role="listitem">
          <span className="mobile-timeline__legend-line" />
          Event
        </div>
      </div>

      {/* Chart */}
      <div className="mobile-timeline__chart-wrap" ref={chartRef}>
        <svg ref={svgRef} className="mobile-timeline__chart-svg" width={dims.width} height={dims.height} />
        <div ref={tooltipRef} className="mobile-tooltip" role="tooltip" />
      </div>

      {/* Events Feed */}
      <div className="mobile-events">
        <button
          className="mobile-events__header"
          onClick={() => setEventsOpen(o => !o)}
          aria-expanded={eventsOpen}
        >
          <span>
            <span className="mobile-events__header-label">Events</span>
            <span className="mobile-events__header-count">{events.length}</span>
          </span>
          <svg className={`mobile-events__chevron ${eventsOpen ? 'mobile-events__chevron--open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {eventsOpen && events.length > 0 && (
          <div className="mobile-events__list" role="list">
            {events.map((evt, i) => (
              <a
                key={i}
                className="mobile-events__item"
                href={evt.citation}
                target="_blank"
                rel="noopener noreferrer"
                role="listitem"
                aria-label={`${evt.label}: ${evt.description}`}
              >
                <span className="mobile-events__item-date">{formatEventDate(evt.date)}</span>
                <span className="mobile-events__item-label">{evt.label}</span>
                <span className="mobile-events__item-desc">{evt.description}</span>
                <span className={`mobile-events__item-type mobile-events__item-type--${evt.type}`}>
                  {evt.type}
                </span>
              </a>
            ))}
          </div>
        )}

        {eventsOpen && events.length === 0 && (
          <div style={{ padding: 'var(--space-2)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            No macro events in this range
          </div>
        )}
      </div>
    </div>
  );
}
