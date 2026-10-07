/* Policy Rate Atlas: the country model, formatting and computed findings.
   Every finding is derived from the published v3 releases (embedded as AtlasData); nothing here is hand-entered except
   per-country presentation (how a bank is named in a sentence, loan defaults, display locale). Ported from the approved
   prototype (design/prototype/lib.js). */
import type { AtlasCountry, AtlasData, Code, RawDecision, Transmission } from './types.ts';

export type { Code } from './types.ts';

type Meta = {
  curName: string; name: string; bank: string; short: string; subj: string; inst: string; noun: string; body: string;
  /** Display locale for dates and numbers in sentences; moneyLocale formats amounts. */
  locale: string; moneyLocale: string; tz: string; dk: 'decision' | 'effective'; doc?: string;
  loan: { cur: string; amt: number; yrs: number; rate: number; word: string; product: string };
  txHead: string;
};

export const META: Record<Code, Meta> = {
  IN: { curName: 'rupee', name: 'India', bank: 'Reserve Bank of India', short: 'RBI', subj: 'The RBI', inst: 'Policy repo rate', noun: 'the policy repo rate', body: 'Monetary Policy Committee',
    locale: 'en-IN', moneyLocale: 'en-IN', tz: 'Asia/Kolkata', dk: 'decision', doc: 'resolution',
    loan: { cur: 'INR', amt: 5000000, yrs: 20, rate: 8.5, word: 'EMI', product: 'floating-rate home loan' },
    txHead: 'New floating-rate home loans follow the repo rate within three months' },
  US: { curName: 'dollar', name: 'United States', bank: 'Federal Reserve', short: 'Fed', subj: 'The Fed', inst: 'Federal funds target', noun: 'the federal funds target', body: 'FOMC',
    locale: 'en-US', moneyLocale: 'en-US', tz: 'America/New_York', dk: 'effective', doc: 'statement',
    loan: { cur: 'USD', amt: 50000, yrs: 10, rate: 7.75, word: 'monthly payment', product: 'prime-linked credit line' },
    txHead: 'Credit lines reprice within days; a fixed mortgage does not move at all' },
  EA: { curName: 'euro', name: 'Euro area', bank: 'European Central Bank', short: 'ECB', subj: 'The ECB', inst: 'Deposit facility rate', noun: 'the deposit facility rate', body: 'Governing Council',
    locale: 'en-IE', moneyLocale: 'en-IE', tz: 'Europe/Berlin', dk: 'effective',
    loan: { cur: 'EUR', amt: 250000, yrs: 25, rate: 3.5, word: 'monthly payment', product: 'variable-rate mortgage' },
    txHead: 'Variable mortgages move with Euribor, which runs ahead of the ECB' },
  GB: { curName: 'pound', name: 'United Kingdom', bank: 'Bank of England', short: 'BoE', subj: 'The Bank of England', inst: 'Bank Rate', noun: 'Bank Rate', body: 'Monetary Policy Committee',
    locale: 'en-GB', moneyLocale: 'en-GB', tz: 'Europe/London', dk: 'effective',
    loan: { cur: 'GBP', amt: 250000, yrs: 25, rate: 4.5, word: 'monthly payment', product: 'tracker mortgage' },
    txHead: 'Trackers move from the next payment; fixed deals feel it at remortgage' },
  CA: { curName: 'Canadian dollar', name: 'Canada', bank: 'Bank of Canada', short: 'BoC', subj: 'The Bank of Canada', inst: 'Overnight rate target', noun: 'its overnight rate target', body: 'Governing Council',
    locale: 'en-CA', moneyLocale: 'en-CA', tz: 'America/Toronto', dk: 'effective',
    loan: { cur: 'CAD', amt: 500000, yrs: 25, rate: 4.45, word: 'monthly payment', product: 'variable-rate mortgage' },
    txHead: 'Variable mortgages follow prime within days; fixed terms wait for renewal' },
  AU: { curName: 'Australian dollar', name: 'Australia', bank: 'Reserve Bank of Australia', short: 'RBA', subj: 'The RBA', inst: 'Cash rate target', noun: 'the cash rate target', body: 'Monetary Policy Board',
    locale: 'en-AU', moneyLocale: 'en-AU', tz: 'Australia/Sydney', dk: 'effective',
    loan: { cur: 'AUD', amt: 600000, yrs: 30, rate: 6.35, word: 'monthly repayment', product: 'variable-rate home loan' },
    txHead: 'Most home loans are variable, so moves reach budgets within weeks' },
  BR: { curName: 'real', name: 'Brazil', bank: 'Banco Central do Brasil', short: 'BCB', subj: 'Copom', inst: 'Selic target', noun: 'the Selic target', body: 'Copom',
    locale: 'en-GB', moneyLocale: 'pt-BR', tz: 'America/Sao_Paulo', dk: 'effective',
    loan: { cur: 'BRL', amt: 300000, yrs: 20, rate: 11.5, word: 'monthly payment', product: 'floating-rate loan' },
    txHead: 'Floating credit and fixed income follow the Selic; mortgages less so' },
};
const ORDER: Code[] = ['IN', 'US', 'EA', 'GB', 'CA', 'AU', 'BR'];
export const isCode = (c: string): c is Code => (ORDER as string[]).includes(c);
export const bench = (c: Code): Code => (c === 'US' ? 'EA' : 'US');

/* ---------- time ---------- */
export const DAY = 864e5;
export const tOf = (iso: string) => Date.parse(iso.slice(0, 10) + 'T00:00:00Z');
export const isoOf = (t: number) => new Date(t).toISOString().slice(0, 10);
export const T2000 = Date.UTC(2000, 0, 1);
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/* ---------- model ---------- */
export type Dir = 'hike' | 'cut';
export type Decision = RawDecision & { t: number; te: number; c: Code };
export interface Rec {
  date: string; t: number; lo: number; hi: number; range: boolean; official: boolean; c: Code;
  action: 'start' | 'hike' | 'cut' | 'framework'; chg: number; dir: Dir;
  /** The record before this one. Defined for every move; the first record of a series has none. */
  prev: Rec; next: Rec | null; decision: Decision | null;
}
export type Level = Pick<Rec, 'lo' | 'hi' | 'range'>;
export interface Cycle { dir: Dir; moves: Rec[]; from: Rec; start: Rec; end: Rec; total: number; days: number; i: number }
export interface CountryModel {
  recs: Rec[]; moves: Rec[]; policyMoves: Rec[]; cycles: Cycle[]; decisions: Decision[]; first: Rec; last: Rec;
  next: string[]; eras: AtlasCountry['eras']; tx: Transmission[]; release: string; sources: number; policyFrom: string;
}

export let TODAY = '';
export let T_TODAY = 0;
export let GENERATED = '';
export let CODES: Code[] = [];
export const MODEL = {} as Record<Code, CountryModel>;
export let ALLMOVES: Rec[] = [];
export const fromT = (c: Code) => Math.max(T2000, tOf(MODEL[c].policyFrom));

/** Builds the model for every country in `data`. `today` is the viewer's date (YYYY-MM-DD); findings are computed as of it. */
export function initAtlas(data: AtlasData, today: string): void {
  TODAY = today; T_TODAY = tOf(today); GENERATED = data.generatedAt;
  CODES = ORDER.filter(c => data.countries[c]);
  for (const c of CODES) MODEL[c] = buildModel(data.countries[c]!, c);
  ALLMOVES = CODES.flatMap(c => MODEL[c].policyMoves).sort((a, b) => a.t - b.t);
}

function buildModel(R: AtlasCountry, c: Code): CountryModel {
  const recs = R.series.map(([date, lo, hi, official]) => ({ date, t: tOf(date), lo, hi, range: lo !== hi, official: !!official, c, action: 'start', chg: 0, dir: 'hike', next: null, decision: null }) as unknown as Rec);
  recs.forEach((r, i) => {
    if (!i) return;
    const p = recs[i - 1]; r.prev = p; r.chg = r.hi - p.hi;
    r.action = r.range !== p.range ? 'framework' : r.chg > 0 ? 'hike' : 'cut';
    r.dir = r.chg > 0 ? 'hike' : 'cut';
  });
  const decisions: Decision[] = R.decisions.map(d => ({ ...d, t: tOf(d.date), te: d.effective ? tOf(d.effective) : tOf(d.date), c }));
  const byEffective = new Map(decisions.map(d => [d.effective ?? d.date, d]));
  const moves = recs.filter(r => r.action !== 'start');
  moves.forEach((m, i) => { m.next = moves[i + 1] ?? null; m.decision = byEffective.get(m.date) ?? null; });
  const F = Math.max(T2000, tOf(R.policyFrom));
  const policyMoves = moves.filter(m => m.t >= F);
  const cycles: Cycle[] = []; let cur: Cycle | null = null;
  for (const m of policyMoves) {
    if (!cur || cur.dir !== m.dir) { cur = { dir: m.dir, moves: [], from: m.prev, start: m, end: m, total: 0, days: 0, i: cycles.length }; cycles.push(cur); }
    cur.moves.push(m);
  }
  cycles.forEach(cy => { cy.start = cy.moves[0]; cy.end = cy.moves[cy.moves.length - 1]; cy.total = cy.end.hi - cy.from.hi; cy.days = Math.round((cy.end.t - cy.start.t) / DAY); });
  return { recs, moves, policyMoves, cycles, decisions, first: recs[0], last: recs[recs.length - 1], next: R.next, eras: R.eras, tx: R.transmission, release: R.release, sources: R.sources, policyFrom: R.policyFrom };
}
export function valueAt(c: Code, t: number): Rec { const r = MODEL[c].recs; let lo = 0, hi = r.length - 1, a = r[0]; while (lo <= hi) { const m = (lo + hi) >> 1; if (r[m].t <= t) { a = r[m]; lo = m + 1; } else hi = m - 1; } return a; }
/** Future announcement instants (ISO) for a country, after now. */
export const upcoming = (c: Code, nowMs = Date.now()) => MODEL[c].next.filter(iso => Date.parse(iso) > nowMs);

/* ---------- format ---------- */
export const esc = (s: unknown) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
/** A true minus sign for negative rates. */
export const pct = (b: number) => (b / 100).toFixed(2).replace('-', '−');
export const vText = (r: Level) => (r.range ? `${pct(r.lo)} to ${pct(r.hi)}%` : `${pct(r.hi)}%`);
export const vShort = (r: Level) => (r.range ? `${pct(r.lo)}–${pct(r.hi)}%` : `${pct(r.hi)}%`);
export const vBig = (r: Level) => (r.range ? `${pct(r.lo)}<span class="to">to</span>${pct(r.hi)}<small>%</small>` : `${pct(r.hi)}<small>%</small>`);
export const nw = (s: string) => `<span class="nw">${s}</span>`;
export const B = (s: string | number) => `<b class="nw">${s}</b>`;
export const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);
export const bps = (n: number) => `${sgn(n)} bps`;
export const poss = (s: string) => (s.endsWith('s') ? `${s}’` : `${s}’s`);
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const fmtD = (iso: string, c: Code) => new Intl.DateTimeFormat(META[c].locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(tOf(iso)));
export const fmtDT = (t: number, c: Code) => fmtD(isoOf(t), c);
export const fmtM = (t: number, c: Code, long = false) => new Intl.DateTimeFormat(META[c].locale, { month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(t));
// Cross-country lists use one neutral format so rows line up; country pages keep local conventions.
export const fmtXD = (t: number) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(t)).replace('Sept', 'Sep');
export const fmtXM = (t: number) => new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(t)).replace('Sept', 'Sep');
export const yearOf = (t: number) => new Date(t).getUTCFullYear();
export const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
export function span(d: number) { if (d < 60) return `${d} day${d === 1 ? '' : 's'}`; const m = Math.round(d / 30.44); if (m < 24) return `${m} months`; const y = Math.floor(m / 12), r = m % 12; return `${y} year${y > 1 ? 's' : ''}${r ? ` ${r} month${r > 1 ? 's' : ''}` : ''}`; }
const monthsWord = (d: number) => { const m = Math.round(d / 30.44); return m <= 12 ? `${WORDS[m]} month${m === 1 ? '' : 's'}` : `${m} months`; };
export const money = (v: number, c: Code) => new Intl.NumberFormat(META[c].moneyLocale, { style: 'currency', currency: META[c].loan.cur, maximumFractionDigits: 0 }).format(v);
export function moneyWords(v: number, c: Code) {
  if (c === 'IN') { if (v >= 1e7) return `₹${+(v / 1e7).toFixed(2)} crore`; if (v >= 1e5) return `₹${+(v / 1e5).toFixed(2)} lakh`; }
  return money(v, c);
}
export const curSymbol = (c: Code) => new Intl.NumberFormat(META[c].moneyLocale, { style: 'currency', currency: META[c].loan.cur, maximumFractionDigits: 0 }).formatToParts(0).find(p => p.type === 'currency')?.value ?? META[c].loan.cur;
export function fmtNext(iso: string, c: Code) {
  const d = new Date(iso), tz = META[c].tz;
  const date = new Intl.DateTimeFormat(META[c].locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }).format(d);
  const time = new Intl.DateTimeFormat(META[c].locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz, timeZoneName: 'short' }).format(d);
  const days = Math.round((tOf(new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)) - T_TODAY) / DAY);
  return { date, time, days, inText: days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days` };
}
export function voteText(v: RawDecision['vote']) {
  if (!v) return null;
  return { tally: `${v.for}–${v.against}`, sub: v.against === 0 ? 'Unanimous' : `${WORDS[v.against] ? cap(WORDS[v.against]) : v.against} dissent${v.against > 1 ? 's' : ''}` };
}
export const RANKW = (n: number) => (n === 1 ? 'highest' : `${n}${['th', 'st', 'nd', 'rd'][(n % 10 > 3 || [11, 12, 13].includes(n % 100)) ? 0 : n % 10]} highest`);
export const PLURAL: Record<Code, string> = { IN: 'rupees', US: 'dollars', EA: 'euros', GB: 'pounds', CA: 'Canadian dollars', AU: 'Australian dollars', BR: 'reais' };
export const dirOf = (d: string): 'hike' | 'cut' | 'hold' => (d === 'hike' || d === 'cut' ? d : 'hold');

/* ---------- findings ---------- */
export function moveContext(m: Rec) {
  const md = MODEL[m.c], i = md.moves.indexOf(m), F = fromT(m.c), before = md.moves.slice(0, i).filter(x => x.t >= F);
  if (m.action === 'framework') return 'target range introduced';
  let run = 1; for (let k = i - 1; k >= 0 && md.moves[k].dir === m.dir && md.moves[k].t >= F; k--) run++;
  const prevSame = [...before].reverse().find(x => x.dir === m.dir);
  if (run === 1 && prevSame) return `first ${m.dir} since ${fmtM(prevSame.t, m.c, true)}`;
  if (run === 1) return `first ${m.dir} in this record`;
  return run <= 12 ? `${ORD[run]} ${m.dir} in a row` : `${m.dir} number ${run} in a row`;
}
export function lede(c: Code, asOf = T_TODAY) {
  const m = META[c], moves = MODEL[c].policyMoves.filter(x => x.t <= asOf), last = moves[moves.length - 1], prev = moves[moves.length - 2];
  const dec = last.decision, verb = last.chg > 0 ? 'raised' : 'cut';
  const val = last.range ? `a range of ${B(vText(last))}` : B(vText(last));
  const when = dec && dec.effective && dec.date !== dec.effective ? ` on ${nw(fmtD(dec.date, c))}, effective ${nw(fmtD(dec.effective, c))}` : m.dk === 'effective' ? `, effective ${nw(fmtD(last.date, c))}` : ` on ${nw(fmtD(last.date, c))}`;
  const gap = prev ? Math.round((last.t - prev.t) / DAY) : 0;
  const after = prev && gap >= 90 ? `, after ${monthsWord(gap)} unchanged at ${B(vText(last.prev))}` : '';
  const since = Math.round((asOf - last.t) / DAY);
  if (last.action === 'framework') return `${m.subj} moved to a target range of ${B(vText(last))}${when}.`;
  if (since <= 45) return `${m.subj} ${verb} ${m.noun} by ${B(Math.abs(last.chg) + ' bps')} to ${val}${when}, its ${moveContext(last)}${after}.`;
  return `${m.subj} has held ${m.noun} at ${B(vText(last))} for ${span(since)}. Its last move was a ${Math.abs(last.chg)} bps ${last.dir}${when}.`;
}
export function levelInfo(c: Code) {
  const md = MODEL[c], t0 = Math.max(fromT(c), md.first.t), now = md.last.hi; let below = 0, eq = 0, tot = 0;
  const bins = new Map<number, number>(), pts = md.recs.filter(r => r.t > t0);
  let t = t0, r = valueAt(c, t0);
  for (const nx of [...pts, null]) {
    const e = nx ? nx.t : T_TODAY, d = Math.max(0, e - t); tot += d;
    if (r.hi < now) below += d; else if (r.hi === now) eq += d;
    const b = Math.floor(r.hi / 100); bins.set(b, (bins.get(b) ?? 0) + d);
    if (nx) { t = nx.t; r = nx; }
  }
  return { pBelow: below / tot, pAbove: (tot - below - eq) / tot, bins, now, t0 };
}
export function cycleInfo(c: Code) {
  const md = MODEL[c], cur = md.cycles[md.cycles.length - 1], past = md.cycles.slice(0, -1).filter(cy => cy.dir === cur.dir && cy.moves.length >= 2);
  const r = (v: number | null) => (v == null ? null : Math.round(v));
  return { cur, past, medTotal: r(median(past.map(p => p.total))), medDays: r(median(past.map(p => p.days))), holding: Math.round((T_TODAY - cur.end.t) / DAY), elapsed: Math.round((T_TODAY - cur.start.t) / DAY) };
}
export type CycleInfo = ReturnType<typeof cycleInfo>;
export function gapSeries(c: Code, b = bench(c)) {
  const t0 = Math.max(MODEL[c].first.t, MODEL[b].first.t, fromT(c), fromT(b));
  const ts = [...new Set([t0, ...MODEL[c].recs.map(r => r.t), ...MODEL[b].recs.map(r => r.t)])].filter(t => t >= t0 && t <= T_TODAY).sort((x, y) => x - y);
  const pts: { t: number; s: number }[] = [];
  ts.forEach(t => { const s = valueAt(c, t).hi - valueAt(b, t).hi; if (!pts.length || pts[pts.length - 1].s !== s) pts.push({ t, s }); });
  return { pts, t0, b };
}
export function gapInfo(c: Code) {
  const { pts, b, t0 } = gapSeries(c), s = pts[pts.length - 1].s;
  let ya = pts[0]; for (const p of pts) if (p.t <= T_TODAY - 365 * DAY) ya = p;
  const yearAgo = ya.s;
  let below = 0, above = 0, tot = 0, wide = pts[0], narrow = pts[0];
  pts.forEach((p, i) => { const e = pts[i + 1] ? pts[i + 1].t : T_TODAY, d = e - p.t; tot += d; if (p.s < s) below += d; else if (p.s > s) above += d; if (p.s > wide.s) wide = p; if (p.s < narrow.s) narrow = p; });
  const pB = below / tot, pA = above / tot;
  const rel = s >= 0 ? (pA >= pB ? { word: 'narrower', share: pA } : { word: 'wider', share: pB }) : (pB >= pA ? { word: 'smaller discount', share: pB } : { word: 'deeper discount', share: pA });
  let since: number | null = null, dirWord = '';
  if (s !== yearAgo) {
    const narrowing = s < yearAgo;
    for (let i = pts.length - 2; i >= 0; i--) { const p = pts[i]; if (narrowing ? p.s <= s : p.s >= s) { since = pts[i + 1] ? pts[i + 1].t - DAY : p.t; break; } }
    if (since != null && T_TODAY - since < 365 * DAY) since = null;
    dirWord = narrowing ? (s >= 0 ? 'narrowest' : 'deepest discount') : (s >= 0 ? 'widest' : 'smallest discount');
  }
  return { s, yearAgo, since, dirWord, b, pts, rel, yr: yearOf(t0), t0, wide, narrow };
}
export type GapInfo = ReturnType<typeof gapInfo>;
export function peers(c: Code) { const list = CODES.map(k => ({ k, v: MODEL[k].last.hi })).sort((a, b) => b.v - a.v); return { list, rank: list.findIndex(p => p.k === c) + 1 }; }
export function stanceOfPlay(c: Code) {
  const md = MODEL[c], last = md.policyMoves[md.policyMoves.length - 1], d = Math.round((T_TODAY - last.t) / DAY), cy = md.cycles[md.cycles.length - 1];
  if (d > 182) return { cls: 'hold' as const, txt: `On hold for ${span(d)}`, short: 'On hold' };
  return { cls: last.dir, txt: `${last.dir === 'hike' ? 'Tightening' : 'Easing'} since ${fmtM(cy.start.t, c)}`, short: last.dir === 'hike' ? 'Tightening' : 'Easing' };
}
export function pulseFinding() {
  const win = 90 * DAY, inWin = (end: number) => ALLMOVES.filter(m => m.t > end - win && m.t <= end && m.action !== 'framework');
  const now = inWin(T_TODAY), hb = [...new Set(now.filter(m => m.dir === 'hike').map(m => m.c))], cb = [...new Set(now.filter(m => m.dir === 'cut').map(m => m.c))];
  let since: number | null = null;
  for (let t = T_TODAY - win; t >= T2000 + win; t -= 7 * DAY) { if (new Set(inWin(t).filter(m => m.dir === 'hike').map(m => m.c)).size >= hb.length) { since = t; break; } }
  const names = (a: Code[]) => a.map(k => META[k].short).join(', ');
  const s1 = hb.length ? `${B(hb.length)} of ${CODES.length} central banks raised rates in the last 90 days (${names(hb)})` : 'No central bank in this set raised rates in the last 90 days';
  const s2 = cb.length ? `${cb.length === 1 ? 'one' : WORDS[cb.length]} cut (${names(cb)})` : 'none cut';
  const s3 = hb.length >= 2 ? (since ? `. That is the widest tightening turn since ${new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(since))}` : '. That is the widest tightening turn in this record') : '';
  return { html: `${s1}, and ${s2}${s3}.`, hb, cb };
}

/* ---------- loan arithmetic (standard amortisation) ---------- */
export function emi(L: number, ratePct: number, months: number) { const r = ratePct / 1200; return r === 0 ? L / months : L * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1); }
export function monthsFor(L: number, ratePct: number, P: number) { const r = ratePct / 1200; if (r * L >= P) return Infinity; return -Math.log(1 - r * L / P) / Math.log(1 + r); }

/* ---------- small marks ---------- */
const GLYPH: Record<string, string> = {
  hike: '<path d="M5 1.8 8.6 7.8H1.4Z"/>', cut: '<path d="M5 8.2 8.6 2.2H1.4Z"/>',
  hold: '<rect x="1.6" y="4.1" width="6.8" height="1.8" rx=".9"/>', framework: '<path d="M5 1.4 8.6 5 5 8.6 1.4 5Z"/>',
};
export const mark = (dir: string, cls = '') => `<span class="mark ${dir} ${cls}" aria-hidden="true"><svg viewBox="0 0 10 10" fill="currentColor">${GLYPH[dir] ?? GLYPH.hold}</svg></span>`;
export const movePill = (dir: string, chg: number) => `<span class="move">${mark(dir)}<span class="num">${dir === 'hold' ? 'Hold' : sgn(chg)}</span></span>`;
/* Flags: HatScripts/circle-flags (MIT), served from /flags/. */
const FLAGS: Record<Code, string> = { IN: 'in', US: 'us', EA: 'european_union', GB: 'gb', CA: 'ca', AU: 'au', BR: 'br' };
export const flagSrc = (c: Code) => `/flags/${FLAGS[c]}.svg`;
export const flagImg = (c: Code) => `<img src="${flagSrc(c)}" alt="" width="28" height="28" decoding="async">`;
export const flag = (c: Code, cls = '') => `<span class="disc flag ${cls}" title="${META[c].name}">${flagImg(c)}</span>`;
