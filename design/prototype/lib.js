/* Policy Rate Atlas prototype: model, formatting and computed findings.
   Every finding is derived from window.ATLAS_DATA (official series and verified decisions); nothing here is hand-entered
   except per-country presentation metadata (names, locales, loan defaults, transmission notes for countries whose
   pipeline adapters do not exist yet). */
'use strict';

const RAW = window.ATLAS_DATA.countries;
const TODAY = window.ATLAS_DATA.generatedAt.slice(0, 10);

const META = {
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
        txHead: 'Variable mortgages move with Euribor, which runs ahead of the ECB',
        tx: [
          { product: 'Variable-rate mortgage', benchmark: 'Euribor, usually 3 or 12 months', reset: 'Every 3 to 12 months', passThrough: 'direct', note: 'Euribor moves on expectations for ECB policy, so it often shifts before the decision itself.' },
          { product: 'Fixed-rate mortgage', benchmark: 'Fixed at origination', reset: 'At the end of the fixed period', passThrough: 'none', note: 'Germany and France lean fixed; Spain, Portugal and Finland lean variable.' } ] },
  GB: { curName: 'pound', name: 'United Kingdom', bank: 'Bank of England', short: 'BoE', subj: 'The Bank of England', inst: 'Bank Rate', noun: 'Bank Rate', body: 'Monetary Policy Committee',
        locale: 'en-GB', moneyLocale: 'en-GB', tz: 'Europe/London', dk: 'effective',
        loan: { cur: 'GBP', amt: 250000, yrs: 25, rate: 4.5, word: 'monthly payment', product: 'tracker mortgage' },
        txHead: 'Trackers move from the next payment; fixed deals feel it at remortgage',
        tx: [
          { product: 'Tracker mortgage', benchmark: 'Bank Rate plus a margin', reset: 'Usually from the next monthly payment', passThrough: 'direct', note: 'A tracker follows Bank Rate one for one.' },
          { product: 'Fixed-rate mortgage', benchmark: 'Fixed for two to five years', reset: 'When the deal ends', passThrough: 'none', note: 'Most UK borrowers are on fixed deals and feel Bank Rate when they remortgage.' } ] },
  CA: { curName: 'Canadian dollar', name: 'Canada', bank: 'Bank of Canada', short: 'BoC', subj: 'The Bank of Canada', inst: 'Overnight rate target', noun: 'its overnight rate target', body: 'Governing Council',
        locale: 'en-CA', moneyLocale: 'en-CA', tz: 'America/Toronto', dk: 'effective',
        loan: { cur: 'CAD', amt: 500000, yrs: 25, rate: 4.45, word: 'monthly payment', product: 'variable-rate mortgage' },
        txHead: 'Variable mortgages follow prime within days; fixed terms wait for renewal',
        tx: [
          { product: 'Variable-rate mortgage', benchmark: "Lender's prime rate", reset: 'Within days of a decision', passThrough: 'direct', note: 'On many variable mortgages the payment stays fixed and the share going to interest changes instead.' },
          { product: 'Fixed-rate mortgage', benchmark: 'Fixed for the term, often five years', reset: 'At renewal', passThrough: 'none', note: 'Fixed terms reprice when they renew.' } ] },
  AU: { curName: 'Australian dollar', name: 'Australia', bank: 'Reserve Bank of Australia', short: 'RBA', subj: 'The RBA', inst: 'Cash rate target', noun: 'the cash rate target', body: 'Monetary Policy Board',
        locale: 'en-AU', moneyLocale: 'en-AU', tz: 'Australia/Sydney', dk: 'effective',
        loan: { cur: 'AUD', amt: 600000, yrs: 30, rate: 6.35, word: 'monthly repayment', product: 'variable-rate home loan' },
        txHead: 'Most home loans are variable, so moves reach budgets within weeks',
        tx: [
          { product: 'Variable-rate home loan', benchmark: "Lender's standard variable rate", reset: 'Usually within weeks', passThrough: 'direct', note: 'Most Australian home loans are variable, one of the most direct channels to household budgets.' },
          { product: 'Fixed-rate home loan', benchmark: 'Fixed for one to five years', reset: 'Rolls to variable when the fix ends', passThrough: 'none', note: 'Fixed loans meet the cash rate when they roll off.' } ] },
  BR: { curName: 'real', name: 'Brazil', bank: 'Banco Central do Brasil', short: 'BCB', subj: 'Copom', inst: 'Selic target', noun: 'the Selic target', body: 'Copom',
        locale: 'en-GB', moneyLocale: 'pt-BR', tz: 'America/Sao_Paulo', dk: 'effective',
        loan: { cur: 'BRL', amt: 300000, yrs: 20, rate: 11.5, word: 'monthly payment', product: 'floating-rate loan' },
        txHead: 'Floating credit and fixed income follow the Selic; mortgages less so',
        tx: [
          { product: 'Floating-rate credit', benchmark: 'Selic or CDI', reset: 'Quickly', passThrough: 'direct', note: 'Overdrafts, floating loans and CDB yields move closely with the Selic.' },
          { product: 'Home loan', benchmark: 'Often TR or IPCA plus a spread', reset: 'Depends on the index', passThrough: 'lagged', note: 'Many home loans follow other indices, so mortgage pass-through is weaker.' } ] },
};
const CODES = Object.keys(META);
const bench = c => (c === 'US' ? 'EA' : 'US');

/* ---------- time ---------- */
const DAY = 864e5;
const tOf = iso => Date.parse(iso.slice(0, 10) + 'T00:00:00Z');
const isoOf = t => new Date(t).toISOString().slice(0, 10);
const T_TODAY = tOf(TODAY), T2000 = Date.UTC(2000, 0, 1);
const fromT = c => Math.max(T2000, tOf(RAW[c].policyFrom));
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/* ---------- model ---------- */
const MODEL = {};
for (const c of CODES) {
  const R = RAW[c];
  const recs = R.series.map(([date, lo, hi, official]) => ({ date, t: tOf(date), lo, hi, range: lo !== hi, official: !!official, c }));
  recs.forEach((r, i) => {
    if (!i) { r.action = 'start'; r.chg = 0; return; }
    const p = recs[i - 1]; r.prev = p; r.chg = r.hi - p.hi;
    r.action = r.range !== p.range ? 'framework' : r.chg > 0 ? 'hike' : 'cut';
    r.dir = r.chg > 0 ? 'hike' : 'cut';
  });
  const decisions = (R.decisions || []).map(d => ({ ...d, t: tOf(d.date), te: tOf(d.effective), c }));
  const byEffective = new Map(decisions.map(d => [d.effective, d]));
  const moves = recs.filter(r => r.action !== 'start');
  moves.forEach((m, i) => { m.next = moves[i + 1] || null; m.decision = byEffective.get(m.date) || null; });
  const policyMoves = moves.filter(m => m.t >= fromT(c));
  const cycles = []; let cur = null;
  for (const m of policyMoves) { if (!cur || cur.dir !== m.dir) { cur = { dir: m.dir, moves: [], from: m.prev }; cycles.push(cur); } cur.moves.push(m); }
  cycles.forEach((cy, i) => { cy.start = cy.moves[0]; cy.end = cy.moves.at(-1); cy.total = cy.end.hi - cy.from.hi; cy.days = Math.round((cy.end.t - cy.start.t) / DAY); cy.i = i; });
  MODEL[c] = { recs, moves, policyMoves, cycles, decisions, first: recs[0], last: recs.at(-1), next: R.next || [], eras: R.eras || [], tx: R.transmission?.length ? R.transmission : META[c].tx, release: R.release, sources: R.sources };
}
function valueAt(c, t) { const r = MODEL[c].recs; let lo = 0, hi = r.length - 1, a = r[0]; while (lo <= hi) { const m = (lo + hi) >> 1; if (r[m].t <= t) { a = r[m]; lo = m + 1; } else hi = m - 1; } return a; }
const ALLMOVES = CODES.flatMap(c => MODEL[c].policyMoves).sort((a, b) => a.t - b.t);

/* ---------- format ---------- */
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const pct = b => (b / 100).toFixed(2).replace('-', '−'); // a true minus sign for negative rates
const vText = r => (r.range ? `${pct(r.lo)} to ${pct(r.hi)}%` : `${pct(r.hi)}%`);
const vShort = r => (r.range ? `${pct(r.lo)}–${pct(r.hi)}%` : `${pct(r.hi)}%`);
const vBig = r => (r.range ? `${pct(r.lo)}<span class="to">to</span>${pct(r.hi)}<small>%</small>` : `${pct(r.hi)}<small>%</small>`);
const nw = s => `<span class="nw">${s}</span>`;
const B = s => `<b class="nw">${s}</b>`;
const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);
const bps = n => `${sgn(n)} bps`;
const poss = s => (s.endsWith('s') ? `${s}’` : `${s}’s`);
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const fmtD = (iso, c) => new Intl.DateTimeFormat(META[c].locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(tOf(iso)));
const fmtDT = (t, c) => fmtD(isoOf(t), c);
const fmtM = (t, c, long) => new Intl.DateTimeFormat(META[c].locale, { month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(t));
// Cross-country lists use one neutral format so rows line up; country pages keep local conventions.
const fmtXD = t => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(t)).replace('Sept', 'Sep');
const fmtXM = t => new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(t)).replace('Sept', 'Sep');
const yearOf = t => new Date(t).getUTCFullYear();
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
function span(d) { if (d < 60) return `${d} day${d === 1 ? '' : 's'}`; const m = Math.round(d / 30.44); if (m < 24) return `${m} months`; const y = Math.floor(m / 12), r = m % 12; return `${y} year${y > 1 ? 's' : ''}${r ? ` ${r} month${r > 1 ? 's' : ''}` : ''}`; }
const monthsWord = d => { const m = Math.round(d / 30.44); return m <= 12 ? `${WORDS[m]} month${m === 1 ? '' : 's'}` : `${m} months`; };
function money(v, c) { return new Intl.NumberFormat(META[c].moneyLocale, { style: 'currency', currency: META[c].loan.cur, maximumFractionDigits: 0 }).format(v); }
function moneyWords(v, c) {
  if (c === 'IN') { const sym = '₹'; if (v >= 1e7) return `${sym}${+(v / 1e7).toFixed(2)} crore`; if (v >= 1e5) return `${sym}${+(v / 1e5).toFixed(2)} lakh`; }
  return money(v, c);
}
const curSymbol = c => new Intl.NumberFormat(META[c].moneyLocale, { style: 'currency', currency: META[c].loan.cur, maximumFractionDigits: 0 }).formatToParts(0).find(p => p.type === 'currency')?.value || META[c].loan.cur;
function fmtNext(iso, c) {
  const d = new Date(iso), tz = META[c].tz;
  const date = new Intl.DateTimeFormat(META[c].locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }).format(d);
  const time = new Intl.DateTimeFormat(META[c].locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz, timeZoneName: 'short' }).format(d);
  const days = Math.round((tOf(new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)) - T_TODAY) / DAY);
  return { date, time, days, inText: days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days` };
}
function voteText(v) {
  if (!v) return null;
  const tally = `${v.for}–${v.against}`;
  return { tally, sub: v.against === 0 ? 'Unanimous' : `${WORDS[v.against] ? cap(WORDS[v.against]) : v.against} dissent${v.against > 1 ? 's' : ''}` };
}
const RANKW = n => (n === 1 ? 'highest' : `${n}${['th', 'st', 'nd', 'rd'][(n % 10 > 3 || [11, 12, 13].includes(n % 100)) ? 0 : n % 10]} highest`);

/* ---------- findings ---------- */
function moveContext(m) {
  const md = MODEL[m.c], i = md.moves.indexOf(m), before = md.moves.slice(0, i).filter(x => x.t >= fromT(m.c));
  if (m.action === 'framework') return 'target range introduced';
  let run = 1; for (let k = i - 1; k >= 0 && md.moves[k].dir === m.dir && md.moves[k].t >= fromT(m.c); k--) run++;
  const prevSame = [...before].reverse().find(x => x.dir === m.dir);
  if (run === 1 && prevSame) return `first ${m.dir} since ${fmtM(prevSame.t, m.c, true)}`;
  if (run === 1) return `first ${m.dir} in this record`;
  return run <= 12 ? `${ORD[run]} ${m.dir} in a row` : `${m.dir} number ${run} in a row`;
}
function lede(c, asOf = T_TODAY) {
  const m = META[c], moves = MODEL[c].policyMoves.filter(x => x.t <= asOf), last = moves.at(-1), prev = moves.at(-2);
  const dec = last.decision, verb = last.chg > 0 ? 'raised' : 'cut';
  const val = last.range ? `a range of ${B(vText(last))}` : B(vText(last));
  const when = dec && dec.date !== dec.effective ? ` on ${nw(fmtD(dec.date, c))}, effective ${nw(fmtD(dec.effective, c))}` : m.dk === 'effective' ? `, effective ${nw(fmtD(last.date, c))}` : ` on ${nw(fmtD(last.date, c))}`;
  const gap = prev ? Math.round((last.t - prev.t) / DAY) : 0;
  const after = prev && gap >= 90 ? `, after ${monthsWord(gap)} unchanged at ${B(vText(last.prev))}` : '';
  const since = Math.round((asOf - last.t) / DAY);
  if (last.action === 'framework') return `${m.subj} moved to a target range of ${B(vText(last))}${when}.`;
  if (since <= 45) return `${m.subj} ${verb} ${m.noun} by ${B(Math.abs(last.chg) + ' bps')} to ${val}${when}, its ${moveContext(last)}${after}.`;
  return `${m.subj} has held ${m.noun} at ${B(vText(last))} for ${span(since)}. Its last move was a ${Math.abs(last.chg)} bps ${last.dir}${when}.`;
}
function levelInfo(c) {
  const md = MODEL[c], t0 = Math.max(fromT(c), md.first.t), now = md.last.hi; let below = 0, eq = 0, tot = 0;
  const bins = new Map(), pts = md.recs.filter(r => r.t > t0);
  let t = t0, r = valueAt(c, t0);
  for (const nx of [...pts, null]) {
    const e = nx ? nx.t : T_TODAY, d = Math.max(0, e - t); tot += d;
    if (r.hi < now) below += d; else if (r.hi === now) eq += d;
    const b = Math.floor(r.hi / 100); bins.set(b, (bins.get(b) || 0) + d);
    if (nx) { t = nx.t; r = nx; }
  }
  return { pBelow: below / tot, pAbove: (tot - below - eq) / tot, bins, now, t0 };
}
function cycleInfo(c) {
  const md = MODEL[c], cur = md.cycles.at(-1), past = md.cycles.slice(0, -1).filter(cy => cy.dir === cur.dir && cy.moves.length >= 2);
  const r = v => (v == null ? null : Math.round(v));
  return { cur, past, medTotal: r(median(past.map(p => p.total))), medDays: r(median(past.map(p => p.days))), holding: Math.round((T_TODAY - cur.end.t) / DAY), elapsed: Math.round((T_TODAY - cur.start.t) / DAY) };
}
function gapSeries(c, b = bench(c)) {
  const t0 = Math.max(MODEL[c].first.t, MODEL[b].first.t, fromT(c), fromT(b));
  const ts = [...new Set([t0, ...MODEL[c].recs.map(r => r.t), ...MODEL[b].recs.map(r => r.t)])].filter(t => t >= t0 && t <= T_TODAY).sort((x, y) => x - y);
  const pts = []; ts.forEach(t => { const s = valueAt(c, t).hi - valueAt(b, t).hi; if (!pts.length || pts.at(-1).s !== s) pts.push({ t, s }); });
  return { pts, t0, b };
}
function gapInfo(c) {
  const { pts, b, t0 } = gapSeries(c), s = pts.at(-1).s;
  let ya = pts[0]; for (const p of pts) if (p.t <= T_TODAY - 365 * DAY) ya = p;
  const yearAgo = ya.s;
  let below = 0, above = 0, tot = 0, wide = pts[0], narrow = pts[0];
  pts.forEach((p, i) => { const e = pts[i + 1] ? pts[i + 1].t : T_TODAY, d = e - p.t; tot += d; if (p.s < s) below += d; else if (p.s > s) above += d; if (p.s > wide.s) wide = p; if (p.s < narrow.s) narrow = p; });
  const pB = below / tot, pA = above / tot;
  const rel = s >= 0 ? (pA >= pB ? { word: 'narrower', share: pA } : { word: 'wider', share: pB }) : (pB >= pA ? { word: 'smaller discount', share: pB } : { word: 'deeper discount', share: pA });
  let since = null, dirWord = '';
  if (s !== yearAgo) {
    const narrowing = s < yearAgo;
    for (let i = pts.length - 2; i >= 0; i--) { const p = pts[i]; if (narrowing ? p.s <= s : p.s >= s) { since = pts[i + 1] ? pts[i + 1].t - DAY : p.t; break; } }
    if (since != null && T_TODAY - since < 365 * DAY) since = null;
    dirWord = narrowing ? (s >= 0 ? 'narrowest' : 'deepest discount') : (s >= 0 ? 'widest' : 'smallest discount');
  }
  return { s, yearAgo, since, dirWord, b, pts, rel, yr: yearOf(t0), t0, wide, narrow };
}
function peers(c) { const list = CODES.map(k => ({ k, v: MODEL[k].last.hi })).sort((a, b) => b.v - a.v); return { list, rank: list.findIndex(p => p.k === c) + 1 }; }
function stanceOfPlay(c) {
  const md = MODEL[c], last = md.policyMoves.at(-1), d = Math.round((T_TODAY - last.t) / DAY), cy = md.cycles.at(-1);
  if (d > 182) return { cls: 'hold', txt: `On hold for ${span(d)}`, short: 'On hold' };
  return { cls: last.dir, txt: `${last.dir === 'hike' ? 'Tightening' : 'Easing'} since ${fmtM(cy.start.t, c)}`, short: last.dir === 'hike' ? 'Tightening' : 'Easing' };
}
function pulseFinding() {
  const win = 90 * DAY, inWin = end => ALLMOVES.filter(m => m.t > end - win && m.t <= end && m.action !== 'framework');
  const now = inWin(T_TODAY), hb = [...new Set(now.filter(m => m.dir === 'hike').map(m => m.c))], cb = [...new Set(now.filter(m => m.dir === 'cut').map(m => m.c))];
  let since = null;
  for (let t = T_TODAY - win; t >= T2000 + win; t -= 7 * DAY) { if (new Set(inWin(t).filter(m => m.dir === 'hike').map(m => m.c)).size >= hb.length) { since = t; break; } }
  const names = a => a.map(k => META[k].short).join(', ');
  const s1 = hb.length ? `${B(hb.length)} of ${CODES.length} central banks raised rates in the last 90 days (${names(hb)})` : 'No central bank in this set raised rates in the last 90 days';
  const s2 = cb.length ? `${cb.length === 1 ? 'one' : WORDS[cb.length]} cut (${names(cb)})` : 'none cut';
  const s3 = hb.length >= 2 ? (since ? `. That is the widest tightening turn since ${new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(since))}` : '. That is the widest tightening turn in this record') : '';
  return { html: `${s1}, and ${s2}${s3}.`, hb, cb };
}

/* ---------- loan arithmetic (standard amortisation) ---------- */
function emi(L, ratePct, months) { const r = ratePct / 1200; return r === 0 ? L / months : L * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1); }
function monthsFor(L, ratePct, P) { const r = ratePct / 1200; if (r * L >= P) return Infinity; return -Math.log(1 - r * L / P) / Math.log(1 + r); }

/* ---------- motion ---------- */
const RM = matchMedia('(prefers-reduced-motion: reduce)'), reduced = () => RM.matches;
const EASE = 'cubic-bezier(.22,.61,.36,1)', EASE_IN = 'cubic-bezier(.4,0,1,1)', SPRING = 'cubic-bezier(.3,1.35,.5,1)';
// Text swap: fade the old text out, the new one in, in the direction of the move. Unchanged text never moves. Inside a
// transaction (a country switch) the swap is queued so every changed text on the page commits on one frame.
const TPL = document.createElement('template');
const norm = h => { TPL.innerHTML = h; return TPL.innerHTML; };
function swap(el, html, dir = 0, instant = false) {
  if (!el) return;
  const want = norm(html);
  if (BATCH && !instant && !reduced()) { if (el.innerHTML === want) BATCH.items.delete(el); else BATCH.items.set(el, { el, html: want, dir }); return; }
  if (el.innerHTML === want) return; el.getAnimations().forEach(a => a.cancel());
  if (instant || reduced()) { el.innerHTML = want; return; }
  const d = dir > 0 ? 1 : dir < 0 ? -1 : 0, dist = d ? 10 : 4;
  const out = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${d >= 0 ? -dist / 2 : dist / 2}px)` }], { duration: 70, easing: EASE_IN, fill: 'forwards' });
  out.onfinish = () => { el.innerHTML = want; out.cancel(); if (want.includes('data-lucide')) makeIcons(); el.animate([{ opacity: 0, transform: `translateY(${d >= 0 ? dist : -dist}px)` }, { opacity: 1, transform: 'none' }], { duration: 170, easing: EASE }); };
}

/* ---------- motion clock: keyed tweens on one rAF loop ---------- */
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t, dx = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => { let t = x; for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6 || !d) break; t -= e / d; } return sy(Math.min(1, Math.max(0, t))); };
}
const easeOut = bezier(0.22, 0.61, 0.36, 1);
const TWEENS = new Map(); let tweenRaf = 0;
function tweenTick(now) {
  tweenRaf = 0;
  for (const [key, tw] of [...TWEENS]) {
    if (TWEENS.get(key) !== tw) continue;
    const raw = Math.min(1, Math.max(0, (now - tw.t0) / tw.dur));
    tw.frame(easeOut(raw));
    if (raw >= 1 && TWEENS.get(key) === tw) { TWEENS.delete(key); tw.done?.(); }
  }
  if (TWEENS.size && !tweenRaf) tweenRaf = requestAnimationFrame(tweenTick);
}
// Starting a tween for a key that is running replaces it; callers start from what is on screen, so nothing jumps.
function tween(key, dur, frame, done) {
  TWEENS.delete(key);
  if (reduced() || dur <= 0) { frame(1); done?.(); return; }
  TWEENS.set(key, { t0: performance.now(), dur, frame, done });
  if (!tweenRaf) tweenRaf = requestAnimationFrame(tweenTick);
}
const tweening = key => TWEENS.has(key);
function lerpState(a, b, p) {
  const o = {};
  for (const k in b) {
    const x = a?.[k], y = b[k];
    if (typeof y === 'number') o[k] = typeof x === 'number' ? x + (y - x) * p : y;
    else if (y && y.length != null && x && x.length === y.length) { const r = new Float64Array(y.length); for (let i = 0; i < y.length; i++) r[i] = x[i] + (y[i] - x[i]) * p; o[k] = r; }
    else o[k] = y;
  }
  return o;
}
// Morph a chart's state (numbers and sampled arrays) from what it shows now to `target`, drawing every frame.
const MORPH_MS = 420;
function morph(st, key, target, draw, animate, done) {
  const from = st.cur;
  if (!animate || !from || reduced()) { TWEENS.delete(key); st.cur = target; draw(target, 1); done?.(); return; }
  tween(key, MORPH_MS, p => { st.cur = lerpState(from, target, p); draw(st.cur, p); }, () => { st.cur = target; draw(target, 1); done?.(); });
}
// A step series sampled onto n fixed columns across [t0, t1]; before the first record it holds the first value.
function sampleStep(c, t0, t1, n, field = 'hi') {
  const r = MODEL[c].recs, out = new Float64Array(n); let k = 0;
  for (let i = 0; i < n; i++) { const t = t0 + (t1 - t0) * i / (n - 1); while (k + 1 < r.length && r[k + 1].t <= t) k++; out[i] = r[k][field]; }
  return out;
}

/* ---------- one transaction per country switch ---------- */
// Every changed text fades out together, commits on one frame, and fades in; rows glide to their new height and the
// blocks inside cards slide to their new places (FLIP). Charts morph on their own clock during the same window.
let BATCH = null, TX = null;
const SETTLE = new Set();
const atCommit = fn => { if (BATCH) BATCH.fns.push(fn); else fn(); };
const onSettle = fn => { if (TX) SETTLE.add(fn); else fn(); };
function transact(apply) {
  TX?.flush();
  if (reduced()) { apply(); return; }
  const rows = [...document.querySelectorAll('#page .row')].filter(r => r.getClientRects().length);
  const blocks = [...document.querySelectorAll('#page .card-head > *, #page .card-body > *, #page .tile > *')];
  const rel = b => b.getBoundingClientRect().top - b.closest('.card, .tile').getBoundingClientRect().top;
  const h0 = rows.map(r => r.getBoundingClientRect().height), top0 = new Map();
  blocks.forEach(b => { if (b.getClientRects().length) top0.set(b, rel(b)); });
  BATCH = { items: new Map(), fns: [] };
  let batch;
  try { apply(); } finally { batch = BATCH; BATCH = null; }
  const items = [...batch.items.values()], anims = [];
  rows.forEach((r, i) => { r.style.height = h0[i] + 'px'; r.classList.add('tx-lock'); });
  const outs = items.map(({ el, dir }) => { el.getAnimations().forEach(a => a.cancel()); return el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${dir > 0 ? -4 : dir < 0 ? 4 : -2}px)` }], { duration: 90, easing: EASE_IN, fill: 'forwards' }); });
  let committed = false, cleaned = false, timer = 0;
  const cleanup = () => {
    if (cleaned) return; cleaned = true;
    rows.forEach(r => { r.style.height = ''; r.classList.remove('tx-lock'); });
    if (TX === tx) TX = null;
    const fns = [...SETTLE]; SETTLE.clear(); fns.forEach(fn => fn());
  };
  const commit = () => {
    if (committed) return; committed = true; clearTimeout(timer);
    items.forEach(({ el, html }) => { el.innerHTML = html; });
    batch.fns.forEach(fn => fn());
    makeIcons();
    outs.forEach(a => a.cancel());
    rows.forEach(r => { r.style.height = ''; });
    const h1 = rows.map(r => r.getBoundingClientRect().height), moved = [];
    top0.forEach((t, b) => { if (!b.isConnected || !b.getClientRects().length) return; const d = t - rel(b); if (Math.abs(d) > 0.5) moved.push([b, d]); });
    rows.forEach((r, i) => { if (Math.abs(h1[i] - h0[i]) > 0.5) anims.push(r.animate([{ height: h0[i] + 'px' }, { height: h1[i] + 'px' }], { duration: 340, easing: EASE })); });
    moved.forEach(([b, d]) => anims.push(b.animate([{ transform: `translateY(${d}px)` }, { transform: 'translateY(0)' }], { duration: 340, easing: EASE, composite: 'add' })));
    items.forEach(({ el, dir }) => anims.push(el.animate([{ opacity: 0, transform: `translateY(${dir > 0 ? 8 : dir < 0 ? -8 : 3}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE })));
    if (anims.length) Promise.allSettled(anims.map(a => a.finished)).then(cleanup); else cleanup();
  };
  const tx = { flush() { commit(); anims.forEach(a => a.finish()); cleanup(); } };
  TX = tx;
  timer = setTimeout(commit, items.length ? 90 : 0);
}

/* ---------- crossfades for visuals whose shape differs between countries ---------- */
function xfadeSvg(svg, render, animate) {
  if (!animate || reduced() || !svg.childNodes.length) { render(); return; }
  const ghost = svg.cloneNode(true);
  ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  ghost.setAttribute('aria-hidden', 'true'); ghost.classList.add('xf-ghost');
  const r = svg.getBoundingClientRect(), pr = svg.parentElement.getBoundingClientRect();
  ghost.style.cssText = `position:absolute;left:${r.left - pr.left}px;top:${r.top - pr.top}px;width:${r.width}px;height:${r.height}px;pointer-events:none`;
  svg.parentElement.appendChild(ghost);
  render();
  svg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: EASE });
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: EASE_IN, fill: 'forwards' }).onfinish = () => ghost.remove();
}
function xfadeFlag(box, c, animate) {
  const src = `vendor/flags/${FLAGS[c]}.svg`, old = box.querySelector('img:not(.leaving)');
  if (old && old.getAttribute('src') === src) return;
  const img = new Image(28, 28); img.src = src; img.alt = ''; img.decoding = 'async';
  if (!old || !animate || reduced()) { box.replaceChildren(img); return; }
  img.style.cssText = 'position:absolute;inset:0;margin:auto'; old.classList.add('leaving');
  box.appendChild(img);
  img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: EASE }).onfinish = () => { box.querySelectorAll('img.leaving').forEach(n => n.remove()); img.style.cssText = ''; };
}
// Lucide keeps data-lucide on the svgs it creates, so a second createIcons() would replace every icon on the page. Strip it.
function makeIcons() { if (!window.lucide || !document.querySelector('i[data-lucide]')) return; lucide.createIcons({ nameAttr: 'data-lucide' }); document.querySelectorAll('svg[data-lucide]').forEach(n => n.removeAttribute('data-lucide')); }
const svgEl = (tag, attrs = {}) => { const n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
function stagger(nodes, base = 0) { if (reduced()) return; [...nodes].forEach((n, i) => n.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: base + Math.min(i * 24, 160), easing: EASE, fill: 'backwards' })); }
function drawIn(root, sel, dur = 600, step = 40) { if (reduced()) return; root.querySelectorAll(sel).forEach((p, i) => { p.setAttribute('pathLength', '1'); p.animate([{ strokeDasharray: '1 2', strokeDashoffset: 1 }, { strokeDasharray: '1 2', strokeDashoffset: 0 }], { duration: dur, delay: Math.min(i * step, 400), easing: EASE, fill: 'backwards' }); }); }
function popIn(nodes, base = 0, origin = 'center') { if (reduced()) return; [...nodes].forEach((d, i) => { d.style.transformBox = 'fill-box'; d.style.transformOrigin = origin; d.animate([{ transform: 'scale(0)' }, { transform: 'none' }], { duration: 380, delay: base + Math.min(i * 30, 240), easing: SPRING, fill: 'backwards' }); }); }
function growIn(nodes, origin, base = 0, step = 12) { if (reduced()) return; [...nodes].forEach((r, i) => { r.style.transformBox = 'fill-box'; r.style.transformOrigin = origin; r.animate([{ transform: origin.startsWith('0') ? 'scaleX(0)' : 'scaleY(0)' }, { transform: 'none' }], { duration: 320, delay: base + Math.min(i * step, 300), easing: EASE, fill: 'backwards' }); }); }
function segc(el, onPick, key) {
  const thumb = el.querySelector('.thumb');
  const place = () => { const b = el.querySelector('button[aria-pressed="true"]'); if (!b || !b.offsetWidth) return; thumb.style.width = b.offsetWidth + 'px'; thumb.style.transform = `translateX(${b.offsetLeft}px)`; };
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); place(); onPick(b.dataset[key]); });
  el.place = place; el.set = v => { el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset[key] === v))); place(); };
  return el;
}
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* per-viewer convenience only */ } } };

/* ---------- flags (HatScripts/circle-flags, MIT, vendored in vendor/flags) ---------- */
const FLAGS = { IN: 'in', US: 'us', EA: 'european_union', GB: 'gb', CA: 'ca', AU: 'au', BR: 'br' };
const flagImg = c => `<img src="vendor/flags/${FLAGS[c]}.svg" alt="" width="28" height="28" decoding="async">`;
const flag = (c, cls = '') => `<span class="disc flag ${cls}" title="${META[c].name}">${flagImg(c)}</span>`;

/* ---------- small marks ---------- */
const GLYPH = {
  hike: '<path d="M5 1.8 8.6 7.8H1.4Z"/>', cut: '<path d="M5 8.2 8.6 2.2H1.4Z"/>',
  hold: '<rect x="1.6" y="4.1" width="6.8" height="1.8" rx=".9"/>', framework: '<path d="M5 1.4 8.6 5 5 8.6 1.4 5Z"/>',
};
const mark = (dir, cls = '') => `<span class="mark ${dir} ${cls}" aria-hidden="true"><svg viewBox="0 0 10 10" fill="currentColor">${GLYPH[dir] || GLYPH.hold}</svg></span>`;
const movePill = (dir, chg) => `<span class="move">${mark(dir)}<span class="num">${dir === 'hold' ? 'Hold' : sgn(chg)}</span></span>`;
