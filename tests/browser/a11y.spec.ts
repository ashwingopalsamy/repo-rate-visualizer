import AxeBuilder from '@axe-core/playwright';
import { test, expect, open } from './fixtures.ts';
import type { RouteName } from './fixtures.ts';

for (const theme of ['light', 'dark'] as const) for (const route of ['in', 'us', 'world', 'privacy'] as RouteName[]) for (const width of [1440, 390]) {
  test(`no serious or critical axe violations: ${route} at ${width} px, ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await open(page, route);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}
