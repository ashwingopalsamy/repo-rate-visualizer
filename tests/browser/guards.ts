/* Layout guards, ported from the approved prototype's check.mjs. Runs inside the page (page.evaluate(guards)) and
   returns one line per failure: overflow, content escaping its card, clipped or overlapping text, mono in prose,
   unequal row heights, empty card areas, toolbar and phone-shell collisions, table alignment and wrapping figures. */
// @ts-nocheck -- evaluated in the browser; kept verbatim from the prototype so the two cannot drift.
export function guards(): string[] {
  const fails = [];
  const R = el => el.getBoundingClientRect();
  const vis = el => { const r = R(el), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[hidden]') && !el.closest('.sr'); };
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
    if (!on) { if (/^(country|world)/.test(document.getElementById('page').dataset.route || '')) fails.push('phone dock: no active tab'); } else if (Math.abs(R(pill).left - R(on).left) > 1 || Math.abs(R(pill).width - R(on).width) > 1) fails.push('phone dock: pill not under the active tab');
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
