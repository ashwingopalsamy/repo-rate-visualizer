import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import ThemeToggle from './ThemeToggle.jsx';
import { indiaCountrySnapshot, loadCountryManifest } from '../data/countrySnapshot.js';
import './atlas.css';

const dateLabel = (value, locale = 'en-US') => new Date(`${value}T00:00:00Z`).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const percent = bps => (bps / 100).toFixed(2);
const valueLabel = value => value.kind === 'range'
  ? `${percent(value.lowBps)}–${percent(value.highBps)}%`
  : `${percent(value.lowBps)}%`;

function AtlasHeader({ active }) {
  return (
    <header className="atlas-header">
      <div className="atlas-wrap atlas-header__inner">
        <a className="atlas-brand" href="/countries" aria-label="Policy Rate Atlas home">
          <span className="atlas-brand__mark">PR</span><span>Policy Rate Atlas</span>
        </a>
        <nav className="atlas-header__nav" aria-label="Atlas navigation">
          <a href="/countries" aria-current={active === 'index' ? 'page' : undefined}>Countries</a>
          <a href="/" aria-current={active === 'india' ? 'page' : undefined}>India</a>
          <a href="/?country=US" aria-current={active === 'us' ? 'page' : undefined}>United States</a>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function CountryIdentity({ country = 'IN', countries = null, onCountryChange }) {
  const allCountries = countries || [
  { code: 'IN', name: 'India', instrument: 'RBI repo rate', status: 'available' },
    { code: 'US', name: 'United States', instrument: 'Fed funds target', centralBank: 'Federal Reserve', status: 'available' },
  ];
  const availableCountries = allCountries.filter(entry => entry.status === 'available');
  const selectedEntry = allCountries.find(entry => entry.code === country);
  return (
    <nav className="country-identity" aria-label="Country selection">
      <div className="country-identity__text"><a href="/countries">Policy Rate Atlas</a><span aria-hidden="true">/</span><strong>{selectedEntry?.name || country}</strong></div>
      <label className="country-identity__select">Country
        <select value={country} onChange={event => {
          if (onCountryChange) onCountryChange(event.target.value);
          else window.location.href = event.target.value === 'IN' ? '/' : `/?country=${encodeURIComponent(event.target.value)}`;
        }}>
          {!availableCountries.some(entry => entry.code === country) ? <option value={country} disabled>{selectedEntry?.name || country} · {selectedEntry?.status === 'planned' ? 'Planned' : 'Unavailable'}</option> : null}
          {availableCountries.map(entry => <option key={entry.code} value={entry.code}>{entry.name} · {entry.instrument}</option>)}
        </select>
      </label>
    </nav>
  );
}

function useCountryManifest() {
  const [state, setState] = useState({ manifest: null, error: '' });
  useEffect(() => {
    let live = true;
    loadCountryManifest().then(manifest => { if (live) setState({ manifest, error: '' }); })
      .catch(error => { if (live) setState({ manifest: null, error: error.message }); });
    return () => { live = false; };
  }, []);
  return state;
}

export function CountryIndex() {
  const { manifest, error } = useCountryManifest();
  const india = indiaCountrySnapshot();
  const countries = manifest?.countries || [{ code: 'IN', name: 'India', status: 'available', path: '/', instrument: 'Policy repo rate', centralBank: 'Reserve Bank of India', coverageFrom: india.coverage.from, coverageThrough: india.coverage.through }];
  return (
    <div className="chartbook-app atlas-shell">
      <AtlasHeader active="index" />
      <main className="atlas-wrap atlas-main">
        <div className="atlas-eyebrow">COUNTRY INDEX <span>·</span> MONETARY POLICY REFERENCE</div>
        <h1 className="atlas-title">Policy rates, in their own terms.</h1>
        <p className="atlas-deck">A source-led history of central-bank policy instruments. Each country keeps its own rate definition, evidence coverage, and policy framework.</p>
        <div className="atlas-index-note"><span className="atlas-index-note__rule" />{countries.filter(entry => entry.status === 'available').length} countries available · {countries.filter(entry => entry.status === 'planned').length} in the research queue</div>
        {error ? <p role="alert" className="atlas-error">{error}</p> : null}
        <section className="atlas-index" aria-label="Country coverage">
          <div className="atlas-index__head"><span>COUNTRY / BANK</span><span>POLICY INSTRUMENT</span><span>COVERAGE</span><span>STATUS</span></div>
          {countries.map((entry, index) => (
            <div className="atlas-index__row" key={entry.code}>
              <div className="atlas-index__name"><span className="atlas-index__ordinal">{String(index + 1).padStart(2, '0')}</span><div>{entry.status === 'available' ? <a href={entry.code === 'IN' ? '/' : `/?country=${encodeURIComponent(entry.code)}`}>{entry.name} <span aria-hidden="true">↗</span></a> : <strong>{entry.name}</strong>}<small>{entry.centralBank || 'Central bank'}</small></div></div>
              <span>{entry.instrument}</span>
              <span className="atlas-index__coverage">{entry.status === 'available' ? `${entry.coverageFrom?.slice(0, 4)}–${entry.coverageThrough?.slice(0, 4)}` : 'Pending source review'}</span>
              <span className="atlas-status">{entry.status === 'available' ? 'Available' : 'Planned'}</span>
            </div>
          ))}
        </section>
        <div className="atlas-method"><h2>How the atlas grows</h2><p>United Kingdom, Japan, and Taiwan follow in that order. Later candidates are prioritized by nominal GDP and the quality of accessible primary records. The queue above is editorial, not a GDP ranking.</p>{manifest?.ranking?.values ? <p>GDP reference: <a href={manifest.ranking.sourceUrl}>IMF World Economic Outlook, April 2026</a>, 2025 nominal GDP in US$ billions. Among these five economies: United States {manifest.ranking.values.US.toLocaleString('en-US')}; Japan {manifest.ranking.values.JP.toLocaleString('en-US')}; United Kingdom {manifest.ranking.values.GB.toLocaleString('en-US')}; India {manifest.ranking.values.IN.toLocaleString('en-US')}; Taiwan {manifest.ranking.values.TW.toLocaleString('en-US')}.</p> : null}<p>Policy instruments differ across countries and over time. Comparing their numerical levels alone does not measure relative monetary tightness.</p></div>
      </main>
    </div>
  );
}

const actionForChange = record => record.changeBps === undefined ? 'observation' : record.changeBps === null ? 'framework' : record.changeBps > 0 ? 'hike' : record.changeBps < 0 ? 'cut' : 'unchanged';

function formatBasisPoints(value) {
  if (value === null) return 'Framework change';
  if (value === undefined) return 'Change not reported';
  return `${value > 0 ? '+' : ''}${value} bps`;
}

function changeLabel(record) {
  return record.changeBps === null ? 'Framework change' : record.changeBps === undefined ? 'Rate observation' : 'Published target change';
}

export function RangeChart({ records, title = 'Policy rate', view = 'timeline', showBand = true, locale = 'en-US' }) {
  const container = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);
  useEffect(() => setHover(null), [records, view]);
  const hasChangeMetadata = records.some(record => record.changeBps !== undefined);
  const hasRanges = records.some(record => record.value.kind === 'range' && record.value.lowBps !== record.value.highBps);
  useEffect(() => {
    if (!container.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const drawing = useMemo(() => {
    if (!width || !records.length) return null;
    const height = width < 550 ? 300 : 450;
    const margin = { top: 28, right: width < 550 ? 14 : 24, bottom: 38, left: width < 550 ? 42 : 54 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const points = records.map(record => ({ ...record, date: new Date(`${record.recordDate}T00:00:00Z`) }));
    const extent = d3.extent(points, point => point.date);
    if (+extent[0] === +extent[1]) extent[1] = new Date(+extent[1] + 86400000);
    const x = d3.scaleUtc().domain(extent).range([margin.left, margin.left + innerW]);
    if (view === 'changes') {
      const maxChange = Math.max(100, d3.max(points, point => Math.abs(point.changeBps || 0)) || 0);
      const y = d3.scaleLinear().domain([-maxChange, maxChange]).nice(5).range([margin.top + innerH, margin.top]);
      return { height, margin, x, y, points, ticks: y.ticks(5), years: x.ticks(width < 550 ? 4 : 7), zeroY: y(0) };
    }
    const minValue = d3.min(points, point => point.value.lowBps) / 100;
    const maxValue = d3.max(points, point => point.value.highBps) / 100;
    const y = d3.scaleLinear().domain([Math.max(0, minValue - 0.35), maxValue + 0.35]).nice(6).range([margin.top + innerH, margin.top]);
    const high = d3.line().curve(d3.curveStepAfter).x(point => x(point.date)).y(point => y(point.value.highBps / 100))(points);
    const low = d3.line().curve(d3.curveStepAfter).x(point => x(point.date)).y(point => y(point.value.lowBps / 100))(points);
    const band = d3.area().curve(d3.curveStepAfter).x(point => x(point.date)).y0(point => y(point.value.lowBps / 100)).y1(point => y(point.value.highBps / 100))(points);
    return { height, margin, x, y, points, high, low, band, ticks: y.ticks(6), years: x.ticks(width < 550 ? 4 : 8) };
  }, [width, records, view]);
  const selectedIndex = hover === null ? records.length - 1 : Math.max(0, Math.min(records.length - 1, hover));
  const selected = records[selectedIndex];
  return (
    <div className="atlas-chart" ref={container}>
      <div className="atlas-chart__heading"><div><span className="atlas-kicker">{view === 'changes' ? 'PUBLISHED MOVES' : 'POLICY RATE HISTORY'}</span><h2>{view === 'changes' ? 'Rate changes' : title}</h2></div><div className="atlas-chart__readout" aria-live="polite" aria-atomic="true"><span>{selected && dateLabel(selected.recordDate, locale)}</span><strong className={selected ? `atlas-${actionForChange(selected)}` : ''}>{selected && (view === 'changes' ? formatBasisPoints(selected.changeBps) : valueLabel(selected.value))}</strong><small>{selected && changeLabel(selected)}</small>{view === 'changes' && selected ? <small>Published value {valueLabel(selected.value)}</small> : null}</div></div>
      <div className="atlas-chart__legend" aria-label="Chart legend">
        {view === 'timeline' ? hasRanges ? <><span><i className="atlas-chart__line atlas-chart__line--high" /> Upper bound</span><span><i className="atlas-chart__line atlas-chart__line--low" /> Lower bound</span>{showBand ? <span><i className="atlas-chart__swatch" /> Published range</span> : null}</> : <span><i className="atlas-chart__line" /> Published point value</span> : null}
        {hasChangeMetadata ? <><span><i className="atlas-chart__dot atlas-chart__dot--cut" /> Cuts</span><span><i className="atlas-chart__dot atlas-chart__dot--hike" /> Hikes</span><span><i className="atlas-chart__dot atlas-chart__dot--framework" /> Framework</span></> : null}
        {view === 'timeline' ? <span>Steps begin on published date</span> : <span>Moves in basis points</span>}
      </div>
      {drawing ? <svg className="atlas-chart__svg" width={width} height={drawing.height} viewBox={`0 0 ${width} ${drawing.height}`} role="img" tabIndex={0} aria-label={`${view === 'changes' ? 'Published rate changes in basis points' : `${title} history${hasRanges ? ' with separate upper and lower bounds' : ''}`} from ${dateLabel(records[0].recordDate, locale)} through ${dateLabel(records.at(-1).recordDate, locale)}. Use left and right arrow keys to inspect published dates.`} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); setHover(current => event.key === 'Home' ? 0 : event.key === 'End' ? records.length - 1 : Math.max(0, Math.min(records.length - 1, (current ?? records.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1)))); }} onBlur={() => setHover(null)}>
        {drawing.ticks.map(tick => <g key={tick}><line x1={drawing.margin.left} x2={width - drawing.margin.right} y1={drawing.y(tick)} y2={drawing.y(tick)} className="atlas-chart__grid" /><text x={drawing.margin.left - 9} y={drawing.y(tick) + 4} textAnchor="end" className="atlas-chart__axis">{view === 'changes' ? `${tick > 0 ? '+' : ''}${tick}` : `${tick}%`}</text></g>)}
        {drawing.years.map(year => <text key={year.toISOString()} x={drawing.x(year)} y={drawing.height - 9} textAnchor="middle" className="atlas-chart__axis">{year.getUTCFullYear()}</text>)}
        {view === 'timeline' ? <>
          {showBand && hasRanges ? <path d={drawing.band} className="atlas-chart__band" /> : null}
          <path d={drawing.high} className="atlas-chart__upper" />
          {hasRanges ? <path d={drawing.low} className="atlas-chart__lower" /> : null}
          {drawing.points.map(point => {
            const kind = actionForChange(point);
            return <g key={point.id || point.recordDate} className={`atlas-chart__event atlas-chart__event--${kind}`} aria-hidden="true">
              <circle cx={drawing.x(point.date)} cy={drawing.y(point.value.highBps / 100)} r={3.4} className="atlas-chart__marker" />
              {point.value.kind === 'range' && point.value.highBps !== point.value.lowBps ? <circle cx={drawing.x(point.date)} cy={drawing.y(point.value.lowBps / 100)} r={3.1} className="atlas-chart__marker atlas-chart__marker--secondary" /> : null}
            </g>;
          })}
        </> : <>
          <line x1={drawing.margin.left} x2={width - drawing.margin.right} y1={drawing.zeroY} y2={drawing.zeroY} className="atlas-chart__zero" />
          {drawing.points.map(point => {
            const kind = actionForChange(point);
            const value = point.changeBps || 0;
            return <g key={point.id || point.recordDate} className={`atlas-chart__event atlas-chart__event--${kind}`} aria-hidden="true">
              {kind === 'framework' ? <path d={d3.symbol().type(d3.symbolDiamond).size(42)()} transform={`translate(${drawing.x(point.date)},${drawing.zeroY})`} className="atlas-chart__framework-mark" /> : <><line x1={drawing.x(point.date)} x2={drawing.x(point.date)} y1={drawing.zeroY} y2={drawing.y(value)} className="atlas-chart__move-stem" /><circle cx={drawing.x(point.date)} cy={drawing.y(value)} r={3.4} className="atlas-chart__marker" /></>}
            </g>;
          })}
        </>}
        {hover !== null && drawing.points[hover] ? <line x1={drawing.x(drawing.points[hover].date)} x2={drawing.x(drawing.points[hover].date)} y1={drawing.margin.top} y2={drawing.height - drawing.margin.bottom} className="atlas-chart__crosshair" /> : null}
        <rect x={drawing.margin.left} y={drawing.margin.top} width={width - drawing.margin.left - drawing.margin.right} height={drawing.height - drawing.margin.top - drawing.margin.bottom} fill="transparent" aria-hidden="true" onPointerMove={event => { const box = event.currentTarget.ownerSVGElement.getBoundingClientRect(); const pointerDate = drawing.x.invert(event.clientX - box.left); const index = d3.bisector(point => point.date).center(drawing.points, pointerDate); setHover(index); }} onPointerLeave={() => setHover(null)} />
      </svg> : null}
      <p className="atlas-chart__caption">{view === 'timeline' ? hasRanges ? 'The shaded band marks the published interval only. Lower and upper bounds remain separate; no midpoint is calculated. Dates are preserved as published; records not shown are not interpreted as unchanged policy.' : 'Point values are shown as published. Dates are preserved as published; records not shown are not interpreted as unchanged policy.' : 'Bars show numeric published changes. Framework transitions remain separate because they are not comparable as one basis-point move.'}</p>
      {view === 'changes' && records.length === 0 ? <p className="m-0 py-8 text-center text-sm text-muted-foreground" role="status">No numeric published changes match the current range and action filter.</p> : null}
    </div>
  );
}
