/* The site opens on India. A first-time visitor gets a small prompt to pick their own central bank, suggested from the
   browser's time zone and language; the choice is remembered, and / opens there next time. */
import { test, expect, open } from './fixtures.ts';
import type { Page } from '@playwright/test';

test.use({ home: null });
const prompt = (page: Page) => page.locator('#cprompt');

test.describe('a first visit from London', () => {
  test.use({ timezoneId: 'Europe/London', viewport: { width: 1440, height: 900 } });

  test('opens on India and suggests the Bank of England', async ({ page }) => {
    await open(page, 'home');
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('#chName')).toHaveText('India');
    await expect(prompt(page)).toBeVisible();
    await expect(prompt(page).locator('#cpTitle')).toHaveText('Following the Bank of England?');
    await expect(prompt(page).locator('.cp-go')).toHaveText('Switch to United Kingdom');
  });

  test('switching is a data change, remembered for the next visit to /', async ({ page }) => {
    await open(page, 'home');
    const card = await page.evaluateHandle(() => document.getElementById('decision'));
    await prompt(page).locator('.cp-go').click();
    await expect(prompt(page)).toHaveCount(0);
    await expect(page.locator('#openPal')).toHaveAttribute('data-c', 'GB');
    expect(new URL(page.url()).pathname).toBe('/gb/');
    expect(await card.evaluate(n => n?.isConnected)).toBe(true);
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(new URL(page.url()).pathname).toBe('/gb/');
    await page.waitForTimeout(1600);
    await expect(prompt(page)).toHaveCount(0);
  });

  test('keeping India stays on / and never asks again', async ({ page }) => {
    await open(page, 'home');
    await prompt(page).locator('.cp-keep').click();
    await expect(prompt(page)).toHaveCount(0);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1600);
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(page.locator('#chName')).toHaveText('India');
    await expect(prompt(page)).toHaveCount(0);
  });

  test('any flag picks that bank, and Escape closes the prompt', async ({ page }) => {
    await open(page, 'home');
    await prompt(page).locator('.cp-flag[data-c="AU"]').click();
    await expect(page.locator('#openPal')).toHaveAttribute('data-c', 'AU');
    await page.goto('/in/', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.removeItem('atlas-country'));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(prompt(page)).toBeVisible();
    await prompt(page).locator('.cp-flag').first().focus();
    await page.keyboard.press('Escape');
    await expect(prompt(page)).toHaveCount(0);
  });
});

test.describe('a first visit from India', () => {
  test.use({ timezoneId: 'Asia/Kolkata', viewport: { width: 1440, height: 900 } });
  test('asks without suggesting, since India is already shown', async ({ page }) => {
    await open(page, 'home');
    await expect(prompt(page)).toBeVisible();
    await expect(prompt(page).locator('#cpTitle')).toHaveText('Follow another central bank?');
    await expect(prompt(page).locator('.cp-go')).toHaveCount(0);
  });
});

for (const width of [390, 768, 1440]) {
  test(`the prompt fits at ${width} px: inside the viewport, clear of the toolbar and the dock`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page, 'home');
    await expect(prompt(page)).toBeVisible();
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const box = (s: string) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const p = box('#cprompt')!, row = document.querySelector('.cp-flags')!;
      const hit = (a: ReturnType<typeof box>) => !!a && Math.min(a.r, p.r) - Math.max(a.l, p.l) > 0 && Math.min(a.b, p.b) - Math.max(a.t, p.t) > 0;
      return { inside: p.l >= 0 && p.t >= 0 && p.r <= innerWidth && p.b <= innerHeight, dock: hit(box('.m-dock-bar')), top: hit(box('.m-topbar')) || hit(box('.toolbar')), overflow: row.scrollWidth > row.clientWidth + 1 };
    });
    expect(r).toEqual({ inside: true, dock: false, top: false, overflow: false });
  });
}

test('the world view lives at /world/ and its rail links back to the country', async ({ page }) => {
  await open(page, 'world');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Policy rates around the world');
  await page.waitForTimeout(1600);
  await expect(prompt(page)).toHaveCount(0);
});

test.describe('rings', () => {
  test.use({ timezoneId: 'Europe/London' });
  for (const theme of ['light', 'dark'] as const) {
  test(`the current and suggested flags carry their rings in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await open(page, 'home');
    await expect(prompt(page)).toBeVisible();
    const rings = await page.evaluate(() => ['[aria-current="true"]', '[data-suggested]', ':not([aria-current]):not([data-suggested])'].map(s => getComputedStyle(document.querySelector(`.cp-flag${s} .disc`)!).boxShadow.split(/,(?![^(]*\))/).length));
    expect(rings).toEqual([2, 2, 1]);
  });
}
});
