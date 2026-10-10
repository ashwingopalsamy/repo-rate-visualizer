/**
 * Prerenders every route into dist/ from the built shell (dist/index.html), using the same page modules as the client.
 * Text is rendered as of the build date; charts are drawn on load, and nothing on the page is replaced when the client
 * boots on the same route. Also writes the sitemap, robots.txt, 404.html and the security headers (with the CSP hash of
 * the inline theme script). Usage: node scripts/prerender.ts
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseHTML } from 'linkedom';
import { buildAtlas } from './build-atlas.ts';
import { CODES, META, MODEL, initAtlas, lede } from '../src/lib/atlas.ts';
import { DEFAULT_CC } from '../src/app/shell.ts';
import type { Code } from '../src/lib/atlas.ts';

export const SITE = 'https://rates.ashwingopalsamy.in';
const DIST = new URL('../dist/', import.meta.url).pathname;

type Route = { path: string; page: 'world' | 'country' | 'privacy' | 'design' | 'notfound'; cc: Code | null; file: string };
const strip = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const attr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/** JSON safe inside a <script> element: no "</script" or "<!--" can be formed. */
export const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

/** The default country's page lives at /, so /in/ points search engines there. */
const canonicalOf = (r: Route) => SITE + (r.page === 'country' && r.cc === DEFAULT_CC ? '/' : r.path);

function head(r: Route, title: string): string {
  const url = canonicalOf(r);
  const description = r.page === 'country' && r.cc ? strip(lede(r.cc))
    : r.page === 'privacy' ? 'What Policy Rate Atlas counts, how long it is kept and how to switch it off. No cookies and no personal data.'
    : r.page === 'design' ? 'The colours, type, components and rules Policy Rate Atlas is built from, rendered with the live stylesheet.'
    : `Policy rates for ${CODES.length} central banks, every move since 2000, checked against official sources, with the findings that matter for borrowers and markets.`;
  const ld = r.page === 'country' && r.cc ? {
    '@context': 'https://schema.org', '@type': 'Dataset', name: `${META[r.cc].bank} ${META[r.cc].inst.toLowerCase()} history`, description, url,
    license: 'https://opensource.org/licenses/MIT', isAccessibleForFree: true, spatialCoverage: META[r.cc].name,
    temporalCoverage: `2000-01-01/${MODEL[r.cc].last.date}`, creator: { '@type': 'Person', name: 'Ashwin Gopalsamy' },
    isBasedOn: META[r.cc].bank,
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}/api/v1/countries/${r.cc.toLowerCase()}.json` },
      { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE}/api/v1/countries/${r.cc.toLowerCase()}/series.csv` },
    ],
  } : { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Policy Rate Atlas', url: SITE + '/' };
  return [
    `<meta name="description" content="${attr(description)}" />`,
    r.page === 'notfound' ? '<meta name="robots" content="noindex" />' : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`, `<meta property="og:site_name" content="Policy Rate Atlas" />`,
    `<meta property="og:title" content="${attr(title)}" />`, `<meta property="og:description" content="${attr(description)}" />`, `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary" />`,
    r.page === 'notfound' ? '' : `<script type="application/ld+json">${scriptJson(ld)}</script>`,
  ].filter(Boolean).join('\n    ');
}

/** Renders one route by running the page modules against a server-side DOM built from the shell. */
async function render(shell: string, r: Route, state: string): Promise<string> {
  const { document, window } = parseHTML(shell);
  Object.assign(globalThis, { document, window });
  const dom = await import('../src/app/dom.ts'), shellMod = await import('../src/app/shell.ts'), country = await import('../src/app/country.ts');
  const { makeIcons } = await import('../src/lib/icons.ts');
  Object.assign(dom.state, { ssr: true, page: r.page, curSec: null, dday: 'live' });
  if (r.cc) dom.state.code = r.cc;
  const host = document.getElementById('page')!;
  host.innerHTML = shellMod.pageHTML(r.page);
  host.dataset.route = shellMod.routeKey({ page: r.page, cc: r.cc });
  country.renderChip();
  if (r.page === 'country') country.renderCountry();
  else if (r.page === 'world') (await import('../src/app/world.ts')).renderWorld(false);
  else if (r.page === 'privacy') (await import('../src/app/privacy.ts')).renderPrivacy();
  else if (r.page === 'design') (await import('../src/app/design.ts')).renderDesign();
  else (await import('../src/app/notfound.ts')).renderNotFound();
  shellMod.setRail();
  makeIcons(document);
  const title = document.title;
  let html = document.toString();
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${attr(title).replace(/&quot;/g, '"')}</title>`);
  html = html.replace(/<meta name="description"[^>]*>/, '');
  html = html.replace('<!--app-head-->', head(r, title));
  html = html.replace('<!--app-data-->', `<script type="application/json" id="atlas-state">${state}</script>`);
  html = html.replace('<!--app-html-->', '');
  if (!/^<!doctype html>/i.test(html)) html = '<!doctype html>\n' + html;
  return html;
}

/** The security headers. The CSP allows only this origin plus the Cloudflare Web Analytics beacon. */
export function headers(inlineScripts: string[]): string {
  const hashes = inlineScripts.map(s => `'sha256-${createHash('sha256').update(s).digest('base64')}'`).join(' ');
  const csp = [
    "default-src 'self'", `script-src 'self' ${hashes} https://static.cloudflareinsights.com`, "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:", "font-src 'self'", "connect-src 'self' https://cloudflareinsights.com", "frame-ancestors 'none'",
    "base-uri 'self'", "form-action 'none'", "object-src 'none'", 'upgrade-insecure-requests',
  ].join('; ');
  return `/*
  ! Cache-Control
  Cache-Control: public, max-age=0, must-revalidate
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains

/assets/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable

/flags/*
  ! Cache-Control
  Cache-Control: public, max-age=604800

/design.md
  Content-Type: text/markdown; charset=utf-8

/api/*
  Access-Control-Allow-Origin: *

/api/v1/releases/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable

/data/snapshots/*
  ! Cache-Control
  Cache-Control: public, max-age=86400, immutable
`;
}

async function main() {
  const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
  const data = buildAtlas(), today = new Date().toISOString().slice(0, 10);
  initAtlas(data, today);
  const state = scriptJson(data);
  // The inline head script sends / to a returning visitor's chosen country; it needs the codes other than the default.
  const page = shell.replace('__HOME_CODES__', CODES.filter(c => c !== DEFAULT_CC).join(','));
  const routes: Route[] = [
    { path: '/', page: 'country', cc: DEFAULT_CC, file: 'index.html' },
    { path: '/world/', page: 'world', cc: null, file: 'world/index.html' },
    ...CODES.map(cc => ({ path: `/${cc.toLowerCase()}/`, page: 'country' as const, cc, file: `${cc.toLowerCase()}/index.html` })),
    { path: '/privacy/', page: 'privacy', cc: null, file: 'privacy/index.html' },
    { path: '/design/', page: 'design', cc: null, file: 'design/index.html' },
    { path: '/404', page: 'notfound', cc: null, file: '404.html' },
  ];
  const inline = new Set<string>();
  for (const r of routes) {
    const out = join(DIST, r.file);
    mkdirSync(dirname(out), { recursive: true });
    const html = await render(page, r, state);
    for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) inline.add(m[1]);
    writeFileSync(out, html);
  }
  copyFileSync(new URL('../DESIGN.md', import.meta.url), join(DIST, 'design.md'));
  writeFileSync(join(DIST, '_headers'), headers([...inline]));
  writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.filter(r => r.page !== 'notfound' && canonicalOf(r) === SITE + r.path).map(r => `  <url><loc>${SITE}${r.path}</loc><lastmod>${data.generatedAt}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`prerendered ${routes.length} routes as of ${today}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
