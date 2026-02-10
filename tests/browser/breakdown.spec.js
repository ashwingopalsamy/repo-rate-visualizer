import { expect, test } from '@playwright/test';

async function waitForBreakdown(page) {
  await page.waitForFunction(() => document.querySelectorAll('.breakdown-segment').length > 0);
}

test('breakdown view renders stacked bars, segment labels, ratio badges, and metrics', async ({ page }) => {
  await page.goto('/?view=breakdown&range=ALL');
  await waitForBreakdown(page);

  // Verify view title and description
  await expect(page.getByRole('tab', { name: 'Breakdown' })).toHaveAttribute('data-state', 'active');
  await expect(page.getByText('RBI Policy Regime Decomposition')).toBeVisible();
  await expect(page.getByText(/% holds\./)).toBeVisible();

  // Verify metric cards row
  await expect(page.getByText('Total decisions', { exact: true })).toBeVisible();
  await expect(page.getByText('Holds', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Rate Cuts', { exact: true })).toBeVisible();
  await expect(page.getByText('Rate Hikes', { exact: true })).toBeVisible();

  // Verify SVG stacked bars and top ratio badges
  const svg = page.locator('.chart-svg');
  await expect(svg).toBeVisible();

  const segmentCount = await page.locator('.breakdown-segment').count();
  expect(segmentCount).toBeGreaterThan(5);

  const topBadges = await page.locator('.breakdown-top-badge').count();
  expect(topBadges).toBeGreaterThan(3);

  // Test hovering a segment to trigger ChartReadout
  const firstSegment = page.locator('.breakdown-segment').first();
  await firstSegment.hover();
  await expect(page.locator('.chart-readout')).toBeVisible();

  // Test mode switcher: By Year
  await page.getByRole('tab', { name: 'By Year' }).click();
  await expect(page.getByText('Annual Monetary Policy Breakdown')).toBeVisible();
  const yearlySegments = await page.locator('.breakdown-segment').count();
  expect(yearlySegments).toBeGreaterThan(5);

  // Test metric mode switcher: Bps Volume
  await page.getByRole('tab', { name: 'Bps Volume' }).click();
  await expect(page.getByText('Number above each bar = net cumulative bps move')).toBeVisible();

  // Test export from breakdown view
  await page.getByRole('button', { name: 'Download chart' }).click();
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download SVG' }).click();
  expect((await svgDownload).suggestedFilename()).toMatch(/\.svg$/);
});

test('breakdown view supports theme toggle and mobile navigation', async ({ page }) => {
  await page.goto('/?view=breakdown&range=10Y');
  await waitForBreakdown(page);

  // Theme switch test
  const themeButton = page.locator('.site-header button[aria-label^="Switch to "]').first();
  await expect(themeButton).toBeVisible();
  const initialTheme = await page.locator('html').getAttribute('data-theme');
  await themeButton.click();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).not.toBe(initialTheme);

  // Mobile viewport test
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileNavTrigger = page.getByRole('button', { name: 'Open navigation and tools' });
  await expect(mobileNavTrigger).toBeVisible();
  await mobileNavTrigger.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: /Breakdown/ })).toBeVisible();
});

test('captures breakdown screenshots for visual audit', async ({ page }) => {
  const outDir = '/Users/ashwin/.gemini/antigravity/brain/501d36e3-4618-426d-b9c2-36591a27d078/scratch';
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto('/?view=breakdown&range=ALL');
  await waitForBreakdown(page);
  await expect(page.locator('.x-axis-label-group').first()).toBeVisible();
  const breakdownCard = page.locator('.breakdown-view');
  await breakdownCard.screenshot({ path: `${outDir}/breakdown_desktop_card.png` });

  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/?view=breakdown&range=ALL');
  await waitForBreakdown(page);
  await breakdownCard.screenshot({ path: `${outDir}/breakdown_mobile_card.png` });
});
