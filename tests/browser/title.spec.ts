import { test, expect, open } from './fixtures.ts';

// Rolling title under fast scrolling: never more than two labels in the slot, never two fully visible, one at rest.
for (const width of [1440, 390]) {
  test(`rolling title stays single-flight under fast scroll at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'in', 1500);
    const r = await page.evaluate(async () => {
      const phone = innerWidth <= 720, slot = document.getElementById(phone ? 'mTitle' : 'crumbSlot')!, sc = phone ? document.scrollingElement! : document.getElementById('canvas')!;
      let worst = 0, both = 0; const max = sc.scrollHeight - sc.clientHeight;
      for (let i = 0; i <= 60; i++) {
        sc.scrollTop = (i % 20 < 10 ? i % 10 : 10 - i % 10) / 10 * max; await new Promise(f => setTimeout(f, 35));
        const live = [...slot.querySelectorAll('.crumb')]; worst = Math.max(worst, live.length);
        if (live.filter(n => +getComputedStyle(n).opacity > 0.9).length > 1) both++;
      }
      await new Promise(f => setTimeout(f, 600));
      return { worst, both, rest: slot.querySelectorAll('.crumb').length };
    });
    expect(r.worst).toBeLessThanOrEqual(2);
    expect(r.both).toBe(0);
    expect(r.rest).toBe(1);
  });
}
