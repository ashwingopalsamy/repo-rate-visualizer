import { expect, test } from '@playwright/test';

test('the production build serves the v2 app', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Policy Rate Atlas');
});
