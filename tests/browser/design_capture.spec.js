import { test } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const outDir = '/Users/ashwin/.gemini/antigravity/brain/7857af42-5976-4ec9-bafe-1cbf47ec0111/scratch';
mkdirSync(outDir, { recursive: true });

test('capture design colophon screenshots for visual verification', async ({ page }) => {
  // 1. Desktop Light
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/design', { waitUntil: 'networkidle' });
  await page.waitForSelector('svg.chart-svg');
  await page.screenshot({ path: join(outDir, 'design_desktop_light.png'), fullPage: true });

  // 2. Desktop Dark
  const themeToggle = page.locator('.site-header button.theme-toggle');
  await themeToggle.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'design_desktop_dark.png'), fullPage: true });

  // 3. Mobile Light
  await page.setViewportSize({ width: 375, height: 812 });
  // switch back to light
  await themeToggle.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'design_mobile_light.png'), fullPage: true });

  // 4. Mobile Dark
  await themeToggle.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'design_mobile_dark.png'), fullPage: true });

  // 5. Colophon Desktop Light
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/colophon', { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(outDir, 'colophon_desktop_light.png'), fullPage: true });

  // 6. Colophon Desktop Dark
  const colophonToggle = page.locator('.site-header button.theme-toggle');
  await colophonToggle.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'colophon_desktop_dark.png'), fullPage: true });

  // 7. Colophon Mobile Light
  await page.setViewportSize({ width: 375, height: 812 });
  await colophonToggle.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'colophon_mobile_light.png'), fullPage: true });
});
