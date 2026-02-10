import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { decisions, repoRateData, macroEvents, regimes } from '../data/dataLoader.js';
import DecisionTimelineList from './DecisionTimelineList.jsx';
import ChartReadout from './ChartReadout.jsx';

const DESKTOP_MARGIN = { top: 28, right: 20, bottom: 38, left: 50 };
const MOBILE_MARGIN = { top: 22, right: 10, bottom: 32, left: 38 };

const REGIME_FILLS = {
  easing: 'var(--color-easing)',
  tightening: 'var(--color-tightening)',
  pause: 'var(--color-pause)',
};

function actionText(action) {
  if (action === 'cut') return 'Cut';
  if (action === 'hike') return 'Hike';
  if (action === 'hold') return 'Hold';
  return 'Initial record';
}

function decisionChange(decision) {
  return decision.changeBps > 0 ? `+${decision.changeBps}` : `${decision.changeBps}`;
}

function formatReadoutDatum(datum) {
  return {
    date: datum.date,
    rate: datum.rate ?? datum.repoRate,
    action: datum.action,
    changeBps: datum.changeBps,
    annotation: datum.stance && datum.stance !== 'neutral' ? datum.stance : undefined,
  };
}

export default function TimelineChart({ activeDecisionId, dateRange, onDecisionSelect, showEvents = false, showRegimes = false }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const readoutStateRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [readout, setReadout] = useState(null);

  const stats = useMemo(() => {
    let data = repoRateData;
    let filteredDecisions = decisions;
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      data = data.filter(d => d.dateObj >= startDate);
      filteredDecisions = filteredDecisions.filter(d => d.dateObj >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      data = data.filter(d => d.dateObj <= endDate);
      filteredDecisions = filteredDecisions.filter(d => d.dateObj <= endDate);
    }
    if (!data.length) return null;

    const startRate = data[0]?.rate ?? 0;
    const latestRate = data[data.length - 1]?.rate ?? 0;
    const minPoint = d3.least(data, d => d.rate);
    const maxPoint = d3.greatest(data, d => d.rate);
    const netBps = Math.round((latestRate - startRate) * 100);
    const cuts = filteredDecisions.filter(d => d.action === 'cut');
    const hikes = filteredDecisions.filter(d => d.action === 'hike');
    const holds = filteredDecisions.filter(d => d.action === 'hold' || d.action === 'initial');

    return {
      startRate,
      latestRate,
      minRate: minPoint?.rate ?? startRate,
      maxRate: maxPoint?.rate ?? startRate,
      minDate: minPoint?.date ?? '',
      maxDate: maxPoint?.date ?? '',
      netBps,
      totalDecisions: filteredDecisions.length,
      cutsCount: cuts.length,
      hikesCount: hikes.length,
      holdsCount: holds.length,
    };
  }, [dateRange.start, dateRange.end]);

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
    readoutStateRef.current = null;
    setReadout(null);
  }, [dateRange.start, dateRange.end, showEvents, showRegimes]);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return undefined;

    const { width, height } = dimensions;
    const margin = width < 520 ? MOBILE_MARGIN : DESKTOP_MARGIN;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    if (innerW <= 0 || innerH <= 0) return undefined;

    let data = repoRateData;
    let filteredDecisions = decisions;
    let filteredRegimes = showRegimes ? regimes : [];
    let filteredEvents = showEvents ? macroEvents : [];

    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      data = data.filter(d => d.dateObj >= startDate);
      filteredDecisions = filteredDecisions.filter(d => d.dateObj >= startDate);
      filteredRegimes = filteredRegimes.filter(r => r.endObj >= startDate);
      filteredEvents = filteredEvents.filter(e => e.dateObj >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      data = data.filter(d => d.dateObj <= endDate);
      filteredDecisions = filteredDecisions.filter(d => d.dateObj <= endDate);
      filteredRegimes = filteredRegimes.filter(r => r.startObj <= endDate);
      filteredEvents = filteredEvents.filter(e => e.dateObj <= endDate);
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (data.length === 0) return undefined;

    const xExtent = d3.extent(data, d => d.dateObj);
    const yExtent = d3.extent(data, d => d.rate);
    const yPad = (yExtent[1] - yExtent[0]) * 0.15 || 0.5;
    const xScale = d3.scaleTime().domain(xExtent).range([0, innerW]);
    const yScale = d3.scaleLinear()
      .domain([Math.max(0, yExtent[0] - yPad), yExtent[1] + yPad])
      .range([innerH, 0])
      .nice();

    // Defs for gradient fill under the step line
    const defs = svg.append('defs');
    const areaGrad = defs.append('linearGradient')
      .attr('id', 'timeline-area-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');

    areaGrad.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'var(--color-line)')
      .attr('stop-opacity', 0.20);

    areaGrad.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'var(--color-line)')
      .attr('stop-opacity', 0.0);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const plot = g.append('g').attr('class', 'chart-plot');

    plot.append('g').attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat('').ticks(7));

    plot.selectAll('.regime-band')
      .data(filteredRegimes)
      .join('rect')
      .attr('class', 'regime-band')
      .attr('x', d => Math.max(0, xScale(d.startObj)))
      .attr('y', 0)
      .attr('width', d => Math.max(0, Math.min(innerW, xScale(d.endObj)) - Math.max(0, xScale(d.startObj))))
      .attr('height', innerH)
      .attr('fill', d => REGIME_FILLS[d.type] || 'var(--color-pause)')
      .append('title')
      .text(d => `${d.label} (${d.type})`);

    const avoidRects = [];
    const LABEL_SLOTS = [16, 42, 68];
    const placedLabels = [];
    const sortedEvents = [...filteredEvents].sort((a, b) => a.dateObj - b.dateObj);
    const validEvents = [];

    sortedEvents.forEach(event => {
      const x = xScale(event.dateObj);
      if (x < 0 || x > innerW) return;
      validEvents.push({ ...event, x });
      plot.append('line')
        .attr('class', 'annotation-line')
        .attr('x1', x).attr('x2', x)
        .attr('y1', 0).attr('y2', innerH);
    });

    validEvents.forEach(event => {
      const { x, label } = event;
      const probe = plot.append('text')
        .attr('class', 'annotation-label')
        .attr('x', -9999).attr('y', -9999)
        .text(label);
      const probeWidth = probe.node().getBBox().width;
      probe.remove();
      const halfWidth = probeWidth / 2 + 8;
      const slotIndex = LABEL_SLOTS.findIndex((_, index) => !placedLabels.some(item => item.slotIndex === index && Math.abs(item.x - x) < item.halfWidth + halfWidth + 8));
      if (slotIndex === -1) return;
      const labelY = LABEL_SLOTS[slotIndex];
      placedLabels.push({ x, halfWidth, slotIndex });
      avoidRects.push({ left: margin.left + x - halfWidth, top: margin.top + labelY - 12, width: halfWidth * 2, height: 18 });

      const text = plot.append('text')
        .attr('class', 'annotation-label')
        .attr('x', x).attr('y', labelY)
        .text(label);
      const box = text.node().getBBox();
      plot.insert('rect', () => text.node())
        .attr('class', 'annotation-label-bg')
        .attr('x', box.x - 5).attr('y', box.y - 3)
        .attr('width', box.width + 10).attr('height', box.height + 6);
      text.raise();
    });

    // Area Gradient under the step line (Image 1 aesthetic)
    const area = d3.area()
      .x(d => xScale(d.dateObj))
      .y0(innerH)
      .y1(d => yScale(d.rate))
      .curve(d3.curveStepAfter);

    plot.append('path')
      .datum(data)
      .attr('class', 'rate-area-gradient')
      .attr('d', area)
      .attr('fill', 'url(#timeline-area-gradient)')
      .attr('pointer-events', 'none');

    const line = d3.line()
      .x(d => xScale(d.dateObj))
      .y(d => yScale(d.rate))
      .curve(d3.curveStepAfter);
    plot.append('path').datum(data).attr('class', 'rate-line').attr('d', line);

    plot.selectAll('.rate-dot')
      .data(data)
      .join('circle')
      .attr('class', 'rate-dot')
      .attr('cx', d => xScale(d.dateObj))
      .attr('cy', d => yScale(d.rate))
      .attr('r', 2.5)
      .attr('aria-hidden', 'true');

    // Peak Annotation
    const maxPoint = d3.greatest(data, d => d.rate);
    const latestPoint = data[data.length - 1];
    if (maxPoint && latestPoint && maxPoint.rate > latestPoint.rate + 0.5) {
      const px = xScale(maxPoint.dateObj);
      const py = yScale(maxPoint.rate);
      if (px > 40 && px < innerW - 55) {
        const peakG = plot.append('g')
          .attr('class', 'chart-peak-annotation')
          .attr('transform', `translate(${px}, ${py - 10})`);

        peakG.append('text')
          .attr('text-anchor', 'middle')
          .text(`${maxPoint.rate.toFixed(2)}% Peak`);
      }
    }

    // End-of-line callout badge at latest point (Image 1 aesthetic)
    if (latestPoint) {
      const lx = xScale(latestPoint.dateObj);
      const ly = yScale(latestPoint.rate);
      const calloutG = plot.append('g')
        .attr('class', 'chart-latest-callout')
        .attr('transform', `translate(${lx}, ${ly})`);

      calloutG.append('circle')
        .attr('class', 'chart-callout-pulse')
        .attr('r', 6)
        .attr('fill', 'var(--color-line)');

      calloutG.append('circle')
        .attr('class', 'chart-callout-dot')
        .attr('r', 3.5)
        .attr('fill', 'var(--color-line)');
    }

    const xTickInterval = innerW > 600 ? d3.timeYear.every(2) : d3.timeYear.every(4);
    g.append('g').attr('class', 'axis axis--x')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(xTickInterval).tickFormat(d3.timeFormat('%Y')).tickSizeOuter(0));

    g.append('g').attr('class', 'axis axis--y')
      .call(d3.axisLeft(yScale).ticks(7).tickFormat(d => `${d}%`).tickSizeOuter(0));

    g.append('text')
      .attr('class', 'chart-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -36).attr('x', -innerH / 2)
      .attr('text-anchor', 'middle')
      .text('Repo rate (%)');

    const pointCoordinates = data.map(point => ({ x: margin.left + xScale(point.dateObj), y: margin.top + yScale(point.rate) }));
    const nearestDataPoint = (event) => {
      const [mx] = d3.pointer(event, plot.node());
      const dateAtCursor = xScale.invert(mx);
      const index = d3.bisector(d => d.dateObj).left(data, dateAtCursor, 1);
      const d0 = data[index - 1];
      const d1 = data[index];
      if (!d0) return null;
      return d1 && dateAtCursor - d0.dateObj > d1.dateObj - dateAtCursor ? d1 : d0;
    };

    const setReadoutFor = (datum, persistent = false) => {
      if (!datum) return;
      const rate = datum.rate ?? datum.repoRate;
      const next = {
        visible: true,
        datum: formatReadoutDatum(datum),
        anchor: { x: margin.left + xScale(datum.dateObj), y: margin.top + yScale(rate) },
        nearbyPoints: pointCoordinates,
        avoidRects,
        persistent,
      };
      readoutStateRef.current = next;
      setReadout(next);
    };

    const clearReadout = () => {
      if (readoutStateRef.current?.persistent) return;
      readoutStateRef.current = null;
      setReadout(null);
    };

    const crosshairV = plot.append('line').attr('class', 'crosshair-line').style('display', 'none');
    const crosshairH = plot.append('line').attr('class', 'crosshair-line').style('display', 'none');
    const hoverHalo = plot.append('circle')
      .attr('class', 'chart-hover-halo')
      .attr('r', 10)
      .style('display', 'none')
      .style('pointer-events', 'none');
    const hoverDot = plot.append('circle')
      .attr('class', 'chart-hover-dot')
      .attr('r', 5)
      .style('display', 'none')
      .style('pointer-events', 'none');

    plot.append('rect')
      .attr('class', 'chart-interaction-overlay')
      .attr('width', innerW).attr('height', innerH)
      .attr('fill', 'transparent')
      .on('pointermove', function(event) {
        if (event.pointerType === 'touch') return;
        const datum = nearestDataPoint(event);
        if (!datum) return;
        const x = xScale(datum.dateObj);
        const y = yScale(datum.rate);
        crosshairV.style('display', null).attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', innerH);
        crosshairH.style('display', null).attr('x1', 0).attr('x2', innerW).attr('y1', y).attr('y2', y);
        hoverHalo.style('display', null).attr('cx', x).attr('cy', y);
        hoverDot.style('display', null).attr('cx', x).attr('cy', y);
        setReadoutFor(datum, false);
      })
      .on('pointerleave', function() {
        crosshairV.style('display', 'none');
        crosshairH.style('display', 'none');
        hoverHalo.style('display', 'none');
        hoverDot.style('display', 'none');
        clearReadout();
      })
      .on('pointerup', function(event) {
        const datum = nearestDataPoint(event);
        if (!datum) return;
        setReadoutFor(datum, true);
        onDecisionSelect?.(datum.decisionId);
      });

    const markerLayer = plot.append('g')
      .attr('class', 'decision-markers')
      .attr('aria-label', 'Official policy decision markers');

    const markerGroups = markerLayer.selectAll('.decision-marker')
      .data(filteredDecisions)
      .join('g')
      .attr('class', decision => `decision-marker decision-marker--${decision.action}${activeDecisionId === decision.id ? ' decision-marker--active' : ''}`)
      .attr('transform', decision => `translate(${xScale(decision.dateObj)},${yScale(decision.repoRate)})`)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('data-decision-id', decision => decision.id)
      .attr('aria-pressed', decision => activeDecisionId === decision.id ? 'true' : 'false')
      .attr('aria-label', decision => `${actionText(decision.action)} on ${decision.date}, repo rate ${decision.repoRate.toFixed(2)} percent, ${decisionChange(decision)} basis points`)
      .on('mouseenter focus', function(event, decision) {
        setReadoutFor(decision, false);
      })
      .on('mouseleave blur', clearReadout)
      .on('pointerup', function(event, decision) {
        event.preventDefault();
        setReadoutFor(decision, true);
        onDecisionSelect?.(decision.id);
      })
      .on('keydown', function(event, decision) {
        if (event.key === 'Escape') {
          readoutStateRef.current = null;
          setReadout(null);
          return;
        }
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setReadoutFor(decision, true);
        onDecisionSelect?.(decision.id);
      });

    markerGroups.append('line')
      .attr('class', 'decision-marker__stem')
      .attr('x1', 0).attr('x2', 0)
      .attr('y1', -8).attr('y2', 8);
    markerGroups.append('circle')
      .attr('class', 'decision-marker__hit')
      .attr('r', 10)
      .attr('aria-hidden', 'true');
    markerGroups.append('circle')
      .attr('class', 'decision-marker__dot')
      .attr('r', 3.8)
      .attr('aria-hidden', 'true')
      .append('title')
      .text(decision => `${actionText(decision.action)} · ${decision.date} · ${decision.repoRate.toFixed(2)}%`);

    if (activeDecisionId) {
      const activeMarker = markerGroups.filter(decision => decision.id === activeDecisionId).node();
      const activeDecision = filteredDecisions.find(decision => decision.id === activeDecisionId);
      if (activeMarker && activeDecision) {
        activeMarker.focus({ preventScroll: true });
        setReadoutFor(activeDecision, true);
      }
    }

    return () => {
      svg.selectAll('*').on('.pointermove', null).on('.pointerleave', null).on('.pointerup', null);
    };
  }, [activeDecisionId, dateRange, dimensions, onDecisionSelect, showEvents, showRegimes]);

  return (
    <>
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Timeline
          </span>
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Chart legend">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-700 dark:text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Easing</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-rose-700 dark:text-rose-300">
              <span className="size-1.5 rounded-full bg-rose-500" />
              <span>Tightening</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-blue-700 dark:text-blue-300">
              <span className="size-1.5 rounded-full bg-blue-500" />
              <span>Pause</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/60 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground">
              <span className="h-0.5 w-2 border-b border-dashed border-muted-foreground/80" />
              <span>Macro event</span>
            </span>
          </div>
        </div>

        {stats ? (
          <>
            <p className="m-0 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {stats.netBps < 0
                ? `Repo rate has eased by ${Math.abs(stats.netBps)} bps across this period from the ${stats.maxRate?.toFixed(2)}% peak, with ${stats.cutsCount} cuts totaling ${Math.abs(stats.netBps)} bps.`
                : stats.netBps > 0
                ? `Repo rate has tightened by +${stats.netBps} bps across this period, peaking at ${stats.maxRate?.toFixed(2)}% with ${stats.hikesCount} rate hikes.`
                : `Repo rate has held steady at ${stats.latestRate.toFixed(2)}% across ${stats.holdsCount} decisions in this window.`}
            </p>

            <div className="grid grid-cols-2 divide-y divide-border/60 rounded-xl border border-border/70 bg-muted/20 shadow-2xs sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
              <div className="p-3 sm:p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Horizon start</span>
                <div className="mt-1 text-sm sm:text-base font-semibold tabular-nums text-foreground">
                  {stats.startRate.toFixed(2)}%
                </div>
              </div>

              <div className="p-3 sm:p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Period peak</span>
                <div className="mt-1 text-sm sm:text-base font-semibold tabular-nums text-hike">
                  {stats.maxRate?.toFixed(2)}% <span className="text-xs font-normal text-muted-foreground">({stats.maxDate?.slice(0, 4)})</span>
                </div>
              </div>

              <div className="p-3 sm:p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Period low</span>
                <div className="mt-1 text-sm sm:text-base font-semibold tabular-nums text-cut">
                  {stats.minRate?.toFixed(2)}% <span className="text-xs font-normal text-muted-foreground">({stats.minDate?.slice(0, 4)})</span>
                </div>
              </div>

              <div className="p-3 sm:p-3.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Decisions</span>
                <div className="mt-1 text-sm sm:text-base font-semibold tabular-nums text-foreground">
                  {stats.totalDecisions} <span className="text-xs font-normal text-muted-foreground">({stats.holdsCount} holds)</span>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="chart-container" ref={containerRef} role="group" aria-label="RBI Repo Rate timeline chart with official decision markers">
        <svg ref={svgRef} className="chart-svg" width={dimensions.width} height={dimensions.height} />
        <ChartReadout
          visible={Boolean(readout)}
          datum={readout?.datum}
          anchor={readout?.anchor}
          bounds={dimensions}
          nearbyPoints={readout?.nearbyPoints}
          avoidRects={readout?.avoidRects}
          persistent={readout?.persistent}
          onDismiss={() => {
            readoutStateRef.current = null;
            setReadout(null);
          }}
        />
      </div>
      <DecisionTimelineList activeDecisionId={activeDecisionId} dateRange={dateRange} onDecisionSelect={onDecisionSelect} />
    </>
  );
}
