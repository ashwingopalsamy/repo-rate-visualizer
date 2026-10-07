import { test as base, expect } from '@playwright/test';

const test = base;
const track = (page: import('@playwright/test').Page) => {
  const posts: { url: string; body: string }[] = [], beacon: string[] = [];
  page.on('request', r => {
    if (new URL(r.url()).pathname === '/e') posts.push({ url: r.url(), body: r.postData() ?? '' });
    if (r.url().includes('cloudflareinsights.com')) beacon.push(r.url());
  });
  return { posts, beacon };
};

test('with Global Privacy Control set, nothing is sent', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }));
  await page.route('**/e', r => r.fulfill({ status: 204 }));
  const seen = track(page);
  await page.goto('/in/', { waitUntil: 'networkidle' });
  await page.locator('#ladder .rung[data-c="US"]').click(); await page.waitForTimeout(400);
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(300);
  expect(seen.posts).toEqual([]);
  expect(seen.beacon).toEqual([]);
});

test('with Do Not Track set, nothing is sent', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' }));
  await page.route('**/e', r => r.fulfill({ status: 204 }));
  const seen = track(page);
  await page.goto('/in/', { waitUntil: 'networkidle' });
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(300);
  expect(seen.posts).toEqual([]);
});

test('a country switch posts one batch with page and country_switch, flushed on pagehide', async ({ page }) => {
  await page.route('**/e', r => r.fulfill({ status: 204 }));
  const seen = track(page);
  await page.goto('/in/', { waitUntil: 'networkidle' });
  await page.locator('#ladder .rung[data-c="US"]').click(); await page.waitForTimeout(400);
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  await page.waitForTimeout(300);
  expect(seen.posts).toHaveLength(1);
  const batch = JSON.parse(seen.posts[0].body) as { v: number; e: { n: string; p: Record<string, string> }[] };
  expect(batch.v).toBe(1);
  expect(batch.e.filter(e => e.n !== 'decision_window')).toEqual([{ n: 'page', p: { route: 'country', cc: 'IN' } }, { n: 'country_switch', p: { from: 'IN', to: 'US', via: 'ladder' } }]);
  expect(seen.posts[0].body).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|Mozilla/);
});
