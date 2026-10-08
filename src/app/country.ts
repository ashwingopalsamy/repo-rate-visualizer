/* The country page: decision, insights, loan, transmission, cycle, gap, record, decisions and peers. A country switch
   changes data, never the page (spec §6.5). Ported from the approved prototype (design/prototype/app.js). */
import {
  B, CODES, DAY, META, MODEL, RANKW, T_TODAY, TODAY, WORDS, bps, cap, curSymbol, cycleInfo, dirOf, emi, esc, flag, fmtD, fmtDT, fmtM, fmtNext,
  fmtXM, fromT, gapInfo, isoOf, lede, levelInfo, mark, money, moneyWords, monthsFor, moveContext, movePill, peers, PLURAL, poss, sgn, span,
  stanceOfPlay, tOf, upcoming, valueAt, vBig, voteText, vShort, vText, yearOf, flagSrc,
} from '../lib/atlas.ts';
import type { Code, Decision, Rec } from '../lib/atlas.ts';
import {
  EASE, atCommit, drawIn, flushTransaction, growIn, onSettle, popIn, reduced, segc, stagger, store, swap, transact, xfadeImg, xfadeSvg,
} from '../lib/motion.ts';
import type { Seg } from '../lib/motion.ts';
import { makeIcons } from '../lib/icons.ts';
import { GapChart, GapSpark, GlanceChart, PeerViz, RecordChart, drawCycle, vizCycle, vizLevel } from '../charts/charts.ts';
import type { GapChartApi, RecordChartApi } from '../charts/charts.ts';
import { $, $svg, hideTip, pathFor, showTip, state, sw } from './dom.ts';
import { jump, refreshRail, roll } from './nav.ts';
import { card, footerHTML, kick } from './templates.ts';
import { track } from '../analytics/track.ts';
import type { VIA } from '../analytics/schema.ts';

type Via = (typeof VIA)[number];

const TILES = [{ go: 'record', ic: 'gauge' }, { go: 'cycle', ic: 'repeat' }, { go: 'gap', ic: 'arrow-left-right' }, { go: 'peers', ic: 'globe' }];
const REPLAY_INFO = 'Live shows the verified record. Announced and Decided preview the states this page goes through on decision day.';

export function countryHTML(): string {
  return `
  <h1 class="sr" id="pageTitle"></h1>
  <div class="row">
    ${card('decision', 'span-7', 'The decision', 'landmark',
      kick('landmark', '', 'dKick'),
      `<div class="value-row"><div class="value" id="big"></div><div class="change" id="chg"></div></div>
       <p class="lede" id="lede" data-prose></p>
       <blockquote class="quote" id="quote" data-prose></blockquote>
       <dl class="facts" id="facts" data-prose>${'<div><dt></dt><dd></dd></div>'.repeat(4)}</dl>
       <div class="glance"><div class="glance-chart" id="glance"></div><div class="glance-stats" id="glanceStats">${['A year ago', '5-year high', '5-year low'].map(k => `<div><span>${k}</span><b></b></div>`).join('')}</div></div>`,
      '<span id="dFoot"></span><a id="dSrc" target="_blank" rel="noopener"></a>')}
    <div class="tiles span-5" id="tiles">${TILES.map(t => `<div class="tile" data-go="${t.go}" role="link" tabindex="0"><p class="kick"><i data-lucide="${t.ic}"></i><span class="kt"></span></p><p class="hd" data-prose></p><div class="viz"><svg aria-hidden="true"></svg></div><p class="cap" data-prose></p></div>`).join('')}</div>
  </div>
  <div class="row">
    ${card('loan', 'span-7', 'Your loan', 'wallet',
      `${kick('wallet', 'What it means for a loan')}
       <div class="actions"><div class="seg" id="loanMode"><span class="thumb"></span><button type="button" data-m="decision" aria-pressed="true">This decision</button><button type="button" data-m="since" aria-pressed="false">Since you borrowed</button></div></div>
       <p class="finding" id="loanFinding" data-prose></p>`,
      `<div class="loan">
         <div class="fields">
           <div class="field"><label for="amt">Loan amount</label><div class="input"><span id="curSym"></span><input id="amt" inputmode="numeric" autocomplete="off"></div><div class="presets" id="presets" aria-label="Quick amounts"></div></div>
           <div class="pair">
             <div class="field"><label for="yrs">Years left</label><div class="input"><input id="yrs" inputmode="numeric" autocomplete="off"><span>yrs</span></div></div>
             <div class="field"><label for="rate" id="rateLbl">Your rate before</label><div class="input"><input id="rate" inputmode="decimal" autocomplete="off"><span>%</span></div></div>
           </div>
           <div class="field" id="sinceField" hidden><label for="since">When you borrowed</label><div class="input"><input id="since" type="date"></div></div>
           <p class="prose" id="loanNote" data-prose></p>
         </div>
         <div class="result" id="out" aria-live="polite"><div class="lab" id="oLab"></div><div class="delta" id="oDelta"></div>
           <dl><div><dt id="oK1"></dt><dd class="num" id="oV1"></dd></div><div><dt id="oK2"></dt><dd id="oV2"></dd></div><div><dt>Interest over the loan</dt><dd class="num" id="oV3"></dd></div><div><dt>Rate</dt><dd class="num" id="oV4"></dd></div></dl></div>
       </div>`,
      '<span>Standard amortisation on the balance left. Your lender’s spread and reset date decide when, and how much of this, you see.</span>')}
    ${card('reach', 'span-5', 'How it reaches you', 'route',
      `${kick('route', '', 'txKick')}<p class="finding" id="txHead" data-prose></p>`,
      '<div class="passes" id="passes" data-prose></div>',
      '<span>Your loan agreement’s benchmark and reset clause decide which applies.</span>')}
  </div>
  <div class="row">
    ${card('cycle', 'span-8', 'The cycle', 'repeat',
      `${kick('repeat', 'Where this cycle stands')}<p class="finding" id="cycFinding" data-prose></p>`,
      '<div class="chart ana" id="anaBox"><svg id="ana" role="img" aria-label="This cycle against earlier cycles, in basis points from the start"></svg></div><div class="legend" id="anaLg"></div>')}
    ${card('cycles', 'span-4', 'Every cycle', 'history',
      `${kick('history', '', 'cycKick')}<p class="finding" id="cycListFinding" data-prose></p>`,
      '<div class="fill"><div class="list" id="cycList" tabindex="0" aria-label="Every cycle" data-prose></div></div>')}
  </div>
  <div class="row">
    ${card('gap', 'span-12', 'Against the Fed', 'arrow-left-right',
      `${kick('arrow-left-right', '', 'gapKick')}<p class="finding" id="gapFinding" data-prose></p>`,
      `<div class="chart gapc" id="gapBox"><svg id="gapc" role="img" aria-label="The policy rate gap against the benchmark since 2000, in basis points"></svg></div><div class="legend" id="gapLg"></div><div class="stats" id="gapStats">${'<div><span></span><b></b><em></em></div>'.repeat(4)}</div>`,
      '<span id="gapNote"></span>')}
  </div>
  <div class="row">
    ${card('record', 'span-8', 'The record', 'chart-line',
      `${kick('chart-line', '', 'recKick')}
       <div class="actions"><div class="seg" id="dday" aria-label="Decision-day state"><span class="thumb"></span><button type="button" data-s="live" aria-pressed="true">Live</button><button type="button" data-s="announced" aria-pressed="false">Announced</button><button type="button" data-s="decided" aria-pressed="false">Decided</button></div>
       <button class="ib" id="replay" type="button" aria-label="Replay every move"><i data-lucide="play"></i></button></div>
       <p class="finding" id="recFinding" data-prose></p>`,
      '<div class="chart rec" id="recBox"><svg id="rec" role="img" tabindex="0" aria-label="The policy rate since 2000. Use the arrow keys to step through every move."></svg><div class="stamp" id="stamp"></div></div><div class="legend" id="recLg"></div>',
      '<span id="replayInfo"></span>')}
    ${card('decisions', 'span-4', 'Every decision', 'list-ordered',
      `${kick('list-ordered', '', 'decKick')}<p class="finding" id="decFinding" data-prose></p>`,
      '<div class="fill"><div class="list" id="decList" tabindex="0" aria-label="Every decision" data-prose></div></div>')}
  </div>
  <div class="row">
    ${card('peers', 'span-12', 'Among peers', 'globe',
      `${kick('globe', `Among ${CODES.length} central banks`)}<div class="actions"><a class="btn" href="/world/" data-link>World view<i data-lucide="arrow-right"></i></a></div><p class="finding" id="peerFinding" data-prose></p>`,
      '<div class="ladder" id="ladder"></div>')}
  </div>
  ${footerHTML()}`;
}

/* ---------- 1. the decision ---------- */
// put(): set an element's content. During a country switch the change is queued into the transaction; on first paint it
// is instant. Unchanged content is never touched, so labels that do not change never move.
let painting = false;
const put = (el: Element | null, html: string, dir = 0) => swap(el, html, dir, painting);
const lastMove = (c: Code) => { const p = MODEL[c].policyMoves; return p[p.length - 1]; };

function changeHTML(last: Rec) {
  if (last.action === 'framework') return `<b>${mark('framework')}Range introduced</b><span>from ${vText(last.prev)}</span>`;
  return `<b>${mark(last.dir)}${bps(last.chg)}</b><span>from ${vText(last.prev)}</span>`;
}
type Fact = [string, string, string];
function factsList(pending = false): Fact[] {
  const c = state.code, m = META[c], md = MODEL[c], last = lastMove(c), dec = last.decision, st = stanceOfPlay(c), out: Fact[] = [];
  const nx = upcoming(c)[0], n = nx && fmtNext(nx, c);
  const next: Fact = n ? ['Next decision', n.date, `${n.time} · ${n.inText}`] : ['Next decision', 'Not on our calendar yet', 'Being added'];
  // Announced but unverified: show nothing from the new decision except that it exists.
  if (pending) return [['Announced', 'Today', 'Verifying now'], ['Vote', 'Pending', `With the ${m.doc ?? 'release'}`], ['Stance', 'Pending', `With the ${m.doc ?? 'release'}`], next];
  const ago = Math.round((T_TODAY - last.t) / DAY);
  if (dec) out.push(['Decided', fmtD(dec.date, c), dec.effective && dec.date !== dec.effective ? `Effective ${fmtD(dec.effective, c)}` : ago ? `${span(ago)} ago` : 'Effective today']);
  else out.push(['Effective', fmtD(last.date, c), ago ? `${span(ago)} ago` : 'Today']);
  const v = voteText(dec?.vote ?? null);
  if (v) out.push(['Vote', v.tally, v.sub]);
  if (dec?.stance) {
    const prev = [...md.decisions].reverse().find(d => d.t < dec.t && d.stance && d.stance !== dec.stance);
    out.push(['Stance', cap(dec.stance), prev ? `Was ${prev.stance}` : '']);
  }
  if (out.length < 3) out.push(['Cycle', st.short, st.cls === 'hold' ? st.txt.replace('On hold for ', 'For ') : st.txt.replace(/^\w+ /, '')]);
  if (out.length < 3) {
    const yr = md.policyMoves.filter(x => x.t > T_TODAY - 365 * DAY), h = yr.filter(x => x.dir === 'hike').length, ct = yr.length - h;
    out.push(['Moves in 12 months', String(yr.length), [h && `${h} hike${h > 1 ? 's' : ''}`, ct && `${ct} cut${ct > 1 ? 's' : ''}`].filter(Boolean).join(', ') || 'None']);
  }
  out.push(next);
  return out;
}
function renderFacts(list: Fact[], instant = painting) {
  Array.from($('facts').children).forEach((cell, i) => { const [k, v, s] = list[i]; swap(cell.firstElementChild, esc(k), 0, instant); swap(cell.lastElementChild, `${v}${s ? `<span>${s}</span>` : ''}`, 0, instant); });
}
function renderHero(dir = 0, instant = painting) {
  const c = state.code, m = META[c], md = MODEL[c], last = lastMove(c), dec = last.decision, set = (el: Element | null, h: string, d = dir) => swap(el, h, d, instant);
  set($('dKick'), esc(`${m.bank} · ${m.inst}`), 0);
  set($('pageTitle'), esc(`${m.name}: ${m.inst.toLowerCase()} ${vText(md.last)}`), 0);
  set($('big'), vBig(md.last)); set($('chg'), changeHTML(last)); set($('lede'), lede(c));
  const quote = dec?.excerpt ? `“${esc(dec.excerpt)}”<cite>${m.body}, ${fmtD(dec.date, c)}</cite>` : '';
  if (quote) set($('quote'), quote, 0);
  atCommit(() => { $('quote').hidden = !quote; });
  renderFacts(factsList(), instant);
  set($('dFoot'), esc(md.release ? `${md.sources} official sources · release ${md.release}` : `Official series from the ${m.bank}`), 0);
  if (dec?.url) set($('dSrc'), `Read the ${m.doc ?? 'release'}<i data-lucide="arrow-up-right"></i>`, 0);
  atCommit(() => { const a = $<HTMLAnchorElement>('dSrc'); a.hidden = !dec?.url; if (dec?.url) a.href = dec.url; });
  renderGlance(!instant);
}
let glance: ReturnType<typeof GlanceChart> | null = null;
function renderGlance(animate: boolean) {
  const c = state.code;
  let stats: [Rec, Rec, Rec];
  if (glance && !state.ssr) { const g = glance.update(c, animate); stats = [g.yearAgo, g.hi5, g.lo5]; }
  else { const t0 = T_TODAY - 5 * 365.25 * DAY, pts = [{ ...valueAt(c, t0) }, ...MODEL[c].recs.filter(r => r.t > t0)]; stats = [valueAt(c, T_TODAY - 365 * DAY), pts.reduce((a, r) => (r.hi > a.hi ? r : a)), pts.reduce((a, r) => (r.lo < a.lo ? r : a))]; }
  Array.from($('glanceStats').children).forEach((cell, i) => put(cell.lastElementChild, vShort(stats[i])));
}
export function setPhoneTitle(text: string) {
  const slot = $('mTitle'), cur = slot.querySelector('.crumb:not(.leaving)');
  if (cur?.textContent === text) return;
  roll(slot, `<span>${esc(text)}</span>`, 'down', !cur || state.ssr);
}
/** The page title: what the rate is and what the bank last did, e.g. "RBI policy repo rate: 5.50%, raised 7 Oct 2026". */
export function countryTitle(c: Code): string {
  const m = META[c], md = MODEL[c], mv = lastMove(c), d = md.decisions[md.decisions.length - 1];
  const held = !!d && dirOf(d.dir) === 'hold' && d.t > mv.t;
  const verb = held ? 'held' : mv.action === 'framework' ? 'set' : mv.dir === 'hike' ? 'raised' : 'cut';
  return `${m.short} ${m.noun.replace(/^(the|its) /, '')}: ${vText(md.last)}, ${verb} ${fmtD(held ? d.date : mv.date, 'GB')} · Policy Rate Atlas`;
}
/** The country chip, phone flag button, document title and toolbar meta. */
export function renderChip(dir = 0) {
  const c = state.code, m = META[c], md = MODEL[c], animate = !painting && !state.ssr;
  xfadeImg($('chFlag'), flagSrc(c), animate); xfadeImg($('mFlag'), flagSrc(c), animate);
  $('openPal').dataset.c = c; $('mFlag').setAttribute('aria-label', `Switch country. Showing ${m.name}`);
  swap($('chName'), esc(m.name), dir, !animate); swap($('chVal'), vShort(md.last), dir, !animate);
  const world = state.page === 'world';
  setPhoneTitle(world ? 'World' : state.page === 'privacy' ? 'Privacy' : state.page === 'notfound' ? 'Not found' : m.name);
  if (state.page === 'country') document.title = countryTitle(c);
  swap($('crumbMeta'), esc(world ? `${CODES.length} central banks · as of ${fmtD(TODAY, 'GB')}` : state.page === 'privacy' ? 'How this site measures traffic' : state.page === 'notfound' ? 'Nothing at this address' : `${m.name} · ${m.bank}`), 0, !animate);
}

/* ---------- insight tiles: four fixed tiles; their words swap and their visuals morph or crossfade ---------- */
let tileViz: null | { sizes: [number, number][]; svgs: SVGSVGElement[]; gap: ReturnType<typeof GapSpark>; peers: ReturnType<typeof PeerViz> } = null;
function tileTexts(c: Code) {
  const L = levelInfo(c), C = cycleInfo(c), G = gapInfo(c), P = peers(c), bName = META[G.b].short, y0 = yearOf(L.t0), kind = C.cur.dir === 'hike' ? 'tightening' : 'easing';
  const above = P.list.slice(P.rank).map(p => META[p.k].short);
  return [
    { lab: 'How high it is', hd: L.pBelow < L.pAbove ? `Lower than on ${B(Math.round(L.pAbove * 100) + '%')} of days since ${y0}` : `Higher than on ${B(Math.round(L.pBelow * 100) + '%')} of days since ${y0}`, cap: `Days at each level since ${y0}. Today’s level is in colour.` },
    { lab: 'Where in the cycle', hd: C.holding > 182 ? `On hold for ${span(C.holding)} after ${kind}` : `${cap(kind)}, ${B(bps(C.cur.total))} so far`,
      cap: C.past.length === 1 ? `The previous ${kind} cycle ran ${bps(C.past[0].total)} over ${span(C.past[0].days)}.` : C.medTotal != null ? `${cap(WORDS[C.past.length] ?? String(C.past.length))} earlier ${kind} cycles ran a median ${bps(C.medTotal)} over ${span(C.medDays ?? 0)}.` : `No earlier ${kind} cycle of two or more moves.` },
    { lab: `Against the ${bName}`, hd: `${B(bps(G.s))} ${G.s >= 0 ? 'above' : 'below'} the ${bName}, ${G.rel.word} than on ${B(Math.round(G.rel.share * 100) + '%')} of days since ${G.yr}`, cap: G.yearAgo !== G.s ? `A year ago the gap was ${bps(G.yearAgo)}.` : 'The same gap as a year ago.' },
    { lab: `Among ${CODES.length} central banks`, hd: `The ${B(RANKW(P.rank))} policy rate of the ${WORDS[CODES.length]}`, cap: above.length ? `Above the ${above.slice(0, -1).join(', ')}${above.length > 1 ? ' and ' : ''}${above[above.length - 1]}.` : 'The lowest of the set.' },
  ];
}
const tileSizes = (): [number, number][] => Array.from($('tiles').children).map(el => { const v = el.querySelector('.viz') as HTMLElement; return [Math.max(120, Math.round(v.clientWidth)), Math.max(48, Math.min(132, Math.round(v.clientHeight)))]; });
function buildTileViz() {
  const sizes = tileSizes(), svgs = Array.from($('tiles').querySelectorAll<SVGSVGElement>('.viz > svg:not(.xf-ghost)'));
  tileViz = { sizes, svgs, gap: GapSpark(svgs[2], ...sizes[2]), peers: PeerViz(svgs[3], ...sizes[3]) };
}
function renderTiles(mode: 'first' | 'switch' | 'static') {
  const c = state.code, texts = tileTexts(c), tiles = Array.from($('tiles').children) as HTMLElement[], switching = mode === 'switch';
  tiles.forEach((el, i) => { put(el.querySelector('.kt'), esc(texts[i].lab)); put(el.querySelector('.hd'), texts[i].hd); put(el.querySelector('.cap'), texts[i].cap); el.setAttribute('aria-label', `${texts[i].lab}: open the detail`); });
  if (state.ssr) return;
  if (!switching || !tileViz) buildTileViz();
  const tv = tileViz!, simple = (i: number, viz: typeof vizLevel) => { const [VW, VH] = tv.sizes[i]; tv.svgs[i].setAttribute('viewBox', `0 0 ${VW} ${VH}`); tv.svgs[i].innerHTML = viz(c, VW, VH); };
  xfadeSvg(tv.svgs[0], () => simple(0, vizLevel), switching); xfadeSvg(tv.svgs[1], () => simple(1, vizCycle), switching);
  tv.gap.update(c, switching); tv.peers.update(c);
  if (mode === 'first') { const host = $('tiles'); growIn(host.querySelectorAll('.vb'), '50% 100%', 120, 14); growIn(host.querySelectorAll('.vx'), '0 50%', 160); drawIn(host, 'path.draw', 700); popIn(host.querySelectorAll('.vd'), 200); }
  // Text in a tile can change its height; once the switch settles, redraw any visual whose box changed.
  if (switching) onSettle(() => {
    const now = tileSizes();
    if (!now.some((s, i) => Math.abs(s[0] - tileViz!.sizes[i][0]) > 2 || Math.abs(s[1] - tileViz!.sizes[i][1]) > 2)) return;
    buildTileViz(); const t2 = tileViz!;
    [0, 1].forEach(i => xfadeSvg(t2.svgs[i], () => { const [VW, VH] = t2.sizes[i]; t2.svgs[i].setAttribute('viewBox', `0 0 ${VW} ${VH}`); t2.svgs[i].innerHTML = (i ? vizCycle : vizLevel)(state.code, VW, VH); }, true));
    t2.gap.update(state.code, false); t2.peers.update(state.code);
  });
}
function wireSource() { $('dSrc').addEventListener('click', () => track('source_click', { cc: state.code })); }
function wireTiles() { $('tiles').querySelectorAll<HTMLElement>('.tile').forEach(t => { const go = () => { jump(t.dataset.go!); track('tile_open', { cc: state.code, tile: t.dataset.go as 'record' | 'cycle' | 'gap' | 'peers' }); }; t.onclick = go; t.onkeydown = e => { if (e.key === 'Enter') go(); }; }); }

/* ---------- 2. the loan ---------- */
const input = (id: string) => $<HTMLInputElement>(id);
function initLoan() {
  const c = state.code, l = META[c].loan;
  state.loan = { amt: l.amt, yrs: l.yrs, rate: l.rate, since: isoOf(T_TODAY - Math.round(3 * 365.25) * DAY) };
  put($('curSym'), esc(curSymbol(c)));
  put($('presets'), [0.5, 1, 2].map(k => `<button type="button" data-v="${l.amt * k}" aria-pressed="${k === 1}">${moneyWords(l.amt * k, c)}</button>`).join(''));
  atCommit(() => {
    input('amt').value = new Intl.NumberFormat(META[c].moneyLocale).format(l.amt); input('yrs').value = String(l.yrs); input('rate').value = String(l.rate); input('since').value = state.loan.since;
    input('since').min = isoOf(Math.max(fromT(c), MODEL[c].first.t)); input('since').max = TODAY;
  });
}
const pressPresets = () => $('presets').querySelectorAll<HTMLElement>('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v! === state.loan.amt)));
function renderLoan(instant = painting) {
  const c = state.code, m = META[c], l = m.loan, md = MODEL[c], last = lastMove(c), set = (el: Element | null, h: string) => swap(el, h, 0, instant);
  const { amt, yrs, rate, since } = state.loan, n = Math.round(yrs * 12);
  let d: number | null = null, label: string;
  atCommit(() => { $('sinceField').hidden = state.loanMode !== 'since'; $('loanNote').hidden = state.loanMode === 'since'; });
  if (state.loanMode === 'decision') { d = last.chg; label = `If the ${m.short}’s ${bps(d)} reaches your loan`; set($('rateLbl'), 'Your rate before'); }
  else {
    set($('rateLbl'), 'Your rate then');
    const t = since ? tOf(since) : null;
    if (t) d = md.last.hi - valueAt(c, Math.max(md.first.t, t)).hi;
    label = t ? `${m.short} moves since ${fmtD(since, c)} add up to ${d == null ? '' : bps(d)}` : 'Pick the date you borrowed';
  }
  set($('loanNote'), `Defaults model a ${moneyWords(l.amt, c)} ${l.product}. Change any field.`);
  set($('oLab'), label);
  const word = l.word, Word = cap(word);
  set($('oK1'), Word); set($('oK2'), `Or keep the ${word}`);
  if (!(amt > 0) || !(n > 0) || !(rate >= 0) || d == null) {
    set($('oDelta'), d == null ? 'Pick a date' : 'Check the fields');
    ['oV1', 'oV2', 'oV3', 'oV4'].forEach(id => set($(id), '—'));
    set($('loanFinding'), `What ${m.short} decisions mean for your ${l.word}`); return;
  }
  const to = rate + d / 100, p0 = emi(amt, rate, n), p1 = emi(amt, to, n), dp = p1 - p0, months = monthsFor(amt, to, p0), dir = dp > 0.5 ? 'hike' : dp < -0.5 ? 'cut' : 'hold';
  const tenure = Math.abs(dp) < 0.5 ? 'No change' : !isFinite(months) ? `${Word} no longer covers interest` : dp > 0 ? `${Math.round(months - n)} more months` : `${Math.round(n - months)} fewer months`;
  set($('oDelta'), `${mark(dir)}${dp >= 0 ? '+' : '−'}${money(Math.abs(dp), c)}<small>a month</small>`);
  set($('oV1'), `${money(p0, c)} → ${money(p1, c)}`); set($('oV2'), tenure);
  set($('oV3'), `${dp >= 0 ? '+' : '−'}${money(Math.abs(dp * n), c)}`); set($('oV4'), `${rate.toFixed(2)}% → ${to.toFixed(2)}%`);
  set($('loanFinding'), state.loanMode === 'decision'
    ? `On a ${B(moneyWords(amt, c))} loan over ${yrs} years, this ${last.dir} ${dp >= 0 ? 'adds' : 'takes off'} about ${B(money(Math.abs(dp), c))} a month`
    : `Since you borrowed, ${m.short} moves ${dp >= 0 ? 'add' : 'take off'} about ${B(money(Math.abs(dp), c))} a month`);
}
let loanSeg: Seg | null = null, ddaySeg: Seg | null = null;
let loanTracked = false;
const trackLoan = () => { if (loanTracked) return; loanTracked = true; track('loan_calc', { cc: state.code, mode: state.loanMode }); };
function wireLoan() {
  const num = (s: string) => +String(s).replace(/[^\d.]/g, '');
  input('amt').addEventListener('input', e => { state.loan.amt = num((e.target as HTMLInputElement).value); pressPresets(); renderLoan(true); trackLoan(); });
  $('presets').addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('button'); if (!b) return; state.loan.amt = +b.dataset.v!; input('amt').value = new Intl.NumberFormat(META[state.code].moneyLocale).format(state.loan.amt); pressPresets(); renderLoan(false); trackLoan(); });
  input('amt').addEventListener('blur', e => { if (state.loan.amt > 0) (e.target as HTMLInputElement).value = new Intl.NumberFormat(META[state.code].moneyLocale).format(state.loan.amt); });
  input('yrs').addEventListener('input', e => { state.loan.yrs = num((e.target as HTMLInputElement).value); renderLoan(true); trackLoan(); });
  input('rate').addEventListener('input', e => { state.loan.rate = num((e.target as HTMLInputElement).value); renderLoan(true); trackLoan(); });
  input('since').addEventListener('change', e => { state.loan.since = (e.target as HTMLInputElement).value; renderLoan(false); trackLoan(); });
  loanSeg = segc($('loanMode'), v => { state.loanMode = v as 'decision' | 'since'; renderLoan(false); loanTracked = false; trackLoan(); }, 'm');
}
function renderReach() {
  const c = state.code, m = META[c], md = MODEL[c], words: Record<string, string> = { direct: 'Direct', lagged: 'Lagged', none: 'None', weak: 'Weak' };
  const where = m.name === 'United States' ? 'the US' : m.name === 'United Kingdom' ? 'the UK' : m.name === 'Euro area' ? 'the euro area' : m.name;
  put($('txKick'), esc(`How it reaches loans in ${where}`));
  put($('txHead'), esc(m.txHead));
  put($('passes'), md.tx.map(p => `<div class="pass"><b>${esc(p.product)}</b><span class="pill">${words[p.passThrough] ?? cap(p.passThrough)}</span>
    <dl><div><dt>Priced off</dt><dd>${esc(p.benchmark)}</dd></div><div><dt>Resets</dt><dd>${esc(p.reset)}</dd></div></dl><span>${esc(p.note)}</span></div>`).join(''));
}

/* ---------- 3. the cycle ---------- */
function renderCycle(mode: 'first' | 'switch' | 'static') {
  const c = state.code, md = MODEL[c], svg = $svg('ana');
  let C = cycleInfo(c);
  if (!state.ssr) xfadeSvg(svg, () => { C = drawCycle(svg, c); }, mode === 'switch');
  const kind = C.cur.dir === 'hike' ? 'tightening' : 'easing', subj = META[c].subj;
  put($('cycFinding'), C.holding > 182
    ? `${subj} last ${C.cur.dir === 'hike' ? 'raised' : 'cut'} rates ${span(C.holding)} ago. That ${kind} cycle moved ${B(bps(C.cur.total))} in ${span(C.cur.days || 1)}${C.medTotal != null ? `, against a median of ${B(bps(C.medTotal))} for earlier ones` : ''}.`
    : C.past.length === 1 ? `This ${kind} cycle is ${B(bps(C.cur.total))} in. The previous one ran ${B(bps(C.past[0].total))} over ${span(C.past[0].days)}.`
    : C.medTotal != null ? `This ${kind} cycle is ${B(bps(C.cur.total))} in. The ${WORDS[C.past.length] ?? C.past.length} before it ran a median ${B(bps(C.medTotal))} over ${span(C.medDays ?? 0)}.`
    : `This ${kind} cycle is ${B(bps(C.cur.total))} in, with no earlier ${kind} cycle of two or more moves to compare.`);
  const col = C.cur.dir === 'hike' ? 'hawk' : 'dove';
  put($('anaLg'), `<span><i class="ln" style="background:var(--${col})"></i>This cycle</span><span><i class="ln" style="background:var(--other)"></i>Earlier ${kind} cycles, by start year</span>${C.medTotal != null && C.past.length > 1 ? `<span><i class="ln" style="background:repeating-linear-gradient(90deg,var(--ink-3) 0 3px,transparent 3px 6px)"></i>Median total</span>` : ''}`);
  const list = md.cycles.slice().reverse(), mx = Math.max(...list.map(cy => Math.abs(cy.total)), 25);
  const nh = md.cycles.filter(cy => cy.dir === 'hike').length, nc = md.cycles.length - nh;
  put($('cycKick'), `Every cycle since ${yearOf(fromT(c))}`);
  put($('cycListFinding'), `${cap(WORDS[nh] ?? String(nh))} tightening and ${WORDS[nc] ?? nc} easing cycles. Hover one to trace it.`);
  put($('cycList'), list.map(cy => `<div class="item" data-ci="${cy.i}">${mark(cy.dir)}<span class="title">${cy.dir === 'hike' ? 'Tightening' : 'Easing'}${cy === C.cur ? ' · latest' : ''}</span><span class="fig">${sgn(cy.total)}</span>
      <span class="sub">${fmtM(cy.start.t, c)}${cy.moves.length > 1 ? ` to ${fmtM(cy.end.t, c)}` : ''} · ${cy.moves.length} move${cy.moves.length > 1 ? 's' : ''}</span>
      <span class="bar"><i style="width:${Math.abs(cy.total) / mx * 100}%;--c:var(--${cy.dir === 'hike' ? 'hawk' : 'dove'})"></i></span></div>`).join(''));
  atCommit(() => { $('cycList').scrollTop = 0; });
  if (mode === 'first') { drawIn(svg, 'path.past', 600, 50); drawIn(svg, 'path.now', 800, 0); popIn(svg.querySelectorAll('.nowdot'), 600); }
}
function wireCycle() {
  const box = $('anaBox'), list = $('cycList');
  const hl = (ci: string | null) => { box.classList.toggle('hl', ci != null); box.querySelectorAll<SVGElement>('.past').forEach(p => p.classList.toggle('on', p.dataset.ci === ci)); list.querySelectorAll<HTMLElement>('.item').forEach(r => r.classList.toggle('on', r.dataset.ci === ci)); };
  box.addEventListener('pointerover', e => {
    const p = (e.target as Element).closest<SVGElement>('#ana .past'); if (!p) return; hl(p.dataset.ci ?? null);
    const cy = MODEL[state.code].cycles[+p.dataset.ci!]; if (!cy) return;
    showTip(`<div class="t-title">${cy.dir === 'hike' ? 'Tightening' : 'Easing'} from ${fmtM(cy.start.t, state.code, true)}</div><div class="t-rule"></div><div class="t-row"><span>Total</span><span class="t-num">${bps(cy.total)}</span></div><div class="t-row"><span>Moves</span><span class="t-num">${cy.moves.length}</span></div><div class="t-row"><span>Lasted</span><span>${span(cy.days || 1)}</span></div><div class="t-row"><span>Rate</span><span class="t-num">${vShort(cy.from)} → ${vShort(cy.end)}</span></div>`, (e as PointerEvent).clientX, (e as PointerEvent).clientY);
  });
  box.addEventListener('pointerout', e => { if ((e.target as Element).closest('.past')) { hl(null); hideTip(); } });
  list.addEventListener('pointerover', e => { const r = (e.target as Element).closest<HTMLElement>('.item'); if (r) hl(r.dataset.ci ?? null); });
  list.addEventListener('pointerleave', () => hl(null));
}

/* ---------- 4. against the benchmark ---------- */
let gapChart: GapChartApi | null = null;
function renderGap(mode: 'first' | 'switch' | 'static') {
  const c = state.code, cm = META[c];
  const G = gapChart && !state.ssr ? (state.gapGeom = gapChart.update(c, mode === 'switch')).G : gapInfo(c);
  const b = G.b, bm = META[b];
  $('gap').dataset.name = `Against the ${bm.short}`;
  put($('gapKick'), `Against the ${bm.short}`);
  put($('gapFinding'), `${poss(cm.name)} ${cm.inst.toLowerCase()} sits ${B(Math.abs(G.s) + ' bps')} ${G.s >= 0 ? 'above' : 'below'} the ${bm.short}${MODEL[b].last.range ? '’s upper bound' : ''}: a ${G.rel.word}${G.s >= 0 ? ' gap' : ''} than on ${B(Math.round(G.rel.share * 100) + '%')} of days since ${G.yr}${G.since ? `, and the ${G.dirWord} since ${fmtM(G.since, c, true)}` : ''}.`);
  put($('gapLg'), `<span><i class="sw" style="background:var(--gap);opacity:.7"></i>${cm.name} minus ${bm.name}, in bps</span><span><i class="ln" style="background:var(--ink-3)"></i>Zero: the same rate</span>`);
  const st: [string, string, string][] = [['Gap today', bps(G.s), fmtD(TODAY, c)], ['A year ago', bps(G.yearAgo), fmtD(isoOf(T_TODAY - 365 * DAY), c)], [`Widest since ${G.yr}`, bps(G.wide.s), fmtM(G.wide.t, c)], [`Narrowest since ${G.yr}`, bps(G.narrow.s), fmtM(G.narrow.t, c)]];
  Array.from($('gapStats').children).forEach((cell, i) => { const [k, v, s2] = st[i]; put(cell.children[0], esc(k)); put(cell.children[1], v); put(cell.children[2], esc(s2)); });
  const mine = PLURAL[c], rival = PLURAL[b], cur = c === 'BR' ? 'the real' : `the ${cm.curName}`;
  put($('gapNote'), G.s >= 0
    ? `Holding ${mine} earns more than holding ${rival}, which supports ${cur}; a narrowing gap removes some of that support. One input among many, not a forecast.`
    : `Holding ${mine} earns less than holding ${rival}, a headwind for ${cur}. One input among many, not a forecast.`);
  if (mode === 'first' && !state.ssr) { drawIn($svg('gapc'), 'path.line', 900); if (!reduced()) $svg('gapc').querySelector('.area')?.animate([{ opacity: 0 }, { opacity: 0.16 }], { duration: 700, easing: EASE }); }
  refreshRail();
}
function wireGap() {
  const svg = $svg('gapc');
  svg.addEventListener('pointermove', e => {
    const g = state.gapGeom; if (!g) return;
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (g.W / r.width), t = Math.min(g.t1, Math.max(g.t0, g.inv(px)));
    const cur = $svg('gCur'); cur.setAttribute('x1', String(g.x(t))); cur.setAttribute('x2', String(g.x(t))); cur.classList.add('on');
    const b = g.G.b, a = valueAt(state.code, t), o = valueAt(b, t);
    showTip(`<div class="t-title">${fmtDT(t, state.code)}</div><div class="t-rule"></div><div class="t-row"><span>${sw('var(--ink)')}${META[state.code].name}</span><span class="t-num">${vShort(a)}</span></div><div class="t-row"><span>${sw('var(--ink-3)')}${META[b].name}</span><span class="t-num">${vShort(o)}</span></div><div class="t-row"><span>${sw('var(--gap)')}Gap</span><span class="t-num">${bps(a.hi - o.hi)}</span></div>`, e.clientX, e.clientY);
  });
  svg.addEventListener('pointerleave', () => { $svg('gCur')?.classList.remove('on'); hideTip(); });
}

/* ---------- 5. the record ---------- */
let recChart: RecordChartApi | null = null;
const seen = new Set<Code>();
function renderRecord(mode: 'first' | 'switch' | 'static') {
  const c = state.code, md = MODEL[c], F = fromT(c);
  if (recChart && !state.ssr) state.recGeom = recChart.update(c, mode === 'switch');
  const pol = md.recs.filter(r => r.t >= F).concat(valueAt(c, F)), hi = pol.reduce((a, r) => (r.hi > a.hi ? r : a)), lo = pol.reduce((a, r) => (r.lo < a.lo ? r : a));
  const anyRange = md.recs.some(r => r.t >= F && r.range), hasObs = F > Math.max(md.first.t, Date.UTC(2000, 0, 1));
  put($('recKick'), `The record since ${yearOf(Math.max(Date.UTC(2000, 0, 1), md.first.t))}`);
  put($('recFinding'), `${B(md.policyMoves.length)} moves since ${fmtM(F, c, true)}, from a high of ${B(vText(hi))} in ${fmtM(hi.t, c)} to a low of ${B(vText(lo))} in ${fmtM(lo.t, c)}.`);
  put($('recLg'), `<span><i class="ln" style="background:var(--ink)"></i>${META[c].inst}</span>${anyRange ? '<span><i class="sw" style="background:var(--level);opacity:.45"></i>Target range</span>' : ''}<span>${mark('hike', 'sm')}Hike</span><span>${mark('cut', 'sm')}Cut</span>${hasObs ? '<span><i class="sw" style="background:var(--obs);opacity:.35"></i>Pre-2004 observations, not used in findings</span>' : ''}`);
  put($('replayInfo'), REPLAY_INFO);
  if (mode === 'first' && !state.ssr && !reduced() && !seen.has(c)) { seen.add(c); reveal(900); }
}
const setReplayInfo = (txt?: string) => { $('replayInfo').textContent = txt ?? REPLAY_INFO; };
let revRaf = 0;
function reveal(dur: number) {
  cancelAnimationFrame(revRaf);
  const g = state.recGeom!, rr = $svg('revealRect'), head = $svg('head'); rr.setAttribute('width', '0');
  const st = performance.now() + 200, ease = (p: number) => 1 - Math.pow(1 - p, 3);
  const tick = (now: number) => {
    if (state.recGeom !== g) { rr.setAttribute('width', String(g.W)); head.style.opacity = '0'; return; }
    const p = Math.min(1, Math.max(0, (now - st) / dur)), px = g.M.l + ease(p) * (g.W - g.M.l - g.M.r);
    rr.setAttribute('width', String(p >= 1 ? g.W : px));
    const t = g.inv(px), r = valueAt(state.code, t);
    if (p > 0 && p < 1 && t >= MODEL[state.code].first.t) { head.setAttribute('cx', String(px)); head.setAttribute('cy', String(g.y(r.hi))); head.style.opacity = '1'; } else head.style.opacity = '0';
    if (p < 1) revRaf = requestAnimationFrame(tick); else head.style.opacity = '0';
  };
  revRaf = requestAnimationFrame(tick);
}
type Row = { t: number; move: Rec | null | undefined; dir: string; title: string; fig: string; sub: string };
function decisionRows(): Row[] {
  const c = state.code, md = MODEL[c];
  if (md.decisions.length) return md.decisions.slice().reverse().map((d: Decision) => {
    const dir = dirOf(d.dir), r = { lo: d.lo, hi: d.hi, range: d.lo !== d.hi }, move = md.policyMoves.find(m => m.decision === d), v = voteText(d.vote);
    return { t: move ? move.t : d.te, move, dir, title: dir === 'hike' ? `Raised to ${vText(r)}` : dir === 'cut' ? `Cut to ${vText(r)}` : `Held at ${vText(r)}`, fig: dir === 'hold' ? '±0' : sgn(d.change ?? 0), sub: `${fmtD(d.date, c)}${v ? ` · ${v.tally} vote` : ''}${d.offCycle ? ' · unscheduled' : ''}` };
  });
  return md.policyMoves.slice().reverse().map(m => ({ t: m.t, move: m, dir: m.action === 'framework' ? 'framework' : m.dir, title: m.action === 'framework' ? `Range of ${vText(m)}` : `${m.dir === 'hike' ? 'Raised' : 'Cut'} to ${vText(m)}`, fig: sgn(m.chg), sub: `${fmtD(m.date, c)} · ${moveContext(m)}` }));
}
function renderDecisions(mode: 'first' | 'switch' | 'static') {
  const c = state.code, md = MODEL[c], rows = decisionRows();
  if (md.decisions.length) {
    const n = (k: string) => md.decisions.filter(d => dirOf(d.dir) === k).length;
    put($('decKick'), 'Every decision');
    put($('decFinding'), `${B(md.decisions.length)} ${META[c].body} decisions since ${fmtM(md.decisions[0].t, c)}: ${n('hike')} hikes, ${n('cut')} cuts and ${n('hold')} holds.`);
  } else {
    put($('decKick'), 'Every move');
    put($('decFinding'), `${B(md.policyMoves.length)} moves since ${fmtM(fromT(c), c)}. Votes and statements for the ${META[c].short} are being added.`);
  }
  put($('decList'), rows.map(r => `<div class="item" data-t="${r.t}" data-move="${r.move ? 1 : 0}">${mark(r.dir)}<span class="title">${r.title}</span><span class="fig">${r.fig}</span><span class="sub">${r.sub}</span></div>`).join(''));
  atCommit(() => { $('decList').scrollTop = 0; });
  if (mode === 'first' && !state.ssr) stagger(Array.from($('decList').children).slice(0, 12));
}
let activeMk: SVGElement | null = null;
function markOn(t: number | null, scroll = false) {
  activeMk?.classList.remove('on');
  activeMk = t != null ? $svg('rec').querySelector<SVGElement>(`.mk[data-t="${t}"]`) : null;
  activeMk?.classList.add('on');
  $('decList').querySelectorAll('.item.on').forEach(r => r.classList.remove('on'));
  if (t != null) { const it = $('decList').querySelector(`.item[data-t="${t}"]`); if (it) { it.classList.add('on'); if (scroll) it.scrollIntoView({ block: 'nearest' }); } }
}
function wireRecord() {
  const svg = $svg('rec');
  const near = (px: number) => { const g = state.recGeom!; let best: Rec | null = null, bd = 12; for (const m of g.moves) { const d = Math.abs(g.x(m.t) - px); if (d < bd) { bd = d; best = m; } } return best; };
  const scrub = (e: PointerEvent) => {
    const g = state.recGeom; if (!g || state.replaying || state.dday !== 'live') return;
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (g.W / r.width), s = near(px), c = state.code;
    const t = s ? s.t : Math.min(g.t1, Math.max(g.t0, g.inv(px))), v = valueAt(c, t);
    const cur = $svg('rCur'); cur.setAttribute('x1', String(g.x(t))); cur.setAttribute('x2', String(g.x(t))); cur.classList.add('on');
    markOn(s ? s.t : null, true);
    const vt = s?.decision?.vote ? voteText(s.decision.vote) : null;
    showTip(s ? `<div class="t-title">${fmtD(s.date, c)}</div><div class="t-sub">${cap(moveContext(s))}</div><div class="t-rule"></div><div class="t-row"><span>${sw(`var(--${s.dir === 'hike' ? 'hawk' : 'dove'})`)}${s.dir === 'hike' ? 'Hike' : 'Cut'}</span><span class="t-num">${bps(s.chg)}</span></div><div class="t-row"><span>New level</span><span class="t-num">${vShort(s)}</span></div>${vt ? `<div class="t-row"><span>Vote</span><span class="t-num">${vt.tally}</span></div>` : ''}<div class="t-row"><span>Held for</span><span>${s.next ? span(Math.round((s.next.t - s.t) / DAY)) : 'to today'}</span></div>`
      : `<div class="t-title">${fmtDT(t, c)}</div><div class="t-sub">${t < fromT(c) ? 'Observation era' : 'In effect'}</div><div class="t-rule"></div><div class="t-row"><span>${sw('var(--level)')}${META[c].inst}</span><span class="t-num">${vShort(v)}</span></div>`, e.clientX, e.clientY);
  };
  svg.addEventListener('pointermove', scrub);
  svg.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') scrub(e); });
  svg.addEventListener('pointerleave', () => { $svg('rCur').classList.remove('on'); markOn(null); hideTip(); });
  svg.addEventListener('keydown', e => {
    const g = state.recGeom; if (!g || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || !g.moves.length) return; e.preventDefault();
    const ms = g.moves, i = activeMk ? ms.findIndex(m => String(m.t) === activeMk!.dataset.t) : ms.length;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? ms.length - 1 : Math.max(0, Math.min(ms.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1))), m = ms[j];
    markOn(m.t, true); setReplayInfo(`${fmtD(m.date, state.code)} · ${m.dir === 'hike' ? 'hike' : 'cut'} of ${Math.abs(m.chg)} bps to ${vText(m)} · ${moveContext(m)}`);
  });
  const list = $('decList');
  list.addEventListener('pointerover', e => {
    const g = state.recGeom, it = (e.target as Element).closest<HTMLElement>('.item'); if (!it || !g || state.replaying || state.dday !== 'live') return;
    const t = +it.dataset.t!, m = MODEL[state.code].policyMoves.find(x => x.t === t), cur = $svg('rCur');
    cur.setAttribute('x1', String(g.x(t))); cur.setAttribute('x2', String(g.x(t))); cur.classList.add('on');
    const tn = $svg('tenure');
    if (m) { const end = m.next ? m.next.t : g.t1; tn.setAttribute('d', `M${g.x(m.t)},${g.y(m.hi)}H${g.x(Math.min(end, g.t1))}`); tn.classList.add('on'); markOn(t); }
    else { tn.classList.remove('on'); markOn(null); it.classList.add('on'); }
  });
  list.addEventListener('pointerleave', () => { $svg('tenure').classList.remove('on'); $svg('rCur').classList.remove('on'); markOn(null); });
  $('replay').addEventListener('click', toggleReplay);
  ddaySeg = segc($('dday'), v => { setDday(v as typeof state.dday); track('dday_preview', { cc: state.code, state: v as typeof state.dday }); }, 's');
}
function setReplayIcon(play: boolean) { $('replay').innerHTML = `<i data-lucide="${play ? 'play' : 'square'}"></i>`; $('replay').setAttribute('aria-label', play ? 'Replay every move' : 'Stop replay'); makeIcons($('replay')); }
function stopReplay(restore = true) {
  if (!state.replaying) return; cancelAnimationFrame(state.replaying.raf); state.replaying = null; setReplayIcon(true); setReplayInfo();
  $svg('head').style.opacity = '0'; markOn(null); $svg('revealRect').setAttribute('width', String(state.recGeom!.W));
  if (restore) { swap($('big'), vBig(MODEL[state.code].last)); swap($('chVal'), vShort(MODEL[state.code].last)); }
}
function toggleReplay() {
  if (state.replaying) { stopReplay(); return; }
  if (state.dday !== 'live') { setDday('live'); ddaySeg?.set('live'); }
  const g = state.recGeom!, ms = g.moves, N = ms.length, c = state.code; if (!N) return;
  if (reduced()) { setReplayInfo(`${N} moves. Replay is off because reduced motion is on.`); return; }
  track('replay', { cc: c });
  const per = Math.max(110, Math.min(260, 9000 / N)), knots = [g.t0, ...ms.map(m => m.t), g.t1], total = per * (knots.length - 1), st = performance.now();
  let lastIdx = -1; setReplayIcon(false); state.replaying = { raf: 0 };
  const tick = (now: number) => {
    if (!state.replaying || state.recGeom !== g) return;
    const p = Math.min(1, (now - st) / total), f = p * (knots.length - 1), k = Math.min(knots.length - 2, Math.floor(f)), t = knots[k] + (knots[k + 1] - knots[k]) * (f - k), px = g.x(t);
    $svg('revealRect').setAttribute('width', String(px));
    const r = valueAt(c, t), head = $svg('head'); head.setAttribute('cx', String(px)); head.setAttribute('cy', String(g.y(r.hi))); head.style.opacity = '1';
    let idx = -1; for (let q = 0; q < N && ms[q].t <= t; q++) idx = q;
    if (idx !== lastIdx && idx >= 0) { lastIdx = idx; const m = ms[idx]; markOn(m.t, true); $('big').innerHTML = vBig(m); setReplayInfo(`${fmtD(m.date, c)} · ${vText(m)} · move ${idx + 1} of ${N}`); }
    if (p < 1) state.replaying.raf = requestAnimationFrame(tick); else stopReplay(true);
  };
  state.replaying.raf = requestAnimationFrame(tick);
}

/* decision day: live, announced (verifying), decided (ceremony) */
function clearDday() {
  if (!$('rec')) return;
  $svg('rec').classList.remove('announced'); ['pending', 'pendline'].forEach(id => $svg(id)?.classList.remove('on')); $('stamp')?.classList.remove('on'); $svg('ceremony')?.setAttribute('d', '');
}
function setDday(s: typeof state.dday) {
  if (state.replaying) stopReplay(false); clearDday(); state.dday = s;
  const c = state.code, last = lastMove(c), prev = last.prev, g = state.recGeom!, rr = $svg('revealRect'), m = META[c];
  if (s === 'live') { rr.setAttribute('width', String(g.W)); renderHero(0, false); setReplayInfo(); return; }
  rr.setAttribute('width', String(Math.max(0, g.x(last.t) - 1)));
  const x0 = g.x(last.t), yA = g.y(prev.hi);
  if (s === 'announced') {
    swap($('big'), vBig(prev)); swap($('chg'), `<b>${mark('hold')}Announced</b><span>verifying the ${m.doc ?? 'release'}</span>`);
    swap($('lede'), `${m.subj} has announced its decision. The record keeps ${B(vText(prev))} until the official ${m.doc ?? 'release'} is checked against ${m.short}’s own site, usually within minutes.`);
    $('quote').hidden = true; renderFacts(factsList(true), false); $svg('rec').classList.add('announced');
    const pe = $svg('pending'), pl = $svg('pendline');
    pe.setAttribute('x', String(x0)); pe.setAttribute('width', String(Math.max(14, g.W - x0 - 2))); pe.setAttribute('y', String(g.M.t)); pe.setAttribute('height', String(g.H - g.M.t - g.M.b)); pe.classList.add('on');
    pl.setAttribute('x1', String(x0)); pl.setAttribute('x2', String(x0)); pl.setAttribute('y1', String(g.M.t)); pl.setAttribute('y2', String(g.H - g.M.b)); pl.classList.add('on');
    const cer = $svg('ceremony'); cer.setAttribute('d', `M${x0 - 1},${yA}H${g.x(g.t1)}`); cer.style.strokeDasharray = '2 4';
    setReplayInfo(`Announced: the page holds ${vText(prev)} and hatches the window until the ${m.doc ?? 'release'} is verified.`);
  }
  if (s === 'decided') { ceremony(last, prev); setReplayInfo(`Decided: verified against ${m.short}. The new level steps in and the change is stamped.`); }
}
function ceremony(last: Rec, prev: Rec) {
  const g = state.recGeom!, rr = $svg('revealRect'), cer = $svg('ceremony'), stamp = $('stamp'), burst = $svg('burst'), x0 = g.x(last.t), yA = g.y(prev.hi), yB = g.y(last.hi), xEnd = g.x(g.t1);
  cer.style.strokeDasharray = '';
  stamp.innerHTML = `${mark(last.dir)}${bps(last.chg)} · ${vText(last)}`;
  const place = () => { const box = $svg('rec').getBoundingClientRect(), k = box.width / g.W; stamp.style.left = Math.min(box.width - stamp.offsetWidth - 4, Math.max(4, x0 * k - stamp.offsetWidth - 14)) + 'px'; stamp.style.top = Math.max(0, Math.min(yA, yB) * k - 40) + 'px'; };
  if (reduced()) { rr.setAttribute('width', String(g.W)); renderHero(0, false); place(); stamp.classList.add('on'); return; }
  rr.setAttribute('width', String(x0 - 1)); cer.setAttribute('d', `M${x0},${yA}V${yB}`);
  burst.setAttribute('cx', String(x0)); burst.setAttribute('cy', String(yB)); burst.style.stroke = `var(--${last.dir === 'hike' ? 'hawk' : 'dove'})`;
  burst.animate([{ opacity: 0.9, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(3.2)' }], { duration: 650, easing: EASE });
  renderHero(Math.sign(last.chg), false);
  const t0 = performance.now(), D = 280, ease = (p: number) => 1 - Math.pow(1 - p, 3);
  const tick = (now: number) => { if (state.dday !== 'decided') return; const p = ease(Math.min(1, (now - t0) / D)); cer.setAttribute('d', `M${x0},${yA}V${yB}H${x0 + (xEnd - x0) * p}`); if (p < 1) requestAnimationFrame(tick); else { rr.setAttribute('width', String(g.W)); cer.setAttribute('d', ''); place(); stamp.classList.add('on'); } };
  requestAnimationFrame(tick);
}

/* ---------- 6. among peers: the same seven rows for every country; only the highlight moves ---------- */
function buildPeers() {
  const P = peers(state.code), max = P.list[0].v;
  $('ladder').innerHTML = P.list.map(p => {
    const l = lastMove(p.k), r = MODEL[p.k].last;
    return `<a class="rung" data-c="${p.k}" href="${pathFor(p.k)}" data-link data-via="ladder">
      <div class="who">${flag(p.k)}<div><b>${META[p.k].name}</b><span>${META[p.k].bank}</span></div></div>
      <div class="track">${r.range ? `<i class="span" style="left:${r.lo / max * 100}%;width:${(r.hi - r.lo) / max * 100}%"></i>` : ''}<i style="width:${r.lo / max * 100}%"></i></div>
      <span class="fig">${vShort(r)}</span>
      <span class="last">${movePill(l.action === 'framework' ? 'framework' : l.dir, l.chg)}<span class="when">${fmtXM(l.t)}</span></span><i class="go" data-lucide="arrow-right"></i></a>`;
  }).join('');
  makeIcons($('ladder'));
}
function renderPeers(mode: 'first' | 'switch' | 'static') {
  const c = state.code, P = peers(c), i = P.rank - 1, up = P.list[i - 1], dn = P.list[i + 1];
  const nm = (k: Code) => `${META[k].name} (${vText(MODEL[k].last)})`;
  put($('peerFinding'), `${poss(META[c].name)} ${B(vText(MODEL[c].last))} is the ${RANKW(P.rank)} of the ${WORDS[CODES.length]}${up && dn ? `, between ${nm(up.k)} and ${nm(dn.k)}` : up ? `, below ${nm(up.k)}` : dn ? `, above ${nm(dn.k)}` : ''}.`);
  $('ladder').querySelectorAll<HTMLElement>('.rung').forEach(el => { const on = el.dataset.c === c; el.classList.toggle('cur', on); if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  if (mode === 'first' && !state.ssr) { stagger($('ladder').children); if (!reduced()) $('ladder').querySelectorAll('.track i').forEach((b, k) => b.animate([{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 480, delay: 80 + Math.floor(k / 2) * 30, easing: EASE, fill: 'backwards' })); }
}

/* ---------- page lifecycle ---------- */
/** First paint of a country page (or the prerender): build every component once, then fill it. */
export function renderCountry(): void {
  painting = true;
  if (!state.ssr) {
    recChart = RecordChart($svg('rec')); recChart.build();
    gapChart = GapChart($svg('gapc')); gapChart.build();
    glance = GlanceChart($('glance')); glance.build();
    wireTiles(); wireSource(); wireLoan(); wireCycle(); wireGap(); wireRecord();
  }
  buildPeers(); tileViz = null;
  renderChip(); renderHero(0); renderTiles('first'); initLoan(); renderLoan(); renderReach(); renderCycle('first'); renderGap('first');
  renderRecord('first'); renderDecisions('first'); renderPeers('first');
  painting = false;
  if (!state.ssr) { requestAnimationFrame(() => { loanSeg?.place(); ddaySeg?.place(); }); observeGlance(); }
}
/** A country switch changes data, never the page: one transaction in which text swaps, charts morph from what is on
 *  screen, and rows glide to their new height. Nothing is rebuilt and no card fades. */
export function setCountry(next: Code, opts: { preview?: boolean; via?: Via } = {}): void {
  if (next === state.code) return;
  const from = state.code, dir = CODES.indexOf(next) > CODES.indexOf(from) ? 1 : -1;
  if (state.replaying) stopReplay(false);
  clearDday(); if (state.dday !== 'live') { state.dday = 'live'; ddaySeg?.set('live'); }
  cancelAnimationFrame(revRaf); if (state.recGeom) $svg('revealRect').setAttribute('width', String(state.recGeom.W)); $svg('head').style.opacity = '0'; hideTip();
  state.code = next; loanTracked = false;
  if (!opts.preview) commitCountry(from, opts.via ?? 'link');
  transact(() => {
    renderChip(dir); renderHero(dir); renderTiles('switch'); initLoan(); renderLoan(); renderReach();
    renderCycle('switch'); renderGap('switch'); renderRecord('switch'); renderDecisions('switch'); renderPeers('switch');
  });
}
/** Makes the country on screen the visitor's choice: remembered, in the address bar and counted once. */
export function commitCountry(from: Code, via: Via): void {
  const c = state.code;
  store.set('atlas-country', c);
  if (location.pathname !== pathFor(c)) history.pushState(null, '', pathFor(c));
  if (from !== c) track('country_switch', { from, to: c, via });
}
/** Resizing redraws charts at the new size from the final state (no morph). */
export function redrawCountry(): void {
  flushTransaction();
  if (state.replaying) stopReplay(); clearDday(); state.dday = 'live'; ddaySeg?.set('live');
  recChart?.build(); if (recChart) state.recGeom = recChart.update(state.code, false);
  gapChart?.build(); if (gapChart) state.gapGeom = gapChart.update(state.code, false);
  painting = true; renderCycle('static'); renderTiles('static'); painting = false;
  rebuildGlance(); loanSeg?.place();
}
function rebuildGlance() { if (!glance) return; glance.build(); renderGlance(false); }
let glanceRO: ResizeObserver | null = null;
function observeGlance() {
  glanceRO?.disconnect(); let h = $('glance').clientHeight;
  glanceRO = new ResizeObserver(() => { const g = $('glance'); if (!g || Math.abs(g.clientHeight - h) < 1) return; h = g.clientHeight; onSettle(rebuildGlance); });
  glanceRO.observe($('glance'));
}
export const leaveCountry = () => { if (state.replaying) stopReplay(false); glanceRO?.disconnect(); recChart = gapChart = null; glance = null; state.recGeom = state.gapGeom = null; };
