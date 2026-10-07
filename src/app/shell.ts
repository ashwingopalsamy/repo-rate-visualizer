/* The shell: path routing, the rail, the rolling crumb, the phone dock, the country palette and the theme. The page
   inside #page is the only thing a route replaces; a country switch on a country page replaces nothing. */
import { CODES, META, MODEL, T_TODAY, DAY, flag, isCode, mark, stanceOfPlay, vShort } from '../lib/atlas.ts';
import type { Code } from '../lib/atlas.ts';
import { EASE, flushTransaction, reduced, stagger, store } from '../lib/motion.ts';
import { makeIcons } from '../lib/icons.ts';
import { track } from '../analytics/track.ts';
import type { VIA } from '../analytics/schema.ts';
import { $, hideTip, mobile, pathFor, state } from './dom.ts';
import { jump, navigate, onRailChange, onRoute, roll } from './nav.ts';
import { commitCountry, countryHTML, leaveCountry, redrawCountry, renderChip, renderCountry, setCountry } from './country.ts';
import { renderPulse, renderWorld, worldHTML } from './world.ts';
import { privacyHTML, renderPrivacy } from './privacy.ts';
import { notFoundHTML, renderNotFound } from './notfound.ts';

type Via = (typeof VIA)[number];
type Page = 'country' | 'world' | 'privacy' | 'notfound';
export type Route = { page: Page; cc: Code | null };

/** Maps a pathname to a page. */
export function parsePath(path: string): Route {
  const seg = path.replace(/^\/+|\/+$/g, '').replace(/\/index\.html$|^index\.html$/, '').toLowerCase();
  if (seg === '') return { page: 'world', cc: null };
  if (seg === 'privacy') return { page: 'privacy', cc: null };
  const cc = seg.toUpperCase();
  if (isCode(cc) && MODEL[cc]) return { page: 'country', cc };
  return { page: 'notfound', cc: null };
}
export const routeKey = (r: Route) => (r.page === 'country' ? `country:${r.cc}` : r.page);
export const pageHTML = (p: Page) => (p === 'world' ? worldHTML() : p === 'privacy' ? privacyHTML() : p === 'notfound' ? notFoundHTML() : countryHTML());

/* ---------- rail and crumb ---------- */
const RAIL: Record<Page, [string, string, string][]> = {
  country: [['decision', 'landmark', 'The decision'], ['loan', 'wallet', 'Your loan'], ['cycle', 'repeat', 'The cycle'], ['gap', 'arrow-left-right', 'Against the Fed'], ['record', 'chart-line', 'The record'], ['/', 'globe', 'World view']],
  world: [['pulse', 'activity', 'The pulse'], ['board', 'table-2', 'Every bank'], ['upcoming', 'calendar-clock', 'Upcoming'], ['/country', 'landmark', 'Country view']],
  privacy: [['counted', 'activity', 'What is counted'], ['kept', 'history', 'How long'], ['off', 'shield-check', 'Switching it off'], ['/', 'globe', 'World view']],
  notfound: [['banks', 'globe', 'Every central bank'], ['/', 'globe', 'World view']],
};
export function setRail(): void {
  const page = state.page ?? 'world';
  const items = RAIL[page].map(([go, ic, label]) => {
    if (go === 'gap') label = $('gap')?.dataset.name || label;
    if (go === '/country') { go = pathFor(state.code); label = META[state.code].name; }
    return go.startsWith('/') ? `<a class="rail-btn" href="${go}" data-link data-tip="${label}"><i data-lucide="${ic}"></i><span class="rl">${label}</span></a>`
      : `<button type="button" class="rail-btn" data-go="${go}" data-tip="${label}" aria-current="${go === state.curSec}"><i data-lucide="${ic}"></i><span class="rl">${label}</span></button>`;
  }).join('');
  const nav = $('railNav');
  if (railSig.get(nav) === items) return;
  railSig.set(nav, items); nav.innerHTML = items; makeIcons(nav);
}
const railSig = new WeakMap<HTMLElement, string>();
const sections = () => Array.from(document.querySelectorAll<HTMLElement>('#page [data-name]')).filter(s => s.getClientRects().length);
function setCrumb(id: string, force = false) {
  if (id === state.curSec && !force) return;
  const secs = sections(), from = secs.findIndex(s => s.id === state.curSec), to = secs.findIndex(s => s.id === id), d = to >= from ? 'down' : 'up';
  state.curSec = id; const sec = secs[to]; if (!sec) return;
  roll($('crumbSlot'), `<i data-lucide="${sec.dataset.icon}"></i><span>${sec.dataset.name}</span>`, d, force);
  makeIcons($('crumbSlot'));
  const railId = ({ cycles: 'cycle', decisions: 'record', reach: 'loan', peers: 'record', latest: 'pulse' } as Record<string, string>)[id] || id;
  document.querySelectorAll<HTMLElement>('#railNav [data-go]').forEach(b => b.setAttribute('aria-current', String(b.dataset.go === railId)));
  setDock(state.page === 'country' ? (({ cycles: 'cycle', gap: 'cycle', decisions: 'record', reach: 'loan', peers: 'record' } as Record<string, string>)[id] || id) : state.page === 'world' ? 'world' : '');
}
let spyRaf = 0;
const spyLater = () => { if (!spyRaf) spyRaf = requestAnimationFrame(() => { spyRaf = 0; spy(); }); };
function spy() {
  const top = (mobile() ? 0 : $('canvas').getBoundingClientRect().top) + (mobile() ? 96 : 120), secs = sections();
  let id = secs[0]?.id; for (const s of secs) if (s.getBoundingClientRect().top <= top) id = s.id;
  if (id) setCrumb(id);
}

/* ---------- phone dock: page-level tabs; the active tab is an ink pill with its label, gliding between tabs ---------- */
const DOCK = [['decision', 'landmark', 'Decision'], ['loan', 'wallet', 'Loan'], ['cycle', 'repeat', 'Cycle'], ['record', 'chart-line', 'Record'], ['world', 'globe', 'World']];
let pendingJump: string | null = null, dockOn: string | null = null;
function buildDock() {
  const tabs = $('mTabs');
  tabs.insertAdjacentHTML('beforeend', DOCK.map(([id, ic, label]) => `<button type="button" class="m-tab" data-tab="${id}" aria-label="${label}"><i data-lucide="${ic}"></i><span class="m-tab-label"><span>${label}</span></span></button>`).join(''));
  makeIcons(tabs);
  tabs.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.m-tab'); if (!b) return; const id = b.dataset.tab!;
    if (id === 'world') { if (state.page !== 'world') { pendingVia = 'dock'; navigate('/'); } else scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); return; }
    if (state.page !== 'country') { pendingJump = id === 'decision' ? null : id; pendingVia = 'dock'; navigate(pathFor(state.code)); return; }
    jump(id);
  });
}
function setDock(id: string) {
  if (id === dockOn) return; dockOn = id;
  $('mTabs').querySelectorAll<HTMLElement>('.m-tab').forEach(b => { const on = b.dataset.tab === id; b.toggleAttribute('data-on', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  placePill();
}
function placePill() {
  const on = $('mTabs').querySelector<HTMLElement>('.m-tab[data-on]'), pill = $('mPill');
  pill.toggleAttribute('hidden', !on); if (!on || !on.offsetWidth) return;
  pill.style.width = on.offsetWidth + 'px'; pill.style.transform = `translateX(${on.offsetLeft}px)`;
  if (!$('mTabs').dataset.ready) requestAnimationFrame(() => { $('mTabs').dataset.ready = '1'; });
}

/* ---------- routing ---------- */
let firstRoute = true, pendingVia: Via | null = null;
function route() {
  const r = parsePath(location.pathname), via = pendingVia ?? 'link'; pendingVia = null;
  if (r.page === 'country' && state.page === 'country' && r.cc) { if (r.cc !== state.code) setCountry(r.cc, { via }); return; }
  const from = state.code;
  if (r.cc) state.code = r.cc;
  if (state.page === 'country') leaveCountry();
  flushTransaction(); hideTip(); state.page = r.page; state.dday = 'live'; state.curSec = null;
  const host = $('page'), key = routeKey(r), hydrate = firstRoute && host.dataset.route === key;
  if (!hydrate) { host.innerHTML = pageHTML(r.page); host.dataset.route = key; }
  makeIcons(host);
  renderChip();
  if (r.page === 'country') { renderCountry(); store.set('atlas-country', state.code); if (!firstRoute && from !== state.code) track('country_switch', { from, to: state.code, via }); }
  else if (r.page === 'world') renderWorld(firstRoute && !hydrate);
  else if (r.page === 'privacy') renderPrivacy();
  else renderNotFound();
  setRail();
  if (!hydrate) { $('canvas').scrollTop = 0; if (mobile()) scrollTo(0, 0); }
  const first = sections()[0]; if (first) setCrumb(first.id, true); else setDock('');
  if (pendingJump) { const id = pendingJump; pendingJump = null; requestAnimationFrame(() => jump(id)); }
  if (firstRoute) { if (!hydrate) stagger(document.querySelectorAll('#page .card, #page .tiles, #page .page-head'), 0); }
  else if (!reduced()) host.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
  track('page', r.cc ? { route: r.page, cc: r.cc } : { route: r.page });
  if (r.page === 'country' && r.cc) { const d = MODEL[r.cc].decisions, last = d[d.length - 1]; if (last && T_TODAY - last.t <= 2 * DAY) track('decision_window', { cc: r.cc }); }
  firstRoute = false;
}

/* ---------- palette (country switcher) ---------- */
let palOrigin: Code | null = null, palSel = 0, palItems: Code[] = [];
function renderPal(q = '') {
  const s = q.trim().toLowerCase();
  palItems = CODES.filter(c => !s || [c, META[c].name, META[c].bank, META[c].inst, META[c].short].join(' ').toLowerCase().includes(s));
  palSel = Math.max(0, Math.min(palSel, palItems.length - 1));
  $('palList').innerHTML = palItems.map((c, i) => { const p = MODEL[c].policyMoves, l = p[p.length - 1]; return `<li role="option" id="opt-${c}" data-c="${c}" aria-selected="${i === palSel}">${flag(c)}<span class="pl-text"><span class="nm">${META[c].name}</span><span class="bk">${META[c].bank} · ${stanceOfPlay(c).txt}</span></span><span class="pv">${mark(l.dir)}<span class="num">${vShort(MODEL[c].last)}</span></span></li>`; }).join('') || '<li aria-disabled="true"><span></span><span class="bk">No match</span><span></span></li>';
  $('palIn').setAttribute('aria-activedescendant', palItems[palSel] ? `opt-${palItems[palSel]}` : '');
}
function openPal(from: 'keyboard' | 'button') {
  palOrigin = state.code; palSel = Math.max(0, CODES.indexOf(state.code));
  const sc = $('scrim'); sc.hidden = false; $<HTMLInputElement>('palIn').value = ''; renderPal(''); stagger($('palList').children);
  requestAnimationFrame(() => { sc.classList.add('on'); $('palIn').focus(); });
  track('palette_open', { from });
}
function closePal(commit: boolean) {
  const sc = $('scrim'); if (sc.hidden) return;
  if (!commit && state.page === 'country' && palOrigin && state.code !== palOrigin) setCountry(palOrigin, { preview: true });
  sc.classList.remove('on'); setTimeout(() => { sc.hidden = true; }, reduced() ? 0 : 180); (mobile() ? $('mFlag') : $('openPal')).focus();
}
function pick(c: Code) {
  if (state.page === 'country') { setCountry(c, { preview: true }); commitCountry(palOrigin ?? c, 'palette'); }
  else { pendingVia = 'palette'; navigate(pathFor(c)); }
  closePal(true);
}
function movePal(d: number) {
  if (!palItems.length) return; palSel = (palSel + d + palItems.length) % palItems.length; renderPal($<HTMLInputElement>('palIn').value);
  document.getElementById('opt-' + palItems[palSel])?.scrollIntoView({ block: 'nearest' });
  if (state.page === 'country') setCountry(palItems[palSel], { preview: true });
}

/* ---------- theme and palette ---------- */
function wireTheme() {
  $('themeBtn').addEventListener('click', () => {
    const root = document.documentElement, dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches, to = dark ? 'light' : 'dark';
    const apply = () => { root.dataset.theme = to; store.set('atlas-theme', to); };
    if (document.startViewTransition && !reduced()) document.startViewTransition(apply); else apply();
    track('theme', { to });
  });
  $('mTheme').addEventListener('click', () => $('themeBtn').click());
  let palette = store.get('atlas-palette') === 'clay' ? 'clay' : 'claret';
  const applyPalette = (p: string, animate: boolean) => {
    const root = document.documentElement;
    if (animate && !reduced()) { root.classList.add('palette-switching'); setTimeout(() => root.classList.remove('palette-switching'), 320); }
    root.dataset.palette = p; const nm = p === 'clay' ? 'Clay' : 'Claret'; $('palBtn').dataset.tip = `Palette: ${nm}`; $('palLbl').textContent = `Palette: ${nm}`; store.set('atlas-palette', p);
  };
  applyPalette(palette, false);
  $('palBtn').addEventListener('click', () => { palette = palette === 'claret' ? 'clay' : 'claret'; applyPalette(palette, true); });
}

/** Wires the shell once and renders the current path. */
export function bootShell(): void {
  makeIcons();
  onRoute(route); onRailChange(setRail);
  // Internal links route without a page load; modified clicks keep the browser's behaviour.
  document.addEventListener('click', e => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-link]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(a.href, location.href); if (url.origin !== location.origin) return;
    e.preventDefault(); pendingVia = (a.dataset.via as Via) || 'link'; navigate(url.pathname);
  });
  addEventListener('popstate', () => { pendingVia = 'history'; route(); });
  $('railNav').addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('[data-go]'); if (b) jump(b.dataset.go!); });
  $('openPal').addEventListener('click', () => openPal('button'));
  $('mFlag').addEventListener('click', () => openPal('button'));
  const palIn = $<HTMLInputElement>('palIn');
  palIn.addEventListener('input', () => { palSel = 0; renderPal(palIn.value); });
  palIn.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); movePal(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); movePal(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); const c = palItems[palSel]; if (c) pick(c); } else if (e.key === 'Escape') { e.preventDefault(); closePal(false); }
  });
  $('palList').addEventListener('click', e => { const li = (e.target as Element).closest<HTMLElement>('li[data-c]'); if (li) pick(li.dataset.c as Code); });
  $('palList').addEventListener('pointermove', e => {
    const li = (e.target as Element).closest<HTMLElement>('li[data-c]'); if (!li) return; const i = palItems.indexOf(li.dataset.c as Code); if (i === palSel) return;
    palSel = i; $('palList').querySelectorAll('li[data-c]').forEach(n => n.setAttribute('aria-selected', String(n === li))); palIn.setAttribute('aria-activedescendant', li.id);
  });
  $('scrim').addEventListener('pointerdown', e => { if (e.target === $('scrim')) closePal(false); });
  addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName ?? '');
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); if ($('scrim').hidden) openPal('keyboard'); else closePal(false); }
  });
  $('canvas').addEventListener('scroll', () => { $('canvas').classList.toggle('scrolled', $('canvas').scrollTop > 4); spyLater(); }, { passive: true });
  addEventListener('scroll', () => { if (mobile()) { $('mTop').toggleAttribute('data-scrolled', scrollY > 4); spyLater(); } }, { passive: true });
  buildDock();
  $('mMark').addEventListener('click', () => scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }));
  addEventListener('resize', placePill);
  $('railBtn').addEventListener('click', () => { const f = $('frame'), open = !f.classList.contains('open'); f.classList.toggle('open', open); $('railBtn').setAttribute('aria-expanded', String(open)); $('railBtn').dataset.tip = open ? 'Collapse' : 'Expand'; });
  wireTheme();
  route();
  let lastW = $('page').clientWidth, rt = 0;
  new ResizeObserver(() => {
    const w = $('page').clientWidth; if (w === lastW) return; lastW = w; cancelAnimationFrame(rt);
    rt = requestAnimationFrame(() => { hideTip(); if (state.page === 'country') redrawCountry(); else if (state.page === 'world') renderPulse(false); });
  }).observe($('page'));
}
