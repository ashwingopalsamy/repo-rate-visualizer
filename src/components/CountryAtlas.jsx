import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import ThemeToggle from './ThemeToggle.jsx';
import { indiaCountrySnapshot, loadCountryManifest, loadCountrySnapshot } from '../data/countrySnapshot.js';
import './atlas.css';

const US_PATH = '/country/us';
const dateLabel = value => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const percent = bps => (bps / 100).toFixed(2);
const valueLabel = value => value.kind === 'range'
  ? `${percent(value.lowBps)}–${percent(value.highBps)}%`
  : `${percent(value.lowBps)}%`;
const evidenceLabel = type => type === 'rate_observation' ? 'Rate observation' : type === 'policy_decision' ? 'Verified decision' : 'Published target change';

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
          <a href={US_PATH} aria-current={active === 'us' ? 'page' : undefined}>United States</a>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}

export function CountryIdentity({ country = 'IN' }) {
  return (
    <nav className="country-identity" aria-label="Country selection">
      <div className="country-identity__text"><a href="/countries">Policy Rate Atlas</a><span aria-hidden="true">/</span><strong>{country === 'IN' ? 'India' : 'United States'}</strong></div>
      <label className="country-identity__select">Country
        <select value={country} onChange={event => { window.location.href = event.target.value === 'IN' ? '/' : US_PATH; }}>
          <option value="IN">India · RBI repo rate</option>
          <option value="US">United States · Fed funds target</option>
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
  return (
    <div className="chartbook-app atlas-shell">
      <AtlasHeader active="index" />
      <main className="atlas-wrap atlas-main">
        <div className="atlas-eyebrow">COUNTRY INDEX <span>·</span> MONETARY POLICY REFERENCE</div>
        <h1 className="atlas-title">Policy rates, in their own terms.</h1>
        <p className="atlas-deck">A source-led history of central-bank policy instruments. Each country keeps its own rate definition, evidence coverage, and policy framework.</p>
        <div className="atlas-index-note"><span className="atlas-index-note__rule" />Two countries available · Three in the research queue</div>
        {error ? <p role="alert" className="atlas-error">{error}</p> : null}
        <section className="atlas-index" aria-label="Country coverage">
          <div className="atlas-index__head"><span>COUNTRY / BANK</span><span>POLICY INSTRUMENT</span><span>COVERAGE</span><span>STATUS</span></div>
          {(manifest?.countries || [
            { code: 'IN', name: 'India', status: 'available', path: '/', instrument: 'Policy repo rate', coverageFrom: india.coverage.from, coverageThrough: india.coverage.through },
          ]).map((entry, index) => (
            <div className="atlas-index__row" key={entry.code}>
              <div className="atlas-index__name"><span className="atlas-index__ordinal">{String(index + 1).padStart(2, '0')}</span><div>{entry.status === 'available' ? <a href={entry.path}>{entry.name} <span aria-hidden="true">↗</span></a> : <strong>{entry.name}</strong>}<small>{entry.code === 'IN' ? 'Reserve Bank of India' : entry.code === 'US' ? 'Federal Reserve' : entry.code === 'GB' ? 'Bank of England' : entry.code === 'JP' ? 'Bank of Japan' : 'Central Bank of the Republic of China (Taiwan)'}</small></div></div>
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

export function RangeChart({ records, title = 'Federal funds target' }) {
  const container = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!container.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const drawing = useMemo(() => {
    if (!width || !records.length) return null;
    const height = width < 550 ? 285 : 350;
    const margin = { top: 22, right: width < 550 ? 18 : 34, bottom: 37, left: width < 550 ? 39 : 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const points = records.map(record => ({ ...record, date: new Date(`${record.recordDate}T00:00:00Z`) }));
    const x = d3.scaleUtc().domain(d3.extent(points, point => point.date)).range([margin.left, margin.left + innerW]);
    const y = d3.scaleLinear().domain([0, d3.max(points, point => point.value.highBps) / 100 + 0.5]).nice().range([margin.top + innerH, margin.top]);
    const high = d3.line().curve(d3.curveStepAfter).x(point => x(point.date)).y(point => y(point.value.highBps / 100))(points);
    const low = d3.line().curve(d3.curveStepAfter).x(point => x(point.date)).y(point => y(point.value.lowBps / 100))(points);
    const band = d3.area().curve(d3.curveStepAfter).x(point => x(point.date)).y0(point => y(point.value.lowBps / 100)).y1(point => y(point.value.highBps / 100))(points);
    return { height, margin, x, y, points, high, low, band, ticks: y.ticks(5), years: x.ticks(width < 550 ? 4 : 7) };
  }, [width, records]);
  const selected = hover === null ? records.at(-1) : records[hover];
  return (
    <div className="atlas-chart" ref={container}>
      <div className="atlas-chart__heading"><div><span className="atlas-kicker">TARGET HISTORY</span><h2>{title}</h2></div><div className="atlas-chart__readout" aria-live="polite"><span>{selected && dateLabel(selected.recordDate)}</span><strong>{selected && valueLabel(selected.value)}</strong></div></div>
      <div className="atlas-chart__legend"><span><i className="atlas-chart__line" /> Upper bound</span><span><i className="atlas-chart__line atlas-chart__line--low" /> Lower bound</span><span>Step begins at published change date</span></div>
      {drawing ? <svg className="atlas-chart__svg" width={width} height={drawing.height} viewBox={`0 0 ${width} ${drawing.height}`} role="img" tabIndex={0} aria-label="Federal funds target rate and range from 2000 to the latest published change. Upper and lower bounds are shown separately. Use left and right arrow keys to inspect dated changes." onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); setHover(current => event.key === 'Home' ? 0 : event.key === 'End' ? records.length - 1 : Math.max(0, Math.min(records.length - 1, (current ?? records.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1)))); }} onBlur={() => setHover(null)}>
        {drawing.ticks.map(tick => <g key={tick}><line x1={drawing.margin.left} x2={width - drawing.margin.right} y1={drawing.y(tick)} y2={drawing.y(tick)} className="atlas-chart__grid" /><text x={drawing.margin.left - 9} y={drawing.y(tick) + 4} textAnchor="end" className="atlas-chart__axis">{tick}%</text></g>)}
        {drawing.years.map(year => <text key={year.toISOString()} x={drawing.x(year)} y={drawing.height - 9} textAnchor="middle" className="atlas-chart__axis">{year.getUTCFullYear()}</text>)}
        <path d={drawing.band} className="atlas-chart__band" />
        <path d={drawing.high} className="atlas-chart__upper" />
        <path d={drawing.low} className="atlas-chart__lower" />
        {hover !== null ? <line x1={drawing.x(drawing.points[hover].date)} x2={drawing.x(drawing.points[hover].date)} y1={drawing.margin.top} y2={drawing.height - drawing.margin.bottom} className="atlas-chart__crosshair" /> : null}
        <rect x={drawing.margin.left} y={drawing.margin.top} width={width - drawing.margin.left - drawing.margin.right} height={drawing.height - drawing.margin.top - drawing.margin.bottom} fill="transparent" onPointerMove={event => { const box = event.currentTarget.getBoundingClientRect(); const pointerDate = drawing.x.invert(event.clientX - box.left + drawing.margin.left); const index = Math.max(0, Math.min(records.length - 1, d3.bisector(point => point.date).right(drawing.points, pointerDate) - 1)); setHover(index); }} onPointerLeave={() => setHover(null)} />
      </svg> : null}
      <p className="atlas-chart__caption">The shaded interval appears only when the Fed publishes a range. No midpoint is calculated. Published changes omit unchanged FOMC meetings.</p>
    </div>
  );
}

function downloadCsv(snapshot) {
  const header = 'country,central_bank,instrument,record_date,decision_date,effective_date,record_type,value_kind,lower_bps,upper_bps,change_bps,source_urls';
  const byId = new Map(snapshot.sources.map(source => [source.id, source]));
  const rows = snapshot.records.map(record => [snapshot.country, snapshot.centralBank, snapshot.instrument, record.recordDate, record.decisionDate || '', record.effectiveDate || '', record.recordType, record.value.kind, record.value.lowBps, record.value.highBps, record.changeBps ?? '', record.sourceIds.map(id => byId.get(id)?.url || '').join(' | ')].map(value => `"${String(value).replaceAll('"', '""')}"`).join(','));
  const url = URL.createObjectURL(new Blob([[header, ...rows].join('\n') + '\n'], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `policy-rate-${snapshot.country.toLowerCase()}-${snapshot.coverage.through}.csv`; link.click(); URL.revokeObjectURL(url);
}

export function UnitedStatesPage() {
  const { manifest, error: manifestError } = useCountryManifest();
  const [state, setState] = useState({ snapshot: null, error: '' });
  const [year, setYear] = useState('all');
  useEffect(() => {
    const entry = manifest?.countries.find(country => country.code === 'US');
    if (!entry) return undefined;
    let live = true;
    loadCountrySnapshot(entry).then(snapshot => { if (live) setState({ snapshot, error: '' }); })
      .catch(error => { if (live) setState({ snapshot: null, error: error.message }); });
    return () => { live = false; };
  }, [manifest]);
  const snapshot = state.snapshot;
  const latest = snapshot?.records.at(-1);
  const sourceById = new Map(snapshot?.sources.map(source => [source.id, source]) || []);
  const years = [...new Set(snapshot?.records.map(record => record.recordDate.slice(0, 4)) || [])].reverse();
  const visible = snapshot?.records.filter(record => year === 'all' || record.recordDate.startsWith(year)).reverse() || [];
  return (
    <div className="chartbook-app atlas-shell">
      <AtlasHeader active="us" />
      <main className="atlas-wrap atlas-main">
        <CountryIdentity country="US" />
        <div className="atlas-country-heading"><div><span className="atlas-eyebrow">UNITED STATES <span>·</span> FEDERAL RESERVE</span><h1 className="atlas-title">The federal funds target.</h1><p className="atlas-deck">A dated history of published target changes, retaining the Fed’s single target before December 2008 and its lower and upper bounds afterward.</p></div><span className="atlas-country-code">US / FED</span></div>
        {manifestError || state.error ? <p role="alert" className="atlas-error">{manifestError || state.error}</p> : null}
        {!snapshot ? <p className="atlas-loading">Loading verified country release…</p> : <>
          <section className="atlas-hero" aria-label="Latest published target">
            <div className="atlas-hero__primary"><span className="atlas-kicker">LATEST PUBLISHED TARGET <span>·</span> {dateLabel(latest.recordDate)}</span><div className="atlas-hero__value">{latest.value.kind === 'range' ? <><span>{percent(latest.value.lowBps)}<small>LOWER</small></span><b aria-hidden="true">–</b><span>{percent(latest.value.highBps)}<small>UPPER</small></span><em>%</em></> : <>{percent(latest.value.lowBps)}<em>%</em></>}</div><p>Federal funds target {latest.value.kind} · {latest.changeBps === null ? 'Change not comparable across framework' : `${latest.changeBps > 0 ? '+' : ''}${latest.changeBps} bps at this published change`}</p></div>
            <div className="atlas-hero__meta"><div><span>INSTRUMENT</span><strong>{snapshot.instrument}</strong></div><div><span>RECORD TYPE</span><strong>{evidenceLabel(latest.recordType)}</strong></div><div><span>PRIMARY SOURCE</span><a href={sourceById.get(latest.sourceIds[0])?.url} target="_blank" rel="noopener noreferrer">Federal Reserve change table ↗</a></div></div>
          </section>
          <div className="atlas-facts"><div><span>COVERAGE</span><strong>{dateLabel(snapshot.coverage.from)} – {dateLabel(snapshot.coverage.through)}</strong></div><div><span>PUBLISHED CHANGES</span><strong>{snapshot.records.length}</strong></div><div><span>RELEASE RETRIEVED</span><strong>{dateLabel(snapshot.retrievedAt.slice(0, 10))}</strong></div></div>
          <RangeChart records={snapshot.records} />
          <section className="atlas-records" aria-labelledby="atlas-records-title"><div className="atlas-section-heading"><div><span className="atlas-kicker">SOURCE LEDGER</span><h2 id="atlas-records-title">Published changes</h2><p>The Federal Reserve change tables supply these rows. A row does not stand for every FOMC meeting or an inferred hold.</p></div><div className="atlas-records__controls"><label>Year <select value={year} onChange={event => setYear(event.target.value)}><option value="all">All years</option>{years.map(item => <option key={item}>{item}</option>)}</select></label><button type="button" onClick={() => downloadCsv(snapshot)}>Download CSV ↓</button></div></div>
            <div className="atlas-records__table-wrap"><table className="atlas-records__table"><thead><tr><th>TABLE DATE</th><th>TARGET</th><th>CHANGE</th><th>TYPE</th><th>SOURCE</th></tr></thead><tbody>{visible.map(record => <tr key={record.id}><td>{dateLabel(record.recordDate)}</td><td className="atlas-records__value">{valueLabel(record.value)}</td><td className={record.changeBps > 0 ? 'atlas-hike' : record.changeBps < 0 ? 'atlas-cut' : ''}>{record.changeBps === null ? 'Framework change' : `${record.changeBps > 0 ? '+' : ''}${record.changeBps} bps`}</td><td>{evidenceLabel(record.recordType)}</td><td><a href={sourceById.get(record.sourceIds[0])?.url} target="_blank" rel="noopener noreferrer">Fed table ↗</a></td></tr>)}</tbody></table></div>
          </section>
          <section className="atlas-method atlas-method--country"><h2>Reading this series</h2><p>The Fed table dates are recorded as published, while decision dates and effective dates remain unknown in this snapshot. The December 2008 shift from a point target to a range is shown as a framework change. No midpoint, unchanged meeting, or continuous policy stance is inferred.</p><p>Primary sources: <a href={snapshot.sources[0].url}>current change table</a>, <a href={snapshot.sources[1].url}>historical archive</a>, and <a href={snapshot.sources[2].url}>FOMC statement archive</a>. The statements are a cross-check reference; this release does not claim meeting-by-meeting reconciliation.</p><p>Immutable release <code>{manifest.countries.find(country => country.code === 'US').releaseId}</code></p></section>
        </>}
      </main>
    </div>
  );
}
