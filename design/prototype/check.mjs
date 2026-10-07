// Layout guard and screenshot run for the design prototype.
// Usage: node design/prototype/check.mjs [--shots]
// Checks every page at 360, 768, 1280 and 1440 px in light and dark for: page overflow, content escaping its card,
// clipped text, overlapping text, mono type inside prose, unequal card heights in a row, empty card areas, toolbar
// overlap, and table alignment. Exits non-zero on any failure.
import { chromium } from '../../node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(dir, 'index.html');
const shots = process.argv.includes('--shots');
const outDir = path.join(dir, 'shots');
if (shots) mkdirSync(outDir, { recursive: true });

const WIDTHS = [360, 768, 1280, 1440], THEMES = ['light', 'dark'], ROUTES = ['in', 'us', 'world', 'br'];

function guards() {
  const fails = [];
  const R = el => el.getBoundingClientRect();
  const vis = el => { const r = R(el), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]'); };
  const name = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')) + (el.closest('[id]') && !el.id ? ` in #${el.closest('[id]').id}` : '');
  const inScroller = el => el.closest('.list, .table-wrap, .palette');
  // 1. page-level horizontal overflow
  const de = document.documentElement, cv = document.getElementById('canvas');
  if (de.scrollWidth > innerWidth + 1) fails.push(`page overflows horizontally: ${de.scrollWidth} > ${innerWidth}`);
  if (cv.scrollWidth > cv.clientWidth + 1) fails.push(`canvas overflows horizontally: ${cv.scrollWidth} > ${cv.clientWidth}`);
  const cards = [...document.querySelectorAll('#page .card, #page .tile')].filter(vis);
  // 2. content escaping its card
  for (const c of cards) {
    const cr = R(c);
    for (const el of c.querySelectorAll('*')) {
      if (!vis(el) || inScroller(el) || el.closest('svg') && el.tagName !== 'svg') continue;
      const r = R(el);
      if (r.right > cr.right + 1 || r.left < cr.left - 1) { fails.push(`escapes card horizontally: ${name(el)} (${Math.round(r.left)}..${Math.round(r.right)} vs ${Math.round(cr.left)}..${Math.round(cr.right)})`); break; }
    }
  }
  // 3. clipped text (ellipsis or hidden overflow cutting text)
  const textEls = [...document.querySelectorAll('#page *, .toolbar *')].filter(el => vis(el) && !el.closest('svg') && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  for (const el of textEls) {
    if (inScroller(el) && !el.closest('.item, td')) continue;
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') fails.push(`clipped text: ${name(el)} "${el.textContent.trim().slice(0, 40)}"`);
  }
  // 4. overlapping text (HTML leaves and SVG text, per card and in the toolbar)
  const groups = [...cards, ...document.querySelectorAll('.toolbar, .m-topbar, .m-dock')].filter(vis);
  for (const g of groups) {
    const leaves = [...g.querySelectorAll('*')].filter(el => vis(el) && (el.tagName === 'text' || (!el.closest('svg') && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))) && !(el.closest('.list') && !el.closest('.item')));
    const boxes = leaves.map(el => { const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter(r => r.width > 0.5); return { el, rs }; });
    outer: for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const sa = a.el.closest('.list'), sb = b.el.closest('.list'); if ((sa || sb) && sa !== sb) continue;
      for (const p of a.rs) for (const q of b.rs) {
        const ox = Math.min(p.right, q.right) - Math.max(p.left, q.left), oy = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
        if (ox > 2 && oy > 2) { fails.push(`text overlap: ${name(a.el)} "${a.el.textContent.trim().slice(0, 24)}" × ${name(b.el)} "${b.el.textContent.trim().slice(0, 24)}"`); break outer; }
      }
    }
  }
  // 5. mono type inside prose
  for (const host of document.querySelectorAll('[data-prose]')) {
    const w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode, el = n.parentElement;
      if (!n.textContent.trim() || !vis(el) || el.closest('.fig, .stats b, .pill, .disc')) continue;
      if (/Geist Mono/i.test(getComputedStyle(el).fontFamily.split(',')[0])) { fails.push(`mono in prose: ${name(el)} "${n.textContent.trim().slice(0, 30)}"`); break; }
    }
  }
  // 6. cards on one line of a row share a height
  for (const row of document.querySelectorAll('#page .row')) {
    const kids = [...row.children].filter(vis), lines = new Map();
    kids.forEach(k => { const t = Math.round(R(k).top); lines.set(t, [...(lines.get(t) || []), k]); });
    for (const ks of lines.values()) if (ks.length > 1) { const hs = ks.map(k => Math.round(R(k).height)); if (Math.max(...hs) - Math.min(...hs) > 1) fails.push(`unequal heights in row: ${ks.map(name).join(' / ')} = ${hs.join(' / ')}`); }
  }
  // 7. empty areas at the bottom of a card body
  for (const b of document.querySelectorAll('#page .card-body')) {
    if (!vis(b)) continue;
    const r = R(b), pb = parseFloat(getComputedStyle(b).paddingBottom), kids = [...b.children].filter(vis);
    if (!kids.length) { fails.push(`empty card body: ${name(b)}`); continue; }
    const bottom = Math.max(...kids.map(k => R(k).bottom)), slack = r.bottom - pb - bottom;
    if (slack > 24) fails.push(`empty area ${Math.round(slack)}px at bottom of ${name(b.closest('.card'))}`);
  }
  // 8. toolbar: crumb never collides with the switcher
  const slot = document.getElementById('crumbSlot'), sw = document.getElementById('openPal'), meta = document.getElementById('crumbMeta');
  const hit = (a, b) => { const p = R(a), q = R(b); return p.width && q.width && Math.min(p.right, q.right) - Math.max(p.left, q.left) > 0 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 0; };
  if (hit(slot, sw)) fails.push('toolbar: crumb overlaps the country switch');
  if (vis(meta) && hit(meta, sw)) fails.push('toolbar: crumb meta overlaps the country switch');
  const crumb = slot.querySelector('.crumb:last-child span'); if (crumb && crumb.scrollWidth > slot.clientWidth + 1) fails.push('toolbar: crumb label wider than its slot');
  // phone shell: title clear of both round buttons; dock tabs inside the bar; the last content clears the dock
  const mt = document.getElementById('mTop');
  if (vis(mt)) {
    const title = document.getElementById('mTitle'), t = title.querySelector('.crumb:last-child span');
    for (const b of mt.querySelectorAll('.m-round')) if (hit(title, b)) fails.push('phone top bar: title overlaps a round button');
    if (t && t.scrollWidth > t.clientWidth + 1) fails.push(`phone top bar: title clipped "${t.textContent}"`);
    const bar = R(document.querySelector('.m-dock-bar'));
    for (const tab of document.querySelectorAll('.m-tab')) { const r = R(tab); if (r.left < bar.left - 0.5 || r.right > bar.right + 0.5) fails.push('phone dock: tab outside the bar'); }
    const on = document.querySelector('.m-tab[data-on]'), pill = document.getElementById('mPill');
    if (!on) fails.push('phone dock: no active tab'); else if (Math.abs(R(pill).left - R(on).left) > 1 || Math.abs(R(pill).width - R(on).width) > 1) fails.push('phone dock: pill not under the active tab');
    const foot = document.querySelector('.site-foot'), pad = parseFloat(getComputedStyle(document.getElementById('page')).paddingBottom);
    if (pad < R(document.querySelector('.m-dock')).height + 16) fails.push('phone: page bottom padding does not clear the dock');
  }
  // 9. table alignment: discs share a left edge, rows share a height, rates stay on one line
  const league = document.getElementById('league');
  if (league && vis(league)) {
    const discs = [...league.querySelectorAll('tbody .disc')].map(d => Math.round(R(d).left)), hs = [...league.tBodies[0].rows].map(r => Math.round(R(r).height));
    if (new Set(discs).size > 1) fails.push(`table: discs misaligned ${[...new Set(discs)].join(',')}`);
    if (new Set(hs).size > 1) fails.push(`table: row heights differ ${[...new Set(hs)].join(',')}`);
  }
  for (const f of document.querySelectorAll('#page .fig, #page .stats b, #page .glance-stats b')) if (vis(f) && R(f).height > parseFloat(getComputedStyle(f).lineHeight) * 1.5) fails.push(`figure wraps: ${name(f)} "${f.textContent}"`);
  // 10. footer sits on the card grid
  const foot = document.querySelector('.site-foot'), firstRow = document.querySelector('#page .row');
  if (foot && firstRow && Math.abs(R(foot.children[0]).left - R(firstRow).left) > 3) fails.push(`footer off the grid: ${Math.round(R(foot.children[0]).left)} vs ${Math.round(R(firstRow).left)}`);
  return fails;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let total = 0;
const errors = [];
async function open(width, theme, route, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: shots ? 2 : 1, colorScheme: theme, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`${route}@${width}/${theme}: ${e.message}`));
  p.on('console', m => { if (m.type() === 'error') errors.push(`${route}@${width}/${theme}: ${m.text()}`); });
  await p.goto(`${url}#/${route}`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(350);
  return { ctx, p };
}
for (const theme of THEMES) for (const width of WIDTHS) for (const route of ROUTES) {
  const { ctx, p } = await open(width, theme, route);
  const fails = await p.evaluate(guards);
  total += fails.length;
  console.log(`${fails.length ? 'FAIL' : 'ok  '} ${route.padEnd(5)} ${String(width).padStart(4)} ${theme.padEnd(5)}${fails.length ? '\n  - ' + fails.join('\n  - ') : ''}`);
  await ctx.close();
}

// Interaction states: decision day, loan modes, palette, sort, country switch; each re-checked.
{
  const { ctx, p } = await open(1440, 'light', 'in');
  for (const s of ['announced', 'decided', 'live']) { await p.click(`#dday button[data-s="${s}"]`); await p.waitForTimeout(200); const f = await p.evaluate(guards); total += f.length; console.log(`${f.length ? 'FAIL' : 'ok  '} state dday=${s}${f.length ? '\n  - ' + f.join('\n  - ') : ''}`); }
  await p.click('#loanMode button[data-m="since"]'); await p.waitForTimeout(150);
  { const f = await p.evaluate(guards); total += f.length; console.log(`${f.length ? 'FAIL' : 'ok  '} state loan=since${f.length ? '\n  - ' + f.join('\n  - ') : ''}`); }
  await p.keyboard.press('Meta+k'); await p.waitForTimeout(150); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(250);
  const previewed = await p.evaluate(() => document.getElementById('openPal').dataset.c);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  const restored = await p.evaluate(() => document.getElementById('openPal').dataset.c);
  console.log(`${previewed !== 'IN' && restored === 'IN' ? 'ok  ' : 'FAIL'} palette preview ${previewed}, escape restores ${restored}`); if (!(previewed !== 'IN' && restored === 'IN')) total++;
  await ctx.close();
}
{
  const { ctx, p } = await open(1440, 'light', 'world');
  await p.click('#league th[data-k="y12"] button'); await p.waitForTimeout(400);
  const f = await p.evaluate(guards); total += f.length; console.log(`${f.length ? 'FAIL' : 'ok  '} state league sorted by 12-month change${f.length ? '\n  - ' + f.join('\n  - ') : ''}`);
  await ctx.close();
}

// Switch smoothness: a country switch must change data, not the page. Motion is ON here.
async function staticD(width, route) {
  const { ctx, p } = await open(width, 'light', route);
  const d = await p.evaluate(() => [document.getElementById('rHi').getAttribute('d'), document.getElementById('gLine').getAttribute('d')]);
  await ctx.close(); return d;
}
async function smooth(width, how, target) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'light', isMobile: width <= 720, hasTouch: width <= 720 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${url}#/in`, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1800);
  await p.evaluate(() => {
    const keep = '#page .card, #page .tile, #page .row, #page .chart > svg, #page .viz > svg, #page .chart, .rail, .toolbar, .m-topbar, .m-dock, #rTicks, #rHi, #gLine, #facts > div, #ladder .rung, #page .kick > svg';
    window.__nodes = [...document.querySelectorAll(keep)];
    window.__min = 1; window.__minEl = ''; window.__ds = new Set(); window.__stop = false;
    const shell = '#page .card, #page .tile, #page .row, .rail, .toolbar, .m-topbar, .m-dock';
    const tick = () => {
      for (const n of document.querySelectorAll(shell)) { if (!n.getClientRects().length) continue; const o = +getComputedStyle(n).opacity; if (o < window.__min) { window.__min = o; window.__minEl = n.id || n.className; } }
      window.__ds.add(document.getElementById('rHi').getAttribute('d'));
      if (!window.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const opener = width <= 720 ? '#mFlag' : '#openPal';
  if (how === 'palette') { await p.click(opener); await p.waitForTimeout(250); await p.keyboard.type(META_NAME[target]); await p.keyboard.press('Enter'); }
  if (how === 'ladder') { await p.locator(`#ladder .rung[data-c="${target}"]`).click(); }
  if (how === 'rapid') { await p.click(opener); await p.waitForTimeout(250); for (let i = 0; i < 5; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(45); } await p.keyboard.press('Enter'); }
  await p.waitForTimeout(1100);
  const r = await p.evaluate(() => { window.__stop = true; return { min: window.__min, minEl: window.__minEl, frames: window.__ds.size, kept: window.__nodes.every(n => n.isConnected), code: document.getElementById('openPal').dataset.c, d: [document.getElementById('rHi').getAttribute('d'), document.getElementById('gLine').getAttribute('d')], g: [] }; });
  await ctx.close();
  const want = await staticD(width, target.toLowerCase()), fails = [];
  if (r.code !== target) fails.push(`ended on ${r.code}, expected ${target}`);
  if (!r.kept) fails.push('page nodes were recreated');
  if (r.min < 0.999) fails.push(`a card, row or shell element faded (opacity ${r.min.toFixed(2)} on ${r.minEl})`);
  if (r.frames < 3) fails.push(`record line did not morph (${r.frames} distinct paths)`);
  if (r.d[0] !== want[0]) fails.push('record line did not land on the static render');
  if (r.d[1] !== want[1]) fails.push('gap line did not land on the static render');
  if (errs.length) fails.push('console: ' + [...new Set(errs)].join(' | '));
  total += fails.length;
  console.log(`${fails.length ? 'FAIL' : 'ok  '} switch ${how.padEnd(7)} IN → ${target} @${width}${fails.length ? '\n  - ' + fails.join('\n  - ') : ` (${r.frames} morph frames)`}`);
}
const META_NAME = { US: 'United States', BR: 'Brazil', AU: 'Australia', CA: 'Canada' };
await smooth(1440, 'palette', 'US');
await smooth(1440, 'ladder', 'BR');
await smooth(1440, 'rapid', 'AU');
await smooth(390, 'palette', 'CA');
{
  const { ctx, p } = await open(1440, 'light', 'in');
  await p.locator('#ladder .rung[data-c="US"]').click(); await p.waitForTimeout(60);
  const d = await p.evaluate(() => document.getElementById('rHi').getAttribute('d')); await ctx.close();
  const want = await staticD(1440, 'us'), ok = d === want[0]; if (!ok) total++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} reduced motion: final state applies at once`);
}

// Rolling title under fast scrolling: never more than two labels in the slot, never two fully visible, one at rest.
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width <= 720 });
  const p = await ctx.newPage(); await p.goto(`${url}#/in`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const phone = innerWidth <= 720, slot = document.getElementById(phone ? 'mTitle' : 'crumbSlot'), sc = phone ? document.scrollingElement : document.getElementById('canvas');
    let worst = 0, both = 0; const max = sc.scrollHeight - sc.clientHeight;
    for (let i = 0; i <= 60; i++) {
      sc.scrollTop = (i % 20 < 10 ? i % 10 : 10 - i % 10) / 10 * max; await new Promise(f => setTimeout(f, 35));
      const live = [...slot.querySelectorAll('.crumb')]; worst = Math.max(worst, live.length);
      if (live.filter(n => +getComputedStyle(n).opacity > 0.9).length > 1) both++;
    }
    await new Promise(f => setTimeout(f, 600));
    return { worst, both, rest: slot.querySelectorAll('.crumb').length };
  });
  const ok = r.worst <= 2 && r.both === 0 && r.rest === 1; if (!ok) total++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} rolling title under fast scroll @${width} (max ${r.worst} in slot, ${r.both} frames with two visible, ${r.rest} at rest)`);
  await ctx.close();
}
// Copy: rendered text on every page has no null/undefined, stray spacing, broken plurals or unbalanced quotes and brackets.
{
  const bad = new Set();
  for (const w of [1440, 390]) for (const r of ['in', 'us', 'ea', 'gb', 'ca', 'au', 'br', 'world']) {
    const { ctx, p } = await open(w, 'light', r);
    (await p.evaluate(() => {
      const out = [], rx = [[/\bnull\b|\bundefined\b|NaN|Infinity/, 'null/undefined'], [/ {2,}/, 'double space'], [/ [,.;:]/, 'space before punctuation'], [/\.\./, 'double period'], [/\b1 (months|days|years|moves|hikes|cuts|cycles)\b/, 'plural'], [/\bthe the\b/i, 'double article'], [/\(\s*\)/, 'empty brackets']];
      for (const e of document.querySelectorAll('#page p, #page dd, #page dt, #page .title, #page .sub, #page blockquote, #page .lab, #page .delta, #page .kick, #page h1, #page td, #page .legend span, #page .pass, #page .card-foot, .toolbar, .m-topbar, #page .stats div, #page .glance-stats div')) {
        if (!e.getClientRects().length) continue; const t = e.innerText.replace(/\s*\n\s*/g, ' ');
        for (const [x, k] of rx) if (x.test(t)) out.push(`${k}: "${t.slice(0, 90)}"`);
        if (((t.match(/“/g) || []).length !== (t.match(/”/g) || []).length) || (t.match(/"/g) || []).length % 2) out.push(`unbalanced quotes: "${t.slice(0, 90)}"`);
        if ((t.match(/\(/g) || []).length !== (t.match(/\)/g) || []).length) out.push(`unbalanced brackets: "${t.slice(0, 90)}"`);
      }
      return out;
    })).forEach(f => bad.add(`${r}@${w} ${f}`));
    await ctx.close();
  }
  total += bad.size;
  console.log(`${bad.size ? 'FAIL' : 'ok  '} copy audit on every page${bad.size ? '\n  - ' + [...bad].join('\n  - ') : ''}`);
}

if (shots) {
  for (const [width, file] of [[1440, 'switch-desktop'], [390, 'switch-phone']]) {
    const vctx = await browser.newContext({ viewport: { width, height: width > 720 ? 900 : 844 }, colorScheme: 'light', isMobile: width <= 720, hasTouch: width <= 720, recordVideo: { dir: outDir, size: { width, height: width > 720 ? 900 : 844 } } });
    const p = await vctx.newPage(); await p.goto(`${url}#/in`, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1600);
    for (const c of ['US', 'BR', 'GB', 'IN']) { await p.click(width > 720 ? '#openPal' : '#mFlag'); await p.waitForTimeout(350); await p.keyboard.type(META_NAME[c] || 'India'); await p.waitForTimeout(150); await p.keyboard.press('Enter'); await p.waitForTimeout(1300); }
    if (width <= 720) { await p.evaluate(() => scrollTo({ top: document.getElementById('record').getBoundingClientRect().top + scrollY - 76 })); await p.waitForTimeout(500); for (const c of ['US', 'IN']) { await p.click('#mFlag'); await p.waitForTimeout(350); await p.keyboard.type(META_NAME[c] || 'India'); await p.keyboard.press('Enter'); await p.waitForTimeout(1300); } }
    const v = p.video(); await vctx.close(); const { renameSync } = await import('node:fs'); renameSync(await v.path(), path.join(outDir, `${file}.webm`));
  }

  const full = async (p, file, width) => {
    if (width > 720) { const h = await p.evaluate(() => document.getElementById('canvas').scrollHeight + 16); await p.setViewportSize({ width, height: h }); await p.waitForTimeout(400); }
    await p.screenshot({ path: path.join(outDir, file), fullPage: width <= 720 });
  };
  for (const [route, width, theme] of [['in', 1440, 'light'], ['in', 1440, 'dark'], ['world', 1440, 'light'], ['world', 1440, 'dark'], ['us', 1440, 'light'], ['in', 1280, 'light'], ['in', 768, 'light']]) {
    const { ctx, p } = await open(width, theme, route); await full(p, `${route}-${width}-${theme}.png`, width); await ctx.close();
  }
  // Phone: what a visitor actually sees, one viewport per key card, with the bottom bar in place.
  for (const [route, theme, sels] of [['in', 'light', ['#decision', '#loan', '#record']], ['in', 'dark', ['#decision']], ['world', 'light', ['#pulse', '#board']]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
    const p = await ctx.newPage(); await p.goto(`${url}#/${route}`, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(350);
    for (const s of sels) { await p.evaluate(sel => scrollTo(0, document.querySelector(sel).getBoundingClientRect().top + scrollY - 64), s); await p.waitForTimeout(300); await p.screenshot({ path: path.join(outDir, `phone-${route}-${theme}-${s.slice(1)}.png`) }); }
    await ctx.close();
  }
  {
    const { ctx, p } = await open(1440, 'light', 'in');
    for (const s of ['announced', 'decided']) {
      await p.click(`#dday button[data-s="${s}"]`); await p.waitForTimeout(300);
      await p.evaluate(() => document.getElementById('canvas').scrollTo(0, 0));
      await p.locator('#decision').screenshot({ path: path.join(outDir, `in-dday-${s}-decision.png`) });
      await p.evaluate(() => { const c = document.getElementById('canvas'), r = document.getElementById('record'); c.scrollTo(0, r.offsetTop - 72); });
      await p.waitForTimeout(150);
      await p.locator('#record').screenshot({ path: path.join(outDir, `in-dday-${s}-record.png`) });
    }
    await p.click('#dday button[data-s="live"]'); await p.evaluate(() => document.getElementById('canvas').scrollTo(0, 0));
    await p.keyboard.press('Meta+k'); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(outDir, 'palette-1440-light.png') });
    await ctx.close();
  }
}
await browser.close();
if (errors.length) { console.log('\nPage errors:\n  - ' + [...new Set(errors)].join('\n  - ')); total += errors.length; }
console.log(`\n${total ? `${total} failure(s)` : 'All guards pass'}`);
process.exit(total ? 1 : 0);
