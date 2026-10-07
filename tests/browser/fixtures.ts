/* Shared browser fixtures: the analytics collector is stubbed (vite preview has no Worker), and every page error or
   console error fails the test that caused it. */
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const test = base.extend<{ errors: string[] }>({
  errors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/e', r => r.fulfill({ status: 204 }));
    await use(errors);
    expect(errors, 'page and console errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

export const PATHS = { in: '/in/', us: '/us/', ea: '/ea/', gb: '/gb/', ca: '/ca/', au: '/au/', br: '/br/', world: '/', privacy: '/privacy/' } as const;
export type RouteName = keyof typeof PATHS;

/** Opens a route and waits for fonts and the first paint to settle. */
export async function open(page: Page, route: RouteName, settle = 350): Promise<void> {
  await page.goto(PATHS[route], { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);
}
