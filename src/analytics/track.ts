/* First-party product events. Batched in memory and sent with sendBeacon to the same-origin collector at /e when the
   batch fills, after a short idle, or when the page is hidden. Nothing is stored and nothing is sent under GPC or DNT. */
import { MAX_EVENTS } from './schema.ts';
import type { EventName, EventProps, WireBatch, WireEvent } from './schema.ts';

const IDLE_MS = 4000;
let enabled = false;
let queue: WireEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

type Nav = Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
/** True when the visitor has asked not to be tracked (Global Privacy Control or Do Not Track). */
export function optedOut(nav: Nav = navigator, win: { doNotTrack?: string } = globalThis as { doNotTrack?: string }): boolean {
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.msDoNotTrack === '1' || win.doNotTrack === '1';
}

/** Turns tracking on for this page view unless the visitor opted out. Returns whether it is on. */
export function initTracking(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function' || optedOut()) return (enabled = false);
  enabled = true;
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  return true;
}

export function track<N extends EventName>(n: N, p: EventProps<N>): void {
  if (!enabled) return;
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (typeof v === 'string') clean[k] = v;
  queue.push({ n, p: clean });
  if (queue.length >= MAX_EVENTS) flush();
  else if (!timer) timer = setTimeout(flush, IDLE_MS);
}

export function flush(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const batch: WireBatch = { v: 1, path: location.pathname, e: queue.slice(0, MAX_EVENTS) };
  queue = queue.slice(MAX_EVENTS);
  navigator.sendBeacon('/e', new Blob([JSON.stringify(batch)], { type: 'application/json' }));
  if (queue.length) flush();
}
