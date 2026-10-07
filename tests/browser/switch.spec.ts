/* A country switch changes data, never the page (spec §6.5): no node is recreated, no card or shell element fades, the
   record line morphs through intermediate frames, and the final state equals a direct render of the target. */
import { test, expect, open } from './fixtures.ts';
import type { Page } from '@playwright/test';
import type { RouteName } from './fixtures.ts';

const NAME: Record<string, string> = { US: 'United States', BR: 'Brazil', AU: 'Australia', CA: 'Canada' };
const lines = (page: Page) => page.evaluate(() => [document.getElementById('rHi')!.getAttribute('d'), document.getElementById('gLine')!.getAttribute('d')]);

async function staticLines(page: Page, cc: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, cc.toLowerCase() as RouteName);
  return lines(page);
}

const CASES = [
  { width: 1440, how: 'palette', target: 'US' }, { width: 1440, how: 'ladder', target: 'BR' },
  { width: 1440, how: 'rapid', target: 'AU' }, { width: 390, how: 'palette', target: 'CA' },
] as const;

for (const { width, how, target } of CASES) {
  test(`switch via ${how} IN → ${target} at ${width} px is a data change`, async ({ page, browser }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'in', 1800);
    await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const keep = '#page .card, #page .tile, #page .row, #page .chart > svg, #page .viz > svg, #page .chart, .rail, .toolbar, .m-topbar, .m-dock, #rTicks, #rHi, #gLine, #facts > div, #ladder .rung, #page .kick > svg';
      w.__nodes = [...document.querySelectorAll(keep)]; w.__min = 1; w.__minEl = ''; w.__ds = new Set<string>(); w.__stop = false;
      const shell = '#page .card, #page .tile, #page .row, .rail, .toolbar, .m-topbar, .m-dock';
      const tick = () => {
        for (const n of document.querySelectorAll<HTMLElement>(shell)) { if (!n.getClientRects().length) continue; const o = +getComputedStyle(n).opacity; if (o < (w.__min as number)) { w.__min = o; w.__minEl = n.id || n.className; } }
        (w.__ds as Set<string>).add(document.getElementById('rHi')!.getAttribute('d') ?? '');
        if (!w.__stop) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const opener = width <= 720 ? '#mFlag' : '#openPal';
    if (how === 'palette') { await page.click(opener); await page.waitForTimeout(250); await page.keyboard.type(NAME[target]); await page.keyboard.press('Enter'); }
    if (how === 'ladder') await page.locator(`#ladder .rung[data-c="${target}"]`).click();
    if (how === 'rapid') { await page.click(opener); await page.waitForTimeout(250); for (let i = 0; i < 5; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(45); } await page.keyboard.press('Enter'); }
    await page.waitForTimeout(1100);
    const r = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>; w.__stop = true;
      return { min: w.__min as number, minEl: w.__minEl as string, frames: (w.__ds as Set<string>).size, kept: (w.__nodes as Element[]).every(n => n.isConnected), code: document.getElementById('openPal')!.dataset.c };
    });
    const got = await lines(page);
    expect(r.code).toBe(target);
    expect(new URL(page.url()).pathname).toBe(`/${target.toLowerCase()}/`);
    expect(r.kept, 'page nodes were recreated').toBe(true);
    expect(r.min, `opacity dip on ${r.minEl}`).toBeGreaterThanOrEqual(0.999);
    expect(r.frames, 'record line morph frames').toBeGreaterThanOrEqual(3);
    const ref = await browser.newPage({ viewport: { width, height: 900 } });
    await ref.route('**/e', x => x.fulfill({ status: 204 }));
    expect(got).toEqual(await staticLines(ref, target));
    await ref.close();
  });
}

test('reduced motion applies the final state at once', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'in');
  await page.locator('#ladder .rung[data-c="US"]').click(); await page.waitForTimeout(60);
  const got = await lines(page);
  const ref = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await ref.route('**/e', x => x.fulfill({ status: 204 }));
  expect(got[0]).toBe((await staticLines(ref, 'US'))[0]);
  await ref.close();
});

test('back and forward move between countries without a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, 'in');
  const card = await page.evaluateHandle(() => document.getElementById('decision'));
  await page.locator('#ladder .rung[data-c="GB"]').click(); await page.waitForTimeout(700);
  await page.goBack(); await page.waitForTimeout(700);
  expect(await page.getAttribute('#openPal', 'data-c')).toBe('IN');
  expect(await card.evaluate(n => n?.isConnected)).toBe(true);
});
