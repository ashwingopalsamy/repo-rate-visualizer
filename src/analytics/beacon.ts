/* Cloudflare Web Analytics, loaded manually so it can respect GPC and DNT. The token is a public site identifier set at
   build time (VITE_CF_BEACON_TOKEN); without it nothing loads. `spa: true` counts history navigations as page views. */
import { optedOut } from './track.ts';

export function loadBeacon(token: string | undefined = import.meta.env.VITE_CF_BEACON_TOKEN): boolean {
  if (!token || optedOut()) return false;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.dataset.cfBeacon = JSON.stringify({ token, spa: true });
  document.head.appendChild(s);
  return true;
}
