/* The world page: the pulse, latest moves, the league table and upcoming decisions. Ported from the approved prototype. */
import {
  ALLMOVES, B, CODES, DAY, META, MODEL, TODAY, T_TODAY, WORDS, cap, flag, fmtD, fmtNext, fmtXD, fmtXM, moveContext, movePill, nw,
  pulseFinding, sgn, stanceOfPlay, vShort, vText, valueAt,
} from '../lib/atlas.ts';
import type { Code } from '../lib/atlas.ts';
import { EASE, growIn, reduced, stagger } from '../lib/motion.ts';
import { drawPulse, qLabel } from '../charts/charts.ts';
import { $, $svg, hideTip, pathFor, showTip, state, sw } from './dom.ts';
import { card, footerHTML, kick } from './templates.ts';

export function worldHTML(): string {
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

export function renderPulse(animate: boolean): void {
  if (!state.ssr) state.pulGeom = drawPulse($svg('pul'));
  $('pulseFinding').innerHTML = pulseFinding().html;
  $('pulLg').innerHTML = '<span><i class="sw" style="background:var(--hawk)"></i>Hikes in the quarter</span><span><i class="sw" style="background:var(--dove)"></i>Cuts in the quarter</span><span><i class="sw" style="background:none;box-shadow:inset 0 0 0 1.5px var(--accent)"></i>This quarter</span>';
  if (animate && !state.ssr) { growIn($svg('pul').querySelectorAll('rect.up'), '50% 100%', 0, 4); growIn($svg('pul').querySelectorAll('rect.dn'), '50% 0', 0, 4); }
}
function wirePulse() {
  const svg = $svg('pul');
  svg.addEventListener('pointermove', e => {
    const g = state.pulGeom; if (!g) return;
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * (g.W / r.width), i = Math.floor((px - g.M.l) / g.bw), d = g.data[i];
    if (!d) return;
    $('pulBox').classList.add('hl'); svg.querySelectorAll<SVGElement>('rect.up,rect.dn').forEach(b => b.classList.toggle('on', +b.dataset.i! === i));
    const list = [...d.up, ...d.dn].sort((a, b) => a.t - b.t);
    const row = (m: (typeof list)[number]) => `<div class="t-row"><span>${sw(`var(--${m.dir === 'hike' ? 'hawk' : 'dove'})`)}${META[m.c].short} · ${fmtXD(m.t)}</span><span class="t-num">${sgn(m.chg)}</span></div>`;
    showTip(`<div class="t-title">${qLabel(d.q)}</div><div class="t-sub">${d.up.length} hike${d.up.length === 1 ? '' : 's'}, ${d.dn.length} cut${d.dn.length === 1 ? '' : 's'}</div>${list.length ? '<div class="t-rule"></div>' + list.slice(0, 10).map(row).join('') + (list.length > 10 ? `<div class="t-sub" style="margin-top:6px">and ${list.length - 10} more</div>` : '') : ''}`, e.clientX, e.clientY);
  });
  svg.addEventListener('pointerleave', () => { $('pulBox').classList.remove('hl'); svg.querySelectorAll('rect.on').forEach(b => b.classList.remove('on')); hideTip(); });
}
function renderLatest(animate: boolean) {
  const recent = ALLMOVES.filter(m => m.action !== 'framework').slice(-14).reverse(), last = recent[0], n90 = ALLMOVES.filter(m => m.t > T_TODAY - 90 * DAY).length;
  const when = last.t === T_TODAY ? 'today' : `on ${fmtXD(last.t)}`;
  $('latestFinding').innerHTML = `${B(n90)} moves in the last 90 days. The latest: the ${META[last.c].short}’s ${last.dir} to ${B(vText(last))} ${when}.`;
  $('latestList').innerHTML = recent.map(m => `<a class="item link" data-c="${m.c}" href="${pathFor(m.c)}" data-link data-via="latest">${flag(m.c)}<span class="title">${META[m.c].short} ${m.dir === 'hike' ? 'raised' : 'cut'} to ${vText(m)}</span><span class="fig">${sgn(m.chg)}</span><span class="sub">${fmtXD(m.t)} · ${moveContext(m)}</span></a>`).join('');
  if (animate && !state.ssr) stagger(Array.from($('latestList').children).slice(0, 10));
}
type LeagueRow = { c: Code; name: string; rate: number; recent: number; y12: number; cycle: number; gap: number | null };
function leagueRows(): LeagueRow[] {
  return CODES.map(c => {
    const md = MODEL[c], last = md.policyMoves[md.policyMoves.length - 1], st = stanceOfPlay(c);
    return { c, name: META[c].name, rate: md.last.hi, recent: last.t, y12: md.last.hi - valueAt(c, T_TODAY - 365 * DAY).hi, cycle: st.cls === 'hike' ? 2 : st.cls === 'cut' ? 0 : 1, gap: c === 'US' ? null : md.last.hi - MODEL.US.last.hi };
  });
}
function renderLeague(animate = false) {
  const rows = leagueRows(), k = state.sortKey, dir = state.sortDir;
  rows.sort((a, b) => (k === 'name' ? a.name.localeCompare(b.name) * dir : ((a[k] ?? -1e9) - (b[k] ?? -1e9)) * dir));
  const my12 = Math.max(...rows.map(r => Math.abs(r.y12)), 25), tb = $('league').querySelector('tbody')!, trs = () => Array.from(tb.querySelectorAll<HTMLTableRowElement>('tr'));
  const first = new Map(trs().map(r => [r.dataset.c, r.getBoundingClientRect().top]));
  // Rows are links so they work without script and read as links to assistive tech; the whole row is the hit target.
  tb.innerHTML = rows.map(r => {
    const w = Math.abs(r.y12) / my12 * 50, md = MODEL[r.c], l = md.policyMoves[md.policyMoves.length - 1], st = stanceOfPlay(r.c);
    return `<tr data-c="${r.c}" class="link${r.c === state.code ? ' cur' : ''}">
      <td><a class="who" href="${pathFor(r.c)}" data-link data-via="league">${flag(r.c)}<div><b>${META[r.c].name}</b><span>${META[r.c].bank}</span></div></a></td>
      <td class="r"><span class="fig">${vShort(md.last)}</span><span class="sub">${META[r.c].inst}</span></td>
      <td>${movePill(l.action === 'framework' ? 'framework' : l.dir, l.chg)}<span class="when">${fmtXM(l.t)}</span></td>
      <td><span class="div"><i style="${r.y12 >= 0 ? `left:50%;width:${w}%;background:var(--hawk);--o:left` : `right:50%;width:${w}%;background:var(--dove);--o:right`}"></i></span><span class="fig">${sgn(r.y12)}</span></td>
      <td><span class="state ${st.cls}"><i></i>${st.txt}</span></td>
      <td class="r">${r.gap == null ? '<span class="when">Benchmark</span>' : `<span class="fig">${sgn(r.gap)}</span>`}</td></tr>`;
  }).join('');
  if (!state.ssr && !reduced()) {
    if (first.size) trs().forEach(r => { const dy = (first.get(r.dataset.c) ?? 0) - r.getBoundingClientRect().top; if (dy) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 300, easing: EASE }); });
    else if (animate) stagger(trs());
  }
  $('league').querySelectorAll<HTMLElement>('th').forEach(th => { if (th.dataset.k === k) th.setAttribute('aria-sort', dir < 0 ? 'descending' : 'ascending'); else th.removeAttribute('aria-sort'); });
  const sts = rows.map(r => stanceOfPlay(r.c).cls), hik = sts.filter(s => s === 'hike').length, cut = sts.filter(s => s === 'cut').length, hold = rows.length - hik - cut;
  const mx = rows.reduce((a, r) => (r.rate > a.rate ? r : a)), mn = rows.reduce((a, r) => (r.rate < a.rate ? r : a));
  $('leagueFinding').innerHTML = `${cap(WORDS[hik])} tightening, ${WORDS[cut]} easing and ${WORDS[hold]} on hold. Policy rates run from ${B(vText(MODEL[mn.c].last))} at the ${META[mn.c].short} to ${B(vText(MODEL[mx.c].last))} at the ${META[mx.c].short}.`;
  $('leagueSm').innerHTML = rows.map(r => `<a class="item link" data-c="${r.c}" href="${pathFor(r.c)}" data-link data-via="league">${flag(r.c)}<span class="title">${META[r.c].name}</span><span class="fig">${vShort(MODEL[r.c].last)}</span><span class="sub">${stanceOfPlay(r.c).txt}</span></a>`).join('');
}
function wireLeague() {
  const table = $<HTMLTableElement>('league');
  table.querySelector('thead')!.addEventListener('click', e => {
    const th = (e.target as Element).closest<HTMLElement>('th'); if (!th) return;
    const k = th.dataset.k as typeof state.sortKey; state.sortDir = state.sortKey === k ? -state.sortDir : k === 'name' ? 1 : -1; state.sortKey = k; renderLeague();
  });
  // A click anywhere on a row follows the row's link.
  table.querySelector('tbody')!.addEventListener('click', e => { if ((e.target as Element).closest('a')) return; const tr = (e.target as Element).closest('tr'); tr?.querySelector<HTMLAnchorElement>('a[data-link]')?.click(); });
}
function renderUpcoming(animate: boolean) {
  const items = CODES.flatMap(c => MODEL[c].next.map(iso => ({ c, iso, t: Date.parse(iso) }))).filter(it => it.t > Date.now()).sort((a, b) => a.t - b.t).slice(0, 4);
  const f = items[0] && fmtNext(items[0].iso, items[0].c);
  $('upFinding').innerHTML = f ? `Next up: the ${META[items[0].c].short} on ${nw(f.date)}, ${f.inText}.` : 'No decisions scheduled in the tracked calendars.';
  $('upList').innerHTML = items.map(it => { const n = fmtNext(it.iso, it.c); return `<div class="up"><div class="who">${flag(it.c)}<div><b>${META[it.c].bank}</b><span>${META[it.c].inst}</span></div></div><time datetime="${it.iso}">${n.date}</time><span class="eta">${n.time} · ${n.inText}</span></div>`; }).join('');
  if (animate && !state.ssr) stagger($('upList').children);
}

/** First paint of the world page (or the prerender). */
export function renderWorld(animate: boolean): void {
  if (!state.ssr) { wirePulse(); wireLeague(); }
  renderPulse(animate); renderLatest(animate); renderLeague(animate); renderUpcoming(animate);
  document.title = 'Policy rates around the world · Policy Rate Atlas';
}
