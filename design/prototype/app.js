/* Policy Rate Atlas prototype: pages, interactions and motion. Routes: #/in, #/us, ... (country) and #/world. */
'use strict';

const $ = id => document.getElementById(id);
const icons = () => makeIcons();
const tip = $('tip');
function showTip(html, x, y) {
  tip.innerHTML = html; tip.classList.add('on');
  const w = tip.offsetWidth, h = tip.offsetHeight; let L = x + 16, T = y - h - 12;
  if (L + w > innerWidth - 8) L = x - w - 16; if (T < 8) T = y + 18; if (T + h > innerHeight - 8) T = innerHeight - h - 8;
  tip.style.left = Math.max(8, L) + 'px'; tip.style.top = T + 'px';
}
const hideTip = () => tip.classList.remove('on');
const sw = v => `<i class="sw" style="background:${v}"></i>`;
const dirOf = d => (d === 'hike' || d === 'cut' ? d : 'hold');

let code = MODEL[store.get('atlas-country')] ? store.get('atlas-country') : 'IN';
let page = null, loanMode = 'decision', loanState = {}, dday = 'live', replaying = null;
let recGeom = null, gapGeom = null, pulGeom = null, sortKey = 'rate', sortDir = -1;
const seen = new Set();

/* ================= country page ================= */
const card = (id, span, name, icon, head, body, foot = '') => `
  <section class="card ${span}" id="${id}" data-name="${name}" data-icon="${icon}">
    <div class="card-head">${head}</div>
    <div class="card-body">${body}</div>${foot ? `<div class="card-foot" data-prose>${foot}</div>` : ''}
  </section>`;
const kick = (icon, text, id = '') => `<p class="kick"><i data-lucide="${icon}"></i><span${id ? ` id="${id}"` : ''}>${text}</span></p>`;

function countryHTML() {
  return `
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
      '<div class="chart ana" id="anaBox"><svg id="ana" role="img"></svg></div><div class="legend" id="anaLg"></div>')}
    ${card('cycles', 'span-4', 'Every cycle', 'history',
      `${kick('history', '', 'cycKick')}<p class="finding" id="cycListFinding" data-prose></p>`,
      '<div class="fill"><div class="list" id="cycList" data-prose></div></div>')}
  </div>
  <div class="row">
    ${card('gap', 'span-12', 'Against the Fed', 'arrow-left-right',
      `${kick('arrow-left-right', '', 'gapKick')}<p class="finding" id="gapFinding" data-prose></p>`,
      '<div class="chart gapc" id="gapBox"><svg id="gapc" role="img"></svg></div><div class="legend" id="gapLg"></div><div class="stats" id="gapStats"></div>',
      '<span id="gapNote"></span>')}
  </div>
  <div class="row">
    ${card('record', 'span-8', 'The record', 'chart-line',
      `${kick('chart-line', '', 'recKick')}
       <div class="actions"><div class="seg" id="dday" aria-label="Decision-day state"><span class="thumb"></span><button type="button" data-s="live" aria-pressed="true">Live</button><button type="button" data-s="announced" aria-pressed="false">Announced</button><button type="button" data-s="decided" aria-pressed="false">Decided</button></div>
       <button class="ib" id="replay" type="button" aria-label="Replay every move"><i data-lucide="play"></i></button></div>
       <p class="finding" id="recFinding" data-prose></p>`,
      '<div class="chart rec" id="recBox"><svg id="rec" role="img" tabindex="0"></svg><div class="stamp" id="stamp"></div></div><div class="legend" id="recLg"></div>',
      '<span id="replayInfo"></span>')}
    ${card('decisions', 'span-4', 'Every decision', 'list-ordered',
      `${kick('list-ordered', '', 'decKick')}<p class="finding" id="decFinding" data-prose></p>`,
      '<div class="fill"><div class="list" id="decList" data-prose></div></div>')}
  </div>
  <div class="row">
    ${card('peers', 'span-12', 'Among peers', 'globe',
      `${kick('globe', `Among ${CODES.length} central banks`)}<div class="actions"><a class="btn" href="#/world">World view<i data-lucide="arrow-right"></i></a></div><p class="finding" id="peerFinding" data-prose></p>`,
      '<div class="ladder" id="ladder"></div>')}
  </div>
  ${footerHTML()}`;
}

function footerHTML() {
  return `<footer class="site-foot" data-prose>
    <div><b>Policy Rate Atlas</b><p>Policy rates for ${CODES.length} central banks, checked against each bank’s own releases. Every finding is computed from the record on the page. Nothing here is a forecast.</p></div>
    <div><b>Sources</b><p>RBI resolutions and press releases, Federal Reserve statements and FRED, ECB data portal, Bank of England database, Bank of Canada Valet, RBA table F1, BCB series 432.</p></div>
    <div><b>This release</b><p>Data as of ${fmtD(TODAY, 'GB')}. India release ${MODEL.IN.release}, United States release ${MODEL.US.release}. A JSON API and WebMCP tools serve the same records at launch.</p></div>
  </footer>`;
}

/* ---------- 1. the decision ---------- */
// put(): set an element's content. During a country switch the change is queued into the transaction; on first paint
// it is instant. Unchanged content is never touched, so labels that do not change never move.
let painting = false;
const put = (el, html, dir = 0) => swap(el, html, dir, painting);
function changeHTML(last) {
  if (last.action === 'framework') return `<b>${mark('framework')}Range introduced</b><span>from ${vText(last.prev)}</span>`;
  return `<b>${mark(last.dir)}${bps(last.chg)}</b><span>from ${vText(last.prev)}</span>`;
}
function factsList(pending = false) {
  const m = META[code], md = MODEL[code], last = md.policyMoves.at(-1), dec = last.decision, st = stanceOfPlay(code), out = [];
  const n = md.next[0] && fmtNext(md.next[0], code), next = n ? ['Next decision', n.date, `${n.time} · ${n.inText}`] : ['Next decision', 'Not on our calendar yet', 'Being added'];
  // Announced but unverified: show nothing from the new decision except that it exists.
  if (pending) return [['Announced', 'Today', 'Verifying now'], ['Vote', 'Pending', `With the ${m.doc || 'release'}`], ['Stance', 'Pending', `With the ${m.doc || 'release'}`], next];
  const ago = Math.round((T_TODAY - last.t) / DAY);
  if (dec) out.push(['Decided', fmtD(dec.date, code), dec.date !== dec.effective ? `Effective ${fmtD(dec.effective, code)}` : ago ? `${span(ago)} ago` : 'Effective today']);
  else out.push(['Effective', fmtD(last.date, code), ago ? `${span(ago)} ago` : 'Today']);
  const v = voteText(dec?.vote);
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
function renderFacts(list, instant = painting) {
  [...$('facts').children].forEach((cell, i) => { const [k, v, s] = list[i]; swap(cell.firstElementChild, esc(k), 0, instant); swap(cell.lastElementChild, `${v}${s ? `<span>${s}</span>` : ''}`, 0, instant); });
}
function renderHero(dir = 0, instant = painting) {
  const m = META[code], md = MODEL[code], last = md.policyMoves.at(-1), dec = last.decision, set = (el, h, d = dir) => swap(el, h, d, instant);
  set($('dKick'), esc(`${m.bank} · ${m.inst}`), 0);
  set($('big'), vBig(md.last)); set($('chg'), changeHTML(last)); set($('lede'), lede(code));
  const quote = dec?.excerpt ? `“${esc(dec.excerpt)}”<cite>${m.body}, ${fmtD(dec.date, code)}</cite>` : '';
  if (quote) set($('quote'), quote, 0);
  atCommit(() => { $('quote').hidden = !quote; });
  renderFacts(factsList(), instant);
  set($('dFoot'), esc(md.release ? `${md.sources} official sources · release ${md.release}` : `Official series from the ${m.bank}`), 0);
  if (dec?.url) set($('dSrc'), `Read the ${m.doc || 'release'}<i data-lucide="arrow-up-right"></i>`, 0);
  atCommit(() => { const a = $('dSrc'); a.hidden = !dec?.url; if (dec?.url) a.href = dec.url; });
  renderGlance(!instant);
}
let glance = null;
function renderGlance(animate) {
  const g = glance.update(code, animate);
  [...$('glanceStats').children].forEach((cell, i) => put(cell.lastElementChild, vShort([g.yearAgo, g.hi5, g.lo5][i])));
}
let phoneTitle = null;
function setPhoneTitle(text) {
  if (text === phoneTitle) return;
  const first = phoneTitle == null; phoneTitle = text;
  roll($('mTitle'), `<span>${esc(text)}</span>`, 'down', first);
}
function renderChip(dir = 0) {
  const m = META[code], md = MODEL[code], animate = !painting;
  xfadeFlag($('chFlag'), code, animate); xfadeFlag($('mFlag'), code, animate);
  $('openPal').dataset.c = code; $('mFlag').setAttribute('aria-label', `Switch country. Showing ${m.name}`);
  swap($('chName'), esc(m.name), dir, !animate); swap($('chVal'), vShort(md.last), dir, !animate);
  setPhoneTitle(page === 'world' ? 'World' : m.name);
  document.title = page === 'world' ? 'Policy rates around the world · Policy Rate Atlas' : `${m.inst} ${vText(md.last)} · ${m.name} · Policy Rate Atlas`;
  swap($('crumbMeta'), esc(page === 'world' ? `${CODES.length} central banks · as of ${fmtD(TODAY, 'GB')}` : `${m.name} · ${m.bank}`), 0, !animate);
}

/* ---------- insight tiles: four fixed tiles; their words swap and their visuals morph or crossfade ---------- */
const TILES = [{ go: 'record', ic: 'gauge' }, { go: 'cycle', ic: 'repeat' }, { go: 'gap', ic: 'arrow-left-right' }, { go: 'peers', ic: 'globe' }];
let tileViz = null;
function tileTexts(c) {
  const L = levelInfo(c), C = cycleInfo(c), G = gapInfo(c), P = peers(c), bName = META[G.b].short, y0 = yearOf(L.t0), kind = C.cur.dir === 'hike' ? 'tightening' : 'easing';
  const above = P.list.slice(P.rank).map(p => META[p.k].short);
  return [
    { lab: 'How high it is', hd: L.pBelow < L.pAbove ? `Lower than on ${B(Math.round(L.pAbove * 100) + '%')} of days since ${y0}` : `Higher than on ${B(Math.round(L.pBelow * 100) + '%')} of days since ${y0}`, cap: `Days at each level since ${y0}. Today’s level is in colour.` },
    { lab: 'Where in the cycle', hd: C.holding > 182 ? `On hold for ${span(C.holding)} after ${kind}` : `${cap(kind)}, ${B(bps(C.cur.total))} so far`,
      cap: C.past.length === 1 ? `The previous ${kind} cycle ran ${bps(C.past[0].total)} over ${span(C.past[0].days)}.` : C.medTotal != null ? `${cap(WORDS[C.past.length] || String(C.past.length))} earlier ${kind} cycles ran a median ${bps(C.medTotal)} over ${span(C.medDays)}.` : `No earlier ${kind} cycle of two or more moves.` },
    { lab: `Against the ${bName}`, hd: `${B(bps(G.s))} ${G.s >= 0 ? 'above' : 'below'} the ${bName}, ${G.rel.word} than on ${B(Math.round(G.rel.share * 100) + '%')} of days since ${G.yr}`, cap: G.yearAgo !== G.s ? `A year ago the gap was ${bps(G.yearAgo)}.` : 'The same gap as a year ago.' },
    { lab: `Among ${CODES.length} central banks`, hd: `The ${B(RANKW(P.rank))} policy rate of the ${WORDS[CODES.length]}`, cap: above.length ? `Above the ${above.slice(0, -1).join(', ')}${above.length > 1 ? ' and ' : ''}${above.at(-1)}.` : 'The lowest of the set.' },
  ];
}
const tileSizes = () => [...$('tiles').children].map(el => { const v = el.querySelector('.viz'); return [Math.max(120, Math.round(v.clientWidth)), Math.max(48, Math.min(132, Math.round(v.clientHeight)))]; });
function buildTileViz() {
  const sizes = tileSizes(), svgs = [...$('tiles').querySelectorAll('.viz > svg:not(.xf-ghost)')];
  tileViz = { sizes, svgs, gap: GapSpark(svgs[2], ...sizes[2]), peers: PeerViz(svgs[3], ...sizes[3]) };
}
function renderTiles(mode) {
  const c = code, texts = tileTexts(c), tiles = [...$('tiles').children], switching = mode === 'switch';
  tiles.forEach((el, i) => { put(el.querySelector('.kt'), esc(texts[i].lab)); put(el.querySelector('.hd'), texts[i].hd); put(el.querySelector('.cap'), texts[i].cap); el.setAttribute('aria-label', `${texts[i].lab}: open the detail`); });
  if (!switching || !tileViz) buildTileViz();
  const { sizes, svgs } = tileViz, simple = (i, viz) => { const [VW, VH] = sizes[i]; svgs[i].setAttribute('viewBox', `0 0 ${VW} ${VH}`); svgs[i].innerHTML = viz(c, VW, VH); };
  xfadeSvg(svgs[0], () => simple(0, vizLevel), switching); xfadeSvg(svgs[1], () => simple(1, vizCycle), switching);
  tileViz.gap.update(c, switching); tileViz.peers.update(c);
  if (mode === 'first') { const host = $('tiles'); stagger(host.children); growIn(host.querySelectorAll('.vb'), '50% 100%', 120, 14); growIn(host.querySelectorAll('.vx'), '0 50%', 160); drawIn(host, 'path.draw', 700); popIn(host.querySelectorAll('.vd'), 200); }
  // Text in a tile can change its height; once the switch settles, redraw any visual whose box changed.
  if (switching) onSettle(() => { const now = tileSizes(); if (now.some((s, i) => Math.abs(s[0] - tileViz.sizes[i][0]) > 2 || Math.abs(s[1] - tileViz.sizes[i][1]) > 2)) { buildTileViz(); [0, 1].forEach(i => xfadeSvg(tileViz.svgs[i], () => simple(i, i ? vizCycle : vizLevel), true)); tileViz.gap.update(code, false); tileViz.peers.update(code); } });
}
function wireTiles() { $('tiles').querySelectorAll('.tile').forEach(t => { const go = () => jump(t.dataset.go); t.onclick = go; t.onkeydown = e => { if (e.key === 'Enter') go(); }; }); }

/* ---------- 2. the loan ---------- */
function initLoan() {
  const l = META[code].loan, c = code;
  loanState = { amt: l.amt, yrs: l.yrs, rate: l.rate, since: isoOf(T_TODAY - Math.round(3 * 365.25) * DAY) };
  put($('curSym'), esc(curSymbol(c)));
  put($('presets'), [0.5, 1, 2].map(k => `<button type="button" data-v="${l.amt * k}" aria-pressed="${k === 1}">${moneyWords(l.amt * k, c)}</button>`).join(''));
  atCommit(() => {
    $('amt').value = new Intl.NumberFormat(META[c].moneyLocale).format(l.amt); $('yrs').value = l.yrs; $('rate').value = l.rate; $('since').value = loanState.since;
    $('since').min = isoOf(Math.max(fromT(c), MODEL[c].first.t)); $('since').max = TODAY;
  });
}
const pressPresets = () => $('presets').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === loanState.amt)));
function renderLoan(instant = painting) {
  const c = code, m = META[c], l = m.loan, md = MODEL[c], last = md.policyMoves.at(-1), set = (el, h) => swap(el, h, 0, instant);
  const amt = loanState.amt, n = Math.round(loanState.yrs * 12), rate = loanState.rate;
  let d = null, label;
  atCommit(() => { $('sinceField').hidden = loanMode !== 'since'; $('loanNote').hidden = loanMode === 'since'; });
  if (loanMode === 'decision') { d = last.chg; label = `If the ${m.short}’s ${bps(d)} reaches your loan`; set($('rateLbl'), 'Your rate before'); }
  else {
    set($('rateLbl'), 'Your rate then');
    const t = loanState.since ? tOf(loanState.since) : null;
    if (t) d = md.last.hi - valueAt(c, Math.max(md.first.t, t)).hi;
    label = t ? `${m.short} moves since ${fmtD(loanState.since, c)} add up to ${d == null ? '' : bps(d)}` : 'Pick the date you borrowed';
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
  set($('loanFinding'), loanMode === 'decision'
    ? `On a ${B(moneyWords(amt, c))} loan over ${loanState.yrs} years, this ${last.dir} ${dp >= 0 ? 'adds' : 'takes off'} about ${B(money(Math.abs(dp), c))} a month`
    : `Since you borrowed, ${m.short} moves ${dp >= 0 ? 'add' : 'take off'} about ${B(money(Math.abs(dp), c))} a month`);
}
function wireLoan() {
  const num = s => +String(s).replace(/[^\d.]/g, '');
  $('amt').addEventListener('input', e => { loanState.amt = num(e.target.value); pressPresets(); renderLoan(true); });
  $('presets').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; loanState.amt = +b.dataset.v; $('amt').value = new Intl.NumberFormat(META[code].moneyLocale).format(loanState.amt); pressPresets(); renderLoan(false); });
  $('amt').addEventListener('blur', e => { if (loanState.amt > 0) e.target.value = new Intl.NumberFormat(META[code].moneyLocale).format(loanState.amt); });
  $('yrs').addEventListener('input', e => { loanState.yrs = num(e.target.value); renderLoan(true); });
  $('rate').addEventListener('input', e => { loanState.rate = num(e.target.value); renderLoan(true); });
  $('since').addEventListener('change', e => { loanState.since = e.target.value; renderLoan(false); });
  segc($('loanMode'), v => { loanMode = v; renderLoan(false); }, 'm');
}
function renderReach() {
  const m = META[code], md = MODEL[code], words = { direct: 'Direct', lagged: 'Lagged', none: 'None' };
  put($('txKick'), esc(`How it reaches loans in ${m.name === 'United States' ? 'the US' : m.name === 'United Kingdom' ? 'the UK' : m.name === 'Euro area' ? 'the euro area' : m.name}`));
  put($('txHead'), esc(m.txHead));
  put($('passes'), md.tx.map(p => `<div class="pass"><b>${esc(p.product)}</b><span class="pill">${words[p.passThrough] || cap(p.passThrough)}</span>
    <dl><div><dt>Priced off</dt><dd>${esc(p.benchmark)}</dd></div><div><dt>Resets</dt><dd>${esc(p.reset)}</dd></div></dl><span>${esc(p.note)}</span></div>`).join(''));
}

/* ---------- 3. the cycle ---------- */
function renderCycle(mode) {
  const c = code, md = MODEL[c], svg = $('ana'); let C;
  xfadeSvg(svg, () => { C = drawCycle(svg, c); }, mode === 'switch');
  const kind = C.cur.dir === 'hike' ? 'tightening' : 'easing', subj = META[c].subj;
  put($('cycFinding'), C.holding > 182
    ? `${subj} last ${C.cur.dir === 'hike' ? 'raised' : 'cut'} rates ${span(C.holding)} ago. That ${kind} cycle moved ${B(bps(C.cur.total))} in ${span(C.cur.days || 1)}${C.medTotal != null ? `, against a median of ${B(bps(C.medTotal))} for earlier ones` : ''}.`
    : C.past.length === 1 ? `This ${kind} cycle is ${B(bps(C.cur.total))} in. The previous one ran ${B(bps(C.past[0].total))} over ${span(C.past[0].days)}.`
    : C.medTotal != null ? `This ${kind} cycle is ${B(bps(C.cur.total))} in. The ${WORDS[C.past.length] || C.past.length} before it ran a median ${B(bps(C.medTotal))} over ${span(C.medDays)}.`
    : `This ${kind} cycle is ${B(bps(C.cur.total))} in, with no earlier ${kind} cycle of two or more moves to compare.`);
  const col = C.cur.dir === 'hike' ? 'hawk' : 'dove';
  put($('anaLg'), `<span><i class="ln" style="background:var(--${col})"></i>This cycle</span><span><i class="ln" style="background:var(--other)"></i>Earlier ${kind} cycles, by start year</span>${C.medTotal != null && C.past.length > 1 ? `<span><i class="ln" style="background:repeating-linear-gradient(90deg,var(--ink-3) 0 3px,transparent 3px 6px)"></i>Median total</span>` : ''}`);
  const list = md.cycles.slice().reverse(), mx = Math.max(...list.map(cy => Math.abs(cy.total)), 25);
  const nh = md.cycles.filter(cy => cy.dir === 'hike').length, nc = md.cycles.length - nh;
  put($('cycKick'), `Every cycle since ${yearOf(fromT(c))}`);
  put($('cycListFinding'), `${cap(WORDS[nh] || String(nh))} tightening and ${WORDS[nc] || nc} easing cycles. Hover one to trace it.`);
  put($('cycList'), list.map(cy => `<div class="item" data-ci="${cy.i}">${mark(cy.dir)}<span class="title">${cy.dir === 'hike' ? 'Tightening' : 'Easing'}${cy === C.cur ? ' · latest' : ''}</span><span class="fig">${sgn(cy.total)}</span>
      <span class="sub">${fmtM(cy.start.t, c)}${cy.moves.length > 1 ? ` to ${fmtM(cy.end.t, c)}` : ''} · ${cy.moves.length} move${cy.moves.length > 1 ? 's' : ''}</span>
      <span class="bar"><i style="width:${Math.abs(cy.total) / mx * 100}%;--c:var(--${cy.dir === 'hike' ? 'hawk' : 'dove'})"></i></span></div>`).join(''));
  atCommit(() => { $('cycList').scrollTop = 0; });
  if (mode === 'first') { drawIn(svg, 'path.past', 600, 50); drawIn(svg, 'path.now', 800, 0); popIn(svg.querySelectorAll('.nowdot'), 600); stagger($('cycList').children); }
}
function wireCycle() {
  const box = $('anaBox'), list = $('cycList');
  const hl = ci => { box.classList.toggle('hl', ci != null); box.querySelectorAll('.past').forEach(p => p.classList.toggle('on', p.dataset.ci === String(ci))); list.querySelectorAll('.item').forEach(r => r.classList.toggle('on', r.dataset.ci === String(ci))); };
  box.addEventListener('pointerover', e => {
    const p = e.target.closest('#ana .past'); if (!p) return; hl(p.dataset.ci);
    const cy = MODEL[code].cycles[+p.dataset.ci]; if (!cy) return;
    showTip(`<div class="t-title">${cy.dir === 'hike' ? 'Tightening' : 'Easing'} from ${fmtM(cy.start.t, code, true)}</div><div class="t-rule"></div><div class="t-row"><span>Total</span><span class="t-num">${bps(cy.total)}</span></div><div class="t-row"><span>Moves</span><span class="t-num">${cy.moves.length}</span></div><div class="t-row"><span>Lasted</span><span>${span(cy.days || 1)}</span></div><div class="t-row"><span>Rate</span><span class="t-num">${vShort(cy.from)} → ${vShort(cy.end)}</span></div>`, e.clientX, e.clientY);
  });
  box.addEventListener('pointerout', e => { if (e.target.closest('.past')) { hl(null); hideTip(); } });
  list.addEventListener('pointerover', e => { const r = e.target.closest('.item'); if (r) hl(r.dataset.ci); });
  list.addEventListener('pointerleave', () => hl(null));
}

/* ---------- 4. against the benchmark ---------- */
let gapChart = null;
function renderGap(mode) {
  const c = code, cm = META[c];
  gapGeom = gapChart.update(c, mode === 'switch');
  const G = gapGeom.G, b = G.b, bm = META[b];
  $('gap').dataset.name = `Against the ${bm.short}`;
  put($('gapKick'), `Against the ${bm.short}`);
  put($('gapFinding'), `${poss(cm.name)} ${cm.inst.toLowerCase()} sits ${B(Math.abs(G.s) + ' bps')} ${G.s >= 0 ? 'above' : 'below'} the ${bm.short}${MODEL[b].last.range ? '’s upper bound' : ''}: a ${G.rel.word}${G.s >= 0 ? ' gap' : ''} than on ${B(Math.round(G.rel.share * 100) + '%')} of days since ${G.yr}${G.since ? `, and the ${G.dirWord} since ${fmtM(G.since, c, true)}` : ''}.`);
  put($('gapLg'), `<span><i class="sw" style="background:var(--gap);opacity:.7"></i>${cm.name} minus ${bm.name}, in bps</span><span><i class="ln" style="background:var(--ink-3)"></i>Zero: the same rate</span>`);
  const st = [['Gap today', bps(G.s), fmtD(TODAY, c)], ['A year ago', bps(G.yearAgo), fmtD(isoOf(T_TODAY - 365 * DAY), c)], [`Widest since ${G.yr}`, bps(G.wide.s), fmtM(G.wide.t, c)], [`Narrowest since ${G.yr}`, bps(G.narrow.s), fmtM(G.narrow.t, c)]];
  const cells = $('gapStats').children;
  if (cells.length !== 4) $('gapStats').innerHTML = '<div><span></span><b></b><em></em></div>'.repeat(4);
  [...$('gapStats').children].forEach((cell, i) => { const [k, v, s2] = st[i]; put(cell.children[0], esc(k)); put(cell.children[1], v); put(cell.children[2], esc(s2)); });
  const PLURAL = { IN: 'rupees', US: 'dollars', EA: 'euros', GB: 'pounds', CA: 'Canadian dollars', AU: 'Australian dollars', BR: 'reais' };
  const money = PLURAL[c], rival = PLURAL[b], cur = c === 'BR' ? 'the real' : `the ${cm.curName}`;
  put($('gapNote'), G.s >= 0
    ? `Holding ${money} earns more than holding ${rival}, which supports ${cur}; a narrowing gap removes some of that support. One input among many, not a forecast.`
    : `Holding ${money} earns less than holding ${rival}, a headwind for ${cur}. One input among many, not a forecast.`);
  if (mode === 'first') { drawIn($('gapc'), 'path.line', 900); if (!reduced()) $('gapc').querySelector('.area').animate([{ opacity: 0 }, { opacity: 0.16 }], { duration: 700, easing: EASE }); }
  setRail();
}
function wireGap() {
  const svg = $('gapc');
  svg.addEventListener('pointermove', e => {
    if (!gapGeom) return;
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (gapGeom.W / r.width), t = Math.min(gapGeom.t1, Math.max(gapGeom.t0, gapGeom.inv(px)));
    const cur = $('gCur'); cur.setAttribute('x1', gapGeom.x(t)); cur.setAttribute('x2', gapGeom.x(t)); cur.classList.add('on');
    const b = gapGeom.G.b, a = valueAt(code, t), o = valueAt(b, t);
    showTip(`<div class="t-title">${fmtDT(t, code)}</div><div class="t-rule"></div><div class="t-row"><span>${sw('var(--ink)')}${META[code].name}</span><span class="t-num">${vShort(a)}</span></div><div class="t-row"><span>${sw('var(--ink-3)')}${META[b].name}</span><span class="t-num">${vShort(o)}</span></div><div class="t-row"><span>${sw('var(--gap)')}Gap</span><span class="t-num">${bps(a.hi - o.hi)}</span></div>`, e.clientX, e.clientY);
  });
  svg.addEventListener('pointerleave', () => { $('gCur')?.classList.remove('on'); hideTip(); });
}

/* ---------- 5. the record ---------- */
let recChart = null;
function renderRecord(mode) {
  const c = code, md = MODEL[c], F = fromT(c);
  recGeom = recChart.update(c, mode === 'switch');
  const pol = md.recs.filter(r => r.t >= F).concat(valueAt(c, F)), hi = pol.reduce((a, r) => (r.hi > a.hi ? r : a)), lo = pol.reduce((a, r) => (r.lo < a.lo ? r : a));
  put($('recKick'), `The record since ${yearOf(Math.max(recGeom.t0, md.first.t))}`);
  put($('recFinding'), `${B(md.policyMoves.length)} moves since ${fmtM(F, c, true)}, from a high of ${B(vText(hi))} in ${fmtM(hi.t, c)} to a low of ${B(vText(lo))} in ${fmtM(lo.t, c)}.`);
  put($('recLg'), `<span><i class="ln" style="background:var(--ink)"></i>${META[c].inst}</span>${recGeom.anyRange ? '<span><i class="sw" style="background:var(--level);opacity:.45"></i>Target range</span>' : ''}<span>${mark('hike', 'sm')}Hike</span><span>${mark('cut', 'sm')}Cut</span>${recGeom.hasObs ? '<span><i class="sw" style="background:var(--obs);opacity:.35"></i>Pre-2004 observations, not used in findings</span>' : ''}`);
  put($('replayInfo'), REPLAY_INFO);
  if (mode === 'first' && !reduced() && !seen.has(c)) { seen.add(c); reveal(900); }
}
const REPLAY_INFO = 'Live shows the verified record. Announced and Decided preview the states this page goes through on decision day.';
const setReplayInfo = (txt) => { $('replayInfo').textContent = txt || REPLAY_INFO; };
let revRaf = 0;
function reveal(dur) {
  cancelAnimationFrame(revRaf);
  const g = recGeom, rr = $('revealRect'), head = $('head'); rr.setAttribute('width', 0);
  const st = performance.now() + 200, ease = p => 1 - Math.pow(1 - p, 3);
  const tick = now => {
    if (recGeom !== g) { rr.setAttribute('width', g.W); head.style.opacity = 0; return; }
    const p = Math.min(1, Math.max(0, (now - st) / dur)), px = g.M.l + ease(p) * (g.W - g.M.l - g.M.r);
    rr.setAttribute('width', p >= 1 ? g.W : px);
    const r = valueAt(code, g.inv(px));
    if (r && p > 0 && p < 1 && g.inv(px) >= MODEL[code].first.t) { head.setAttribute('cx', px); head.setAttribute('cy', g.y(r.hi)); head.style.opacity = 1; } else head.style.opacity = 0;
    if (p < 1) revRaf = requestAnimationFrame(tick); else head.style.opacity = 0;
  };
  revRaf = requestAnimationFrame(tick);
}
function decisionRows() {
  const c = code, md = MODEL[c];
  if (md.decisions.length) return md.decisions.slice().reverse().map(d => {
    const dir = dirOf(d.dir), r = { lo: d.lo, hi: d.hi, range: d.lo !== d.hi }, move = md.policyMoves.find(m => m.decision === d);
    const v = voteText(d.vote);
    return { t: move ? move.t : d.te, move, dir, title: dir === 'hike' ? `Raised to ${vText(r)}` : dir === 'cut' ? `Cut to ${vText(r)}` : `Held at ${vText(r)}`, fig: dir === 'hold' ? '±0' : sgn(d.change), sub: `${fmtD(d.date, c)}${v ? ` · ${v.tally} vote` : ''}${d.offCycle ? ' · unscheduled' : ''}` };
  });
  return md.policyMoves.slice().reverse().map(m => ({ t: m.t, move: m, dir: m.action === 'framework' ? 'framework' : m.dir, title: m.action === 'framework' ? `Range of ${vText(m)}` : `${m.dir === 'hike' ? 'Raised' : 'Cut'} to ${vText(m)}`, fig: sgn(m.chg), sub: `${fmtD(m.date, c)} · ${moveContext(m)}` }));
}
function renderDecisions(mode) {
  const c = code, md = MODEL[c], rows = decisionRows();
  if (md.decisions.length) {
    const n = k => md.decisions.filter(d => dirOf(d.dir) === k).length;
    put($('decKick'), 'Every decision');
    put($('decFinding'), `${B(md.decisions.length)} ${META[c].body} decisions since ${fmtM(md.decisions[0].t, c)}: ${n('hike')} hikes, ${n('cut')} cuts and ${n('hold')} holds.`);
  } else {
    put($('decKick'), 'Every move');
    put($('decFinding'), `${B(md.policyMoves.length)} moves since ${fmtM(fromT(c), c)}. Votes and statements for the ${META[c].short} are being added.`);
  }
  put($('decList'), rows.map(r => `<div class="item" data-t="${r.t}" data-move="${r.move ? 1 : 0}">${mark(r.dir)}<span class="title">${r.title}</span><span class="fig">${r.fig}</span><span class="sub">${r.sub}</span></div>`).join(''));
  atCommit(() => { $('decList').scrollTop = 0; });
  if (mode === 'first') stagger([...$('decList').children].slice(0, 12));
}
let activeMk = null;
function markOn(t, scroll = false) {
  if (activeMk) activeMk.classList.remove('on');
  activeMk = t != null ? $('rec').querySelector(`.mk[data-t="${t}"]`) : null;
  if (activeMk) activeMk.classList.add('on');
  $('decList').querySelectorAll('.item.on').forEach(r => r.classList.remove('on'));
  if (t != null) { const it = $('decList').querySelector(`.item[data-t="${t}"]`); if (it) { it.classList.add('on'); if (scroll) it.scrollIntoView({ block: 'nearest' }); } }
}
function wireRecord() {
  const svg = $('rec');
  const near = px => { let best = null, bd = 12; for (const m of recGeom.moves) { const d = Math.abs(recGeom.x(m.t) - px); if (d < bd) { bd = d; best = m; } } return best; };
  const scrub = e => {
    if (!recGeom || replaying || dday !== 'live') return;
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (recGeom.W / r.width), s = near(px);
    const t = s ? s.t : Math.min(recGeom.t1, Math.max(recGeom.t0, recGeom.inv(px))), v = valueAt(code, t);
    const cur = $('rCur'); cur.setAttribute('x1', recGeom.x(t)); cur.setAttribute('x2', recGeom.x(t)); cur.classList.add('on');
    markOn(s ? s.t : null, true);
    const vt = s?.decision?.vote ? voteText(s.decision.vote) : null;
    showTip(s ? `<div class="t-title">${fmtD(s.date, code)}</div><div class="t-sub">${cap(moveContext(s))}</div><div class="t-rule"></div><div class="t-row"><span>${sw(`var(--${s.dir === 'hike' ? 'hawk' : 'dove'})`)}${s.dir === 'hike' ? 'Hike' : 'Cut'}</span><span class="t-num">${bps(s.chg)}</span></div><div class="t-row"><span>New level</span><span class="t-num">${vShort(s)}</span></div>${vt ? `<div class="t-row"><span>Vote</span><span class="t-num">${vt.tally}</span></div>` : ''}<div class="t-row"><span>Held for</span><span>${s.next ? span(Math.round((s.next.t - s.t) / DAY)) : 'to today'}</span></div>`
      : `<div class="t-title">${fmtDT(t, code)}</div><div class="t-sub">${t < fromT(code) ? 'Observation era' : 'In effect'}</div><div class="t-rule"></div><div class="t-row"><span>${sw('var(--level)')}${META[code].inst}</span><span class="t-num">${vShort(v)}</span></div>`, e.clientX, e.clientY);
  };
  svg.addEventListener('pointermove', scrub);
  svg.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') scrub(e); });
  svg.addEventListener('pointerleave', () => { $('rCur').classList.remove('on'); markOn(null); hideTip(); });
  svg.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || !recGeom.moves.length) return; e.preventDefault();
    const ms = recGeom.moves, i = activeMk ? ms.findIndex(m => String(m.t) === activeMk.dataset.t) : ms.length;
    const m = ms[Math.max(0, Math.min(ms.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    markOn(m.t, true); setReplayInfo(`${fmtD(m.date, code)} · ${m.dir === 'hike' ? 'hike' : 'cut'} of ${Math.abs(m.chg)} bps to ${vText(m)} · ${moveContext(m)}`);
  });
  const list = $('decList');
  list.addEventListener('pointerover', e => {
    const it = e.target.closest('.item'); if (!it || !recGeom || replaying || dday !== 'live') return;
    const t = +it.dataset.t, m = MODEL[code].policyMoves.find(x => x.t === t), cur = $('rCur');
    cur.setAttribute('x1', recGeom.x(t)); cur.setAttribute('x2', recGeom.x(t)); cur.classList.add('on');
    const tn = $('tenure');
    if (m) { const end = m.next ? m.next.t : recGeom.t1; tn.setAttribute('d', `M${recGeom.x(m.t)},${recGeom.y(m.hi)}H${recGeom.x(Math.min(end, recGeom.t1))}`); tn.classList.add('on'); markOn(t); }
    else { tn.classList.remove('on'); markOn(null); it.classList.add('on'); }
  });
  list.addEventListener('pointerleave', () => { $('tenure').classList.remove('on'); $('rCur').classList.remove('on'); markOn(null); });
  $('replay').addEventListener('click', toggleReplay);
  segc($('dday'), v => setDday(v), 's');
}
function setReplayIcon(play) { $('replay').innerHTML = `<i data-lucide="${play ? 'play' : 'square'}"></i>`; $('replay').setAttribute('aria-label', play ? 'Replay every move' : 'Stop replay'); icons(); }
function stopReplay(restore = true) {
  if (!replaying) return; cancelAnimationFrame(replaying.raf); replaying = null; setReplayIcon(true); setReplayInfo();
  $('head').style.opacity = 0; markOn(null); $('revealRect').setAttribute('width', recGeom.W);
  if (restore) { swap($('big'), vBig(MODEL[code].last)); swap($('chVal'), vShort(MODEL[code].last)); }
}
function toggleReplay() {
  if (replaying) { stopReplay(); return; }
  if (dday !== 'live') { setDday('live'); $('dday').set('live'); }
  const g = recGeom, ms = g.moves, N = ms.length; if (!N) return;
  if (reduced()) { setReplayInfo(`${N} moves. Replay is off because reduced motion is on.`); return; }
  const per = Math.max(110, Math.min(260, 9000 / N)), knots = [g.t0, ...ms.map(m => m.t), g.t1], total = per * (knots.length - 1), st = performance.now();
  let lastIdx = -1; setReplayIcon(false); replaying = { raf: 0 };
  const tick = now => {
    if (!replaying || recGeom !== g) return;
    const p = Math.min(1, (now - st) / total), f = p * (knots.length - 1), k = Math.min(knots.length - 2, Math.floor(f)), t = knots[k] + (knots[k + 1] - knots[k]) * (f - k), px = g.x(t);
    $('revealRect').setAttribute('width', px);
    const r = valueAt(code, t); $('head').setAttribute('cx', px); $('head').setAttribute('cy', g.y(r.hi)); $('head').style.opacity = 1;
    let idx = -1; for (let q = 0; q < N && ms[q].t <= t; q++) idx = q;
    if (idx !== lastIdx && idx >= 0) { lastIdx = idx; const m = ms[idx]; markOn(m.t, true); $('big').innerHTML = vBig(m); setReplayInfo(`${fmtD(m.date, code)} · ${vText(m)} · move ${idx + 1} of ${N}`); }
    if (p < 1) replaying.raf = requestAnimationFrame(tick); else stopReplay(true);
  };
  replaying.raf = requestAnimationFrame(tick);
}

/* decision day: live, announced (verifying), decided (ceremony) */
function clearDday() { $('rec')?.classList.remove('announced'); ['pending', 'pendline'].forEach(id => $(id)?.classList.remove('on')); $('stamp')?.classList.remove('on'); $('ceremony')?.setAttribute('d', ''); }
function setDday(s) {
  if (replaying) stopReplay(false); clearDday(); dday = s;
  const md = MODEL[code], last = md.policyMoves.at(-1), prev = last.prev, g = recGeom, rr = $('revealRect'), m = META[code];
  if (s === 'live') { rr.setAttribute('width', g.W); renderHero(0); setReplayInfo(); return; }
  rr.setAttribute('width', Math.max(0, g.x(last.t) - 1));
  const x0 = g.x(last.t), yA = g.y(prev.hi);
  if (s === 'announced') {
    swap($('big'), vBig(prev)); swap($('chg'), `<b>${mark('hold')}Announced</b><span>verifying the ${m.doc || 'release'}</span>`);
    swap($('lede'), `${m.subj} has announced its decision. The record keeps ${B(vText(prev))} until the official ${m.doc || 'release'} is checked against ${m.short}’s own site, usually within minutes.`);
    $('quote').hidden = true; renderFacts(factsList(true), false); $('rec').classList.add('announced');
    const pe = $('pending'), pl = $('pendline');
    pe.setAttribute('x', x0); pe.setAttribute('width', Math.max(14, g.W - x0 - 2)); pe.setAttribute('y', g.M.t); pe.setAttribute('height', g.H - g.M.t - g.M.b); pe.classList.add('on');
    pl.setAttribute('x1', x0); pl.setAttribute('x2', x0); pl.setAttribute('y1', g.M.t); pl.setAttribute('y2', g.H - g.M.b); pl.classList.add('on');
    $('ceremony').setAttribute('d', `M${x0 - 1},${yA}H${g.x(g.t1)}`); $('ceremony').style.strokeDasharray = '2 4';
    setReplayInfo(`Announced: the page holds ${vText(prev)} and hatches the window until the ${m.doc || 'release'} is verified.`);
  }
  if (s === 'decided') { ceremony(last, prev); setReplayInfo(`Decided: verified against ${m.short}. The new level steps in and the change is stamped.`); }
}
function ceremony(last, prev) {
  const g = recGeom, rr = $('revealRect'), cer = $('ceremony'), stamp = $('stamp'), burst = $('burst'), x0 = g.x(last.t), yA = g.y(prev.hi), yB = g.y(last.hi), xEnd = g.x(g.t1);
  cer.style.strokeDasharray = '';
  stamp.innerHTML = `${mark(last.dir)}${bps(last.chg)} · ${vText(last)}`;
  const place = () => { const box = $('rec').getBoundingClientRect(), k = box.width / g.W; stamp.style.left = Math.min(box.width - stamp.offsetWidth - 4, Math.max(4, x0 * k - stamp.offsetWidth - 14)) + 'px'; stamp.style.top = Math.max(0, Math.min(yA, yB) * k - 40) + 'px'; };
  if (reduced()) { rr.setAttribute('width', g.W); renderHero(0); place(); stamp.classList.add('on'); return; }
  rr.setAttribute('width', x0 - 1); cer.setAttribute('d', `M${x0},${yA}V${yB}`);
  burst.setAttribute('cx', x0); burst.setAttribute('cy', yB); burst.style.stroke = `var(--${last.dir === 'hike' ? 'hawk' : 'dove'})`;
  burst.animate([{ opacity: 0.9, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(3.2)' }], { duration: 650, easing: EASE });
  renderHero(Math.sign(last.chg));
  const t0 = performance.now(), D = 280, ease = p => 1 - Math.pow(1 - p, 3);
  const tick = now => { if (dday !== 'decided') return; const p = ease(Math.min(1, (now - t0) / D)); cer.setAttribute('d', `M${x0},${yA}V${yB}H${x0 + (xEnd - x0) * p}`); if (p < 1) requestAnimationFrame(tick); else { rr.setAttribute('width', g.W); cer.setAttribute('d', ''); place(); stamp.classList.add('on'); } };
  requestAnimationFrame(tick);
}

/* ---------- 6. among peers: the same seven rows for every country; only the highlight moves ---------- */
function buildPeers() {
  const P = peers(code), max = P.list[0].v;
  $('ladder').innerHTML = P.list.map(p => {
    const md = MODEL[p.k], l = md.policyMoves.at(-1), r = md.last;
    return `<div class="rung" data-c="${p.k}" role="link" tabindex="0">
      <div class="who">${flag(p.k)}<div><b>${META[p.k].name}</b><span>${META[p.k].bank}</span></div></div>
      <div class="track">${r.range ? `<i class="span" style="left:${r.lo / max * 100}%;width:${(r.hi - r.lo) / max * 100}%"></i>` : ''}<i style="width:${r.lo / max * 100}%"></i></div>
      <span class="fig">${vShort(r)}</span>
      <span class="last">${movePill(l.action === 'framework' ? 'framework' : l.dir, l.chg)}<span class="when">${fmtXM(l.t)}</span></span><i class="go" data-lucide="arrow-right"></i></div>`;
  }).join('');
  icons();
  $('ladder').querySelectorAll('.rung').forEach(el => { const go = () => { if (el.dataset.c !== code) location.hash = '#/' + el.dataset.c.toLowerCase(); }; el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter') go(); }; });
}
function renderPeers(mode) {
  const c = code, P = peers(c), i = P.rank - 1, up = P.list[i - 1], dn = P.list[i + 1];
  const nm = k => `${META[k].name} (${vText(MODEL[k].last)})`;
  put($('peerFinding'), `${poss(META[c].name)} ${B(vText(MODEL[c].last))} is the ${RANKW(P.rank)} of the ${WORDS[CODES.length]}${up && dn ? `, between ${nm(up.k)} and ${nm(dn.k)}` : up ? `, below ${nm(up.k)}` : dn ? `, above ${nm(dn.k)}` : ''}.`);
  $('ladder').querySelectorAll('.rung').forEach(el => el.classList.toggle('cur', el.dataset.c === c));
  if (mode === 'first') { stagger($('ladder').children); if (!reduced()) $('ladder').querySelectorAll('.track i').forEach((b, k) => b.animate([{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 480, delay: 80 + Math.floor(k / 2) * 30, easing: EASE, fill: 'backwards' })); }
}

/* First paint of a country page: build every component once, then fill it. */
function renderCountry() {
  painting = true;
  recChart = RecordChart($('rec')); recChart.build();
  gapChart = GapChart($('gapc')); gapChart.build();
  glance = GlanceChart($('glance')); glance.build();
  wireTiles(); buildPeers(); tileViz = null;
  renderChip(); renderHero(0); renderTiles('first'); initLoan(); renderLoan(); renderReach(); renderCycle('first'); renderGap('first');
  renderRecord('first'); renderDecisions('first'); renderPeers('first');
  painting = false;
  requestAnimationFrame(() => { $('loanMode').place(); $('dday').place(); });
}
// A country switch changes data, never the page: one transaction in which text swaps, charts morph from what is on
// screen, and rows glide to their new height. Nothing is rebuilt and no card fades.
function setCountry(next, opts = {}) {
  if (page !== 'country') { location.hash = '#/' + next.toLowerCase(); return; }
  if (next === code && !opts.force) return;
  const dir = CODES.indexOf(next) > CODES.indexOf(code) ? 1 : -1;
  if (replaying) stopReplay(false);
  clearDday(); if (dday !== 'live') { dday = 'live'; $('dday').set('live'); }
  cancelAnimationFrame(revRaf); $('revealRect').setAttribute('width', recGeom.W); $('head').style.opacity = 0; hideTip();
  code = next; if (!opts.preview) store.set('atlas-country', code);
  if (!opts.preview && location.hash !== '#/' + code.toLowerCase()) history.replaceState(null, '', '#/' + code.toLowerCase());
  transact(() => {
    renderChip(dir); renderHero(dir); renderTiles('switch'); initLoan(); renderLoan(); renderReach();
    renderCycle('switch'); renderGap('switch'); renderRecord('switch'); renderDecisions('switch'); renderPeers('switch');
  });
}
// Resizing redraws charts at the new size from the final state (no morph).
function redrawCountry() {
  TX?.flush();
  if (replaying) stopReplay(); clearDday(); dday = 'live'; $('dday').set('live');
  recChart.build(); recGeom = recChart.update(code, false);
  gapChart.build(); gapGeom = gapChart.update(code, false);
  painting = true; renderCycle('static'); renderTiles('static'); painting = false;
  rebuildGlance(); $('loanMode').place();
}
function rebuildGlance() { if (!glance) return; glance.build(); renderGlance(false); }

/* ================= world page ================= */
function worldHTML() {
  return `
  <div class="page-head"><div><h1>Policy rates around the world</h1><p data-prose>${cap(WORDS[CODES.length])} central banks, every move since 2000, checked against official sources. Data as of ${fmtD(TODAY, 'GB')}.</p></div></div>
  <div class="row">
    ${card('pulse', 'span-8', 'The pulse', 'activity',
      `${kick('activity', `Hikes and cuts each quarter across all ${WORDS[CODES.length]} banks`)}<p class="finding" id="pulseFinding" data-prose></p>`,
      '<div class="chart pul" id="pulBox"><svg id="pul" role="img" aria-label="Hikes and cuts per quarter since 2000"></svg></div><div class="legend" id="pulLg"></div>')}
    ${card('latest', 'span-4', 'Latest moves', 'list-ordered',
      `${kick('list-ordered', 'Latest moves')}<p class="finding" id="latestFinding" data-prose></p>`,
      '<div class="fill"><div class="list" id="latestList" data-prose></div></div>')}
  </div>
  <div class="row">
    ${card('board', 'span-12', 'Where every bank stands', 'table-2',
      `${kick('table-2', 'Where every bank stands')}<p class="finding" id="leagueFinding" data-prose></p>`,
      `<div class="table-wrap"><table class="data" id="league">
         <colgroup><col><col style="width:150px"><col style="width:190px"><col style="width:200px"><col style="width:210px"><col style="width:110px"></colgroup>
         <thead><tr>
           <th data-k="name"><button type="button">Central bank<i data-lucide="arrow-down-up"></i></button></th>
           <th class="r" data-k="rate"><button type="button">Policy rate<i data-lucide="arrow-down-up"></i></button></th>
           <th data-k="recent"><button type="button">Last move<i data-lucide="arrow-down-up"></i></button></th>
           <th data-k="y12"><button type="button">12-month change<i data-lucide="arrow-down-up"></i></button></th>
           <th data-k="cycle"><button type="button">Cycle<i data-lucide="arrow-down-up"></i></button></th>
           <th class="r" data-k="gap"><button type="button">vs the Fed<i data-lucide="arrow-down-up"></i></button></th>
         </tr></thead><tbody></tbody></table></div>
       <div class="list league-sm" id="leagueSm" data-prose></div>`)}
  </div>
  <div class="row">
    ${card('upcoming', 'span-12', 'Upcoming decisions', 'calendar-clock',
      `${kick('calendar-clock', 'Upcoming decisions')}<p class="finding" id="upFinding" data-prose></p>`,
      '<div class="upcoming" id="upList" data-prose></div>',
      '<span>Calendars for the ECB, Bank of England, Bank of Canada, RBA and BCB are being added.</span>')}
  </div>
  ${footerHTML()}`;
}
function renderPulse(animate) {
  pulGeom = drawPulse($('pul'));
  $('pulseFinding').innerHTML = pulseFinding().html;
  $('pulLg').innerHTML = '<span><i class="sw" style="background:var(--hawk)"></i>Hikes in the quarter</span><span><i class="sw" style="background:var(--dove)"></i>Cuts in the quarter</span><span><i class="sw" style="background:none;box-shadow:inset 0 0 0 1.5px var(--accent)"></i>This quarter</span>';
  if (animate) growIn([...$('pul').querySelectorAll('rect.up')], '50% 100%', 0, 4), growIn([...$('pul').querySelectorAll('rect.dn')], '50% 0', 0, 4);
}
function wirePulse() {
  const svg = $('pul');
  svg.addEventListener('pointermove', e => {
    if (!pulGeom) return;
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (pulGeom.W / r.width), i = Math.floor((px - pulGeom.M.l) / pulGeom.bw), d = pulGeom.data[i];
    if (!d) return;
    $('pulBox').classList.add('hl'); svg.querySelectorAll('rect.up,rect.dn').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
    const list = [...d.up, ...d.dn].sort((a, b) => a.t - b.t);
    const row = m => `<div class="t-row"><span>${sw(`var(--${m.dir === 'hike' ? 'hawk' : 'dove'})`)}${META[m.c].short} · ${fmtXD(m.t)}</span><span class="t-num">${sgn(m.chg)}</span></div>`;
    showTip(`<div class="t-title">${qLabel(d.q)}</div><div class="t-sub">${d.up.length} hike${d.up.length === 1 ? '' : 's'}, ${d.dn.length} cut${d.dn.length === 1 ? '' : 's'}</div>${list.length ? '<div class="t-rule"></div>' + list.slice(0, 10).map(row).join('') + (list.length > 10 ? `<div class="t-sub" style="margin-top:6px">and ${list.length - 10} more</div>` : '') : ''}`, e.clientX, e.clientY);
  });
  svg.addEventListener('pointerleave', () => { $('pulBox').classList.remove('hl'); svg.querySelectorAll('rect.on').forEach(b => b.classList.remove('on')); hideTip(); });
}
function renderLatest(animate) {
  const recent = ALLMOVES.filter(m => m.action !== 'framework').slice(-14).reverse(), last = recent[0], n90 = ALLMOVES.filter(m => m.t > T_TODAY - 90 * DAY).length;
  const when = last.t === T_TODAY ? 'today' : `on ${fmtXD(last.t)}`;
  $('latestFinding').innerHTML = `${B(n90)} moves in the last 90 days. The latest: the ${META[last.c].short}’s ${last.dir} to ${B(vText(last))} ${when}.`;
  $('latestList').innerHTML = recent.map(m => `<div class="item link" data-c="${m.c}" role="link" tabindex="0">${flag(m.c)}<span class="title">${META[m.c].short} ${m.dir === 'hike' ? 'raised' : 'cut'} to ${vText(m)}</span><span class="fig">${sgn(m.chg)}</span><span class="sub">${fmtXD(m.t)} · ${moveContext(m)}</span></div>`).join('');
  $('latestList').querySelectorAll('.item').forEach(el => { const go = () => { location.hash = '#/' + el.dataset.c.toLowerCase(); }; el.onclick = go; el.onkeydown = e => { if (e.key === 'Enter') go(); }; });
  if (animate) stagger([...$('latestList').children].slice(0, 10));
}
function leagueRows() {
  return CODES.map(c => {
    const md = MODEL[c], last = md.policyMoves.at(-1), st = stanceOfPlay(c);
    return { c, name: META[c].name, rate: md.last.hi, recent: last.t, y12: md.last.hi - valueAt(c, T_TODAY - 365 * DAY).hi, cycle: st.cls === 'hike' ? 2 : st.cls === 'cut' ? 0 : 1, gap: c === 'US' ? null : md.last.hi - MODEL.US.last.hi, last, st };
  });
}
function renderLeague(animate) {
  const rows = leagueRows(), k = sortKey;
  rows.sort((a, b) => (k === 'name' ? a.name.localeCompare(b.name) * sortDir : ((a[k] ?? -1e9) - (b[k] ?? -1e9)) * sortDir));
  const my12 = Math.max(...rows.map(r => Math.abs(r.y12)), 25), tb = $('league').tBodies[0];
  const first = new Map([...tb.rows].map(r => [r.dataset.c, r.getBoundingClientRect().top]));
  tb.innerHTML = rows.map(r => {
    const w = Math.abs(r.y12) / my12 * 50, l = r.last;
    return `<tr data-c="${r.c}" class="link${r.c === code ? ' cur' : ''}" tabindex="0">
      <td><div class="who">${flag(r.c)}<div><b>${META[r.c].name}</b><span>${META[r.c].bank}</span></div></div></td>
      <td class="r"><span class="fig">${vShort(MODEL[r.c].last)}</span><span class="sub">${META[r.c].inst}</span></td>
      <td>${movePill(l.action === 'framework' ? 'framework' : l.dir, l.chg)}<span class="when">${fmtXM(l.t)}</span></td>
      <td><span class="div"><i style="${r.y12 >= 0 ? `left:50%;width:${w}%;background:var(--hawk);--o:left` : `right:50%;width:${w}%;background:var(--dove);--o:right`}"></i></span><span class="fig">${sgn(r.y12)}</span></td>
      <td><span class="state ${r.st.cls}"><i></i>${r.st.txt}</span></td>
      <td class="r">${r.gap == null ? '<span class="when">Benchmark</span>' : `<span class="fig">${sgn(r.gap)}</span>`}</td></tr>`;
  }).join('');
  if (!reduced()) { if (first.size) [...tb.rows].forEach(r => { const dy = first.get(r.dataset.c) - r.getBoundingClientRect().top; if (dy) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 300, easing: EASE }); }); else if (animate) stagger(tb.rows); }
  tb.querySelectorAll('tr').forEach(r => { const go = () => { location.hash = '#/' + r.dataset.c.toLowerCase(); }; r.onclick = go; r.onkeydown = e => { if (e.key === 'Enter') go(); }; });
  $('league').querySelectorAll('th').forEach(th => { if (th.dataset.k === sortKey) th.setAttribute('aria-sort', sortDir < 0 ? 'descending' : 'ascending'); else th.removeAttribute('aria-sort'); });
  const hik = rows.filter(r => r.st.cls === 'hike').length, cut = rows.filter(r => r.st.cls === 'cut').length, hold = rows.length - hik - cut;
  const mx = rows.reduce((a, r) => (r.rate > a.rate ? r : a)), mn = rows.reduce((a, r) => (r.rate < a.rate ? r : a));
  $('leagueFinding').innerHTML = `${cap(WORDS[hik])} tightening, ${WORDS[cut]} easing and ${WORDS[hold]} on hold. Policy rates run from ${B(vText(MODEL[mn.c].last))} at the ${META[mn.c].short} to ${B(vText(MODEL[mx.c].last))} at the ${META[mx.c].short}.`;
  $('leagueSm').innerHTML = rows.map(r => `<div class="item link" data-c="${r.c}" role="link" tabindex="0">${flag(r.c)}<span class="title">${META[r.c].name}</span><span class="fig">${vShort(MODEL[r.c].last)}</span><span class="sub">${r.st.txt}</span></div>`).join('');
  $('leagueSm').querySelectorAll('.item').forEach(el => { el.onclick = () => { location.hash = '#/' + el.dataset.c.toLowerCase(); }; });
}
function wireLeague() {
  $('league').tHead.addEventListener('click', e => { const th = e.target.closest('th'); if (!th) return; const k = th.dataset.k; sortDir = sortKey === k ? -sortDir : k === 'name' ? 1 : -1; sortKey = k; renderLeague(); });
}
function renderUpcoming(animate) {
  const items = CODES.flatMap(c => MODEL[c].next.map(iso => ({ c, iso, t: Date.parse(iso) }))).sort((a, b) => a.t - b.t).slice(0, 4);
  const f = items[0] && fmtNext(items[0].iso, items[0].c);
  $('upFinding').innerHTML = f ? `Next up: the ${META[items[0].c].short} on ${nw(f.date)}, ${f.inText}.` : 'No decisions scheduled in the tracked calendars.';
  $('upList').innerHTML = items.map(it => { const n = fmtNext(it.iso, it.c); return `<div class="up"><div class="who">${flag(it.c)}<div><b>${META[it.c].bank}</b><span>${META[it.c].inst}</span></div></div><time datetime="${it.iso}">${n.date}</time><span class="eta">${n.time} · ${n.inText}</span></div>`; }).join('');
  if (animate) stagger($('upList').children);
}
function renderWorld(animate = true) { renderChip(); renderPulse(animate); renderLatest(animate); renderLeague(animate); renderUpcoming(animate); }

/* ================= shell: routing, rail, crumb, palette ================= */
const RAIL = {
  country: [['decision', 'landmark', 'The decision'], ['loan', 'wallet', 'Your loan'], ['cycle', 'repeat', 'The cycle'], ['gap', 'arrow-left-right', 'Against the Fed'], ['record', 'chart-line', 'The record'], ['#/world', 'globe', 'World view']],
  world: [['pulse', 'activity', 'The pulse'], ['board', 'table-2', 'Every bank'], ['upcoming', 'calendar-clock', 'Upcoming'], ['#/country', 'landmark', 'Country view']],
};
function setRail() {
  const items = RAIL[page].map(([go, ic, label]) => {
    if (go === 'gap') label = $('gap')?.dataset.name || label;
    if (go === '#/country') { go = '#/' + code.toLowerCase(); label = META[code].name; }
    return go.startsWith('#') ? `<a class="rail-btn" href="${go}" data-tip="${label}"><i data-lucide="${ic}"></i><span class="rl">${label}</span></a>`
      : `<button type="button" class="rail-btn" data-go="${go}" data-tip="${label}" aria-current="${go === curSec}"><i data-lucide="${ic}"></i><span class="rl">${label}</span></button>`;
  }).join('');
  if ($('railNav').dataset.sig === items) return;
  $('railNav').dataset.sig = items; $('railNav').innerHTML = items; icons();
  $('railNav').querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => jump(b.dataset.go)));
}
let curSec = null;
const sections = () => [...document.querySelectorAll('#page [data-name]')].filter(s => s.getClientRects().length);
function setCrumb(id, force) {
  if (id === curSec && !force) return;
  const secs = sections(), from = secs.findIndex(s => s.id === curSec), to = secs.findIndex(s => s.id === id), d = to >= from ? 'down' : 'up';
  curSec = id; const sec = secs[to]; if (!sec) return;
  roll($('crumbSlot'), `<i data-lucide="${sec.dataset.icon}"></i><span>${sec.dataset.name}</span>`, d, force);
  icons();
  const railId = { cycles: 'cycle', decisions: 'record', reach: 'loan', peers: 'record', latest: 'pulse' }[id] || id;
  document.querySelectorAll('#railNav [data-go]').forEach(b => b.setAttribute('aria-current', String(b.dataset.go === railId)));
  setDock(page === 'world' ? 'world' : ({ cycles: 'cycle', gap: 'cycle', decisions: 'record', reach: 'loan', peers: 'record' }[id] || id));
}
const mobile = () => innerWidth <= 720;
// Rolling title: exactly one label arrives and at most one leaves. Anything still leaving when a newer label arrives is
// dropped at once, so fast scrolling never stacks titles on top of each other.
function roll(slot, html, d, instant) {
  slot.querySelectorAll('.crumb.leaving').forEach(o => o.remove());
  const cur = slot.querySelector('.crumb'), el = document.createElement('span');
  el.className = 'crumb'; el.innerHTML = html; slot.appendChild(el);
  if (!cur) return;
  if (instant || reduced()) { cur.remove(); return; }
  const k = d === 'down' ? 1 : -1, from = getComputedStyle(cur).transform;
  cur.getAnimations().forEach(a => a.cancel()); cur.classList.add('leaving');
  cur.animate([{ transform: from === 'none' ? 'none' : from, opacity: 1 }, { transform: `translateY(${-100 * k}%)`, opacity: 0 }], { duration: 300, easing: EASE, fill: 'forwards' }).onfinish = () => cur.remove();
  el.animate([{ transform: `translateY(${100 * k}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: EASE });
}
let spyRaf = 0;
const spyLater = () => { if (!spyRaf) spyRaf = requestAnimationFrame(() => { spyRaf = 0; spy(); }); };
function spy() { const top = (mobile() ? 0 : $('canvas').getBoundingClientRect().top) + (mobile() ? 96 : 120); const secs = sections(); let id = secs[0]?.id; for (const s of secs) if (s.getBoundingClientRect().top <= top) id = s.id; if (id) setCrumb(id); }
function jump(id) { const s = $(id); if (!s) return; const b = reduced() ? 'auto' : 'smooth'; if (!mobile()) $('canvas').scrollTo({ top: s.offsetTop - 72, behavior: b }); else scrollTo({ top: s.getBoundingClientRect().top + scrollY - 76, behavior: b }); }

/* phone dock: page-level tabs; the active tab is an ink pill with its label, gliding between tabs */
const DOCK = [['decision', 'landmark', 'Decision'], ['loan', 'wallet', 'Loan'], ['cycle', 'repeat', 'Cycle'], ['record', 'chart-line', 'Record'], ['world', 'globe', 'World']];
let pendingJump = null, dockOn = null;
function buildDock() {
  $('mTabs').insertAdjacentHTML('beforeend', DOCK.map(([id, ic, label]) => `<button type="button" class="m-tab" data-tab="${id}" aria-label="${label}"><i data-lucide="${ic}"></i><span class="m-tab-label"><span>${label}</span></span></button>`).join(''));
  icons();
  $('mTabs').addEventListener('click', e => {
    const b = e.target.closest('.m-tab'); if (!b) return; const id = b.dataset.tab;
    if (id === 'world') { if (page !== 'world') location.hash = '#/world'; else scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); return; }
    if (page === 'world') { pendingJump = id === 'decision' ? null : id; location.hash = '#/' + code.toLowerCase(); return; }
    jump(id);
  });
}
function setDock(id) {
  if (!DOCK.some(d => d[0] === id) || id === dockOn) return; dockOn = id;
  $('mTabs').querySelectorAll('.m-tab').forEach(b => { const on = b.dataset.tab === id; b.toggleAttribute('data-on', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  placePill();
}
function placePill() {
  const on = $('mTabs').querySelector('.m-tab[data-on]'), pill = $('mPill'); if (!on || !on.offsetWidth) return;
  pill.style.width = on.offsetWidth + 'px'; pill.style.transform = `translateX(${on.offsetLeft}px)`;
  if (!$('mTabs').dataset.ready) requestAnimationFrame(() => { $('mTabs').dataset.ready = '1'; });
}

let firstRoute = true;
function route() {
  const h = location.hash.replace(/^#\/?/, '').toLowerCase();
  const next = h === 'world' ? 'world' : 'country';
  const cc = h.toUpperCase();
  if (next === 'country' && MODEL[cc] && page === 'country') { if (cc !== code) setCountry(cc); return; }
  if (next === 'country' && MODEL[cc]) { code = cc; store.set('atlas-country', code); }
  if (next === 'country' && !MODEL[cc]) { history.replaceState(null, '', '#/' + code.toLowerCase()); }
  if (replaying) stopReplay(false);
  TX?.flush(); hideTip(); page = next; dday = 'live'; curSec = null;
  $('page').innerHTML = page === 'world' ? worldHTML() : countryHTML();
  icons();
  if (page === 'country') { wireLoan(); wireCycle(); wireGap(); wireRecord(); renderCountry(); observeGlance(); }
  else { wirePulse(); wireLeague(); renderWorld(firstRoute); }
  setRail(); $('canvas').scrollTop = 0; if (mobile()) scrollTo(0, 0);
  setCrumb(sections()[0].id, true);
  if (pendingJump) { const id = pendingJump; pendingJump = null; requestAnimationFrame(() => jump(id)); }
  if (firstRoute) stagger(document.querySelectorAll('#page .card, #page .tiles, #page .page-head'), 0);
  else if (!reduced()) $('page').animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
  firstRoute = false;
}

/* palette (country switcher) */
let palOrigin = null, palSel = 0, palItems = [];
function renderPal(q = '') {
  const s = q.trim().toLowerCase();
  palItems = CODES.filter(c => !s || [c, META[c].name, META[c].bank, META[c].inst, META[c].short].join(' ').toLowerCase().includes(s));
  palSel = Math.max(0, Math.min(palSel, palItems.length - 1));
  $('palList').innerHTML = palItems.map((c, i) => { const l = MODEL[c].policyMoves.at(-1); return `<li role="option" id="opt-${c}" data-c="${c}" aria-selected="${i === palSel}">${flag(c)}<span style="min-width:0"><div class="nm">${META[c].name}</div><div class="bk">${META[c].bank} · ${stanceOfPlay(c).txt}</div></span><span class="pv">${mark(l.dir)}<span class="num">${vShort(MODEL[c].last)}</span></span></li>`; }).join('') || '<li aria-disabled="true"><span></span><span class="bk">No match</span><span></span></li>';
  $('palIn').setAttribute('aria-activedescendant', palItems[palSel] ? `opt-${palItems[palSel]}` : '');
}
function openPal() { palOrigin = code; palSel = Math.max(0, CODES.indexOf(code)); const sc = $('scrim'); sc.hidden = false; $('palIn').value = ''; renderPal(''); stagger($('palList').children); requestAnimationFrame(() => { sc.classList.add('on'); $('palIn').focus(); }); }
function closePal(commit) {
  const sc = $('scrim'); if (sc.hidden) return;
  if (!commit && page === 'country' && palOrigin && code !== palOrigin) setCountry(palOrigin);
  if (commit) store.set('atlas-country', code);
  sc.classList.remove('on'); setTimeout(() => { sc.hidden = true; }, reduced() ? 0 : 180); (mobile() ? $('mFlag') : $('openPal')).focus();
}
function pick(c) { if (page === 'country') { setCountry(c); history.replaceState(null, '', '#/' + c.toLowerCase()); } else location.hash = '#/' + c.toLowerCase(); closePal(true); }
function movePal(d) { if (!palItems.length) return; palSel = (palSel + d + palItems.length) % palItems.length; renderPal($('palIn').value); $('opt-' + palItems[palSel])?.scrollIntoView({ block: 'nearest' }); if (page === 'country') setCountry(palItems[palSel], { preview: true }); }

function boot() {
  icons();
  $('openPal').addEventListener('click', openPal);
  $('palIn').addEventListener('input', e => { palSel = 0; renderPal(e.target.value); });
  $('palIn').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); movePal(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); movePal(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = palItems[palSel]; if (c) pick(c); } else if (e.key === 'Escape') { e.preventDefault(); closePal(false); }
  });
  $('palList').addEventListener('click', e => { const li = e.target.closest('li[data-c]'); if (li) pick(li.dataset.c); });
  $('palList').addEventListener('pointermove', e => { const li = e.target.closest('li[data-c]'); if (!li) return; const i = palItems.indexOf(li.dataset.c); if (i === palSel) return; palSel = i; $('palList').querySelectorAll('li[data-c]').forEach(n => n.setAttribute('aria-selected', String(n === li))); $('palIn').setAttribute('aria-activedescendant', li.id); });
  $('scrim').addEventListener('pointerdown', e => { if (e.target === $('scrim')) closePal(false); });
  addEventListener('keydown', e => { const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName); if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); $('scrim').hidden ? openPal() : closePal(false); } });
  $('canvas').addEventListener('scroll', () => { $('canvas').classList.toggle('scrolled', $('canvas').scrollTop > 4); spyLater(); }, { passive: true });
  addEventListener('scroll', () => { if (mobile()) { $('mTop').toggleAttribute('data-scrolled', scrollY > 4); spyLater(); } }, { passive: true });
  buildDock();
  $('mMark').addEventListener('click', () => scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }));
  $('mFlag').addEventListener('click', openPal);
  $('mTheme').addEventListener('click', () => $('themeBtn').click());
  addEventListener('resize', placePill);
  $('railBtn').addEventListener('click', () => { const f = $('frame'), open = !f.classList.contains('open'); f.classList.toggle('open', open); $('railBtn').setAttribute('aria-expanded', String(open)); $('railBtn').dataset.tip = open ? 'Collapse' : 'Expand'; });
  $('themeBtn').addEventListener('click', () => { const root = document.documentElement, dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; const apply = () => { root.dataset.theme = dark ? 'light' : 'dark'; store.set('atlas-theme', root.dataset.theme); }; if (document.startViewTransition && !reduced()) document.startViewTransition(apply); else apply(); });
  let palette = store.get('atlas-palette') === 'clay' ? 'clay' : 'claret';
  const applyPalette = (p, animate) => { const root = document.documentElement; if (animate && !reduced()) { root.classList.add('palette-switching'); setTimeout(() => root.classList.remove('palette-switching'), 320); } root.dataset.palette = p; const nm = p === 'clay' ? 'Clay' : 'Claret'; $('palBtn').dataset.tip = `Palette: ${nm}`; $('palLbl').textContent = `Palette: ${nm}`; store.set('atlas-palette', p); };
  applyPalette(palette, false);
  $('palBtn').addEventListener('click', () => { palette = palette === 'claret' ? 'clay' : 'claret'; applyPalette(palette, true); });
  addEventListener('hashchange', route);
  route();
  let lastW = $('page').clientWidth, rt = 0;
  new ResizeObserver(() => {
    const w = $('page').clientWidth; if (w === lastW) return; lastW = w; cancelAnimationFrame(rt);
    rt = requestAnimationFrame(() => {
      hideTip();
      if (page === 'country') redrawCountry();
      else renderPulse(false);
    });
  }).observe($('page'));
}
let glanceRO = null;
function observeGlance() {
  glanceRO?.disconnect(); let h = $('glance').clientHeight;
  glanceRO = new ResizeObserver(() => { const g = $('glance'); if (!g || Math.abs(g.clientHeight - h) < 1) return; h = g.clientHeight; onSettle(rebuildGlance); });
  glanceRO.observe($('glance'));
}
(document.fonts?.ready || Promise.resolve()).then(boot);
