/* Boot: read the atlas (embedded by the prerender, or fetched in development), model it, then route. */
import '@fontsource-variable/inter/opsz.css';
import '@fontsource-variable/geist-mono/index.css';
import './styles/atlas.css';
import { initAtlas } from './lib/atlas.ts';
import type { AtlasData } from './lib/types.ts';
import { bootShell } from './app/shell.ts';
import { initTracking } from './analytics/track.ts';
import { loadBeacon } from './analytics/beacon.ts';

async function atlas(): Promise<AtlasData> {
  const el = document.getElementById('atlas-state');
  if (el?.textContent) return JSON.parse(el.textContent) as AtlasData;
  const res = await fetch('/atlas.json');
  if (!res.ok) throw new Error(`atlas.json: HTTP ${res.status}`);
  return (await res.json()) as AtlasData;
}

// v1 links carried the country as a query (?country=US); they now land on the country's own path.
function legacyRedirect() {
  const q = new URLSearchParams(location.search).get('country');
  if (q && location.pathname === '/' && /^[a-z]{2}$/i.test(q)) history.replaceState(null, '', `/${q.toLowerCase()}/`);
}

async function boot() {
  legacyRedirect();
  const data = await atlas();
  initAtlas(data, new Date().toISOString().slice(0, 10));
  initTracking();
  await (document.fonts?.ready ?? Promise.resolve());
  bootShell();
  loadBeacon();
}

void boot();
