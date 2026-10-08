/**
 * The Hugging Face tables: one schema for every dataset, built from the same v3 releases the site renders. Each column
 * is declared once here (name, type, nullability, meaning); scripts/build-hf-datasets.py serialises the rows without
 * interpreting them. Cycles and the daily level come from the site's own model (src/lib/atlas.ts), so a figure in the
 * dataset is the figure on the site.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { CountryRelease, Decision } from '../../schema/release.ts';
import type { Level } from '../../schema/level.ts';
import type { Manifest } from '../../schema/files.ts';
import { buildAtlas } from '../build-atlas.ts';
import { DAY, MODEL, initAtlas, isoOf, tOf, valueAt } from '../../src/lib/atlas.ts';
import type { Code } from '../../src/lib/atlas.ts';

export type ColType = 'string' | 'int32' | 'float64' | 'bool' | 'date' | 'timestamp' | 'string_list';
export type Column = { name: string; type: ColType; nullable: boolean; description: string };
export type Row = Record<string, string | number | boolean | null | string[]>;
export type Table = { name: string; description: string; grain: string; columns: Column[]; rows: Row[] };
export type CountryInput = { cc: Code; release: CountryRelease; releaseFile: string; releaseSha256: string };

const ROOT = new URL('../../', import.meta.url);
const ORDER: Code[] = ['IN', 'US', 'EA', 'GB', 'CA', 'AU', 'BR'];

/** Reads every available country's current release, in the site's order. */
export function loadCountries(): CountryInput[] {
  const manifest = JSON.parse(readFileSync(new URL('data/manifest.json', ROOT), 'utf8')) as Manifest;
  return ORDER.flatMap(cc => {
    const e = manifest.countries[cc];
    if (!e || e.status !== 'available' || !e.path) return [];
    const bytes = readFileSync(new URL(`data/${e.path}`, ROOT));
    return [{ cc, release: JSON.parse(bytes.toString('utf8')) as CountryRelease, releaseFile: e.path, releaseSha256: createHash('sha256').update(bytes).digest('hex') }];
  });
}

/* ---------- columns ---------- */
const c = (name: string, type: ColType, nullable: boolean, description: string): Column => ({ name, type, nullable, description });
const COUNTRY = [
  c('country_code', 'string', false, 'ISO 3166-1 alpha-2 code of the jurisdiction (EA for the euro area).'),
  c('country', 'string', false, 'Jurisdiction name.'),
  c('central_bank', 'string', false, 'Central bank that sets the rate.'),
];
const LEVEL = [
  c('level_kind', 'string', false, '`point` for a single rate, `range` for a target range (the US since 16 Dec 2008).'),
  c('rate_pct', 'float64', false, 'The rate in percent: the point, or the upper bound of a range. Never a midpoint.'),
  c('rate_bps', 'int32', false, 'The same rate as an exact integer number of basis points.'),
  c('rate_low_pct', 'float64', false, 'Lower bound of a range in percent; equals `rate_pct` for a point rate.'),
  c('rate_high_pct', 'float64', false, 'Upper bound of a range in percent; equals `rate_pct`.'),
];
const ERA = [
  c('era_id', 'string', false, 'The period of one rate basis this row belongs to; joins to `eras`.'),
  c('era_basis', 'string', false, '`policy` for the policy rate itself, `observation` for an earlier proxy rate kept for history.'),
];

/* ---------- helpers ---------- */
const lohi = (l: Level): [number, number] => (l.kind === 'range' ? [l.lowBps, l.highBps] : l.kind === 'point' ? [l.bps, l.bps] : [Number.NaN, Number.NaN]);
const pct = (bps: number) => Math.round(bps) / 100;
const level = (l: Level) => { const [lo, hi] = lohi(l); return { level_kind: l.kind === 'range' ? 'range' : 'point', rate_pct: pct(hi), rate_bps: hi, rate_low_pct: pct(lo), rate_high_pct: pct(hi) }; };
const levelText = (l: Level) => { const [lo, hi] = lohi(l); return l.kind === 'range' ? `${(lo / 100).toFixed(2)} to ${(hi / 100).toFixed(2)}%` : `${(hi / 100).toFixed(2)}%`; };
const dateText = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const eraOf = (r: CountryRelease, date: string) => r.eras.find(e => e.from <= date && (e.to == null || date <= e.to)) ?? r.eras[0];
const countryCols = (r: CountryRelease) => ({ country_code: r.country.code, country: r.country.name, central_bank: r.authority.name });
const effectiveOf = (d: Decision) => d.effectiveDate ?? d.announcedAt.slice(0, 10);
const words = ['no', 'once', 'twice', 'three times', 'four times', 'five times', 'six times', 'seven times', 'eight times', 'nine times', 'ten times'];
const times = (n: number) => words[n] ?? `${n} times`;

/* ---------- rates: one row per change point ---------- */
export const RATES: Omit<Table, 'rows'> = {
  name: 'rates', grain: 'One row per change in the rate', description: 'Every change point of the policy rate, with the level before and after, its era and its source.',
  columns: [
    ...COUNTRY,
    c('instrument', 'string', false, 'The policy instrument in force on this date.'),
    c('effective_date', 'date', false, 'Date the new rate took effect (the bank’s local date).'),
    ...LEVEL,
    c('previous_rate_pct', 'float64', true, 'The rate in force before this change, in percent (upper bound for a range). Null for the first point.'),
    c('change_bps', 'int32', true, 'Signed change in basis points against the previous upper bound. Null for the first point and when the instrument or its basis changes (an era boundary), where the two rates are not comparable.'),
    c('direction', 'string', false, '`hike`, `cut`, `initial` (first point) or `era_change` (a new instrument or basis).'),
    ...ERA,
    c('evidence', 'string', false, '`official` when the point comes from the central bank’s own series or statement, `secondary` when from a cited secondary source.'),
    c('source_id', 'string', false, 'The source of this point; joins to `sources`.'),
    c('source_url', 'string', false, 'URL of that source.'),
    c('decision_id', 'string', true, 'The announced decision that set this rate, when the decision ledger has it; joins to `decisions`.'),
    c('release_hash', 'string', false, 'SHA-256 content hash of the release this row was built from.'),
    c('record_text', 'string', false, 'One deterministic sentence describing the row, for search and retrieval. Generated from the fields, not written by a model.'),
  ],
};
function rateRows(x: CountryInput): Row[] {
  const r = x.release, src = new Map(r.sources.map(s => [s.id, s])), decisions = r.decisions.filter(d => d.evidence === 'statement');
  const byEffective = new Map(decisions.map(d => [effectiveOf(d), d]));
  return r.series.map((p, i) => {
    const prev = i ? r.series[i - 1] : null, era = eraOf(r, p.date), prevEra = prev ? eraOf(r, prev.date) : null;
    const hi = lohi(p.level)[1], prevHi = prev ? lohi(prev.level)[1] : null, newEra = !!prevEra && prevEra.id !== era.id;
    const change = prevHi == null || newEra ? null : hi - prevHi;
    const direction = !prev ? 'initial' : newEra ? 'era_change' : change! > 0 ? 'hike' : 'cut';
    const dec = byEffective.get(p.date) ?? null;
    const text = !prev ? `The ${r.authority.short} ${r.instrument.name.toLowerCase()} was ${levelText(p.level)} on ${dateText(p.date)}, the first point in this series.`
      : newEra ? `From ${dateText(p.date)} the ${r.authority.short} ${era.instrument.toLowerCase()} was ${levelText(p.level)}, the first rate under this instrument.`
      : `From ${dateText(p.date)} the ${r.authority.short} ${era.instrument.toLowerCase()} was ${levelText(p.level)}, ${change! > 0 ? 'up' : 'down'} ${Math.abs(change!)} bps from ${levelText(prev!.level)}.`;
    return {
      ...countryCols(r), instrument: era.instrument, effective_date: p.date, ...level(p.level),
      previous_rate_pct: prevHi == null ? null : pct(prevHi), change_bps: change, direction, era_id: era.id, era_basis: era.basis,
      evidence: p.evidence, source_id: p.sourceId, source_url: src.get(p.sourceId)!.url, decision_id: dec?.id ?? null, release_hash: r.release.hash, record_text: text,
    };
  });
}

/* ---------- daily: the rate in force on every calendar day ---------- */
export const DAILY: Omit<Table, 'rows'> = {
  name: 'daily', grain: 'One row per calendar day per country', description: 'The rate in force on every calendar day, from 1 Jan 2000 (or the first point of the series, if later) to the date the official series was last observed. Ready to join to any daily or monthly data.',
  columns: [
    c('date', 'date', false, 'Calendar date.'),
    c('country_code', 'string', false, 'ISO 3166-1 alpha-2 code of the jurisdiction (EA for the euro area).'),
    ...LEVEL, ...ERA,
    c('is_change', 'bool', false, 'True on the day a new rate took effect.'),
  ],
};
function dailyRows(x: CountryInput): Row[] {
  const r = x.release, cc = x.cc, md = MODEL[cc], start = Math.max(Date.UTC(2000, 0, 1), md.first.t), end = tOf(r.release.observedThrough);
  const changes = new Set(r.series.map(p => p.date)), byDate = new Map(r.series.map(p => [p.date, p]));
  const rows: Row[] = [];
  let cur = r.series.filter(p => tOf(p.date) <= start).at(-1) ?? r.series[0];
  for (let t = start; t <= end; t += DAY) {
    const d = isoOf(t); cur = byDate.get(d) ?? cur;
    if (valueAt(cc, t).hi !== lohi(cur.level)[1]) throw new Error(`daily ${cc} ${d}: series and model disagree`);
    const era = eraOf(r, d);
    rows.push({ date: d, country_code: r.country.code, ...level(cur.level), era_id: era.id, era_basis: era.basis, is_change: changes.has(d) });
  }
  return rows;
}

/* ---------- decisions: the announced decision ledger ---------- */
export const DECISIONS: Omit<Table, 'rows'> = {
  name: 'decisions', grain: 'One row per announced decision, including holds', description: 'Every announced decision in the ledger, from the bank’s own statement or resolution: hikes, cuts and holds, with the vote, stance, a short excerpt and the statement link.',
  columns: [
    c('decision_id', 'string', false, 'Stable decision identifier, `{country}-{announcement date}`.'),
    c('meeting_id', 'string', true, 'The scheduled meeting this decision came from; null for an unscheduled (off-cycle) decision. Joins to `meetings`.'),
    ...COUNTRY,
    c('decision_body', 'string', false, 'The committee that took the decision.'),
    c('instrument', 'string', false, 'The policy instrument.'),
    c('announced_at', 'timestamp', false, 'Announcement time in UTC.'),
    c('announced_at_local', 'string', false, 'Announcement time as published, with the bank’s UTC offset (ISO 8601).'),
    c('announced_date', 'date', false, 'Announcement date in the bank’s local time.'),
    c('effective_date', 'date', false, 'Date the decided rate took effect (the next day for the Fed).'),
    ...LEVEL,
    c('direction', 'string', false, '`hike`, `cut` or `hold`.'),
    c('change_bps', 'int32', true, 'Signed change in basis points; 0 for a hold. Null when the decision changed the instrument itself.'),
    c('off_cycle', 'bool', false, 'True for an unscheduled decision between meetings.'),
    c('era_change', 'bool', false, 'True when the decision introduced a new instrument or basis (for example the Fed’s move to a target range).'),
    c('vote_for', 'int32', true, 'Members voting for the decision; null where the vote is not captured.'),
    c('vote_against', 'int32', true, 'Members voting against; null where the vote is not captured.'),
    c('dissents', 'string_list', false, 'Names or descriptions of dissenting votes, as published; empty when there were none or none were captured.'),
    c('unanimous', 'bool', true, 'True when no member voted against; null where the vote is not captured.'),
    c('stance', 'string', true, 'The policy stance as stated by the bank (for example `neutral`, `calibrated tightening`), where it states one.'),
    c('statement_url', 'string', true, 'Link to the official statement or resolution.'),
    c('excerpt', 'string', true, 'A short excerpt from the statement (at most 400 characters).'),
    c('evidence', 'string', false, '`statement` for a decision read from the bank’s own statement or resolution.'),
    c('source_ids', 'string_list', false, 'Sources for this decision; join to `sources`.'),
    c('release_hash', 'string', false, 'SHA-256 content hash of the release this row was built from.'),
    c('record_text', 'string', false, 'One deterministic sentence describing the decision, for search and retrieval. Generated from the fields, not written by a model.'),
  ],
};
function decisionRows(x: CountryInput): Row[] {
  const r = x.release, era = (d: Decision) => eraOf(r, effectiveOf(d));
  return r.decisions.map(d => {
    const dir = d.direction === 'hike' || d.direction === 'cut' ? d.direction : 'hold';
    const v = d.vote, verb = dir === 'hike' ? `raised the ${era(d).instrument.toLowerCase()} by ${Math.abs(d.changeBps ?? 0)} bps to` : dir === 'cut' ? `cut the ${era(d).instrument.toLowerCase()} by ${Math.abs(d.changeBps ?? 0)} bps to` : `held the ${era(d).instrument.toLowerCase()} at`;
    const text = `On ${dateText(d.announcedAt.slice(0, 10))} the ${r.authority.name}’s ${r.authority.body} ${d.eraChange ? `set the ${era(d).instrument.toLowerCase()} at` : verb} ${levelText(d.level)}${dir !== 'hold' && d.effectiveDate && d.effectiveDate !== d.announcedAt.slice(0, 10) ? `, effective ${dateText(d.effectiveDate)}` : ''}${v ? `. The vote was ${v.for}–${v.against}` : ''}${d.offCycle ? '. It was an unscheduled decision' : ''}.`;
    return {
      decision_id: d.id, meeting_id: d.meetingId, ...countryCols(r), decision_body: r.authority.body, instrument: era(d).instrument,
      announced_at: new Date(d.announcedAt).toISOString(), announced_at_local: d.announcedAt, announced_date: d.announcedAt.slice(0, 10), effective_date: effectiveOf(d),
      ...level(d.level), direction: dir, change_bps: d.eraChange ? null : (d.changeBps ?? 0), off_cycle: d.offCycle, era_change: d.eraChange,
      vote_for: v?.for ?? null, vote_against: v?.against ?? null, dissents: v?.dissents ?? [], unanimous: v ? v.against === 0 : null,
      stance: d.stance, statement_url: d.statementUrl, excerpt: d.excerpt, evidence: d.evidence, source_ids: d.sourceIds, release_hash: r.release.hash, record_text: text,
    };
  });
}

/* ---------- meetings: the calendar ---------- */
export const MEETINGS: Omit<Table, 'rows'> = {
  name: 'meetings', grain: 'One row per scheduled meeting, past and upcoming', description: 'The meeting calendar, including meetings still to come, with the decision each held meeting produced.',
  columns: [
    c('meeting_id', 'string', false, 'Stable meeting identifier, `{country}-{decision date}`.'),
    c('country_code', 'string', false, 'ISO 3166-1 alpha-2 code of the jurisdiction (EA for the euro area).'),
    c('meeting_start', 'date', true, 'First day of a multi-day meeting.'),
    c('date', 'date', false, 'Decision day.'),
    c('announce_at', 'timestamp', false, 'Scheduled announcement time in UTC.'),
    c('announce_at_local', 'string', false, 'Scheduled announcement time with the bank’s UTC offset (ISO 8601).'),
    c('status', 'string', false, '`held`, `scheduled`, `cancelled` or `moved`.'),
    c('effective_lag_days', 'int32', false, 'Days between the announcement and the date a new rate takes effect.'),
    c('decision_id', 'string', true, 'The decision this meeting produced; joins to `decisions`.'),
    c('source_id', 'string', false, 'The calendar source; joins to `sources`.'),
  ],
};
function meetingRows(x: CountryInput): Row[] {
  const r = x.release, byMeeting = new Map(r.decisions.filter(d => d.meetingId).map(d => [d.meetingId!, d.id]));
  return r.calendar.map(m => ({
    meeting_id: m.id, country_code: r.country.code, meeting_start: m.meetingStart, date: m.date, announce_at: new Date(m.announceAt).toISOString(), announce_at_local: m.announceAt,
    status: m.status, effective_lag_days: m.effectiveLagDays, decision_id: byMeeting.get(m.id) ?? null, source_id: m.sourceId,
  }));
}

/* ---------- cycles: runs of hikes or cuts, as the site computes them ---------- */
export const CYCLES: Omit<Table, 'rows'> = {
  name: 'cycles', grain: 'One row per tightening or easing cycle', description: 'Each run of consecutive moves in one direction since the policy-rate era began, computed exactly as on the site: a cycle starts with the first move after a move the other way.',
  columns: [
    c('cycle_id', 'string', false, 'Stable identifier, `{country}-{direction}-{start date}`.'),
    c('country_code', 'string', false, 'ISO 3166-1 alpha-2 code of the jurisdiction (EA for the euro area).'),
    c('direction', 'string', false, '`tightening` (hikes) or `easing` (cuts).'),
    c('start_date', 'date', false, 'Effective date of the first move.'),
    c('end_date', 'date', false, 'Effective date of the last move so far.'),
    c('moves', 'int32', false, 'Number of moves in the cycle.'),
    c('total_bps', 'int32', false, 'Signed total change from the rate before the cycle to its last move, in basis points.'),
    c('days', 'int32', false, 'Days from the first to the last move.'),
    c('from_rate_pct', 'float64', false, 'The rate before the cycle began (upper bound for a range).'),
    c('to_rate_pct', 'float64', false, 'The rate after the cycle’s last move.'),
    c('is_current', 'bool', false, 'True for the most recent cycle, which may still be running.'),
  ],
};
function cycleRows(x: CountryInput): Row[] {
  const cy = MODEL[x.cc].cycles;
  return cy.map((k, i) => ({
    cycle_id: `${x.cc}-${k.dir === 'hike' ? 'tightening' : 'easing'}-${k.start.date}`, country_code: x.release.country.code, direction: k.dir === 'hike' ? 'tightening' : 'easing',
    start_date: k.start.date, end_date: k.end.date, moves: k.moves.length, total_bps: k.total, days: k.days, from_rate_pct: pct(k.from.hi), to_rate_pct: pct(k.end.hi), is_current: i === cy.length - 1,
  }));
}

/* ---------- annual ---------- */
export const ANNUAL: Omit<Table, 'rows'> = {
  name: 'annual', grain: 'One row per country per calendar year', description: 'Yearly summaries computed from `rates` and `decisions`: the rate at each end of the year, its range, the net and gross change, and how many hikes, cuts and holds there were.',
  columns: [
    c('country_code', 'string', false, 'ISO 3166-1 alpha-2 code of the jurisdiction (EA for the euro area).'),
    c('year', 'int32', false, 'Calendar year.'),
    c('start_rate_pct', 'float64', true, 'The rate in force on 1 January (the latest change effective before it). Null when the series starts later in the year.'),
    c('end_rate_pct', 'float64', false, 'The rate in force on 31 December, or on the last observed date for the current year.'),
    c('min_rate_pct', 'float64', false, 'Lowest rate in force during the year.'),
    c('max_rate_pct', 'float64', false, 'Highest rate in force during the year.'),
    c('net_change_bps', 'int32', true, 'End minus start, in basis points. Null when the start is unknown.'),
    c('gross_hikes_bps', 'int32', false, 'Sum of hikes in the year, in basis points.'),
    c('gross_cuts_bps', 'int32', false, 'Sum of cuts in the year, in basis points (a positive number).'),
    c('hike_count', 'int32', false, 'Number of hikes.'),
    c('cut_count', 'int32', false, 'Number of cuts.'),
    c('hold_count', 'int32', true, 'Number of announced holds. Null where the decision ledger does not cover the whole year.'),
    c('decision_count', 'int32', true, 'Number of announced decisions. Null where the decision ledger does not cover the whole year.'),
    c('is_partial_year', 'bool', false, 'True for a year the data does not fully cover: the first year of the series or the current year.'),
    c('record_text', 'string', false, 'One deterministic sentence summarising the year, for search and retrieval. Generated from the fields, not written by a model.'),
  ],
};
function annualRows(x: CountryInput, rates: Row[], decisions: Row[]): Row[] {
  const r = x.release, daily = dailyRows(x), first = daily[0].date as string, last = r.release.observedThrough;
  const ledgerYear = r.coverage.ledgerFrom ? +r.coverage.ledgerFrom.slice(0, 4) : null, ledgerFull = (y: number) => ledgerYear != null && (y > ledgerYear || r.coverage.ledgerFrom === `${y}-01-01`);
  const rows: Row[] = [];
  for (let y = +first.slice(0, 4); y <= +last.slice(0, 4); y++) {
    const days = daily.filter(d => (d.date as string).startsWith(`${y}-`)), bps = days.map(d => d.rate_bps as number);
    const before = daily.find(d => d.date === `${y - 1}-12-31`) ?? (rates.filter(p => (p.effective_date as string) < `${y}-01-01`).at(-1) ? { rate_bps: rates.filter(p => (p.effective_date as string) < `${y}-01-01`).at(-1)!.rate_bps } : null);
    const start = before ? (before.rate_bps as number) : null, end = bps[bps.length - 1];
    const moves = rates.filter(p => (p.effective_date as string).startsWith(`${y}-`) && p.change_bps != null);
    const hikes = moves.filter(p => (p.change_bps as number) > 0), cuts = moves.filter(p => (p.change_bps as number) < 0);
    const decs = decisions.filter(d => (d.announced_date as string).startsWith(`${y}-`)), full = ledgerFull(y);
    const holds = full ? decs.filter(d => d.direction === 'hold').length : null;
    const partial = y === +last.slice(0, 4) || first > `${y}-01-01`;
    const net = start == null ? null : end - start;
    const subject = `${r.authority.short} ${eraOf(r, days[days.length - 1].date as string).instrument.toLowerCase()}`;
    const text = `In ${y}${partial && y === +last.slice(0, 4) ? ` (to ${dateText(last)})` : ''} the ${subject} ${hikes.length && cuts.length ? `rose ${times(hikes.length)} and fell ${times(cuts.length)}` : hikes.length ? `rose ${times(hikes.length)}` : cuts.length ? `fell ${times(cuts.length)}` : 'did not change'}${start != null ? `, ending at ${(end / 100).toFixed(2)}% against ${(start / 100).toFixed(2)}% at the start of the year` : `, ending at ${(end / 100).toFixed(2)}%`}${holds ? `, with ${holds} hold${holds === 1 ? '' : 's'}` : ''}.`;
    rows.push({
      country_code: r.country.code, year: y, start_rate_pct: start == null ? null : pct(start), end_rate_pct: pct(end), min_rate_pct: pct(Math.min(...bps, ...(start == null ? [] : [start]))), max_rate_pct: pct(Math.max(...bps, ...(start == null ? [] : [start]))),
      net_change_bps: net, gross_hikes_bps: hikes.reduce((s, p) => s + (p.change_bps as number), 0), gross_cuts_bps: -cuts.reduce((s, p) => s + (p.change_bps as number), 0),
      hike_count: hikes.length, cut_count: cuts.length, hold_count: holds, decision_count: full ? decs.length : null, is_partial_year: partial, record_text: text,
    });
  }
  return rows;
}

/* ---------- reference tables ---------- */
export const COUNTRIES: Omit<Table, 'rows'> = {
  name: 'countries', grain: 'One row per country', description: 'What each country’s data covers: the bank, the instrument, the dates covered and the release it was built from.',
  columns: [
    ...COUNTRY,
    c('central_bank_short', 'string', false, 'Short name of the central bank.'),
    c('decision_body', 'string', false, 'The committee that sets the rate.'),
    c('instrument', 'string', false, 'The current policy instrument.'),
    c('instrument_explainer', 'string', false, 'What the instrument is, in plain words.'),
    c('currency', 'string', false, 'ISO 4217 currency code.'),
    c('time_zone', 'string', false, 'IANA time zone of the bank’s announcements.'),
    c('series_from', 'date', false, 'First point of the rate series.'),
    c('ledger_from', 'date', true, 'First decision in the decision ledger; null where the ledger is still being added.'),
    c('observed_through', 'date', false, 'Date the official series was last observed.'),
    c('coverage_note', 'string', false, 'How the data was assembled, in the release’s own words.'),
    c('series_points', 'int32', false, 'Rows in `rates` for this country.'),
    c('decisions', 'int32', false, 'Rows in `decisions` for this country.'),
    c('central_bank_url', 'string', false, 'The bank’s website.'),
    c('release_hash', 'string', false, 'SHA-256 content hash of the release.'),
  ],
};
const countryRow = (x: CountryInput): Row => {
  const r = x.release;
  return {
    ...countryCols(r), central_bank_short: r.authority.short, decision_body: r.authority.body, instrument: r.instrument.name, instrument_explainer: r.instrument.explainer,
    currency: r.country.currency, time_zone: r.country.timeZone, series_from: r.coverage.seriesFrom, ledger_from: r.coverage.ledgerFrom, observed_through: r.release.observedThrough,
    coverage_note: r.coverage.grain.replace('from the v2 record', 'from earlier published histories'), series_points: r.series.length, decisions: r.decisions.length, central_bank_url: r.authority.url, release_hash: r.release.hash,
  };
};
export const ERAS: Omit<Table, 'rows'> = {
  name: 'eras', grain: 'One row per instrument period', description: 'The periods in which one instrument and basis applied. A change of era is why `change_bps` is null at its first point.',
  columns: [
    c('era_id', 'string', false, 'Era identifier.'), c('country_code', 'string', false, 'ISO 3166-1 alpha-2 code of the jurisdiction (EA for the euro area).'),
    c('from_date', 'date', false, 'First date of the era.'), c('to_date', 'date', true, 'Last date of the era; null while it continues.'),
    c('instrument', 'string', false, 'The instrument in this era.'), c('level_kind', 'string', false, '`point` or `range`.'),
    c('basis', 'string', false, '`policy` or `observation`.'), c('note', 'string', false, 'Why the era is drawn here.'), c('source_id', 'string', false, 'Joins to `sources`.'),
  ],
};
export const EVENTS: Omit<Table, 'rows'> = {
  name: 'events', grain: 'One row per context event', description: 'Dated events that help read the rate history. Context only, not causal claims.',
  columns: [c('country_code', 'string', false, 'ISO 3166-1 alpha-2 code of the jurisdiction (EA for the euro area).'), c('date', 'date', false, 'Event date.'), c('label', 'string', false, 'Short label.'), c('description', 'string', false, 'What happened.'), c('source_id', 'string', false, 'Joins to `sources`.')],
};
export const SOURCES: Omit<Table, 'rows'> = {
  name: 'sources', grain: 'One row per source', description: 'Every source the rows cite: official series, statements, calendars and labelled secondary sources.',
  columns: [
    c('source_id', 'string', false, 'Source identifier.'), c('country_code', 'string', false, 'ISO 3166-1 alpha-2 code of the jurisdiction (EA for the euro area).'),
    c('source_type', 'string', false, 'Kind of source, for example `series`, `statement`, `calendar`, `secondary-series`.'), c('title', 'string', false, 'Title as published.'),
    c('url', 'string', false, 'Where to verify it.'), c('official', 'bool', false, 'True when published by the central bank itself (or the official statistical series it maintains).'),
    c('published_at', 'string', true, 'Publication date or time, when known.'),
  ],
};
export const TRANSMISSION: Omit<Table, 'rows'> = {
  name: 'transmission', grain: 'One row per loan product per country', description: 'How the policy rate reaches common loans: the benchmark each is priced off, how often it resets and how directly a change passes through. Curated reference notes.',
  columns: [
    c('country_code', 'string', false, 'ISO 3166-1 alpha-2 code of the jurisdiction (EA for the euro area).'), c('product', 'string', false, 'Loan product.'), c('benchmark', 'string', false, 'What the rate is priced off.'),
    c('spread_bps', 'int32', true, 'Typical spread over the benchmark, where given.'), c('reset', 'string', false, 'How often the rate resets.'),
    c('adjusts', 'string', false, '`payment`, `tenure` or `both`: what changes when the rate does.'), c('pass_through', 'string', false, '`direct`, `lagged`, `weak` or `none`.'),
    c('note', 'string', false, 'Plain-language note.'), c('source_id', 'string', false, 'Joins to `sources`.'),
  ],
};

/** Every table for the given countries, in config order. Tables with no rows are dropped by the caller. */
export function buildTables(xs: CountryInput[]): Table[] {
  initAtlas(buildAtlas(), xs.map(x => x.release.release.observedThrough).sort().at(-1)!);
  const rates = xs.map(rateRows), decisions = xs.map(decisionRows);
  const flat = <T>(a: T[][]) => a.flat();
  return [
    { ...RATES, rows: flat(rates) },
    { ...DAILY, rows: flat(xs.map(dailyRows)) },
    { ...DECISIONS, rows: flat(decisions) },
    { ...MEETINGS, rows: flat(xs.map(meetingRows)) },
    { ...CYCLES, rows: flat(xs.map(cycleRows)) },
    { ...ANNUAL, rows: flat(xs.map((x, i) => annualRows(x, rates[i], decisions[i]))) },
    { ...COUNTRIES, rows: xs.map(countryRow) },
    { ...ERAS, rows: flat(xs.map(x => x.release.eras.map(e => ({ era_id: e.id, country_code: x.release.country.code, from_date: e.from, to_date: e.to, instrument: e.instrument, level_kind: e.kind, basis: e.basis, note: e.note, source_id: e.sourceId })))) },
    { ...EVENTS, rows: flat(xs.map(x => x.release.context.map(e => ({ country_code: x.release.country.code, date: e.date, label: e.label, description: e.description, source_id: e.sourceId })))) },
    { ...SOURCES, rows: flat(xs.map(x => x.release.sources.map(s => ({ source_id: s.id, country_code: x.release.country.code, source_type: s.type, title: s.title, url: s.url, official: s.official, published_at: s.publishedAt })))) },
    { ...TRANSMISSION, rows: flat(xs.map(x => x.release.transmission.map(t => ({ country_code: x.release.country.code, product: t.product, benchmark: t.benchmark, spread_bps: t.spreadBps ?? null, reset: t.reset, adjusts: t.adjusts, pass_through: t.passThrough, note: t.note, source_id: t.sourceId })))) },
  ];
}
