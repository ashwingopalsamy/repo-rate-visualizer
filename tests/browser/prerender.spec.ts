import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures.ts';

const html = (p: string) => readFileSync(new URL(`../../dist/${p}`, import.meta.url), 'utf8');

test('every route is prerendered with its title, description, canonical and embedded state', () => {
  const page = html('in/index.html');
  expect(page).toMatch(/<title>RBI policy repo rate: 5\.50%, raised 7 Oct 2026 · Policy Rate Atlas<\/title>/);
  expect(page).toContain('<link rel="canonical" href="https://rates.ashwingopalsamy.in/in/" />');
  expect(page).toContain('"@type":"Dataset"');
  expect(page).toContain('<script type="application/json" id="atlas-state">');
  expect(page).toMatch(/id="big">5\.50<small>%<\/small>/);
  for (const p of ['index.html', 'us/index.html', 'ea/index.html', 'gb/index.html', 'ca/index.html', 'au/index.html', 'br/index.html', 'privacy/index.html', '404.html']) expect(html(p)).toContain('data-route=');
  expect(html('sitemap.xml')).toContain('<loc>https://rates.ashwingopalsamy.in/br/</loc>');
});

test('the client boots on the prerendered page without replacing it, three days after the build', async ({ page }) => {
  await page.clock.install({ time: Date.now() + 3 * 864e5 });
  await page.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { (window as unknown as { __card: Element | null }).__card = document.getElementById('decision'); }); });
  await page.goto('/in/', { waitUntil: 'networkidle' });
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => (window as unknown as { __card: Element | null }).__card?.isConnected)).toBe(true);
  expect(await page.locator('#rec #rHi').getAttribute('d')).toBeTruthy();
});

test('v1 links land on the new pages', async ({ page }) => {
  await page.goto('/?country=US', { waitUntil: 'networkidle' });
  expect(new URL(page.url()).pathname).toBe('/us/');
  await expect(page.locator('#chName')).toHaveText('United States');
});

test('an unknown address shows the not-found page with every country', async ({ page }) => {
  await page.goto('/nowhere/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  await expect(page.locator('#banks a.item')).toHaveCount(7);
});

test('every page runs under the production Content-Security-Policy without a violation', async ({ page }) => {
  const csp = /Content-Security-Policy: (.+)/.exec(html('_headers'))![1].replace('; upgrade-insecure-requests', '');
  for (const p of ['index.html', 'in/index.html', 'privacy/index.html', '404.html']) {
    for (const [, body] of html(p).matchAll(/<script>([\s\S]*?)<\/script>/g)) expect(csp).toContain(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
  await page.route(/\/(|[a-z]{2}\/|privacy\/)$/, async r => { const res = await r.fetch(); await r.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': csp } }); });
  for (const p of ['/', '/in/', '/privacy/']) { await page.goto(p, { waitUntil: 'networkidle' }); await page.locator('#ladder .rung, #league, #counted').first().waitFor(); }
});
