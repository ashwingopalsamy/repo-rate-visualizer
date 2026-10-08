/* Shared browser fixtures: the analytics collector is stubbed (vite preview has no Worker), and every page error or
   console error fails the test that caused it. */
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** `home` is the visitor's saved country. Most specs act as a returning visitor (India saved) so the first-visit country
 *  prompt stays out of the way; the prompt spec sets it to null. */
export const test = base.extend<{ errors: string[]; home: string | null }>({
  home: ['IN', { option: true }],
  errors: [async ({ page, home }, use) => {
    if (home) await page.addInitScript(cc => { try { localStorage.setItem('atlas-country', cc); } catch { /* storage blocked */ } }, home);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/e', r => r.fulfill({ status: 204 }));
    await use(errors);
    expect(errors, 'page and console errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

export const PATHS = { in: '/in/', us: '/us/', ea: '/ea/', gb: '/gb/', ca: '/ca/', au: '/au/', br: '/br/', world: '/world/', privacy: '/privacy/', home: '/' } as const;
export type RouteName = keyof typeof PATHS;

/** Opens a route and waits for fonts and the first paint to settle. */
export async function open(page: Page, route: RouteName, settle = 350): Promise<void> {
  await page.goto(PATHS[route], { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);
}
