import { test } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const outDir = '/Users/ashwin/.gemini/antigravity/brain/47905a76-6e77-4176-a1f6-1d525f6402c1/scratch';
mkdirSync(outDir, { recursive: true });

test('capture audit screenshots', async ({ page }) => {
  // 1. Desktop 1440px - Light - Timeline
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?view=timeline&range=10Y', { waitUntil: 'networkidle' });
  await page.waitForSelector('.chart-svg');
  await page.screenshot({ path: join(outDir, 'desktop_1440_timeline_light.png'), fullPage: true });

  // 1b. Desktop 1440px - Scrolled Header with Apple Blur
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'desktop_1440_scrolled_header.png') });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  // 2. Desktop 1440px - Dark - Timeline
  await page.locator('header .theme-toggle').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'desktop_1440_timeline_dark.png'), fullPage: true });

  // 2b. Desktop 1440px - Scrolled Header Dark
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'desktop_1440_scrolled_header_dark.png') });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  // Switch back to light
  await page.locator('header .theme-toggle').click();
  await page.waitForTimeout(200);

  // 3. Desktop 1440px - Rate changes
  await page.locator('[role="tab"]:has-text("Rate changes")').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'desktop_1440_rate_change.png'), fullPage: true });

  // 4. Desktop 1440px - Cycles
  await page.locator('[role="tab"]:has-text("Cycles")').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'desktop_1440_cycles.png'), fullPage: true });

  // Switch back to timeline and open sources
  await page.locator('[role="tab"]:has-text("Timeline")').click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("View all sources")').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'desktop_1440_sources_open.png'), fullPage: true });

  // Open custom date popover
  await page.locator('[data-custom-range-trigger]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'desktop_1440_custom_date_popover.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // 5. Mobile 375px - Light - Top & Timeline
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?view=timeline&range=10Y', { waitUntil: 'networkidle' });
  await page.waitForSelector('.chart-svg');
  await page.screenshot({ path: join(outDir, 'mobile_375_timeline_light.png'), fullPage: true });

  // 6. Mobile 375px - Mobile Drawer open
  await page.locator('button[aria-label="Open navigation and tools"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, 'mobile_375_drawer_open.png') });

  // Switch to dark mode from drawer
  await page.locator('[aria-labelledby="mobile-actions-heading"] .theme-toggle').click();
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Close")').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'mobile_375_timeline_dark.png'), fullPage: true });
});
