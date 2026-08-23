import { expect, test } from '@playwright/test';

test('colophon page loads with all sections and metadata', async ({ page }) => {
  await page.goto('/colophon');

  // Verify Header and Titles
  await expect(page.getByRole('heading', { name: 'Colophon', level: 1 })).toBeVisible();
  await expect(page.getByText('What this is, and how it is made.')).toBeVisible();

  // Verify Sections are present
  await expect(page.getByRole('heading', { name: 'Built with' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Data pipeline & provenance' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Performance & footprint' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'For machines & agents' })).toBeVisible();
  await expect(page.getByText('Statutory Notice & Attribution')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Source & thanks' })).toBeVisible();

  // Verify Font Loading & Styles
  const fonts = await page.evaluate(() => ({
    interLoaded: document.fonts.check('16px "Inter Variable"'),
    monoLoaded: document.fonts.check('14px "JetBrains Mono Variable"'),
    fontFamily: getComputedStyle(document.body).fontFamily,
  }));
  expect(fonts.interLoaded).toBe(true);
  expect(fonts.monoLoaded).toBe(true);
  expect(fonts.fontFamily).toContain('Inter Variable');

  // Verify Machine Surfaces Links
  await expect(page.getByRole('link', { name: 'Hugging Face Dataset' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub Source Code' }).or(page.getByRole('link', { name: /GitHub/i })).first()).toBeVisible();

  // Verify Footer Navigation Buttons
  const footerDesignBtn = page.locator('footer').getByRole('link', { name: /Design System & Tokens/i });
  await expect(footerDesignBtn).toBeVisible();
  await expect(footerDesignBtn).toHaveAttribute('href', '/design');
});

test('colophon supports theme toggle and command menu navigation', async ({ page }) => {
  await page.goto('/colophon');

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

test('colophon has no horizontal overflow across screen sizes', async ({ page }) => {
  const viewports = [
    { width: 320, height: 600 },
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto('/colophon');
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);
  }
});
