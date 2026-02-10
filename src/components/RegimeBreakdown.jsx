import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { decisions, regimes } from '../data/dataLoader.js';
import { getRegimeBreakdowns, getYearlyBreakdowns, getAggregateStats } from '../lib/regimeBreakdownData.js';
import ChartReadout from './ChartReadout.jsx';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs.jsx';

const DESKTOP_MARGIN = { top: 36, right: 24, bottom: 92, left: 48 };
const MOBILE_MARGIN = { top: 32, right: 12, bottom: 84, left: 36 };

export default function RegimeBreakdown({ dateRange }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const readoutStateRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [readout, setReadout] = useState(null);
  const [groupBy, setGroupBy] = useState('regime'); // 'regime' | 'year'
  const [metricMode, setMetricMode] = useState('count'); // 'count' | 'bps'

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
  }, [dateRange.start, dateRange.end, groupBy, metricMode]);

  const rawData = useMemo(() => {
    return groupBy === 'regime'
      ? getRegimeBreakdowns(regimes, decisions, dateRange)
      : getYearlyBreakdowns(decisions, dateRange);
  }, [dateRange, groupBy]);

  const aggregate = useMemo(() => {
    return getAggregateStats(decisions, dateRange);
  }, [dateRange]);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return undefined;
    const { width, height } = dimensions;
    const margin = width < 540 ? MOBILE_MARGIN : DESKTOP_MARGIN;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    if (innerW <= 0 || innerH <= 0) return undefined;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (rawData.length === 0) return undefined;

    // Filter items based on width if too crowded in yearly view
    const isMobile = width < 600;
    const data = (groupBy === 'year' && isMobile && rawData.length > 12)
      ? rawData.slice(-12)
      : rawData;

    const xScale = d3.scaleBand()
      .domain(data.map(d => d.id))
      .range([0, innerW])
      .padding(isMobile ? 0.22 : 0.32);

    // Compute stacked data
    const stackKeys = metricMode === 'count'
      ? ['holds', 'cuts', 'hikes']
      : ['cutBps', 'hikeBps'];

    const stack = d3.stack()
      .keys(stackKeys)
      .value((d, key) => d[key] || 0);

    const stackedSeries = stack(data);
    const maxY = d3.max(stackedSeries, layer => d3.max(layer, d => d[1])) || 10;
    const yScale = d3.scaleLinear()
      .domain([0, maxY * 1.18])
      .range([innerH, 0])
      .nice();

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat('').ticks(isMobile ? 4 : 6));

    const colorForKey = {
      holds: 'var(--color-hold)',
      cuts: 'var(--color-cut)',
      hikes: 'var(--color-hike)',
      cutBps: 'var(--color-cut)',
      hikeBps: 'var(--color-hike)',
    };

    const labelForSegment = (key, val) => {
      if (metricMode === 'bps') return `${val}`;
      return `${val}`;
    };

    const barItemCoordinates = [];

    const setReadoutFor = (item, persistent = false) => {
      const coord = barItemCoordinates.find(c => Math.abs(c.x - (margin.left + (xScale(item.id) || 0) + xScale.bandwidth() / 2)) < 5);
      const readoutDatum = {
        date: item.startDate || `${item.label}-01-01`,
        rate: item.endRate,
        action: item.netBps < 0 ? 'cut' : item.netBps > 0 ? 'hike' : 'hold',
        changeBps: item.netBps,
        annotation: `${item.label}: ${item.holds} Holds, ${item.cuts} Cuts, ${item.hikes} Hikes · ${item.ratio} ratio`,
      };

      const anchor = {
        x: coord?.x ?? margin.left + (xScale(item.id) || 0) + xScale.bandwidth() / 2,
        y: coord?.y ?? margin.top + 20,
      };

      const next = { visible: true, datum: readoutDatum, anchor, nearbyPoints: barItemCoordinates, persistent };
      readoutStateRef.current = next;
      setReadout(next);
    };

    const clearReadout = () => {
      if (readoutStateRef.current?.persistent) return;
      readoutStateRef.current = null;
      setReadout(null);
    };

    // Render stacked segments
    stackedSeries.forEach(layer => {
      const key = layer.key;
      const fillColor = colorForKey[key] || 'var(--color-hold)';

      g.selectAll(`.segment-${key}`)
        .data(layer)
        .join('g')
        .attr('class', `segment-group segment-${key}`)
        .each(function(d) {
          const item = d.data;
          const yTop = yScale(d[1]);
          const yBottom = yScale(d[0]);
          const segHeight = Math.max(0, yBottom - yTop);
          const x = xScale(item.id);
          const barW = xScale.bandwidth();
          const val = item[key];

          if (segHeight <= 0 || !val) return;

          const segG = d3.select(this);

          // Bar segment rect
          segG.append('rect')
            .attr('class', `breakdown-segment segment--${key}`)
            .attr('x', x)
            .attr('y', yTop)
            .attr('width', barW)
            .attr('height', segHeight)
            .attr('fill', fillColor)
            .attr('opacity', 0.88)
            .attr('rx', 2.5)
            .attr('cursor', 'pointer')
            .attr('tabindex', 0)
            .attr('role', 'button')
            .attr('aria-label', `${item.label}: ${key} ${val}${metricMode === 'bps' ? ' bps' : ' decisions'}`)
            .on('mouseenter focus', () => {
              setReadoutFor(item, false);
            })
            .on('mouseleave blur', clearReadout)
            .on('pointerup', (event) => {
              event.preventDefault();
              setReadoutFor(item, true);
            });

          // Text inside segment if there is enough height and width
          if (segHeight >= 16 && barW >= 18) {
            segG.append('text')
              .attr('class', 'segment-label font-mono')
              .attr('x', x + barW / 2)
              .attr('y', yTop + segHeight / 2 + 4)
              .attr('text-anchor', 'middle')
              .attr('fill', '#ffffff')
              .attr('font-size', isMobile ? '10px' : '11px')
              .attr('font-weight', '600')
              .attr('pointer-events', 'none')
              .text(labelForSegment(key, val));
          }
        });
    });

    // Top badges above each bar
    data.forEach(item => {
      const x = xScale(item.id);
      const barW = xScale.bandwidth();
      const totalVal = metricMode === 'count'
        ? (item.holds + item.cuts + item.hikes)
        : (item.cutBps + item.hikeBps);
      const topY = yScale(totalVal);

      barItemCoordinates.push({
        x: margin.left + x + barW / 2,
        y: margin.top + topY,
        left: margin.left + x,
        top: margin.top + topY,
        width: barW,
        height: innerH - topY,
      });

      const topText = metricMode === 'count'
        ? `${totalVal}`
        : `${item.netBps > 0 ? '+' : ''}${item.netBps}`;

      if (topText) {
        g.append('text')
          .attr('class', 'breakdown-top-badge font-mono')
          .attr('x', x + barW / 2)
          .attr('y', Math.max(14, topY - 7))
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--foreground)')
          .attr('font-size', isMobile ? '10px' : '11px')
          .attr('font-weight', '700')
          .text(topText);
      }
    });

    // X Axis Labels with Clean Angled Formatting
    const xAxisG = g.append('g')
      .attr('class', 'axis axis--x')
      .attr('transform', `translate(0,${innerH})`);

    xAxisG.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', 'var(--color-axis)')
      .attr('stroke-width', 1);

    const labelAngle = isMobile ? -58 : -38;

    data.forEach(item => {
      const x = (xScale(item.id) || 0) + xScale.bandwidth() / 2;

      // Subtle tick mark connecting bar to its label
      xAxisG.append('line')
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', 0)
        .attr('y2', 5)
        .attr('stroke', 'var(--color-axis)')
        .attr('stroke-width', 1);

      const labelGroup = xAxisG.append('g')
        .attr('class', 'x-axis-label-group')
        .attr('transform', `translate(${x}, 8) rotate(${labelAngle})`)
        .attr('cursor', 'pointer')
        .on('mouseenter focus', () => setReadoutFor(item, false))
        .on('mouseleave blur', clearReadout)
        .on('pointerup', (event) => {
          event.preventDefault();
          setReadoutFor(item, true);
        });

      if (groupBy === 'regime') {
        const text = labelGroup.append('text')
          .attr('text-anchor', 'end')
          .attr('class', 'select-none');

        const title = isMobile && item.label.length > 13
          ? `${item.label.slice(0, 12)}…`
          : item.label;

        text.append('tspan')
          .attr('x', 0)
          .attr('dy', 0)
          .attr('fill', 'var(--foreground)')
          .attr('font-size', isMobile ? '8.5px' : '10.5px')
          .attr('font-weight', '600')
          .text(title);

        text.append('tspan')
          .attr('x', 0)
          .attr('dy', isMobile ? '10.5px' : '13px')
          .attr('fill', 'var(--muted-foreground)')
          .attr('font-size', isMobile ? '7.5px' : '9.5px')
          .attr('font-weight', '500')
          .text(item.periodLabel);
      } else {
        labelGroup.append('text')
          .attr('text-anchor', 'end')
          .attr('x', 0)
          .attr('y', 0)
          .attr('fill', 'var(--foreground)')
          .attr('font-size', isMobile ? '8.5px' : '10.5px')
          .attr('font-weight', '600')
          .attr('class', 'select-none')
          .text(item.label);
      }
    });

    // Y Axis
    g.append('g')
      .attr('class', 'axis axis--y')
      .call(
        d3.axisLeft(yScale)
          .ticks(isMobile ? 4 : 6)
          .tickFormat(d => metricMode === 'bps' ? `${d} bps` : `${d}`)
          .tickSizeOuter(0)
      );

    g.append('text')
      .attr('class', 'chart-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -34)
      .attr('x', -innerH / 2)
      .attr('text-anchor', 'middle')
      .text(metricMode === 'count' ? 'Decisions count' : 'Volume (bps)');

    return () => {
      svg.selectAll('*').on('.mouseenter', null).on('.mouseleave', null).on('.pointerup', null);
    };
  }, [dimensions, rawData, groupBy, metricMode]);

  return (
    <div className="breakdown-view flex flex-col gap-5">
      {/* 1. Hero Editorial Story Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {groupBy === 'regime' ? 'RBI Policy Regime Decomposition' : 'Annual Monetary Policy Breakdown'}
          </span>
          <h2 className="m-0 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {aggregate.holdPct}% holds.
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Most central bank decisions are pauses — <strong className="font-semibold text-foreground">{aggregate.holdRatio}</strong> vs active rate adjustments. Over this timeline, the RBI recorded <strong className="font-semibold text-cut">{aggregate.cutsCount} cuts</strong> totaling -{aggregate.totalCutBps} bps against <strong className="font-semibold text-hike">{aggregate.hikesCount} hikes</strong> totaling +{aggregate.totalHikeBps} bps.
          </p>
        </div>

        {/* Metric Summary Strip */}
        <div className="grid grid-cols-2 divide-y divide-border/60 rounded-xl border border-border/60 bg-muted/20 shadow-2xs sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total decisions</span>
            <div className="mt-1 text-sm sm:text-base font-semibold tabular-nums text-foreground">
              {aggregate.totalDecisions}
            </div>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Holds</span>
            <div className="mt-1 text-sm sm:text-base font-semibold tabular-nums text-hold">
              {aggregate.holdsCount} <span className="text-xs font-normal text-muted-foreground">({aggregate.holdPct}%)</span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cuts</span>
            <div className="mt-1 text-sm sm:text-base font-semibold tabular-nums text-cut">
              {aggregate.cutsCount} <span className="text-xs font-normal text-muted-foreground">(-{aggregate.totalCutBps} bps)</span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hikes</span>
            <div className="mt-1 text-sm sm:text-base font-semibold tabular-nums text-hike">
              {aggregate.hikesCount} <span className="text-xs font-normal text-muted-foreground">(+{aggregate.totalHikeBps} bps)</span>
            </div>
          </div>
        </div>

        {/* Legend & Controls Row — stacks vertically on mobile */}
        <div className="flex flex-col gap-2.5 border-y border-border/60 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          {/* Legend pills */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-hold" aria-hidden="true" />
              <span>Holds</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-cut" aria-hidden="true" />
              <span>Rate Cuts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-hike" aria-hidden="true" />
              <span>Rate Hikes</span>
            </div>
          </div>

          {/* Mode switchers — side-by-side, no wrap on mobile */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Tabs value={groupBy} onValueChange={setGroupBy} className="min-w-0">
              <TabsList className="gap-1">
                <TabsTrigger value="regime" className="px-2.5 sm:px-3 text-xs">By Regime</TabsTrigger>
                <TabsTrigger value="year" className="px-2.5 sm:px-3 text-xs">By Year</TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs value={metricMode} onValueChange={setMetricMode} className="min-w-0">
              <TabsList className="gap-1">
                <TabsTrigger value="count" className="px-2.5 sm:px-3 text-xs">Decisions</TabsTrigger>
                <TabsTrigger value="bps" className="px-2.5 sm:px-3 text-xs">Bps Volume</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* 2. Stacked Bar Chart */}
      <div className="chart-container" ref={containerRef} role="group" aria-label="RBI Policy breakdown stacked bar chart">
        <svg ref={svgRef} className="chart-svg" width={dimensions.width} height={dimensions.height} />
        <ChartReadout
          visible={Boolean(readout)}
          datum={readout?.datum}
          anchor={readout?.anchor}
          bounds={dimensions}
          nearbyPoints={readout?.nearbyPoints}
          persistent={readout?.persistent}
          onDismiss={() => {
            readoutStateRef.current = null;
            setReadout(null);
          }}
        />
      </div>

      {/* 3. Footer Annotation */}
      <p className="m-0 text-center text-[11px] text-muted-foreground">
        {metricMode === 'count'
          ? 'Number above each bar = total decisions · Values inside segments = decision count.'
          : 'Number above each bar = net cumulative bps move · Values inside segments = basis points.'}
      </p>
    </div>
  );
}
