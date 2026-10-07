import { test, expect, open } from './fixtures.ts';
import type { RouteName } from './fixtures.ts';
import { guards } from './guards.ts';

const WIDTHS = [360, 768, 1280, 1440], THEMES = ['light', 'dark'] as const;
const ROUTES: RouteName[] = ['in', 'us', 'ea', 'br', 'world', 'privacy'];

for (const theme of THEMES) for (const width of WIDTHS) for (const route of ROUTES) {
  test(`layout guards: ${route} at ${width} px, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await open(page, route);
    expect(await page.evaluate(guards)).toEqual([]);
  });
}

test.describe('interaction states keep the layout', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });

  test('decision-day states and the loan modes', async ({ page }) => {
    await open(page, 'in');
    for (const s of ['announced', 'decided', 'live']) {
      await page.click(`#dday button[data-s="${s}"]`); await page.waitForTimeout(200);
      expect(await page.evaluate(guards), `dday=${s}`).toEqual([]);
    }
    await page.click('#loanMode button[data-m="since"]'); await page.waitForTimeout(150);
    expect(await page.evaluate(guards), 'loan=since').toEqual([]);
  });

  test('palette previews on arrow keys and Escape restores the country', async ({ page }) => {
    await open(page, 'in');
    await page.keyboard.press('ControlOrMeta+k'); await page.waitForTimeout(150);
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250);
    expect(await page.getAttribute('#openPal', 'data-c')).not.toBe('IN');
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    expect(await page.getAttribute('#openPal', 'data-c')).toBe('IN');
    expect(new URL(page.url()).pathname).toBe('/in/');
  });

  test('league table sorted by 12-month change', async ({ page }) => {
    await open(page, 'world');
    await page.click('#league th[data-k="y12"] button'); await page.waitForTimeout(400);
    expect(await page.evaluate(guards)).toEqual([]);
  });
});

for (const theme of THEMES) for (const width of [1440, 390]) {
  test(`theme toggle icon is centred in its round button: ${width} px, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await open(page, 'in');
    const off = await page.evaluate(() => {
      const btn = document.getElementById(innerWidth <= 720 ? 'mTheme' : 'themeBtn')!, b = btn.getBoundingClientRect();
      const svg = [...btn.querySelectorAll('svg')].find(s => s.getClientRects().length)!, r = svg.getBoundingClientRect();
      return [r.left + r.width / 2 - (b.left + b.width / 2), r.top + r.height / 2 - (b.top + b.height / 2)].map(v => Math.abs(v));
    });
    expect(Math.max(...off), `icon offset ${off.join(', ')} px`).toBeLessThanOrEqual(0.5);
  });
}
