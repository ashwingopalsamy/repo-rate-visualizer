import { expect, test } from '@playwright/test';

test('@trust country index exposes only published country histories', async ({ page }) => {
  await page.goto('/countries');
  await expect(page.getByRole('heading', { name: 'Policy rates, in their own terms.' })).toBeVisible();
  await expect(page.locator('.atlas-index').getByRole('link', { name: /United States/ })).toHaveAttribute('href', '/country/us');
  await expect(page.getByText('United Kingdom', { exact: true })).toBeVisible();
  await expect(page.getByText('Pending source review').first()).toBeVisible();
});

test('@trust US target range, sources, and keyboard readout survive mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/country/us');
  await expect(page.getByText('3.75–4.00%').first()).toBeVisible();
  await expect(page.getByText('75', { exact: true })).toBeVisible();
  await expect(page.locator('.atlas-chart__upper')).toBeVisible();
  await expect(page.locator('.atlas-chart__lower')).toBeVisible();
  await expect(page.locator('.atlas-chart__band')).toBeVisible();
  await page.locator('.atlas-chart__svg').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('.atlas-chart__readout')).toContainText('Feb 2, 2000');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});

test('@trust design reference includes global point and range specimens', async ({ page }) => {
  await page.goto('/design');
  await expect(page.getByRole('heading', { name: 'Country Atlas Patterns' })).toBeVisible();
  await expect(page.getByText('POINT TARGET · RBI EXAMPLE')).toBeVisible();
  await expect(page.getByText('RANGE TARGET · FED EXAMPLE')).toBeVisible();
});
