/* /design: the design system, rendered with the live stylesheet. Swatches read their values from the page's computed
   styles, and every specimen uses the production classes and the current data, so this page cannot drift from the site. */
import { B, CODES, DAY, META, MODEL, T_TODAY, bps, curSymbol, esc, fmtXD, lede, levelInfo, mark, movePill, valueAt, vBig, vText, yearOf } from '../lib/atlas.ts';
import type { Code } from '../lib/atlas.ts';
import { EASE, SPRING, reduced, segc } from '../lib/motion.ts';
import { $, state, sw } from './dom.ts';
import { card, footerHTML, kick } from './templates.ts';

/* ---------- colour ---------- */
const ROLES: [string, string][] = [
  ['hawk', 'Hikes and tightening: markers, move pills and bars'],
  ['dove', 'Cuts and easing: markers, move pills and bars'],
  ['gap', 'Gap to the benchmark bank, and framework changes'],
  ['level', 'Level fills and range bands'],
  ['obs', 'Observation eras before a policy rate existed'],
  ['accent', 'You and now: your level, the selected row, focus'],
  ['live', 'The live dot and nothing else'],
  ['cat-labour', 'Off-cycle and emergency badges'],
];
const NEUTRALS: [string, string][] = [
  ['canvas', 'Page ground'], ['surface', 'Cards, inputs and popovers'], ['wash', 'Quiet fills and hover'], ['wash-2', 'Tracks and pressed fills'],
  ['hair', 'Card borders and rules'], ['hair-2', 'Control borders'], ['ink', 'Primary text and lines'], ['ink-2', 'Secondary text'],
  ['ink-3', 'Captions, axes and idle icons'], ['other', 'De-emphasised marks'],
];
const swatch = ([n, use]: [string, string]) =>
  `<button type="button" class="ds-sw" data-var="--${n}" aria-label="Copy var(--${n})"><i class="ds-chip" style="background:var(--${n})"></i><b>${n}</b><span class="hex"></span><span class="ds-use">${use}</span></button>`;

/* ---------- specimens ---------- */
const money = (c: Code, v: number) => new Intl.NumberFormat(META[c].moneyLocale).format(v);

/** The last eight years of a country's rate as a step line: a range keeps both endpoints, and every move is a marker. */
function stepChart(c: Code): string {
  const m = MODEL[c], t1 = T_TODAY, t0 = t1 - 8 * 365 * DAY, start = valueAt(c, t0);
  const pts = [{ t: t0, hi: start.hi, lo: start.lo }, ...m.recs.filter(r => r.t > t0).map(r => ({ t: r.t, hi: r.hi, lo: r.lo }))];
  const vals = pts.flatMap(p => [p.hi, p.lo]), vMin = Math.min(...vals), vMax = Math.max(...vals);
  const step = vMax - vMin < 300 ? 50 : 100, lo = Math.floor(vMin / step) * step, hi = Math.max(Math.ceil(vMax / step) * step, lo + step);
  const L = 44, R = 748, T = 14, B = 206;
  const x = (t: number) => (L + (t - t0) / (t1 - t0) * (R - L)).toFixed(1), y = (v: number) => (B - (v - lo) / (hi - lo) * (B - T)).toFixed(1);
  const path = (k: 'hi' | 'lo') => pts.reduce((d, p, i) => d + (i ? ` H${x(p.t)} V${y(p[k])}` : `M${x(p.t)} ${y(p[k])}`), '') + ` H${R}`;
  const ticks: number[] = []; for (let v = lo; v <= hi; v += step) ticks.push(v);
  const years: number[] = []; for (let yr = new Date(t0).getUTCFullYear() + 1; yr <= new Date(t1).getUTCFullYear(); yr++) years.push(yr);
  const moves = m.policyMoves.filter(r => r.t > t0), last = moves[moves.length - 1];
  const ranged = pts.some(p => p.lo !== p.hi);
  return `<div class="chart rec"><svg viewBox="0 0 760 240" role="img" aria-label="${esc(META[c].name)} ${esc(META[c].inst.toLowerCase())} over the last eight years, drawn as a step line">
    <g class="grid">${ticks.map(v => `<line x1="${L}" x2="${R}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
    <g class="axis">${ticks.map(v => `<text x="${L - 8}" y="${Number(y(v)) + 4}" text-anchor="end">${v / 100}%</text>`).join('')}${years.map(yr => `<text x="${x(Date.UTC(yr, 0, 1))}" y="${B + 22}" text-anchor="middle">${yr}</text>`).join('')}</g>
    <path class="area" d="${path('hi')} V${B} H${L} Z"/><path class="line" d="${path('hi')}"/>${ranged ? `<path class="line lo" d="${path('lo')}"/>` : ''}
    ${moves.map(r => `<circle class="mk ${r.action === 'framework' ? 'framework' : r.dir}" cx="${x(r.t)}" cy="${y(r.hi)}" r="4.5"/>`).join('')}
    ${last ? `<circle class="halo ${last.dir}" cx="${x(last.t)}" cy="${y(last.hi)}" r="9"/>` : ''}
  </svg></div>`;
}

function tipSpecimen(c: Code): string {
  const m = MODEL[c], mv = m.policyMoves[m.policyMoves.length - 1] ?? m.last, role = mv.dir === 'hike' ? 'hawk' : 'dove';
  return `<div class="tip on ds-tip" aria-hidden="true">
    <div class="t-title">${fmtXD(mv.t)}</div><div class="t-sub">${esc(META[c].inst)}, ${mv.dir}</div><div class="t-rule"></div>
    <div class="t-row"><span>${sw(`var(--${role})`)}Rate</span><span class="t-num">${vText(mv)}</span></div>
    <div class="t-row"><span>${sw('var(--ink-3)')}Change</span><span class="t-num">${bps(mv.chg)}</span></div>
  </div>`;
}

/* ---------- page ---------- */
export function designHTML(): string {
  // Fixed, not the visitor's country: the prerendered HTML must equal what the client renders.
  const c: Code = MODEL.IN ? 'IN' : CODES[0], m = MODEL[c], mv = m.policyMoves[m.policyMoves.length - 1] ?? m.last, loan = META[c].loan;
  const L = levelInfo(c), y0 = yearOf(L.t0);
  const level = L.pBelow < L.pAbove ? `Lower than on ${B(Math.round(L.pAbove * 100) + '%')} of days since ${y0}` : `Higher than on ${B(Math.round(L.pBelow * 100) + '%')} of days since ${y0}`;
  return `
  <div class="page-head"><div><h1>Design system</h1><p data-prose>The colours, type, components and rules this site is built from. Every specimen below uses the live stylesheet and current data, so it always matches the site.</p></div></div>
  <div class="row">
    ${card('principles', 'span-12', 'Principles', 'route',
      `${kick('route', 'What it is built on')}<p class="finding" data-prose>Four rules decide almost every choice</p>`,
      `<dl class="facts" data-prose>
        <div><dt>The data steps</dt><dd>A rate holds, then jumps<span>Charts draw steps. The interface eases, a data cursor never does.</span></dd></div>
        <div><dt>Colour</dt><dd>One job each<span>Direction colour sits on small marks, never on a whole card.</span></dd></div>
        <div><dt>Type</dt><dd>Inter and Geist Mono<span>A number in a sentence stays in Inter. Mono is for numbers that stand alone.</span></dd></div>
        <div><dt>Findings</dt><dd>Answer first<span>Each card asks a question, states the finding, then shows the evidence.</span></dd></div>
      </dl>`)}
  </div>
  <div class="row">
    ${card('colour', 'span-12', 'Colour', 'palette',
      `${kick('palette', 'What each colour means')}
       <div class="actions">
         <div class="seg" id="dsTheme" aria-label="Theme"><span class="thumb"></span><button type="button" data-v="light" aria-pressed="true">Light</button><button type="button" data-v="dark" aria-pressed="false">Dark</button></div>
         <div class="seg" id="dsPal" aria-label="Palette"><span class="thumb"></span><button type="button" data-v="claret" aria-pressed="true">Claret</button><button type="button" data-v="clay" aria-pressed="false">Clay</button></div>
       </div>
       <p class="finding" data-prose>One job per colour, so colour is never decoration</p>`,
      `<div class="ds-groups">
         <div><h3 class="ds-h">Roles</h3><div class="ds-grid">${ROLES.map(swatch).join('')}</div></div>
         <div><h3 class="ds-h">Neutrals</h3><div class="ds-grid">${NEUTRALS.map(swatch).join('')}</div></div>
       </div>`,
      'Select a swatch to copy its CSS variable. Values follow the theme and palette chosen above.')}
  </div>
  <div class="row">
    ${card('type', 'span-12', 'Type', 'type',
      `${kick('type', 'How type is used')}<p class="finding" data-prose>Inter for words and the numbers inside them, Geist Mono for numbers that stand alone</p>`,
      `<dl class="ds-spec" data-prose>
        <div><dt><b>Value</b>76 on 80, 650, −0.05em</dt><dd><div class="value">${vBig(mv)}</div></dd></div>
        <div><dt><b>Lede</b>17 on 27, 400</dt><dd><p class="lede">${lede(c)}</p></dd></div>
        <div><dt><b>Finding</b>17 on 25, 600</dt><dd><p class="finding">${level}</p></dd></div>
        <div><dt><b>Body</b>14 on 22, 400, ink-2</dt><dd><p class="prose">Policy rates are step functions: the value holds until the next documented record date, then jumps.</p></dd></div>
        <div><dt><b>Label</b>12 on 16, 500, ink-3</dt><dd><p class="kick">The question a card answers</p></dd></div>
        <div><dt><b>Number in a sentence</b>Inter, tabular figures</dt><dd><p class="prose">The rate is now <b class="nw">${vText(mv)}</b>, ${mv.chg >= 0 ? 'up' : 'down'} ${Math.abs(mv.chg)} bps on the move before.</p></dd></div>
        <div><dt><b>Number that stands alone</b>Geist Mono 500, 14 on 20</dt><dd><span class="fig">${vText(mv)}</span></dd></div>
        <div><dt><b>Do not</b>Mono inside a sentence</dt><dd><p class="prose">The rate is now <span class="fig">${vText(mv)}</span>, set in mono, which breaks the line of reading.</p></dd></div>
      </dl>`)}
  </div>
  <div class="row">
    ${card('shape', 'span-12', 'Shape', 'square',
      `${kick('square', 'How surfaces are built')}<p class="finding" data-prose>Hairlines and one card radius, with shadow only on things that float</p>`,
      `<div class="ds-groups">
         <div><h3 class="ds-h">Radius</h3><div class="ds-shapes">${[[16, 'Cards and tiles'], [20, 'The canvas and phone cards'], [18, 'Palette and prompt'], [14, 'Results and tooltips'], [12, 'Inputs and list rows'], [999, 'Controls and chips']].map(([r, t]) => `<div class="ds-shape"><i style="border-radius:${r}px"></i><b>${r === 999 ? 'Pill' : r + ' px'}</b><span>${t}</span></div>`).join('')}</div></div>
         <div><h3 class="ds-h">Elevation</h3><div class="ds-shapes">
           <div class="ds-shape"><i class="ds-elev" style="box-shadow:var(--shadow-card);border:1px solid var(--hair)"></i><b>Hairline and rest</b><span>Cards sit on a border and a faint shadow</span></div>
           <div class="ds-shape"><i class="ds-elev" style="box-shadow:var(--shadow-pop)"></i><b>Popover</b><span>Palette, prompt and the decision stamp</span></div>
           <div class="ds-shape"><i class="ds-elev" style="box-shadow:0 10px 30px rgba(0,0,0,.22)"></i><b>Tooltip</b><span>The inverted chart readout</span></div>
         </div></div>
         <p class="prose" data-prose>Cards are separated by 16 px with a 28 px page gutter and 24 px of card padding. Phones use 14, 16 and 18 px.</p>
       </div>`)}
  </div>
  <div class="row">
    ${card('motion', 'span-12', 'Motion', 'activity',
      `${kick('activity', 'How things move')}<div class="actions"><button type="button" class="btn" id="dsPlay"><i data-lucide="play"></i>Play</button></div><p class="finding" data-prose>The interface eases; the data steps</p>`,
      `<div class="ds-lanes" id="lanes">
        <div class="ds-lane"><span><b>Ease</b>Hover, press and sliding thumbs, 100 to 300 ms</span><span class="tr"><i class="dot" data-e="${EASE}"></i></span></div>
        <div class="ds-lane"><span><b>Spring</b>The brand mark, stamps, flags and markers only</span><span class="tr"><i class="dot" data-e="${SPRING}"></i></span></div>
        <div class="ds-lane"><span><b>Step</b>Data cursors, scrubbing and filters never ease</span><span class="tr"><i class="dot" data-e="steps(1, jump-start)"></i></span></div>
      </div>`,
      'With reduced motion on, everything jumps to its final state.')}
  </div>
  <div class="row">
    ${card('marks', 'span-12', 'Direction', 'arrow-down-up',
      `${kick('arrow-down-up', 'How direction is shown')}<p class="finding" data-prose>Colour sits on small marks, never on a card</p>`,
      `<div class="ds-demo">
         <span class="ds-key">${mark('hike')}Hike</span><span class="ds-key">${mark('cut')}Cut</span><span class="ds-key">${mark('hold')}Hold</span><span class="ds-key">${mark('framework')}Framework change</span>
         ${movePill(mv.dir, mv.chg)}
       </div>
       <p class="prose" data-prose>A hike and a cut also differ by glyph, sign and bar direction, so colour is never the only cue.</p>`)}
  </div>
  <div class="row">
    ${card('controls', 'span-12', 'Controls', 'gauge',
      `${kick('gauge', 'What controls look like')}<p class="finding" data-prose>Pills at one height per kind, with a visible response on every hover</p>`,
      `<div class="ds-demo">
         <div class="seg" id="dsSeg"><span class="thumb"></span><button type="button" data-v="a" aria-pressed="true">This decision</button><button type="button" data-v="b" aria-pressed="false">Since you borrowed</button></div>
         <a class="btn" href="/world/" data-link>World view <i data-lucide="arrow-right"></i></a>
         <button type="button" class="ib" aria-label="Close example"><i data-lucide="x"></i></button>
         <kbd>⌘K</kbd>
         <span class="badge"><i class="dot pending"></i>Decision day</span>
       </div>
       <div class="ds-demo">
         <div class="input ds-input"><span>${curSymbol(c)}</span><input aria-label="Loan amount example" value="${money(c, loan.amt)}" inputmode="numeric" autocomplete="off"></div>
         <div class="presets">${[loan.amt / 2, loan.amt, loan.amt * 2].map((v, i) => `<button type="button" aria-pressed="${i === 1}">${money(c, v)}</button>`).join('')}</div>
       </div>`)}
  </div>
  <div class="row">
    ${card('chart', 'span-12', 'Chart', 'chart-line',
      `${kick('chart-line', 'How a rate is drawn')}<p class="finding" data-prose>A rate holds, then jumps, so the line is a step and never a curve</p>`,
      `<div class="ds-chart">${stepChart(c)}<div class="ds-wide">${tipSpecimen(c)}</div></div>
       <div class="legend"><span>${sw('var(--hawk)')}Hike</span><span>${sw('var(--dove)')}Cut</span><span>${sw('var(--gap)')}Framework change</span><span>${sw('var(--level)')}Level</span></div>`,
      `${META[c].name}, ${esc(META[c].inst.toLowerCase())}. Each marker is a documented record date.`)}
  </div>
  <div class="row">
    ${card('rules', 'span-12', 'Rules', 'list-ordered',
      `${kick('list-ordered', 'What keeps it cohesive')}<p class="finding" data-prose>Eleven rules that every page follows</p>`,
      `<div class="ds-cols" data-prose>
         <div><h3 class="ds-h">Do</h3><ul class="points">
           <li><span>Draw policy rates as steps, with both endpoints for a range and no midpoint.</span></li>
           <li><span>Keep one finding and one visual per card on a phone.</span></li>
           <li><span>Use real circular flags for countries.</span></li>
           <li><span>Give every list row a visible hover response.</span></li>
           <li><span>Write amounts in full locale format, such as ₹50,00,000.</span></li>
         </ul></div>
         <div><h3 class="ds-h">Do not</h3><ul class="points">
           <li><span>Tint a card, row or heading by direction.</span></li>
           <li><span>Add status pills such as “verified against”. Provenance is a footnote.</span></li>
           <li><span>Nest a card in a card, or leave a dead area beside a taller neighbour.</span></li>
           <li><span>Use gradients, glows or glass.</span></li>
           <li><span>Use en or em dashes in copy.</span></li>
           <li><span>Flash the page on a country switch. Only the data changes.</span></li>
         </ul></div>
       </div>`,
      '<span>The same rules, in a file an agent can read.</span><a href="/design.md">design.md <i data-lucide="arrow-up-right"></i></a>')}
  </div>
  ${footerHTML()}`;
}

/* ---------- behaviour ---------- */
const root = () => document.documentElement;
const theme = () => { const t = root().dataset.theme; return t === 'dark' || t === 'light' ? t : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; };
const palette = () => (root().dataset.palette === 'clay' ? 'clay' : 'claret');

function fillValues(): void {
  const cs = getComputedStyle(root());
  document.querySelectorAll<HTMLElement>('#colour .ds-sw').forEach(b => { const hex = b.querySelector('.hex'); if (hex) hex.textContent = cs.getPropertyValue(b.dataset.var!).trim().toLowerCase(); });
}

function play(): void {
  document.querySelectorAll<HTMLElement>('#lanes .dot').forEach(d => {
    const dist = d.parentElement!.clientWidth - d.offsetWidth;
    d.getAnimations?.().forEach(a => a.cancel());
    if (reduced() || typeof d.animate !== 'function') { d.style.transform = `translateX(${dist}px)`; return; }
    d.animate([{ transform: 'none' }, { transform: `translateX(${dist}px)` }], { duration: 900, easing: d.dataset.e!, fill: 'forwards' });
  });
}

let watching = false, segs: { theme: ReturnType<typeof segc>; pal: ReturnType<typeof segc> } | null = null;
function sync(): void {
  if (state.page !== 'design' || !segs) return;
  segs.theme.set(theme()); segs.pal.set(palette()); fillValues();
}

export function renderDesign(): void {
  document.title = 'Design system · Policy Rate Atlas';
  if (state.ssr) return;
  segs = {
    theme: segc($('dsTheme'), v => { if (v !== theme()) $('themeBtn').click(); }, 'v'),
    pal: segc($('dsPal'), v => { if (v !== palette()) $('palBtn').click(); }, 'v'),
  };
  segc($('dsSeg'), () => {}, 'v').set('a');
  sync();
  $('colour').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.ds-sw'), hex = b?.querySelector('.hex');
    if (!b || !hex) return;
    navigator.clipboard?.writeText(`var(${b.dataset.var})`).then(() => { hex.textContent = 'Copied'; setTimeout(fillValues, 1100); }, () => {});
  });
  $('dsPlay').addEventListener('click', play);
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); play(); } });
    io.observe($('lanes'));
  } else play();
  if (!watching) {
    watching = true;
    new MutationObserver(sync).observe(root(), { attributes: true, attributeFilter: ['data-theme', 'data-palette'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', sync);
  }
}
