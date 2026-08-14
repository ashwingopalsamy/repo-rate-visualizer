import { expect, test } from '@playwright/test';

async function waitForChart(page) {
  await page.waitForFunction(() => document.querySelectorAll('.decision-marker').length > 0);
}

test('desktop overview, source trail, and decision spine are visible', async ({ page }) => {
  await page.goto('/?view=timeline&range=ALL');
  await waitForChart(page);

  await expect(page.getByText('Repo rate', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Current trend', { exact: true })).toBeVisible();
  await expect(page.getByText(/Latest official decision:/)).toBeVisible();
  await expect(page.getByText('Official decision record', { exact: true })).toBeVisible();
  const attribution = page.locator('[role="note"][aria-labelledby="attribution-title"]');
  await expect(attribution).toBeVisible();
  await expect(attribution.getByRole('heading', { name: 'Attribution & Usage' })).toBeVisible();
  await expect(attribution).toContainText('not created by, affiliated with, authorised by, sponsored by, or endorsed by the Reserve Bank of India');
  await expect(attribution.getByRole('link', { name: 'RBI data dissemination material' })).toBeVisible();

  const counts = await page.evaluate(() => ({
    markers: document.querySelectorAll('.decision-marker').length,
    rows: document.querySelectorAll('.decision-record [data-decision-id]').length,
    font: getComputedStyle(document.body).fontFamily,
    geistLoaded: document.fonts.check('16px "Geist Variable"'),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));

  expect(counts.markers).toBe(counts.rows);
  expect(counts.markers).toBeGreaterThan(0);
  expect(counts.font).toContain('Geist Variable');
  expect(counts.geistLoaded).toBe(true);
  expect(counts.overflow).toBe(false);
  await expect(page.locator('.mobile-dock')).toHaveCount(0);

  const projectSource = page.getByRole('contentinfo', { name: 'Project source' });
  const authorLink = projectSource.getByRole('link', { name: 'Ashwin Gopalsamy', exact: true });
  await expect(authorLink).toHaveAttribute('href', 'https://ashwingopalsamy.in');
  const githubLink = projectSource.getByRole('link', { name: 'Open the Repo Rate Visualizer source code on GitHub' });
  await expect(githubLink).toHaveAttribute(
    'href',
    'https://github.com/ashwingopalsamy/repo-rate-visualizer',
  );
  const huggingFaceLink = projectSource.getByRole('link', { name: 'Open the RBI repo-rate dataset on Hugging Face' });
  await expect(huggingFaceLink).toHaveAttribute(
    'href',
    'https://huggingface.co/datasets/ashwingopalsamy/india-repo-rate-dataset',
  );
  await expect(huggingFaceLink.locator('img')).toHaveAttribute('src', '/hf-logo.svg');
  const footerLinkGeometry = await projectSource.locator('p:first-child a').evaluateAll((links) => links.map((link) => {
    const rect = link.getBoundingClientRect();
    return {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      verticalAlign: getComputedStyle(link).verticalAlign,
    };
  }));
  expect(footerLinkGeometry).toHaveLength(3);
  expect(new Set(footerLinkGeometry.map(({ top }) => top)).size).toBe(1);
  expect(new Set(footerLinkGeometry.map(({ bottom }) => bottom)).size).toBe(1);
  expect(footerLinkGeometry.every(({ verticalAlign }) => verticalAlign === 'middle')).toBe(true);
  await expect(projectSource).toContainText('Independent educational reference. Not affiliated with or endorsed by the Reserve Bank of India. Not financial advice.');
  await expect(projectSource.locator('[data-slot="separator"] + div')).toHaveCSS('align-items', 'center');
  await expect(projectSource.locator('[data-slot="separator"] + div')).toHaveCSS('text-align', 'center');
  await expect(page.getByRole('tab', { name: 'All history' })).toBeVisible();
  await expect(page.locator('.rate-summary')).toHaveAttribute('data-trend', 'hold');
  await expect(page.locator('.rate-summary h2')).toHaveText('Hold');
  await expect(page.locator('.decision-marker--hold').last()).toBeVisible();
  await expect(page.getByText('Steady', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Source-backed snapshot', { exact: true })).toHaveCount(0);
  await expect(page.getByText('MPC resolution', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Static snapshot · D3 chart', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'View all sources' }).click();
  const sourceCount = await page.locator('[data-source-id]').count();
  expect(sourceCount).toBeGreaterThan(0);
  await expect(page.locator('[data-source-id] a[href^="http"]')).toHaveCount(sourceCount);
  await page.getByRole('button', { name: 'Hide sources' }).click();
  await expect(attribution).toBeVisible();
});

test('shared controls and source columns keep stable geometry', async ({ page }) => {
  await page.goto('/?view=timeline&range=ALL');
  await waitForChart(page);

  const controlHeights = await page.evaluate(() => [...document.querySelectorAll('.header-control, .theme-toggle, [data-layer-control], .workspace-export-actions > button, .data-evidence__trigger, .data-evidence__download')]
    .filter(element => getComputedStyle(element).display !== 'none')
    .map(element => Math.round(element.getBoundingClientRect().height)));
  expect(controlHeights.length).toBeGreaterThan(5);
  expect(new Set(controlHeights)).toEqual(new Set([36]));

  await page.getByRole('button', { name: 'View all sources' }).click();
  const sourceLayout = await page.evaluate(() => [...document.querySelectorAll('[data-source-id]')].map(row => {
    const cells = row.querySelectorAll('td');
    const source = row.querySelector('.source-record__title')?.getBoundingClientRect();
    const published = cells[2]?.getBoundingClientRect();
    const linked = cells[3]?.getBoundingClientRect();
    const integrity = cells[4]?.getBoundingClientRect();
    return {
      sourceEndsBeforePublished: source && published ? source.right <= published.left + 1 : false,
      publishedEndsBeforeLinked: published && linked ? published.right <= linked.left + 1 : false,
      linkedEndsBeforeIntegrity: linked && integrity ? linked.right <= integrity.left + 1 : false,
    };
  }));
  expect(sourceLayout.length).toBeGreaterThan(0);
  expect(sourceLayout.every(row => row.sourceEndsBeforePublished && row.publishedEndsBeforeLinked && row.linkedEndsBeforeIntegrity)).toBe(true);
  await expect(page.getByRole('button', { name: 'Hide sources' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide sources' }).click();
  await expect(page.getByRole('button', { name: 'View all sources' })).toBeVisible();
});

test('range state, views, and exports remain functional', async ({ page }) => {
  await page.goto('/?view=timeline&range=10Y');
  await waitForChart(page);

  await page.getByRole('tab', { name: 'Rate changes' }).click();
  await expect(page).toHaveURL(/view=rate-change/);
  await expect(page.getByText('Rate changes', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Timeline' }).click();
  await waitForChart(page);

  await page.getByRole('button', { name: 'More export options' }).click();
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download CSV' }).click();
  expect((await csvDownload).suggestedFilename()).toMatch(/\.csv$/);

  await page.getByRole('button', { name: 'Download chart' }).click();
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download SVG' }).click();
  expect((await svgDownload).suggestedFilename()).toMatch(/\.svg$/);

  await page.getByRole('button', { name: 'Download chart' }).click();
  const pngDownload = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download PNG' }).click();
  expect((await pngDownload).suggestedFilename()).toMatch(/\.png$/);
});

test('workspace controls are grouped and Layers exposes a selected state', async ({ page }) => {
  await page.goto('/?view=timeline&range=10Y');
  await waitForChart(page);

  const controls = page.locator('.workspace-controls');
  await expect(controls).toBeVisible();
  await expect(controls.locator('[data-control-group="view"]')).toBeVisible();
  await expect(controls.getByText('Range', { exact: true })).toBeVisible();
  await expect(controls.getByRole('button', { name: 'Download chart' })).toBeVisible();
  await expect(page.getByText('Timeline · URL-linked view', { exact: true })).toHaveCount(0);
  await expect(page.locator('.workspace-view-switcher__trigger[data-state="active"]')).toHaveText('Timeline');

  const layers = controls.getByRole('button', { name: /Layers, 2 active/ });
  await expect(layers).toBeVisible();
  await layers.click();
  await expect(page.getByRole('menuitemcheckbox', { name: 'Regime bands' })).toBeVisible();
  await page.getByRole('menuitemcheckbox', { name: 'Regime bands' }).click();
  await expect(controls.getByRole('button', { name: /Layers, 1 active/ })).toBeVisible();
  await controls.getByRole('button', { name: /Layers, 1 active/ }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Regime bands' }).click();
  await expect(controls.getByRole('button', { name: /Layers, 2 active/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(controls.getByRole('button', { name: /Layers, 2 active/ })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Macro events', { exact: true }).last()).toBeVisible();
});

test('Layers remains discoverable across analytical views', async ({ page }) => {
  for (const view of ['timeline', 'rate-change', 'cycles']) {
    await page.goto(`/?view=${view}&range=10Y`);
    await expect(page.locator('[data-layer-control]')).toBeVisible();
  }
});

test('markers and decision rows share one selection state', async ({ page }) => {
  await page.goto('/?view=timeline&range=10Y');
  await waitForChart(page);

  const marker = page.locator('.decision-marker').first();
  const markerId = await marker.getAttribute('data-decision-id');
  await marker.click();
  await expect(page.locator(`.decision-record [data-decision-id="${markerId}"] button[aria-pressed="true"]`)).toHaveCount(1);
  await expect(page.locator('.decision-marker--active')).toHaveCount(1);

  const row = page.locator('.decision-spine-row').first();
  const rowId = await row.getAttribute('data-decision-id');
  await row.locator('button[aria-pressed]').click();
  await expect(page.locator(`.decision-marker[data-decision-id="${rowId}"].decision-marker--active`)).toHaveCount(1);
  await expect(row.locator('button[aria-pressed="true"]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-decision-id'))).toBe(rowId);
});

test('custom dates use an accessible popover control', async ({ page }) => {
  await page.goto('/?view=timeline&range=10Y');
  await waitForChart(page);

  await page.locator('[data-custom-range-trigger]').click();
  await expect(page.locator('[data-slot="popover-title"]', { hasText: 'Custom date range' })).toBeVisible();
  await expect(page.getByLabel('Start date')).toBeVisible();
  await expect(page.getByLabel('End date')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-slot="popover-title"]', { hasText: 'Custom date range' })).toBeHidden();
});

test('custom dates apply transactionally and reset to 10Y', async ({ page }) => {
  await page.goto('/?view=timeline&range=10Y');
  await waitForChart(page);

  await page.getByRole('button', { name: 'Choose custom date range' }).click();
  await page.getByLabel('Start date').fill('2020-01-01');
  await page.getByLabel('End date').fill('2022-12-31');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page).toHaveURL(/start=2020-01-01/);
  await expect(page).toHaveURL(/end=2022-12-31/);
  await expect(page.locator('[data-custom-range-trigger]')).toContainText('Custom · 2020–2022');

  const layout = await page.evaluate(() => {
    const rail = document.querySelector('.workspace-control-rail')?.getBoundingClientRect();
    const actions = document.querySelector('.workspace-actions')?.getBoundingClientRect();
    return { rail, actions };
  });
  expect(layout.rail).toBeTruthy();
  expect(layout.actions).toBeTruthy();
  expect(layout.actions.top).toBeGreaterThanOrEqual(layout.rail.top);
  expect(layout.actions.bottom).toBeLessThanOrEqual(layout.rail.bottom);

  await page.locator('[data-custom-range-trigger]').click();
  await page.getByRole('button', { name: 'Reset to 10Y' }).click();
  await expect(page).toHaveURL(/range=10Y/);
});

test('custom date validation is visible and does not mutate the URL until Apply', async ({ page }) => {
  await page.goto('/?view=timeline&range=10Y');
  await waitForChart(page);

  await page.getByRole('button', { name: 'Choose custom date range' }).click();
  await page.getByLabel('Start date').fill('2022-01-01');
  await page.getByLabel('End date').fill('2020-01-01');
  await expect(page.getByText('Start date must be on or before the end date.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/range=10Y/);
});

test('mobile uses the command Drawer and normal page flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?view=timeline&range=10Y');
  await waitForChart(page);

  const trigger = page.getByRole('button', { name: 'Open navigation and tools' });
  await expect(trigger).toBeVisible();
  await expect(page.locator('.mobile-dock')).toHaveCount(0);

  const dimensions = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    fixedBottom: [...document.querySelectorAll('*')].some(node => {
      const style = getComputedStyle(node);
      return style.position === 'fixed' && parseFloat(style.bottom || '0') > 0;
    }),
  }));
  expect(dimensions.overflow).toBe(false);
  expect(dimensions.fixedBottom).toBe(false);

  await trigger.click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('[data-slot="toggle-group"]')).toHaveCount(0);
  await expect(drawer.getByText('Views', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Layers', { exact: true })).toBeVisible();
  const regimeLayer = drawer.getByRole('checkbox', { name: /Regime bands/ });
  await expect(regimeLayer).toBeVisible();
  await regimeLayer.click();
  await expect(regimeLayer).toHaveAttribute('aria-checked', 'false');
  await drawer.getByRole('button', { name: /Rate changes/ }).click();
  await expect(page).toHaveURL(/view=rate-change/);
  await expect(drawer).toBeHidden();
});

test('theme and reduced-motion preferences are respected', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?view=timeline&range=10Y');

  const themeButton = page.locator('button[aria-label^="Switch to "]').first();
  await expect(themeButton).toBeVisible();
  const before = await page.locator('html').getAttribute('data-theme');
  await themeButton.click();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).not.toBe(before);

  const reducedMotion = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  expect(reducedMotion).toBe(true);
});

function assertReadoutAvoidsMarks(page, selector) {
  return page.evaluate((markSelector) => {
    const readout = document.querySelector('.chart-readout');
    if (!readout || getComputedStyle(readout).visibility === 'hidden') return { visible: false, overlaps: ['missing-readout'] };
    const readoutRect = readout.getBoundingClientRect();
    const overlaps = [...document.querySelectorAll(markSelector)].filter(mark => {
      const rect = mark.getBoundingClientRect();
      const padding = 5;
      return !(
        readoutRect.right + padding <= rect.left
        || readoutRect.left - padding >= rect.right
        || readoutRect.bottom + padding <= rect.top
        || readoutRect.top - padding >= rect.bottom
      );
    }).map(mark => mark.className.baseVal || mark.className);
    return { visible: true, overlaps };
  }, selector);
}

test('chart readouts avoid visible points, markers, and bars', async ({ page }) => {
  await page.goto('/?view=timeline&range=10Y');
  await waitForChart(page);

  for (const marker of [page.locator('.decision-marker').first(), page.locator('.decision-marker').last()]) {
    await marker.hover();
    await expect(page.locator('.chart-readout')).toBeVisible();
    const geometry = await assertReadoutAvoidsMarks(page, '.rate-dot, .decision-marker__dot');
    expect(geometry.visible).toBe(true);
    expect(geometry.overlaps).toEqual([]);
  }

  await page.getByRole('tab', { name: 'Rate changes' }).click();
  await expect(page.locator('.bar').first()).toBeVisible();
  for (const bar of [page.locator('.bar').first(), page.locator('.bar').last()]) {
    await bar.hover();
    await expect(page.locator('.chart-readout')).toBeVisible();
    const geometry = await assertReadoutAvoidsMarks(page, '.bar');
    expect(geometry.visible).toBe(true);
    expect(geometry.overlaps).toEqual([]);
  }
});

test('data and evidence keeps dataset metadata and source integrity together', async ({ page }) => {
  await page.goto('/?view=timeline&range=10Y');
  await waitForChart(page);
  const evidenceTrigger = page.locator('.data-evidence__trigger');
  await expect(evidenceTrigger).toHaveAttribute('aria-expanded', 'false');
  await evidenceTrigger.click();
  await expect(evidenceTrigger).toHaveAttribute('aria-expanded', 'true');

  await expect(page.locator('.data-evidence__masthead')).toBeVisible();
  await expect(page.getByText(/107 decisions/).first()).toBeVisible();
  await expect(page.getByText(/Coverage/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download the complete repo-rate decision CSV' })).toBeVisible();
  await expect(page.locator('[data-source-id]').first()).toBeVisible();
  const integrity = page.locator('[data-source-id]').first().getByRole('button', { name: /Open integrity details/ });
  await integrity.click();
  await expect(page.getByText('Integrity & retrieval', { exact: true })).toBeVisible();
  await expect(page.getByText(/Retrieved/).last()).toBeVisible();
});

test('the shared page has no horizontal overflow at supported widths', async ({ page }) => {
  for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?view=timeline&range=10Y');
    await waitForChart(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});
