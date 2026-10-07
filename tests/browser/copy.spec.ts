import { test, expect, open } from './fixtures.ts';
import type { RouteName } from './fixtures.ts';

const ROUTES: RouteName[] = ['in', 'us', 'ea', 'gb', 'ca', 'au', 'br', 'world', 'privacy'];

// Rendered text has no null/undefined, stray spacing, broken plurals, or unbalanced quotes and brackets.
for (const width of [1440, 390]) for (const route of ROUTES) {
  test(`copy audit: ${route} at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, route);
    const bad = await page.evaluate(() => {
      const out: string[] = [], rx: [RegExp, string][] = [[/\bnull\b|\bundefined\b|NaN|Infinity/, 'null/undefined'], [/ {2,}/, 'double space'], [/ [,.;:]/, 'space before punctuation'], [/\.\./, 'double period'], [/\b1 (months|days|years|moves|hikes|cuts|cycles)\b/, 'plural'], [/\bthe the\b/i, 'double article'], [/\(\s*\)/, 'empty brackets']];
      for (const e of document.querySelectorAll<HTMLElement>('#page p, #page dd, #page dt, #page .title, #page .sub, #page blockquote, #page .lab, #page .delta, #page .kick, #page h1, #page td, #page .legend span, #page .pass, #page .card-foot, .toolbar, .m-topbar, #page .stats div, #page .glance-stats div')) {
        if (!e.getClientRects().length) continue; const t = e.innerText.replace(/\s*\n\s*/g, ' ');
        for (const [x, k] of rx) if (x.test(t)) out.push(`${k}: "${t.slice(0, 90)}"`);
        if (((t.match(/“/g) || []).length !== (t.match(/”/g) || []).length) || (t.match(/"/g) || []).length % 2) out.push(`unbalanced quotes: "${t.slice(0, 90)}"`);
        if ((t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length) out.push(`unbalanced brackets: "${t.slice(0, 90)}"`);
      }
      return out;
    });
    expect(bad).toEqual([]);
  });
}
