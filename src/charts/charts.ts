/* SVG charts. The record, the gap and the sparks are persistent components: built once per page (and on resize), then
   `update(c, animate)` morphs them from what is on screen to the new country. Charts whose shape differs between countries
   (cycle analogs, histograms) are redrawn and crossfaded by the caller. Ported from design/prototype/charts.js. */
import {
  ALLMOVES, CODES, DAY, META, MODEL, T2000, T_TODAY, bench, cycleInfo, fmtM, fromT, gapInfo, levelInfo, pct, peers, sgn, valueAt, vShort, yearOf,
} from '../lib/atlas.ts';
import type { Code, CycleInfo, GapInfo, Rec } from '../lib/atlas.ts';
import { EASE, EASE_IN, SPRING, morph, reduced, sampleStep, svgEl } from '../lib/motion.ts';

const svgSize = (svg: SVGSVGElement, W: number, H: number) => { svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('height', String(H)); };
const niceStep = (span: number, steps: number[], max = 6) => steps.find(s => span / s <= max) ?? steps[steps.length - 1];
const triangle = (cx: number, cy: number, s: number, dir: string) => (dir === 'hike' ? `M${cx},${cy - s - 1}L${cx + s},${cy + s - 1}L${cx - s},${cy + s - 1}Z` : `M${cx},${cy + s + 1}L${cx + s},${cy - s + 1}L${cx - s},${cy - s + 1}Z`);
const DOMAIN0 = Date.UTC(2000, 0, 1);
const f1 = (v: number) => Math.round(v * 10) / 10;
const columns = (x0: number, x1: number, n: number) => Float64Array.from({ length: n }, (_, i) => x0 + i * (x1 - x0) / (n - 1));
const widthOf = (svg: SVGSVGElement) => Math.max(280, svg.parentElement?.clientWidth ?? 0);
const yearNow = () => yearOf(T_TODAY);
const $q = <T extends Element = SVGElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
const set = (el: Element, attrs: Record<string, string | number>) => { for (const k in attrs) el.setAttribute(k, String(attrs[k])); };

/** A step path through sampled columns: the value at column i holds until column i + 1. */
export function stepD(xs: ArrayLike<number>, ys: ArrayLike<number>): string {
  let d = `M${f1(xs[0])},${f1(ys[0])}`, p = ys[0];
  for (let i = 1; i < xs.length; i++) if (Math.abs(ys[i] - p) > 0.04) { d += `H${f1(xs[i])}V${f1(ys[i])}`; p = ys[i]; }
  return d + `H${f1(xs[xs.length - 1])}`;
}
/** The area between two step series (the target range band): along the top, back along the bottom. */
function bandD(xs: ArrayLike<number>, yh: ArrayLike<number>, yl: ArrayLike<number>): string {
  const n = xs.length; let d = stepD(xs, yh) + `V${f1(yl[n - 1])}`, p = yl[n - 1];
  for (let i = n - 1; i > 0; i--) if (Math.abs(yl[i - 1] - p) > 0.04) { d += `H${f1(xs[i])}V${f1(yl[i - 1])}`; p = yl[i - 1]; }
  return d + `H${f1(xs[0])}Z`;
}
/** Y-axis gridlines that glide with a tweening scale: shared values stay, the rest crossfade. */
function tickLayer(g: Element, fmt: (v: number) => string, x0: number, x1: number) {
  type T = { v: number; el: Element; a: number; b: number; op: number };
  const live = new Map<number, T>();
  return {
    target(vals: number[], animate: boolean) {
      const want = new Set(vals);
      for (const t of live.values()) { t.a = animate ? t.op : (want.has(t.v) ? 1 : 0); t.b = want.has(t.v) ? 1 : 0; }
      for (const v of vals) if (!live.has(v)) {
        const el = svgEl('g', { class: 'tk' }); el.innerHTML = `<line x1="${x0}" x2="${x1}"/><text x="${x0 - 8}" y="4" text-anchor="end">${fmt(v)}</text>`;
        g.appendChild(el); live.set(v, { v, el, a: animate ? 0 : 1, b: 1, op: 0 });
      }
    },
    draw(yOf: (v: number) => number, p: number, top: number, bot: number) {
      for (const t of live.values()) {
        const y = yOf(t.v), op = (t.a + (t.b - t.a) * p) * (y < top - 1 || y > bot + 1 ? 0 : 1);
        t.op = op; t.el.setAttribute('transform', `translate(0,${f1(y)})`); (t.el as SVGElement).style.opacity = String(op);
      }
    },
    settle() { for (const [v, t] of live) if (!t.b) { t.el.remove(); live.delete(v); } },
  };
}
function landIn(nodes: Iterable<Element>, xOf: (n: SVGGraphicsElement) => number, spanPx: number, base = 0) {
  if (reduced()) return;
  for (const n of nodes) {
    const s = (n as SVGElement).style; s.transformBox = 'fill-box'; s.transformOrigin = 'center';
    n.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: base + Math.max(0, xOf(n as SVGGraphicsElement)) / spanPx * 180, easing: SPRING, fill: 'backwards' });
  }
}

export type RecGeom = {
  W: number; H: number; M: { l: number; r: number; t: number; b: number }; t0: number; t1: number;
  x(t: number): number; y(v: number): number; moves: Rec[]; anyRange: boolean; hasObs: boolean; inv(px: number): number;
};

/** The record: 2000 to today for every country, so the axis never moves; observation era shaded, moves marked. */
export function RecordChart(svg: SVGSVGElement) {
  type S = { hi: Float64Array; lo: Float64Array; yMx: number; yMn: number; sx: number; px: number; era: number; range: number };
  const st: { cur: S | null } = { cur: null };
  let G = null as null | { W: number; H: number; M: RecGeom['M']; pw: number; t0: number; t1: number; n: number; x(t: number): number; xs: Float64Array };
  let ticks: ReturnType<typeof tickLayer>;
  const q = <T extends Element = SVGElement>(sel: string) => $q<T>(svg, sel);
  return {
    build() {
      const W = widthOf(svg), H = W < 560 ? 240 : 300, M = { l: 44, r: 14, t: 18, b: 28 }, pw = W - M.l - M.r;
      svgSize(svg, W, H);
      const t0 = DOMAIN0, t1 = T_TODAY, n = Math.max(2, Math.round(pw) + 1), x = (t: number) => M.l + (t - t0) / (t1 - t0) * pw;
      let axis = ''; const yStep = W < 560 ? 10 : 5;
      for (let yr = 2000; yr <= yearNow(); yr += yStep) axis += `<text x="${f1(x(Date.UTC(yr, 0, 1)))}" y="${H - 8}" text-anchor="middle">${yr}</text>`;
      svg.innerHTML = `<defs><clipPath id="recClip"><rect id="revealRect" x="0" y="0" width="${W}" height="${H}"/></clipPath>
          <clipPath id="polClip"><rect id="polRect" x="0" y="0" width="${W}" height="${H}"/></clipPath>
          <clipPath id="obsClip"><rect id="obsRect" x="0" y="${M.t}" width="0" height="${H - M.t - M.b}"/></clipPath>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--accent)" opacity=".06"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" stroke-width="1.5" opacity=".35"/></pattern></defs>
        <g class="grid ticks" id="rTicks"></g><g class="axis">${axis}</g>
        <g clip-path="url(#recClip)" id="rPlot">
          <rect class="era" id="rEra" x="0" y="${M.t}" width="0" height="${H - M.t - M.b}" rx="4"/>
          <path class="obs" id="rObs" clip-path="url(#obsClip)"/>
          <g clip-path="url(#polClip)"><path class="area" id="rArea"/><path class="band" id="rBand"/><path class="line lo" id="rLo"/><path class="line" id="rHi"/></g>
          <g id="rTags"></g><g id="rMk"></g>
        </g>
        <path class="tenure" id="tenure"/><rect class="pending" id="pending"/><line class="pendline" id="pendline"/><path class="ceremony" id="ceremony"/>
        <circle class="burst" id="burst" r="9"/><circle class="head" id="head" r="4.5"/><line class="cursor" id="rCur" y1="${M.t}" y2="${H - M.b}"/>`;
      G = { W, H, M, pw, t0, t1, n, x, xs: columns(M.l, W - M.r, n) };
      ticks = tickLayer(q('#rTicks'), v => `${String(v / 100).replace('-', '−')}%`, M.l, W - M.r);
      st.cur = null;
    },
    update(c: Code, animate: boolean): RecGeom {
      const g = G!, md = MODEL[c], F = fromT(c), start = Math.max(g.t0, md.first.t), pol = Math.max(start, F), { W, H, M, xs, pw } = g, inner = H - M.t - M.b;
      const vals = md.recs.filter(r => r.t >= F).flatMap(r => [r.hi, r.lo]).concat(valueAt(c, F).hi), low = Math.min(0, ...vals);
      const step = niceStep(Math.max(...vals) - low, [100, 200, 250, 500, 1000]), yMx = Math.ceil((Math.max(...vals) + step * 0.25) / step) * step, yMn = low < 0 ? Math.floor((low - step * 0.25) / step) * step : 0;
      const target: S = { hi: sampleStep(c, g.t0, g.t1, g.n, 'hi'), lo: sampleStep(c, g.t0, g.t1, g.n, 'lo'), yMx, yMn, sx: g.x(start), px: g.x(pol), era: pol > start ? 1 : 0, range: md.recs.some(r => r.t >= F && r.range) ? 1 : 0 };
      const anim = animate && !!st.cur && !reduced(), tv: number[] = [];
      for (let v = yMn; v <= yMx; v += step) tv.push(v);
      ticks.target(tv, anim);
      const mk = q('#rMk'), tags = q('#rTags');
      if (anim) [mk, tags].forEach(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: EASE_IN, fill: 'forwards' }));
      const yOf = (s: S, v: number) => M.t + (1 - (v - s.yMn) / (s.yMx - s.yMn)) * inner;
      const draw = (s: S, p: number) => {
        const yh = Array.from(s.hi, v => yOf(s, v)), yl = Array.from(s.lo, v => yOf(s, v)), dHi = stepD(xs, yh);
        q('#rHi').setAttribute('d', dHi); q('#rObs').setAttribute('d', dHi);
        q('#rArea').setAttribute('d', `${dHi}V${f1(yOf(s, 0))}H${f1(xs[0])}Z`);
        q('#rLo').setAttribute('d', stepD(xs, yl)); q('#rLo').style.opacity = String(s.range);
        q('#rBand').setAttribute('d', bandD(xs, yh, yl)); q('#rBand').style.opacity = String(0.2 * s.range);
        set(q('#polRect'), { x: f1(s.px), width: f1(Math.max(0, W - s.px)) });
        set(q('#obsRect'), { x: f1(s.sx), width: f1(Math.max(0, s.px - s.sx)) });
        const era = q('#rEra'); set(era, { x: f1(s.sx), width: f1(Math.max(0, s.px - s.sx)) }); era.style.opacity = String(0.1 * s.era);
        ticks.draw(v => yOf(s, v), p, M.t, H - M.b);
      };
      const y = (v: number) => yOf(target, v), moves = md.policyMoves.filter(m => m.t > g.t0), latestT = moves[moves.length - 1]?.t;
      const land = () => {
        ticks.settle();
        mk.getAnimations().forEach(a => a.cancel()); tags.getAnimations().forEach(a => a.cancel());
        mk.innerHTML = moves.map(r => { const cx = f1(g.x(r.t)), cy = f1(y(r.hi)), s = r.t === latestT ? 5.5 : 4; return (r.t === latestT ? `<circle class="halo ${r.dir}" cx="${cx}" cy="${cy}" r="11"/>` : '') + `<path class="mk ${r.action === 'framework' ? 'framework' : r.dir}${r.t === latestT ? ' latest' : ''}" data-t="${r.t}" d="${triangle(cx, cy, s, r.dir)}"/>`; }).join('');
        let tg = '';
        if (target.era && target.px - target.sx >= 96) {
          const peak = md.recs.filter(r => r.t < F).reduce((a, r) => (r.hi > a.hi ? r : a)), off = peak.hi > yMx;
          tg = `<text class="era-tag" x="${f1(target.sx + 8)}" y="${H - M.b - (off ? 24 : 10)}">OBSERVATIONS</text>${off ? `<text class="era-note" x="${f1(target.sx + 8)}" y="${H - M.b - 10}">peak ${pct(peak.hi)}%, off scale</text>` : ''}`;
        }
        if (!target.era && target.sx - M.l >= 120) tg += `<text class="tag" x="${f1(M.l + 8)}" y="${M.t + 14}">Series starts ${fmtM(md.first.t, c)}</text>`;
        tags.innerHTML = tg;
        if (anim) { landIn(mk.querySelectorAll('.mk, .halo'), n => n.getBBox().x - M.l, pw); tags.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: EASE }); }
      };
      morph(st, 'record', target, draw, anim, land);
      svg.setAttribute('aria-label', `${META[c].inst} since ${yearOf(start)}, with every move marked.`);
      return { W, H, M, t0: g.t0, t1: g.t1, x: g.x, y, moves, anyRange: !!target.range, hasObs: !!target.era, inv: px => g.t0 + (px - M.l) / pw * (g.t1 - g.t0) };
    },
  };
}
export type RecordChartApi = ReturnType<typeof RecordChart>;

/** Cycle analogs: the current cycle against earlier ones in the same direction, aligned at their first move. */
export function drawCycle(svg: SVGSVGElement, c: Code): CycleInfo {
  const C = cycleInfo(c), W = widthOf(svg), H = W < 560 ? 240 : 290, M = { l: 52, r: 66, t: 14, b: 30 };
  svgSize(svg, W, H);
  const all = [...C.past, C.cur];
  const xMax = Math.max(...all.map(cy => (cy === C.cur ? Math.max(C.elapsed, 30) : cy.days)), 180) * 1.04;
  const curve = (cy: typeof C.cur) => [{ x: 0, y: 0 }, ...cy.moves.map(m => ({ x: (m.t - cy.start.t) / DAY, y: m.hi - cy.from.hi }))];
  const allY = all.flatMap(cy => curve(cy).map(p => p.y)), yMn = Math.min(0, ...allY), yMx = Math.max(0, ...allY), pad = (yMx - yMn) * 0.1 || 25;
  const x = (v: number) => M.l + v / xMax * (W - M.l - M.r), y = (v: number) => M.t + (1 - (v - (yMn - pad)) / ((yMx + pad) - (yMn - pad))) * (H - M.t - M.b);
  const step = niceStep(yMx - yMn + 2 * pad, [25, 50, 100, 200, 250, 500]);
  let g = '', ax = '';
  for (let v = Math.ceil((yMn - pad) / step) * step; v <= yMx + pad; v += step) { g += `<line x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}"/>`; ax += `<text x="${M.l - 8}" y="${y(v) + 4}" text-anchor="end">${sgn(v)}</text>`; }
  const mstep = [91, 182, 365, 730].find(s => xMax / s <= (W - M.l - M.r) / 64) ?? 730;
  for (let v = 0; v <= xMax; v += mstep) ax += `<text x="${x(v)}" y="${H - 8}" text-anchor="middle">${v === 0 ? 'start' : Math.round(v / 30.44) + ' mo'}</text>`;
  const pathOf = (pts: { x: number; y: number }[], endX: number) => { let d = `M${x(0)},${y(0)}`; pts.slice(1).forEach(p => { d += `H${x(p.x)}V${y(p.y)}`; }); return d + `H${x(endX)}`; };
  // End-of-line year tags: nudge vertically to avoid collisions, drop a tag that still collides (the tooltip carries it).
  const nowX = x(Math.min(C.elapsed, xMax / 1.04)) + 10, nowY = y(C.cur.total) + 4, nowW = C.holding > 182 ? 62 : 26, showMed = C.medTotal != null && C.past.length > 1;
  const placed = [{ x: nowX - 16, y: nowY, w: nowW + 16 }], tags: string[] = [];
  if (showMed) placed.push({ x: W - M.r - 40, y: y(C.medTotal!) + 4, w: 110 });
  const clash = (tx: number, ty: number, w: number) => placed.some(p => tx < p.x + p.w + 4 && p.x < tx + w + 4 && Math.abs(p.y - ty) < 13);
  C.past.slice().sort((a, b) => a.total - b.total).forEach(cy => {
    const tx = x(cy.days) + 6, base = y(cy.total) + 4;
    const pos = [0, -13, 13, -26, 26].map(d => base + d).find(ty => ty > M.t + 8 && ty < H - M.b - 2 && tx + 30 < W && !clash(tx, ty, 30));
    if (pos != null) { placed.push({ x: tx, y: pos, w: 30 }); tags.push(`<text class="tag" x="${tx}" y="${pos}">${yearOf(cy.start.t)}</text>`); }
  });
  const past = C.past.map(cy => `<path class="past" data-ci="${cy.i}" d="${pathOf(curve(cy), cy.days)}"/>`).join('') + tags.join('');
  const nowEnd = Math.min(C.elapsed, xMax / 1.04), dir = C.cur.dir;
  const med = showMed ? `<line class="med" x1="${M.l}" x2="${W - M.r}" y1="${y(C.medTotal!)}" y2="${y(C.medTotal!)}"/><text class="tag" x="${W - M.r + 6}" y="${y(C.medTotal!) + 4}">median</text>` : '';
  svg.innerHTML = `<g class="grid">${g}</g><line class="zero" x1="${M.l}" x2="${W - M.r}" y1="${y(0)}" y2="${y(0)}"/><g class="axis">${ax}</g>${med}${past}` +
    `<path class="now ${dir}" d="${pathOf(curve(C.cur), nowEnd)}"/><circle class="nowdot" cx="${x(nowEnd)}" cy="${y(C.cur.total)}" r="5.5" fill="var(--${dir === 'hike' ? 'hawk' : 'dove'})" stroke="var(--surface)" stroke-width="2"/>` +
    `<text class="tag-strong" x="${x(nowEnd) + 10}" y="${y(C.cur.total) + 4}">${C.holding > 182 ? 'last cycle' : 'now'}</text>`;
  svg.setAttribute('aria-label', `Current ${dir === 'hike' ? 'tightening' : 'easing'} cycle against ${C.past.length} earlier ones`);
  return C;
}

export type GapGeom = { G: GapInfo; x(t: number): number; t0: number; t1: number; W: number; inv(px: number): number };
/** Gap against the benchmark central bank, on the same fixed 2000-to-today axis; its start sweeps with the country. */
export function GapChart(svg: SVGSVGElement) {
  type S = { s: Float64Array; lo: number; hi: number; sx: number };
  const st: { cur: S | null } = { cur: null };
  let G = null as null | { W: number; H: number; M: { l: number; r: number; t: number; b: number }; pw: number; t0: number; t1: number; n: number; x(t: number): number; xs: Float64Array };
  let ticks: ReturnType<typeof tickLayer>;
  const q = <T extends Element = SVGElement>(sel: string) => $q<T>(svg, sel);
  return {
    build() {
      const W = widthOf(svg), H = W < 560 ? 200 : 240, M = { l: 52, r: 14, t: 16, b: 28 }, pw = W - M.l - M.r;
      svgSize(svg, W, H);
      const t0 = DOMAIN0, t1 = T_TODAY, n = Math.max(2, Math.round(pw) + 1), x = (t: number) => M.l + (t - t0) / (t1 - t0) * pw;
      const years = yearNow() - 2000, ys = [2, 4, 5].find(s => years / s <= Math.floor((W - 80) / 70)) ?? 5;
      let axis = ''; for (let yr = 2000; yr <= yearNow(); yr += ys) axis += `<text x="${f1(x(Date.UTC(yr, 0, 1)))}" y="${H - 8}" text-anchor="middle">${yr}</text>`;
      svg.innerHTML = `<defs><clipPath id="gapClip"><rect id="gapRect" x="${M.l}" y="0" width="${pw}" height="${H}"/></clipPath></defs>
        <g class="grid ticks" id="gTicks"></g><g class="axis">${axis}</g>
        <g clip-path="url(#gapClip)"><path class="area" id="gArea"/><line class="zero" id="gZero" x1="${M.l}" x2="${W - M.r}"/><path class="line" id="gLine"/></g>
        <g id="gSince"></g><circle class="dot" id="gDot" r="5"/><line class="cursor" id="gCur" y1="${M.t}" y2="${H - M.b}"/>`;
      G = { W, H, M, pw, t0, t1, n, x, xs: columns(M.l, W - M.r, n) };
      ticks = tickLayer(q('#gTicks'), v => sgn(v), M.l, W - M.r);
      st.cur = null;
    },
    update(c: Code, animate: boolean): GapGeom {
      const g = G!, I = gapInfo(c), { W, H, M, xs, pw } = g, inner = H - M.t - M.b;
      const a = sampleStep(c, g.t0, g.t1, g.n), bb = sampleStep(I.b, g.t0, g.t1, g.n), s = a.map((v, i) => v - bb[i]);
      const sv = I.pts.map(p => p.s), mn = Math.min(0, ...sv), mx = Math.max(0, ...sv), pad = (mx - mn) * 0.1 || 25;
      const step = niceStep(mx - mn + 2 * pad, [50, 100, 200, 250, 500, 1000]), tv: number[] = [];
      for (let v = Math.ceil((mn - pad) / step) * step; v <= mx + pad; v += step) tv.push(v);
      const target: S = { s, lo: mn - pad, hi: mx + pad, sx: g.x(I.t0) };
      const anim = animate && !!st.cur && !reduced(), since = q('#gSince');
      ticks.target(tv, anim);
      if (anim) since.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: EASE_IN, fill: 'forwards' });
      const yOf = (S: S, v: number) => M.t + (1 - (v - S.lo) / (S.hi - S.lo)) * inner;
      const draw = (S: S, p: number) => {
        const ys = Array.from(S.s, v => yOf(S, v)), d = stepD(xs, ys), y0 = f1(yOf(S, 0));
        q('#gLine').setAttribute('d', d); q('#gArea').setAttribute('d', `${d}V${y0}H${f1(xs[0])}Z`);
        set(q('#gZero'), { y1: y0, y2: y0 });
        set(q('#gapRect'), { x: f1(S.sx), width: f1(Math.max(0, W - M.r - S.sx)) });
        set(q('#gDot'), { cx: f1(xs[xs.length - 1]), cy: f1(ys[ys.length - 1]) });
        ticks.draw(v => yOf(S, v), p, M.t, H - M.b);
      };
      const land = () => {
        ticks.settle(); since.getAnimations().forEach(x => x.cancel());
        const sx = I.since ? f1(g.x(I.since)) : 0;
        const late = g.x(I.t0) - M.l >= 120 ? `<text class="tag" x="${f1(M.l + 8)}" y="${M.t + 10}">Comparison starts ${fmtM(I.t0, c)}</text>` : '';
        since.innerHTML = late + (I.since ? `<line x1="${sx}" x2="${sx}" y1="${M.t}" y2="${H - M.b}" stroke="var(--ink-3)" stroke-dasharray="2 3"/><text class="tag" x="${sx + 6}" y="${M.t + 10}">last this ${I.dirWord.startsWith('narrow') ? 'narrow' : I.dirWord.startsWith('wide') ? 'wide' : 'low'}</text>` : '');
        if (anim) since.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: EASE });
      };
      morph(st, 'gap', target, draw, anim, land);
      return { G: I, x: g.x, t0: I.t0, t1: g.t1, W, inv: px => g.t0 + (px - M.l) / pw * (g.t1 - g.t0) };
    },
  };
}
export type GapChartApi = ReturnType<typeof GapChart>;

/* The pulse: hikes above the line, cuts below, per quarter, across every bank in the set. */
export const qOf = (t: number) => { const d = new Date(t); return d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3); };
export const qLabel = (q: number) => `Q${q % 4 + 1} ${Math.floor(q / 4)}`;
export type PulseGeom = { data: { q: number; up: Rec[]; dn: Rec[] }[]; M: { l: number; r: number; t: number; b: number }; bw: number; W: number };
export function drawPulse(svg: SVGSVGElement): PulseGeom {
  const W = widthOf(svg), H = W < 560 ? 220 : 270, M = { l: 30, r: 10, t: 14, b: 26 };
  svgSize(svg, W, H);
  const q0 = qOf(T2000), q1 = qOf(T_TODAY), nq = q1 - q0 + 1, data = Array.from({ length: nq }, (_, i) => ({ q: q0 + i, up: [] as Rec[], dn: [] as Rec[] }));
  ALLMOVES.filter(m => m.t >= T2000 && m.t <= T_TODAY && m.action !== 'framework').forEach(m => { const d = data[qOf(m.t) - q0]; (m.dir === 'hike' ? d.up : d.dn).push(m); });
  const mx = Math.max(...data.map(d => Math.max(d.up.length, d.dn.length)), 1), bw = (W - M.l - M.r) / nq, mid = M.t + (H - M.t - M.b) / 2, hh = (H - M.t - M.b) / 2 - 4;
  const h = (v: number) => v / mx * hh;
  let bars = '';
  data.forEach((d, i) => { const xx = M.l + i * bw + bw * 0.14, w = Math.max(1, bw * 0.72); if (d.up.length) bars += `<rect class="up" data-i="${i}" x="${xx}" y="${mid - h(d.up.length)}" width="${w}" height="${h(d.up.length)}" rx="1.5"/>`; if (d.dn.length) bars += `<rect class="dn" data-i="${i}" x="${xx}" y="${mid + 1}" width="${w}" height="${h(d.dn.length)}" rx="1.5"/>`; });
  let ax = ''; for (let yr = 2000; yr <= yearNow(); yr += W < 560 ? 10 : 4) ax += `<text x="${M.l + (yr * 4 - q0) * bw}" y="${H - 6}" text-anchor="middle">${yr}</text>`;
  ax += `<text x="${M.l - 6}" y="${mid - hh + 8}" text-anchor="end">${mx}</text><text x="${M.l - 6}" y="${mid + 4}" text-anchor="end">0</text><text x="${M.l - 6}" y="${mid + hh}" text-anchor="end">${mx}</text>`;
  const lab = `<text class="tag-strong" x="${M.l + 6}" y="${M.t + 10}" style="fill:var(--hawk)">Hikes</text><text class="tag-strong" x="${M.l + 6}" y="${H - M.b - 4}" style="fill:var(--dove)">Cuts</text>`;
  svg.innerHTML = `<line class="zero" x1="${M.l}" x2="${W - M.r}" y1="${mid + 0.5}" y2="${mid + 0.5}"/>${bars}<g class="axis">${ax}</g>${lab}<rect class="nowq" x="${M.l + (nq - 1) * bw}" y="${M.t}" width="${bw}" height="${H - M.t - M.b}" rx="3"/>`;
  return { data, M, bw, W };
}

/* Small visuals for the insight tiles and the decision card. */
export function vizLevel(c: Code, VW: number, VH: number): string {
  const L = levelInfo(c), bk = [...L.bins.keys()].sort((a, b) => a - b), mn = bk[0], mx = bk[bk.length - 1], nb = mx - mn + 1, bw = VW / nb, maxS = Math.max(...L.bins.values()), curB = Math.floor(L.now / 100);
  let s = '';
  for (let b = mn; b <= mx; b++) { const v = L.bins.get(b) ?? 0, h = v ? Math.max(2, v / maxS * (VH - 14)) : 0; if (h) s += `<rect class="vb" x="${(b - mn) * bw + 1}" y="${VH - 14 - h}" width="${Math.max(1, bw - 2)}" height="${h}" rx="1.5" fill="var(--${b === curB ? 'accent' : 'level'})" opacity="${b === curB ? 1 : 0.45}"/>`; }
  return s + `<text class="vt" x="0" y="${VH}">${String(mn).replace('-', '−')}%</text><text class="vt" x="${VW}" y="${VH}" text-anchor="end">${mx + 1}%</text>`;
}
export function vizCycle(c: Code, VW: number, VH: number): string {
  const C = cycleInfo(c), col = `var(--${C.cur.dir === 'hike' ? 'hawk' : 'dove'})`, all = [...C.past, C.cur];
  const scale = Math.max(...all.map(cy => Math.abs(cy.total)), 25);
  if (VH >= 16 * all.length + 14 && all.length > 1) {
    // One bar per same-direction cycle, oldest first; this cycle in colour at the bottom.
    const rh = Math.min(22, (VH - 2) / all.length), x0 = 34;
    return all.map((cy, i) => { const y = i * rh, now = cy === C.cur, w = Math.max(2, Math.abs(cy.total) / scale * (VW - x0 - 34));
      return `<text class="vt" x="0" y="${y + rh / 2 + 3.5}">${now ? 'now' : yearOf(cy.start.t)}</text><rect class="vx" x="${x0}" y="${y + rh / 2 - 3}" width="${w}" height="6" rx="3" fill="${now ? col : 'var(--other)'}"/><text class="vt" x="${x0 + w + 6}" y="${y + rh / 2 + 3.5}">${sgn(cy.total)}</text>`; }).join('') +
      (C.medTotal != null && C.past.length > 1 ? `<line x1="${x0 + Math.abs(C.medTotal) / scale * (VW - x0 - 34)}" x2="${x0 + Math.abs(C.medTotal) / scale * (VW - x0 - 34)}" y1="0" y2="${all.length * rh}" stroke="var(--ink-3)" stroke-dasharray="2 3"/>` : '');
  }
  const b = VH - 26, curAbs = Math.abs(C.cur.total), medAbs = C.medTotal != null ? Math.abs(C.medTotal) : null, sc = Math.max(curAbs, medAbs ?? 0, 25) * 1.12;
  let s = `<rect x="0" y="${b}" width="${VW}" height="8" rx="4" fill="var(--wash-2)"/><rect class="vx" x="0" y="${b}" width="${curAbs / sc * VW}" height="8" rx="4" fill="${col}"/>`;
  if (medAbs) { const mx = medAbs / sc * VW; s += `<line x1="${mx}" x2="${mx}" y1="${b - 6}" y2="${b + 14}" stroke="var(--ink)" stroke-width="1.5"/><text class="vt" x="${Math.min(VW, mx)}" y="${VH}" text-anchor="${mx / VW > 0.7 ? 'end' : 'middle'}">${C.past.length === 1 ? 'previous' : 'median'} ${sgn(C.medTotal!)}</text>`; }
  return s + `<text class="vt" x="0" y="${VH}">0</text>`;
}
/** Tile: the gap over ten years, morphing between countries. */
export function GapSpark(svg: SVGSVGElement, VW: number, VH: number) {
  type S = { s: Float64Array; mn: number; mx: number };
  const st: { cur: S | null } = { cur: null }, t0 = T_TODAY - 10 * 365.25 * DAY, n = Math.max(2, Math.round(VW) + 1), xs = columns(0, VW, n);
  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
  svg.innerHTML = `<line class="gs-zero" x1="0" x2="${VW}" stroke="var(--ink-3)" stroke-dasharray="2 3"/><path class="gs-area" fill="var(--gap)" opacity=".16"/><path class="draw gs-line" fill="none" stroke="var(--gap)" stroke-width="2"/><circle class="vd gs-dot" r="3.5" fill="var(--gap)" stroke="var(--surface)" stroke-width="2"/>`;
  const q = (sel: string) => $q(svg, sel);
  return {
    update(c: Code, animate: boolean) {
      const b = bench(c), a = sampleStep(c, t0, T_TODAY, n), bb = sampleStep(b, t0, T_TODAY, n), s = a.map((v, i) => v - bb[i]);
      const target: S = { s, mn: Math.min(0, ...s), mx: Math.max(0, ...s) };
      morph(st, 'tile-gap', target, S => {
        const y = (v: number) => 4 + (1 - (v - S.mn) / ((S.mx - S.mn) || 1)) * (VH - 10), ys = Array.from(S.s, y), d = stepD(xs, ys), y0 = f1(y(0));
        q('.gs-line').setAttribute('d', d); q('.gs-area').setAttribute('d', `${d}V${y0}H0Z`);
        set(q('.gs-zero'), { y1: y0, y2: y0 });
        set(q('.gs-dot'), { cx: VW, cy: f1(ys[ys.length - 1]) });
      }, animate);
    },
  };
}
/** Tile: every bank's rate. The rows are the same for every country (sorted by rate), so only the highlight moves. */
export function PeerViz(svg: SVGSVGElement, VW: number, VH: number) {
  const list = peers(CODES[0]).list, max = list[0].v, ladder = VH >= 12 * list.length;
  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
  if (ladder) {
    const rh = VH / list.length, x0 = 22, x1 = VW - 46;
    svg.innerHTML = list.map((p, i) => { const y = f1(i * rh + rh / 2); return `<g class="vp-row" data-k="${p.k}"><text class="vt" x="0" y="${f1(y + 3.5)}">${p.k}</text><rect class="vx" x="${x0}" y="${f1(y - 2.5)}" width="${f1(Math.max(2, p.v / max * (x1 - x0)))}" height="5" rx="2.5"/></g>`; }).join('') +
      `<g class="vp-val"><text class="vt" x="${VW}" y="3.5" text-anchor="end"></text></g>`;
  } else {
    const pv = list.map(p => p.v), pmn = Math.min(...pv), pmx = Math.max(...pv), px = (v: number) => 8 + (v - pmn) / ((pmx - pmn) || 1) * (VW - 16), y = VH - 20;
    svg.innerHTML = `<line x1="8" x2="${VW - 8}" y1="${y}" y2="${y}" stroke="var(--hair-2)" stroke-width="2" stroke-linecap="round"/>` +
      list.map(p => `<circle class="vd vp-dot" data-k="${p.k}" cx="${f1(px(p.v))}" cy="${y}" stroke="var(--surface)" stroke-width="2"/>`).join('') +
      `<text class="vt" x="8" y="${VH}">${pct(pmn)}%</text><text class="vt" x="${VW - 8}" y="${VH}" text-anchor="end">${pct(pmx)}%</text>`;
  }
  return {
    update(c: Code) {
      svg.querySelectorAll<SVGElement>('[data-k]').forEach(n => n.classList.toggle('on', n.dataset.k === c));
      const val = svg.querySelector<SVGGElement>('.vp-val');
      if (val) { const i = list.findIndex(p => p.k === c), rh = VH / list.length; val.style.transform = `translateY(${f1(i * rh + rh / 2)}px)`; val.querySelector('text')!.textContent = vShort(MODEL[c].last); }
    },
  };
}
/** Decision card: the last five years, the same window for every country. */
export function GlanceChart(host: HTMLElement) {
  type S = { hi: Float64Array; mn: number; mx: number };
  const st: { cur: S | null } = { cur: null };
  let G = null as null | { W: number; H: number; t0: number; n: number; xs: Float64Array };
  return {
    build() {
      const W = Math.max(120, host.clientWidth), H = Math.max(56, host.clientHeight), t0 = T_TODAY - 5 * 365.25 * DAY, n = Math.max(2, Math.round(W - 10) + 1);
      host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><path class="gl-area" fill="var(--level)" opacity=".1"/><path class="draw gl-line" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/><circle class="vd gl-dot" r="3.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/><text class="vt" x="2" y="${H - 2}">${yearOf(t0)}</text><text class="vt" x="${W - 2}" y="${H - 2}" text-anchor="end">today</text></svg>`;
      G = { W, H, t0, n, xs: columns(2, W - 8, n) }; st.cur = null;
    },
    update(c: Code, animate: boolean) {
      const g = G!, md = MODEL[c], hi = sampleStep(c, g.t0, T_TODAY, g.n), { H, xs } = g, svg = host.querySelector('svg')!;
      const target: S = { hi, mn: Math.min(...hi), mx: Math.max(...hi) };
      morph(st, 'glance', target, S => {
        const y = (v: number) => 6 + (1 - (v - S.mn) / ((S.mx - S.mn) || 1)) * (H - 22), ys = Array.from(S.hi, y), d = stepD(xs, ys);
        $q(svg, '.gl-line').setAttribute('d', d); $q(svg, '.gl-area').setAttribute('d', `${d}V${H - 16}H${f1(xs[0])}Z`);
        set($q(svg, '.gl-dot'), { cx: f1(xs[xs.length - 1]), cy: f1(ys[ys.length - 1]) });
      }, animate && !reduced());
      const pts = [{ ...valueAt(c, g.t0), t: g.t0 }, ...md.recs.filter(r => r.t > g.t0)];
      return { yearAgo: valueAt(c, T_TODAY - 365 * DAY), hi5: pts.reduce((a, r) => (r.hi > a.hi ? r : a)), lo5: pts.reduce((a, r) => (r.lo < a.lo ? r : a)) };
    },
  };
}
