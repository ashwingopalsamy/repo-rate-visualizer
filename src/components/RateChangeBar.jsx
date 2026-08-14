import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { rateChanges } from '../data/dataLoader.js';
import ChartReadout from './ChartReadout.jsx';

const DESKTOP_MARGIN = { top: 24, right: 20, bottom: 38, left: 50 };
const MOBILE_MARGIN = { top: 20, right: 10, bottom: 32, left: 38 };
const EXTREME_THRESHOLD = 50;

function readoutDatum(datum) {
  return {
    date: datum.date,
    rate: datum.rate,
    action: datum.changeBps < 0 ? 'cut' : 'hike',
    changeBps: datum.changeBps,
    annotation: Math.abs(datum.changeBps) >= EXTREME_THRESHOLD ? 'Large move' : undefined,
  };
}

export default function RateChangeBar({ dateRange }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const readoutStateRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [readout, setReadout] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    readoutStateRef.current = null;
    setReadout(null);
  }, [dateRange.start, dateRange.end]);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return undefined;
    const { width, height } = dimensions;
    const margin = width < 520 ? MOBILE_MARGIN : DESKTOP_MARGIN;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    if (innerW <= 0 || innerH <= 0) return undefined;

    let data = rateChanges;
    if (dateRange.start) data = data.filter(d => d.dateObj >= new Date(dateRange.start));
    if (dateRange.end) data = data.filter(d => d.dateObj <= new Date(dateRange.end));

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (data.length === 0) return undefined;

    const xScale = d3.scaleBand().domain(data.map(d => d.date)).range([0, innerW]).padding(0.28);
    const maxBps = d3.max(data, d => Math.abs(d.changeBps)) || 50;
    const yScale = d3.scaleLinear().domain([-maxBps - 10, maxBps + 10]).range([innerH, 0]).nice();
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g').attr('class', 'grid').call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat('').ticks(6));
    g.append('line').attr('class', 'zero-line').attr('x1', 0).attr('x2', innerW).attr('y1', yScale(0)).attr('y2', yScale(0));

    const zeroY = margin.top + yScale(0);
    const barRects = data.map(datum => {
      const x = margin.left + (xScale(datum.date) || 0);
      const endY = margin.top + yScale(datum.changeBps);
      return {
        left: x,
        top: Math.min(zeroY, endY),
        width: xScale.bandwidth(),
        height: Math.abs(endY - zeroY),
        x: x + xScale.bandwidth() / 2,
        y: endY,
      };
    });

    const setReadoutFor = (datum, persistent = false) => {
      const bar = barRects.find(item => item.x === margin.left + (xScale(datum.date) || 0) + xScale.bandwidth() / 2);
      const anchor = {
        x: bar?.x ?? margin.left + (xScale(datum.date) || 0) + xScale.bandwidth() / 2,
        y: bar?.y ?? margin.top + yScale(datum.changeBps),
      };
      const next = { visible: true, datum: readoutDatum(datum), anchor, nearbyPoints: barRects, persistent };
      readoutStateRef.current = next;
      setReadout(next);
    };
    const clearReadout = () => {
      if (readoutStateRef.current?.persistent) return;
      readoutStateRef.current = null;
      setReadout(null);
    };

    const bars = g.selectAll('.bar')
      .data(data)
      .join('rect')
      .attr('class', d => `bar ${d.changeBps > 0 ? 'bar-positive' : 'bar-negative'}${Math.abs(d.changeBps) >= EXTREME_THRESHOLD ? ' bar-extreme' : ''}`)
      .attr('x', d => xScale(d.date))
      .attr('width', xScale.bandwidth())
      .attr('y', d => d.changeBps > 0 ? yScale(d.changeBps) : yScale(0))
      .attr('height', d => Math.abs(yScale(d.changeBps) - yScale(0)))
      .attr('rx', 2)
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-label', d => `${d.changeBps > 0 ? 'Hike' : 'Cut'} on ${d.date}, ${d.changeBps > 0 ? '+' : ''}${d.changeBps} basis points, repo rate ${d.rate.toFixed(2)} percent`)
      .on('mouseenter focus', (event, datum) => setReadoutFor(datum, false))
      .on('mouseleave blur', clearReadout)
      .on('pointerup', (event, datum) => {
        event.preventDefault();
        setReadoutFor(datum, true);
      })
      .on('keydown', (event, datum) => {
        if (event.key === 'Escape') {
          readoutStateRef.current = null;
          setReadout(null);
          return;
        }
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setReadoutFor(datum, true);
      });

    const tickEvery = Math.max(1, Math.floor(data.length / (innerW < 520 ? 6 : 12)));
    g.append('g').attr('class', 'axis axis--x')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).tickValues(data.filter((_, index) => index % tickEvery === 0).map(d => d.date)).tickFormat(d => d3.timeFormat('%Y')(new Date(d))).tickSizeOuter(0));
    g.append('g').attr('class', 'axis axis--y')
      .call(d3.axisLeft(yScale).ticks(6).tickFormat(d => `${d > 0 ? '+' : ''}${d}`).tickSizeOuter(0));
    g.append('text').attr('class', 'chart-axis-label').attr('transform', 'rotate(-90)').attr('y', -36).attr('x', -innerH / 2).attr('text-anchor', 'middle').text('Change (bps)');

    return () => {
      bars.on('.mouseenter', null).on('.mouseleave', null).on('.pointerup', null).on('.keydown', null);
    };
  }, [dateRange, dimensions]);

  return (
    <div className="derived-chart-view">
      <div className="chart-container" ref={containerRef} role="group" aria-label="RBI Repo Rate changes in basis points">
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
    </div>
  );
}
