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

const actionForChange = record => record.changeBps === undefined ? 'illustrative' : record.changeBps === null ? 'framework' : record.changeBps > 0 ? 'hike' : record.changeBps < 0 ? 'cut' : 'unchanged';

function formatRange(value) {
  if (!value) return '—';
  return value.kind === 'range'
    ? `${percent(value.lowBps)}–${percent(value.highBps)}%`
    : `${percent(value.lowBps)}%`;
}

function formatBasisPoints(value) {
  if (value === null) return 'Framework change';
  if (value === undefined) return 'Change not shown';
  return `${value > 0 ? '+' : ''}${value} bps`;
}

function changeLabel(record) {
  return record.changeBps === null ? 'Framework change' : record.changeBps === undefined ? 'Illustrative value' : 'Published target change';
}

export function RangeChart({ records, title = 'Federal funds target', view = 'timeline', showBand = true }) {
  const container = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);
  useEffect(() => setHover(null), [records, view]);
  const hasChangeMetadata = records.some(record => record.changeBps !== undefined);
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
      <div className="atlas-chart__heading"><div><span className="atlas-kicker">{view === 'changes' ? 'PUBLISHED MOVES' : 'TARGET HISTORY'}</span><h2>{view === 'changes' ? 'Rate changes' : title}</h2></div><div className="atlas-chart__readout" aria-live="polite" aria-atomic="true"><span>{selected && dateLabel(selected.recordDate)}</span><strong className={selected ? `atlas-${actionForChange(selected)}` : ''}>{selected && (view === 'changes' ? formatBasisPoints(selected.changeBps) : valueLabel(selected.value))}</strong><small>{selected && changeLabel(selected)}</small>{view === 'changes' && selected ? <small>Target {valueLabel(selected.value)}</small> : null}</div></div>
      <div className="atlas-chart__legend" aria-label="Chart legend">
        {view === 'timeline' ? <><span><i className="atlas-chart__line atlas-chart__line--high" /> Upper bound</span><span><i className="atlas-chart__line atlas-chart__line--low" /> Lower bound</span>{showBand ? <span><i className="atlas-chart__swatch" /> Published range</span> : null}</> : null}
        {hasChangeMetadata ? <><span><i className="atlas-chart__dot atlas-chart__dot--cut" /> Cuts</span><span><i className="atlas-chart__dot atlas-chart__dot--hike" /> Hikes</span><span><i className="atlas-chart__dot atlas-chart__dot--framework" /> Framework</span></> : null}
        {view === 'timeline' ? <span>Steps begin on published date</span> : <span>Moves in basis points</span>}
      </div>
      {drawing ? <svg className="atlas-chart__svg" width={width} height={drawing.height} viewBox={`0 0 ${width} ${drawing.height}`} role="img" tabIndex={0} aria-label={`${view === 'changes' ? 'Published rate changes in basis points' : 'Federal funds target history with separately shown upper and lower bounds'} from ${dateLabel(records[0].recordDate)} through ${dateLabel(records.at(-1).recordDate)}. Use left and right arrow keys to inspect published dates.`} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); setHover(current => event.key === 'Home' ? 0 : event.key === 'End' ? records.length - 1 : Math.max(0, Math.min(records.length - 1, (current ?? records.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1)))); }} onBlur={() => setHover(null)}>
        {drawing.ticks.map(tick => <g key={tick}><line x1={drawing.margin.left} x2={width - drawing.margin.right} y1={drawing.y(tick)} y2={drawing.y(tick)} className="atlas-chart__grid" /><text x={drawing.margin.left - 9} y={drawing.y(tick) + 4} textAnchor="end" className="atlas-chart__axis">{view === 'changes' ? `${tick > 0 ? '+' : ''}${tick}` : `${tick}%`}</text></g>)}
        {drawing.years.map(year => <text key={year.toISOString()} x={drawing.x(year)} y={drawing.height - 9} textAnchor="middle" className="atlas-chart__axis">{year.getUTCFullYear()}</text>)}
        {view === 'timeline' ? <>
          {showBand ? <path d={drawing.band} className="atlas-chart__band" /> : null}
          <path d={drawing.high} className="atlas-chart__upper" />
          <path d={drawing.low} className="atlas-chart__lower" />
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
      <p className="atlas-chart__caption">{view === 'timeline' ? 'The shaded band marks the published interval only. Lower and upper bounds remain separate; no midpoint is calculated. Dates are the Federal Reserve table dates, and unchanged FOMC meetings are not represented.' : 'Bars show each published change. The December 2008 point-to-range transition is marked separately because its change is not comparable as a single number.'}</p>
    </div>
  );
}

function downloadCsv(snapshot, records = snapshot.records) {
  const header = 'country,central_bank,instrument,record_date,decision_date,effective_date,record_type,value_kind,lower_bps,upper_bps,change_bps,source_urls';
  const byId = new Map(snapshot.sources.map(source => [source.id, source]));
  const rows = records.map(record => [snapshot.country, snapshot.centralBank, snapshot.instrument, record.recordDate, record.decisionDate || '', record.effectiveDate || '', record.changeBps === null ? 'framework_change' : record.recordType === 'policy_change' ? 'published_target_change' : record.recordType, record.value.kind, record.value.lowBps, record.value.highBps, record.changeBps ?? '', record.sourceIds.map(id => byId.get(id)?.url || '').join(' | ')].map(value => `"${String(value).replaceAll('"', '""')}"`).join(','));
  const url = URL.createObjectURL(new Blob([[header, ...rows].join('\n') + '\n'], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `policy-rate-${snapshot.country.toLowerCase()}-${snapshot.coverage.through}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function CopyValue({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return <button type="button" className="atlas-copy" onClick={() => void copy()} aria-label={copied ? `${label} copied` : `Copy ${label}`}>{copied ? 'Copied' : `Copy ${label}`}</button>;
}

function EvidenceCard({ snapshot, manifest }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const releaseId = manifest?.countries.find(country => country.code === 'US')?.releaseId || snapshot.releaseId || '';
  const linksBySource = new Map(snapshot.sources.map(source => [source.id, snapshot.records.filter(record => record.sourceIds.includes(source.id)).length]));
  const timestamp = value => value ? new Date(value).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' }) : 'Not reported';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1600);
    } catch {
      setCopiedLink(false);
    }
  };
  return <section className="atlas-evidence" aria-labelledby="atlas-evidence-title">
    <div className="atlas-evidence__head">
      <div><h2 id="atlas-evidence-title">Historical federal funds target evidence</h2><p>Published Federal Reserve target changes and source references used to build this series.</p><div className="atlas-evidence__summary"><span>{snapshot.records.length} published changes</span><span aria-hidden="true">·</span><span>{snapshot.sources.length} sources</span><span aria-hidden="true">·</span><span>Coverage {dateLabel(snapshot.coverage.from)} to {dateLabel(snapshot.coverage.through)}</span></div></div>
      <div className="atlas-evidence__actions"><button type="button" onClick={() => setSourcesOpen(value => !value)} aria-expanded={sourcesOpen}>{sourcesOpen ? 'Hide sources' : 'View all sources'} <span aria-hidden="true">{sourcesOpen ? '⌃' : '⌄'}</span></button><button type="button" onClick={() => downloadCsv(snapshot)}>Download CSV <span aria-hidden="true">↓</span></button></div>
    </div>
    <div className="atlas-evidence__metadata">
      <div><span>Release</span><strong>{releaseId ? `${releaseId.slice(0, 15)}…` : 'Not reported'}</strong><CopyValue label="release ID" value={releaseId} /></div>
      <div><span>Snapshot retrieved</span><strong>{timestamp(snapshot.retrievedAt)}</strong></div>
      <div><span>Latest published change</span><strong>{dateLabel(snapshot.coverage.through)}</strong></div>
      <div><span>Artifact SHA-256</span><strong className="atlas-evidence__hash">{manifest?.countries.find(country => country.code === 'US')?.sha256 || 'Not reported'}</strong><CopyValue label="SHA-256" value={manifest?.countries.find(country => country.code === 'US')?.sha256 || ''} /></div>
    </div>
    {sourcesOpen ? <div className="atlas-evidence__sources-wrap">
      <table className="atlas-evidence__table"><thead><tr><th>Category</th><th>Source</th><th>Retrieved</th><th>Linked</th><th>Integrity</th></tr></thead><tbody>
        {snapshot.sources.map((source, index) => <tr key={source.id}>
          <td><span className="atlas-source-category">{index === 0 ? 'Current change table' : index === 1 ? 'Historical archive' : 'Cross-check reference'}</span></td>
          <td><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></td>
          <td>{timestamp(source.retrievedAt)}</td><td>{linksBySource.get(source.id) || 0}</td>
          <td><details><summary>Integrity</summary><span>{source.sha256 ? `SHA-256 ${source.sha256}` : 'Checksum and retrieval date not reported.'}</span></details></td>
        </tr>)}
      </tbody></table>
    </div> : null}
    <div className="atlas-evidence__note"><h3>Reading this series</h3><p>The Federal Reserve table dates are preserved as published. This release contains {snapshot.records.length} published target changes; decision dates and effective dates are not reported, and a row does not stand for every FOMC meeting. The December 2008 shift from a point target to a range is marked as a framework change. No midpoint or unchanged meeting is inferred.</p><p>Primary sources: {snapshot.sources.map((source, index) => <span key={source.id}>{index > 0 ? ', ' : ''}<a href={source.url} target="_blank" rel="noopener noreferrer">{index === 0 ? 'current change table' : index === 1 ? 'historical archive' : 'FOMC statement archive'}</a></span>)}. The FOMC statements are a cross-check reference; this release does not claim meeting-by-meeting reconciliation.</p><button type="button" onClick={() => void copyLink()}>{copiedLink ? 'Page link copied' : 'Copy page link'}</button></div>
  </section>;
}

export function UnitedStatesPage() {
  const { manifest, error: manifestError } = useCountryManifest();
  const [state, setState] = useState({ snapshot: null, error: '' });
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('view') === 'changes' ? 'changes' : 'timeline');
  const [dateRange, setDateRange] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    const start = query.get('from');
    const end = query.get('to');
    return start && end && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end ? { start, end } : { start: null, end: null };
  });
  const [preset, setPreset] = useState(() => new URLSearchParams(window.location.search).has('from') ? 'CUSTOM' : 'MAX');
  const [recordFilter, setRecordFilter] = useState(() => ['all', 'cut', 'hike', 'framework'].includes(new URLSearchParams(window.location.search).get('filter')) ? new URLSearchParams(window.location.search).get('filter') : 'all');
  const [showBand, setShowBand] = useState(() => new URLSearchParams(window.location.search).get('band') !== '0');
  const [customOpen, setCustomOpen] = useState(false);
  const [draftRange, setDraftRange] = useState({ start: '', end: '' });
  const [expanded, setExpanded] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
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
  const sourceById = useMemo(() => new Map(snapshot?.sources.map(source => [source.id, source]) || []), [snapshot]);
  const dateRecords = useMemo(() => snapshot?.records.filter(record => (!dateRange.start || record.recordDate >= dateRange.start) && (!dateRange.end || record.recordDate <= dateRange.end)) || [], [dateRange, snapshot]);
  const chartRecords = useMemo(() => {
    if (!snapshot || !dateRange.start || !dateRecords.length) return dateRecords;
    const prior = snapshot.records.filter(record => record.recordDate < dateRange.start).at(-1);
    return prior ? [prior, ...dateRecords] : dateRecords;
  }, [dateRange.start, dateRecords, snapshot]);
  const counts = useMemo(() => ({
    all: dateRecords.length,
    cut: dateRecords.filter(record => record.changeBps < 0).length,
    hike: dateRecords.filter(record => record.changeBps > 0).length,
    framework: dateRecords.filter(record => record.changeBps === null).length,
  }), [dateRecords]);
  const visibleRecords = useMemo(() => dateRecords.filter(record => recordFilter === 'all' ||
    (recordFilter === 'framework' ? record.changeBps === null : recordFilter === 'cut' ? record.changeBps < 0 : record.changeBps > 0)).reverse(), [dateRecords, recordFilter]);
  const activeChartRecords = view === 'changes' ? dateRecords : chartRecords;
  const initialRecord = dateRecords[0];
  const peakRecord = dateRecords.reduce((best, record) => !best || record.value.highBps > best.value.highBps ? record : best, null);
  const lowRecord = dateRecords.reduce((best, record) => !best || record.value.lowBps < best.value.lowBps ? record : best, null);

  const applyPreset = id => {
    if (!snapshot) return;
    setPreset(id);
    if (id === 'MAX') {
      setDateRange({ start: null, end: null });
      setCustomOpen(false);
      return;
    }
    const years = Number(id.slice(0, -1));
    const end = new Date(`${snapshot.coverage.through}T00:00:00Z`);
    const start = new Date(end);
    start.setUTCFullYear(start.getUTCFullYear() - years);
    const startDate = start.toISOString().slice(0, 10);
    setDateRange({ start: startDate < snapshot.coverage.from ? snapshot.coverage.from : startDate, end: snapshot.coverage.through });
    setCustomOpen(false);
  };
  const openCustom = () => {
    if (!snapshot) return;
    setDraftRange({ start: dateRange.start || snapshot.coverage.from, end: dateRange.end || snapshot.coverage.through });
    setCustomOpen(value => !value);
  };
  const applyCustom = () => {
    if (!snapshot || !draftRange.start || !draftRange.end || draftRange.start > draftRange.end || draftRange.start < snapshot.coverage.from || draftRange.end > snapshot.coverage.through) return;
    setDateRange({ start: draftRange.start, end: draftRange.end });
    setPreset('CUSTOM');
    setCustomOpen(false);
  };
  const shareView = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    url.searchParams.set('filter', recordFilter);
    url.searchParams.set('band', showBand ? '1' : '0');
    if (dateRange.start && dateRange.end) {
      url.searchParams.set('from', dateRange.start);
      url.searchParams.set('to', dateRange.end);
    } else {
      url.searchParams.delete('from');
      url.searchParams.delete('to');
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1600);
    } catch {
      setLinkCopied(false);
    }
  };

  return (
    <div className="chartbook-app atlas-shell">
      <AtlasHeader active="us" />
      <main className="atlas-wrap atlas-main">
        <CountryIdentity country="US" />
        {manifestError || state.error ? <p role="alert" className="atlas-error">{manifestError || state.error}</p> : null}
        {!snapshot && !manifestError && !state.error ? <p className="atlas-loading">Loading verified country release…</p> : null}
        {snapshot ? <>
          <section className="atlas-us-overview" aria-labelledby="atlas-overview-title">
            <div className="atlas-us-overview__header"><h1 id="atlas-overview-title">Overview</h1><p>The latest published Federal Reserve target and its documented change. The point target before December 2008 and target range afterward are shown in their published form.</p></div>
            <div className="atlas-us-overview__grid">
              <div className="atlas-us-overview__cell"><span className="atlas-us-overview__label">Latest published change</span><strong className={`atlas-us-overview__action atlas-${actionForChange(latest)}`}>{formatBasisPoints(latest.changeBps)}</strong><span className={`atlas-change-pill atlas-change-pill--${actionForChange(latest)}`}>{latest.changeBps === null ? 'Framework' : latest.changeBps > 0 ? 'Tightening' : 'Easing'}</span></div>
              <div className="atlas-us-overview__cell atlas-us-overview__cell--rate"><span className="atlas-us-overview__label">Current federal funds target</span><strong className="atlas-us-overview__rate">{formatRange(latest.value)}</strong><div className="atlas-us-overview__bounds"><span><small>{latest.value.kind === 'range' ? 'LOWER' : 'TARGET'}</small>{percent(latest.value.lowBps)}%</span>{latest.value.kind === 'range' ? <span><small>UPPER</small>{percent(latest.value.highBps)}%</span> : null}</div><span className="atlas-us-overview__sub">Published {dateLabel(latest.recordDate)}</span></div>
              <div className="atlas-us-overview__cell"><span className="atlas-us-overview__label">Latest published date</span><strong className="atlas-us-overview__date">{new Date(`${latest.recordDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })} ’{latest.recordDate.slice(2, 4)}</strong><a className="atlas-us-overview__source" href={sourceById.get(latest.sourceIds[0])?.url} target="_blank" rel="noopener noreferrer">Open Federal Reserve source ↗</a><span className="atlas-us-overview__sub">Published target change</span></div>
            </div>
          </section>

          <section className="atlas-us-workspace" aria-labelledby="atlas-workspace-title">
            <header className="atlas-us-workspace__header"><h2 id="atlas-workspace-title">Timeline</h2><p>Published Federal Reserve target changes, with point and range values preserved across framework dates.</p></header>
            <div className="atlas-us-rail" role="toolbar" aria-label="Federal funds target chart controls">
              <div className="atlas-us-rail__group atlas-us-rail__views" role="group" aria-label="Chart view">
                <span className="atlas-us-rail__label">View</span>
                <div className="atlas-segmented">{[['timeline', 'Timeline'], ['changes', 'Rate changes']].map(([id, label]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div>
              </div>
              <span className="atlas-us-rail__divider" aria-hidden="true" />
              <div className="atlas-us-rail__group atlas-us-rail__range" role="group" aria-label="Date range">
                <span className="atlas-us-rail__label">Range</span>
                <div className="atlas-segmented">{[['1Y', '1Y'], ['5Y', '5Y'], ['10Y', '10Y'], ['MAX', 'Max']].map(([id, label]) => <button type="button" key={id} aria-pressed={preset === id} onClick={() => applyPreset(id)}>{label}</button>)}</div>
                <button type="button" className="atlas-rail-button" aria-expanded={customOpen} aria-pressed={preset === 'CUSTOM'} onClick={openCustom}>Custom</button>
              </div>
              <span className="atlas-us-rail__divider" aria-hidden="true" />
              <details className="atlas-layers"><summary className="atlas-rail-button" aria-label={`Chart layers, ${showBand ? 1 : 0} active`}>Layers <span aria-hidden="true">{showBand ? '1' : '0'}</span></summary><label><input type="checkbox" checked={showBand} disabled={view !== 'timeline'} onChange={event => setShowBand(event.target.checked)} /> Published range band</label><small>Upper and lower bounds remain visible.</small></details>
              <div className="atlas-us-rail__actions"><button type="button" className="atlas-rail-button" onClick={() => downloadCsv(snapshot, dateRecords)} aria-label="Download CSV for selected date range">Download CSV ↓</button><button type="button" className="atlas-icon-button" onClick={() => void shareView()} aria-label={linkCopied ? 'View link copied' : 'Share current view'}>{linkCopied ? '✓' : '↗'}</button></div>
            </div>
            {customOpen ? <div className="atlas-custom-range"><label>Start date<input type="date" min={snapshot.coverage.from} max={snapshot.coverage.through} value={draftRange.start} onChange={event => setDraftRange(current => ({ ...current, start: event.target.value }))} /></label><label>End date<input type="date" min={snapshot.coverage.from} max={snapshot.coverage.through} value={draftRange.end} onChange={event => setDraftRange(current => ({ ...current, end: event.target.value }))} /></label><button type="button" onClick={applyCustom} disabled={!draftRange.start || !draftRange.end || draftRange.start > draftRange.end || draftRange.start < snapshot.coverage.from || draftRange.end > snapshot.coverage.through}>Apply range</button></div> : null}
            <div className="atlas-period-summary" aria-label="Summary for selected date range">
              <div><span>FIRST PUBLISHED TARGET</span><strong>{formatRange(initialRecord?.value)}</strong><small>{initialRecord ? dateLabel(initialRecord.recordDate) : 'No published record'}</small></div>
              <div><span>HIGHEST UPPER BOUND</span><strong className="atlas-hike">{peakRecord ? `${percent(peakRecord.value.highBps)}%` : '—'}</strong><small>{peakRecord ? dateLabel(peakRecord.recordDate) : 'No published record'}</small></div>
              <div><span>LOWEST LOWER BOUND</span><strong className="atlas-cut">{lowRecord ? `${percent(lowRecord.value.lowBps)}%` : '—'}</strong><small>{lowRecord ? dateLabel(lowRecord.recordDate) : 'No published record'}</small></div>
              <div><span>PUBLISHED CHANGES</span><strong>{dateRecords.length}</strong><small>{counts.cut} cuts · {counts.hike} hikes · {counts.framework} framework</small></div>
            </div>
            {dateRecords.length ? <RangeChart records={activeChartRecords} view={view} showBand={showBand} /> : <p className="atlas-empty">No published target changes fall in this date range.</p>}
            <section className="atlas-us-records" aria-labelledby="atlas-records-title">
              <div className="atlas-us-records__heading"><div><h3 id="atlas-records-title">Rate record</h3><p>Published Federal Reserve target changes and their table dates.</p></div><strong>{visibleRecords.length} records</strong></div>
              <div className="atlas-record-filters" role="group" aria-label="Filter rate record">
                {[["all", `All (${counts.all})`], ["cut", `Cuts (${counts.cut})`], ["hike", `Hikes (${counts.hike})`], ["framework", `Framework (${counts.framework})`]].map(([id, label]) => <button type="button" key={id} aria-pressed={recordFilter === id} className={`atlas-record-filter atlas-record-filter--${id}`} onClick={() => setRecordFilter(id)}>{label}</button>)}
              </div>
              <div className={`atlas-record-table-wrap${expanded ? ' atlas-record-table-wrap--expanded' : ''}`}><table className="atlas-record-table"><thead><tr><th>Published date</th><th>Record</th><th>Target</th><th>Change</th><th>Source</th></tr></thead><tbody>{visibleRecords.map(record => {
                const source = sourceById.get(record.sourceIds[0]);
                const action = actionForChange(record);
                return <tr key={record.id}><td>{dateLabel(record.recordDate)}</td><td><span className={`atlas-record-badge atlas-record-badge--${action}`}><i aria-hidden="true" />{changeLabel(record)}</span></td><td className="atlas-record-table__value">{formatRange(record.value)}</td><td className={`atlas-${action}`}>{formatBasisPoints(record.changeBps)}</td><td>{source ? <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${source.title}`}>{source.id === snapshot.sources[1]?.id ? 'Fed archive' : 'Fed table'} ↗</a> : 'Not reported'}</td></tr>;
              })}</tbody></table>{visibleRecords.length === 0 ? <p className="atlas-empty atlas-empty--table">No published changes match this filter.</p> : null}</div>
              {visibleRecords.length > 10 ? <button className="atlas-record-expand" type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Collapse rate record' : `Expand all ${visibleRecords.length} records`} <span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button> : null}
              <p className="atlas-record-note">The record filters apply to this table only. No unchanged FOMC meeting is represented as a hold.</p>
            </section>
          </section>

          <EvidenceCard snapshot={snapshot} manifest={manifest} />
          <footer className="atlas-us-footer"><p>Built by <a href="https://ashwingopalsamy.in" target="_blank" rel="noopener noreferrer">Ashwin Gopalsamy</a>. The source code is available on <a href="https://github.com/ashwingopalsamy/repo-rate-visualizer" target="_blank" rel="noopener noreferrer">GitHub</a>.</p><nav aria-label="Project links"><a href="/countries">Countries</a><a href="/design">Design system <small>/design</small></a><a href="/colophon">Colophon <small>/colophon</small></a></nav><small>Independent educational reference. Not affiliated with or endorsed by the Federal Reserve. Not financial advice.</small></footer>
        </> : null}
      </main>
    </div>
  );
}
