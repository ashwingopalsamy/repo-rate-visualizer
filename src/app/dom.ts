/* Shared DOM helpers and the page state every module reads. */
import type { Code } from '../lib/atlas.ts';
import type { GapGeom, PulseGeom, RecGeom } from '../charts/charts.ts';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const $svg = (id: string) => document.getElementById(id) as unknown as SVGSVGElement;

export const state = {
  code: 'IN' as Code,
  page: null as null | 'country' | 'world' | 'privacy' | 'notfound',
  /** True while prerendering in Node: text is filled, charts and motion are skipped. */
  ssr: false,
  loanMode: 'decision' as 'decision' | 'since',
  loan: { amt: 0, yrs: 0, rate: 0, since: '' },
  dday: 'live' as 'live' | 'announced' | 'decided',
  replaying: null as null | { raf: number },
  recGeom: null as RecGeom | null,
  gapGeom: null as GapGeom | null,
  pulGeom: null as PulseGeom | null,
  sortKey: 'rate' as 'name' | 'rate' | 'recent' | 'y12' | 'cycle' | 'gap',
  sortDir: -1,
  curSec: null as string | null,
};

let tip: HTMLElement | null = null;
export function showTip(html: string, x: number, y: number): void {
  tip ??= $('tip');
  tip.innerHTML = html; tip.classList.add('on');
  const w = tip.offsetWidth, h = tip.offsetHeight; let L = x + 16, T = y - h - 12;
  if (L + w > innerWidth - 8) L = x - w - 16; if (T < 8) T = y + 18; if (T + h > innerHeight - 8) T = innerHeight - h - 8;
  tip.style.left = Math.max(8, L) + 'px'; tip.style.top = T + 'px';
}
export const hideTip = () => { (tip ?? $('tip'))?.classList.remove('on'); };
export const sw = (v: string) => `<i class="sw" style="background:${v}"></i>`;
export const mobile = () => innerWidth <= 720;
export const pathFor = (c: Code | 'world') => (c === 'world' ? '/' : `/${c.toLowerCase()}/`);
