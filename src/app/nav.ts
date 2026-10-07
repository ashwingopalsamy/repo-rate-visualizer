/* Navigation shared by the pages and the shell: history routing, in-page jumps and the rolling title. */
import { EASE, reduced } from '../lib/motion.ts';
import { $, mobile } from './dom.ts';

let routeFn: () => void = () => {};
let railFn: () => void = () => {};
export const onRoute = (fn: () => void) => { routeFn = fn; };
export const onRailChange = (fn: () => void) => { railFn = fn; };
export const refreshRail = () => railFn();

/** Moves to an internal path without a page load. `replace` updates the address without a history entry. */
export function navigate(path: string, replace = false): void {
  if (location.pathname === path) return;
  if (replace) history.replaceState(null, '', path); else history.pushState(null, '', path);
  routeFn();
}

/** Scrolls a section into view under the toolbar (desktop canvas) or the phone top bar. */
export function jump(id: string): void {
  const s = $(id); if (!s) return;
  const behavior: ScrollBehavior = reduced() ? 'auto' : 'smooth';
  if (!mobile()) $('canvas').scrollTo({ top: s.offsetTop - 72, behavior });
  else scrollTo({ top: s.getBoundingClientRect().top + scrollY - 76, behavior });
}

/** Rolling title: exactly one label arrives and at most one leaves. Anything still leaving when a newer label arrives is
 *  dropped at once, so fast scrolling never stacks titles on top of each other. */
export function roll(slot: HTMLElement, html: string, d: 'up' | 'down', instant: boolean): void {
  slot.querySelectorAll('.crumb.leaving').forEach(o => o.remove());
  const cur = slot.querySelector<HTMLElement>('.crumb'), el = document.createElement('span');
  el.className = 'crumb'; el.innerHTML = html; slot.appendChild(el);
  if (!cur) return;
  if (instant || reduced() || typeof cur.animate !== 'function') { cur.remove(); return; }
  const k = d === 'down' ? 1 : -1, from = getComputedStyle(cur).transform;
  cur.getAnimations().forEach(a => a.cancel()); cur.classList.add('leaving');
  cur.animate([{ transform: from === 'none' ? 'none' : from, opacity: 1 }, { transform: `translateY(${-100 * k}%)`, opacity: 0 }], { duration: 300, easing: EASE, fill: 'forwards' }).onfinish = () => cur.remove();
  el.animate([{ transform: `translateY(${100 * k}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: EASE });
}
