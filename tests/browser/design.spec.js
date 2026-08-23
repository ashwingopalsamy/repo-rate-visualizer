import { expect, test } from '@playwright/test';

test('design colophon page loads with all sections, typography, and specimens', async ({ page }) => {
  await page.goto('/design');

  // Verify Header and Titles
  await expect(page.getByRole('heading', { name: 'Design System & Reference', level: 1 })).toBeVisible();

  // Verify Sections are present
  await expect(page.getByRole('heading', { name: 'Design Philosophy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Typography & Tabular Numerals' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Semantic Monetary Palette (OKLCH)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Surfaces & Radii Geometry' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Controls Baseline (36px Rail)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'D3 & SVG Chart Grammar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Responsive Architecture' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Consistency & Judgment Rules' })).toBeVisible();

  // Verify Font Loading & Styles
  const fonts = await page.evaluate(() => ({
    interLoaded: document.fonts.check('16px "Inter Variable"'),
    monoLoaded: document.fonts.check('14px "JetBrains Mono Variable"'),
    fontFamily: getComputedStyle(document.body).fontFamily,
  }));
  expect(fonts.interLoaded).toBe(true);
  expect(fonts.monoLoaded).toBe(true);
  expect(fonts.fontFamily).toContain('Inter Variable');

  // Verify Live D3 SVG charts are rendered
  await expect(page.locator('svg.chart-svg').first()).toBeVisible();
  const svgCount = await page.locator('svg.chart-svg').count();
  expect(svgCount).toBeGreaterThanOrEqual(2);

  // Verify Tabular Numerals Demo
  await expect(page.getByRole('heading', { name: 'Tabular (`tabular-nums`) vs Proportional Numerals' })).toBeVisible();
  const tabularBtn = page.getByRole('button', { name: 'Tabular (Active)' });
  await expect(tabularBtn).toBeVisible();

  // Verify OKLCH Color Swatches
  await expect(page.getByText('--cut', { exact: true })).toBeVisible();
  await expect(page.getByText('--hike', { exact: true })).toBeVisible();
  await expect(page.getByText('--hold', { exact: true })).toBeVisible();
  await expect(page.getByText('--source', { exact: true })).toBeVisible();
});

test('design colophon supports theme toggle and command menu navigation', async ({ page }) => {
  await page.goto('/design');

  const html = page.locator('html');
  const initialClass = await html.getAttribute('class') || '';
  const initialIsDark = initialClass.includes('dark');

  // Click theme toggle
  const themeToggle = page.locator('.site-header button.theme-toggle');
  await expect(themeToggle).toBeVisible();
  await themeToggle.click();

  // Verify theme changed
  await expect(async () => {
    const updatedClass = await html.getAttribute('class') || '';
    expect(updatedClass.includes('dark')).toBe(!initialIsDark);
  }).toPass();

  // Open command dialog via search button
  const searchBtn = page.locator('.site-header').getByRole('button', { name: 'Open command menu' }).first();
  await searchBtn.click();

  const commandDialog = page.locator('[role="dialog"]');
  await expect(commandDialog).toBeVisible();
  await expect(commandDialog.getByText('Return to Repo Rate Explorer')).toBeVisible();

  // Close dialog via Escape
  await page.keyboard.press('Escape');
  await expect(commandDialog).not.toBeVisible();
});

test('design colophon has no horizontal overflow across screen sizes', async ({ page }) => {
  const viewports = [
    { width: 320, height: 600 },
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto('/design');
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);
  }
});
