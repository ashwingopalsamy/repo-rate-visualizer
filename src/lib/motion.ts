/* Motion: the interface eases, the data steps. Text swaps, the keyed tween clock that charts morph on, and the single
   transaction that every country switch runs in. Ported from the approved prototype (design/prototype/lib.js). */
import { MODEL } from './atlas.ts';
import type { Code } from './atlas.ts';
import { makeIcons } from './icons.ts';

const RM = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reduced = () => !!RM?.matches;
export const EASE = 'cubic-bezier(.22,.61,.36,1)', EASE_IN = 'cubic-bezier(.4,0,1,1)', SPRING = 'cubic-bezier(.3,1.35,.5,1)';

type Item = { el: Element; html: string; dir: number };
let BATCH: { items: Map<Element, Item>; fns: (() => void)[] } | null = null;
let TX: { flush(): void } | null = null;
const SETTLE = new Set<() => void>();

let TPL: HTMLTemplateElement | null = null;
const norm = (h: string) => { TPL ??= document.createElement('template'); TPL.innerHTML = h; return TPL.innerHTML; };

/** Sets an element's content. Unchanged content is never touched. Inside a transaction the change is queued so every
 *  changed text on the page commits on one frame; otherwise it fades out, swaps and fades in, in the move's direction. */
export function swap(el: Element | null, html: string, dir = 0, instant = false): void {
  if (!el) return;
  const want = norm(html);
  if (BATCH && !instant && !reduced()) { if (el.innerHTML === want) BATCH.items.delete(el); else BATCH.items.set(el, { el, html: want, dir }); return; }
  if (el.innerHTML === want) return;
  el.getAnimations?.().forEach(a => a.cancel());
  if (instant || reduced()) { el.innerHTML = want; makeIcons(el); return; }
  const d = dir > 0 ? 1 : dir < 0 ? -1 : 0, dist = d ? 10 : 4;
  const out = el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${d >= 0 ? -dist / 2 : dist / 2}px)` }], { duration: 70, easing: EASE_IN, fill: 'forwards' });
  out.onfinish = () => {
    el.innerHTML = want; out.cancel(); makeIcons(el);
    el.animate([{ opacity: 0, transform: `translateY(${d >= 0 ? dist : -dist}px)` }, { opacity: 1, transform: 'none' }], { duration: 170, easing: EASE });
  };
}

/* ---------- motion clock: keyed tweens on one rAF loop ---------- */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t, sy = (t: number) => ((ay * t + by) * t + cy) * t, dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => { let t = x; for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-6 || !d) break; t -= e / d; } return sy(Math.min(1, Math.max(0, t))); };
}
const easeOut = bezier(0.22, 0.61, 0.36, 1);
type Tween = { t0: number; dur: number; frame: (p: number) => void; done?: () => void };
const TWEENS = new Map<string, Tween>();
let tweenRaf = 0;
function tweenTick(now: number) {
  tweenRaf = 0;
  for (const [key, tw] of [...TWEENS]) {
    if (TWEENS.get(key) !== tw) continue;
    const raw = Math.min(1, Math.max(0, (now - tw.t0) / tw.dur));
    tw.frame(easeOut(raw));
    if (raw >= 1 && TWEENS.get(key) === tw) { TWEENS.delete(key); tw.done?.(); }
  }
  if (TWEENS.size && !tweenRaf) tweenRaf = requestAnimationFrame(tweenTick);
}
/** Starting a tween for a running key replaces it; callers start from what is on screen, so nothing jumps. */
export function tween(key: string, dur: number, frame: (p: number) => void, done?: () => void): void {
  TWEENS.delete(key);
  if (reduced() || dur <= 0 || typeof requestAnimationFrame !== 'function') { frame(1); done?.(); return; }
  TWEENS.set(key, { t0: performance.now(), dur, frame, done });
  if (!tweenRaf) tweenRaf = requestAnimationFrame(tweenTick);
}
export type MorphState = Record<string, number | Float64Array>;
function lerpState(a: MorphState | null, b: MorphState, p: number): MorphState {
  const o: MorphState = {};
  for (const k in b) {
    const x = a?.[k], y = b[k];
    if (typeof y === 'number') o[k] = typeof x === 'number' ? x + (y - x) * p : y;
    else if (x instanceof Float64Array && x.length === y.length) { const r = new Float64Array(y.length); for (let i = 0; i < y.length; i++) r[i] = x[i] + (y[i] - x[i]) * p; o[k] = r; }
    else o[k] = y;
  }
  return o;
}
export const MORPH_MS = 420;
/** Morphs a chart's state (numbers and sampled arrays) from what it shows now to `target`, drawing every frame. */
export function morph<S extends MorphState>(st: { cur: S | null }, key: string, target: S, draw: (s: S, p: number) => void, animate: boolean, done?: () => void): void {
  const from = st.cur;
  if (!animate || !from || reduced()) { TWEENS.delete(key); st.cur = target; draw(target, 1); done?.(); return; }
  tween(key, MORPH_MS, p => { st.cur = lerpState(from, target, p) as S; draw(st.cur, p); }, () => { st.cur = target; draw(target, 1); done?.(); });
}
/** A country's step series sampled onto n fixed columns across [t0, t1]; before the first record it holds the first value. */
export function sampleStep(c: Code, t0: number, t1: number, n: number, field: 'hi' | 'lo' = 'hi'): Float64Array {
  const r = MODEL[c].recs, out = new Float64Array(n); let k = 0;
  for (let i = 0; i < n; i++) { const t = t0 + (t1 - t0) * i / (n - 1); while (k + 1 < r.length && r[k + 1].t <= t) k++; out[i] = r[k][field]; }
  return out;
}

/* ---------- one transaction per country switch ---------- */
export const atCommit = (fn: () => void) => { if (BATCH) BATCH.fns.push(fn); else fn(); };
export const onSettle = (fn: () => void) => { if (TX) SETTLE.add(fn); else fn(); };
export const flushTransaction = () => TX?.flush();
/** Every changed text fades out together, commits on one frame and fades in; rows glide to their new height and blocks
 *  inside cards slide to their new places (FLIP). Charts morph on their own clock in the same window. */
export function transact(apply: () => void): void {
  TX?.flush();
  if (reduced()) { apply(); return; }
  const rows = [...document.querySelectorAll<HTMLElement>('#page .row')].filter(r => r.getClientRects().length);
  const blocks = [...document.querySelectorAll<HTMLElement>('#page .card-head > *, #page .card-body > *, #page .tile > *')];
  const rel = (b: Element) => b.getBoundingClientRect().top - (b.closest('.card, .tile') as Element).getBoundingClientRect().top;
  const h0 = rows.map(r => r.getBoundingClientRect().height), top0 = new Map<Element, number>();
  blocks.forEach(b => { if (b.getClientRects().length) top0.set(b, rel(b)); });
  BATCH = { items: new Map(), fns: [] };
  let batch: NonNullable<typeof BATCH>;
  try { apply(); } finally { batch = BATCH!; BATCH = null; }
  const items = [...batch.items.values()], anims: Animation[] = [];
  rows.forEach((r, i) => { r.style.height = h0[i] + 'px'; r.classList.add('tx-lock'); });
  const outs = items.map(({ el, dir }) => { el.getAnimations().forEach(a => a.cancel()); return el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${dir > 0 ? -4 : dir < 0 ? 4 : -2}px)` }], { duration: 90, easing: EASE_IN, fill: 'forwards' }); });
  let committed = false, cleaned = false;
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
    const h1 = rows.map(r => r.getBoundingClientRect().height), moved: [Element, number][] = [];
    top0.forEach((t, b) => { if (!b.isConnected || !b.getClientRects().length) return; const d = t - rel(b); if (Math.abs(d) > 0.5) moved.push([b, d]); });
    rows.forEach((r, i) => { if (Math.abs(h1[i] - h0[i]) > 0.5) anims.push(r.animate([{ height: h0[i] + 'px' }, { height: h1[i] + 'px' }], { duration: 340, easing: EASE })); });
    moved.forEach(([b, d]) => anims.push(b.animate([{ transform: `translateY(${d}px)` }, { transform: 'translateY(0)' }], { duration: 340, easing: EASE, composite: 'add' })));
    items.forEach(({ el, dir }) => anims.push(el.animate([{ opacity: 0, transform: `translateY(${dir > 0 ? 8 : dir < 0 ? -8 : 3}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE })));
    if (anims.length) Promise.allSettled(anims.map(a => a.finished)).then(cleanup); else cleanup();
  };
  const tx = { flush() { commit(); anims.forEach(a => a.finish()); cleanup(); } };
  TX = tx;
  const timer = setTimeout(commit, items.length ? 90 : 0);
}

/* ---------- crossfades for visuals whose shape differs between countries ---------- */
export function xfadeSvg(svg: SVGSVGElement, render: () => void, animate: boolean): void {
  if (!animate || reduced() || !svg.childNodes.length || !svg.parentElement) { render(); return; }
  const ghost = svg.cloneNode(true) as SVGSVGElement;
  ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  ghost.setAttribute('aria-hidden', 'true'); ghost.classList.add('xf-ghost');
  const r = svg.getBoundingClientRect(), pr = svg.parentElement.getBoundingClientRect();
  ghost.style.cssText = `position:absolute;left:${r.left - pr.left}px;top:${r.top - pr.top}px;width:${r.width}px;height:${r.height}px;pointer-events:none`;
  svg.parentElement.appendChild(ghost);
  render();
  svg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: EASE });
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: EASE_IN, fill: 'forwards' }).onfinish = () => ghost.remove();
}
export function xfadeImg(box: Element, src: string, animate: boolean): void {
  const old = box.querySelector('img:not(.leaving)');
  if (old && old.getAttribute('src') === src) return;
  const img = document.createElement('img'); img.width = img.height = 28; img.src = src; img.alt = ''; img.decoding = 'async';
  if (!old || !animate || reduced()) { box.replaceChildren(img); return; }
  img.style.cssText = 'position:absolute;inset:0;margin:auto'; old.classList.add('leaving');
  box.appendChild(img);
  img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: EASE }).onfinish = () => { box.querySelectorAll('img.leaving').forEach(n => n.remove()); img.style.cssText = ''; };
}
export const svgEl = (tag: string, attrs: Record<string, string> = {}) => { const n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

/* ---------- entrances (first paint only) ---------- */
type Nodes = Iterable<Element> | ArrayLike<Element>;
export function stagger(nodes: Nodes, base = 0) { if (reduced()) return; [...Array.from(nodes)].forEach((n, i) => n.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: base + Math.min(i * 24, 160), easing: EASE, fill: 'backwards' })); }
export function drawIn(root: ParentNode, sel: string, dur = 600, step = 40) { if (reduced()) return; root.querySelectorAll(sel).forEach((p, i) => { p.setAttribute('pathLength', '1'); p.animate([{ strokeDasharray: '1 2', strokeDashoffset: 1 }, { strokeDasharray: '1 2', strokeDashoffset: 0 }], { duration: dur, delay: Math.min(i * step, 400), easing: EASE, fill: 'backwards' }); }); }
export function popIn(nodes: Nodes, base = 0, origin = 'center') { if (reduced()) return; Array.from(nodes).forEach((d, i) => { const s = (d as SVGElement).style; s.transformBox = 'fill-box'; s.transformOrigin = origin; d.animate([{ transform: 'scale(0)' }, { transform: 'none' }], { duration: 380, delay: base + Math.min(i * 30, 240), easing: SPRING, fill: 'backwards' }); }); }
export function growIn(nodes: Nodes, origin: string, base = 0, step = 12) { if (reduced()) return; Array.from(nodes).forEach((r, i) => { const s = (r as SVGElement).style; s.transformBox = 'fill-box'; s.transformOrigin = origin; r.animate([{ transform: origin.startsWith('0') ? 'scaleX(0)' : 'scaleY(0)' }, { transform: 'none' }], { duration: 320, delay: base + Math.min(i * step, 300), easing: EASE, fill: 'backwards' }); }); }

/** Segmented control with a sliding thumb. */
export type Seg = HTMLElement & { place(): void; set(v: string): void };
export function segc(el: HTMLElement, onPick: (v: string) => void, key: string): Seg {
  const s = el as Seg, thumb = el.querySelector<HTMLElement>('.thumb')!;
  s.place = () => { const b = el.querySelector<HTMLElement>('button[aria-pressed="true"]'); if (!b || !b.offsetWidth) return; thumb.style.width = b.offsetWidth + 'px'; thumb.style.transform = `translateX(${b.offsetLeft}px)`; };
  s.set = v => { el.querySelectorAll<HTMLElement>('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset[key] === v))); s.place(); };
  el.addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('button'); if (!b) return; el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); s.place(); onPick(b.dataset[key] ?? ''); });
  return s;
}
/** Per-viewer conveniences only (theme, palette, last country); the site works the same without storage. */
export const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
