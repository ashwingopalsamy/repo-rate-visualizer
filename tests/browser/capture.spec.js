import { test } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const outDir = '/Users/ashwin/.gemini/antigravity/brain/d5334eed-16ca-4f6e-ad61-fd7baea68047/scratch';
mkdirSync(outDir, { recursive: true });

test('capture audit screenshots', async ({ page }) => {
  // 1. Desktop 1440px - Light - Timeline
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?view=timeline&range=10Y', { waitUntil: 'networkidle' });
  await page.waitForSelector('.chart-svg');
  await page.screenshot({ path: join(outDir, 'desktop_1440_timeline_light.png'), fullPage: true });

  // 2. Mobile 375px - Light - Timeline Full Page
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?view=timeline&range=MAX', { waitUntil: 'networkidle' });
  await page.waitForSelector('.chart-svg');
  await page.screenshot({ path: join(outDir, 'mobile_375_timeline_max.png'), fullPage: true });

  // 3. Mobile 360px - Breakdown View
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/?view=breakdown', { waitUntil: 'networkidle' });
  await page.waitForSelector('.chart-svg');
  await page.screenshot({ path: join(outDir, 'mobile_360_breakdown.png'), fullPage: true });

  // 4. Mobile 360px - Rate changes View
  await page.goto('/?view=rate-change', { waitUntil: 'networkidle' });
  await page.waitForSelector('.chart-svg');
  await page.screenshot({ path: join(outDir, 'mobile_360_rate_change.png'), fullPage: true });

  // 5. Mobile 360px - Cycles View
  await page.goto('/?view=cycles', { waitUntil: 'networkidle' });
  await page.waitForSelector('.chart-svg');
  await page.screenshot({ path: join(outDir, 'mobile_360_cycles.png'), fullPage: true });

  // 6. Mobile 320px - Timeline (narrowest supported screen)
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?view=timeline&range=MAX', { waitUntil: 'networkidle' });
  await page.waitForSelector('.chart-svg');
  await page.screenshot({ path: join(outDir, 'mobile_320_timeline.png'), fullPage: true });
});
