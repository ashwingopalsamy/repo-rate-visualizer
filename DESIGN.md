# Policy Rate Atlas Design Language

The source of truth is `src/styles/atlas.css`. The rendered reference is the `/design` page, which uses the live stylesheet and current data, so it cannot drift from the site. This file is the same system in a form an agent can read. Where this file and `atlas.css` disagree, `atlas.css` wins.

## Visual Theme

**Calm, cool, exact, alive.** A near-black frame holds one rounded canvas of cool greys, with colour reserved for meaning: one job per colour, carried by small marks, never by whole cards.

The shell and palettes are the owner's own language from home.ashwingopalsamy.in: a dark frame with an icon rail on desktop, a grey page with white floating cards and a pill dock on phones. The product reads like a financial research publication that was built by an engineer: a finding first, the chart as its evidence, numbers that never wobble.

## Color Palette

Themes are `light`, `dark` (follows `prefers-color-scheme` unless `data-theme` is set) and two palettes, `claret` (default) and `clay` (`data-palette="clay"`).

### Neutrals (cool greys; no warm or beige panels)

| Token | Light | Dark | Role |
|---|---|---|---|
| `frame` | `#1c1b1a` | `#070708` | Outer frame behind rail and canvas |
| `rail-ink` / `rail-ink-hi` | `#9b9791` / `#f4f3f1` | `#8c9094` / `#eef0f1` | Rail icons idle / active |
| `rail-hover` / `rail-tile` | `#292826` / `#3a3835` | `#16181a` / `#222528` | Rail hover / current fill |
| `canvas` | `#ffffff` | `#111314` | Page ground, toolbar |
| `surface` | `#ffffff` | `#161819` | Cards, inputs, popovers |
| `wash` | `#f4f5f7` | `#1b1e20` | Quiet fills, hover, results |
| `wash-2` | `#eceef1` | `#212527` | Tracks, pressed, selected row |
| `ink` | `#15171a` | `#e9ebec` | Primary text and lines |
| `ink-2` | `#4d535b` | `#a9aeb2` | Secondary text |
| `ink-3` | `#5f656d` | `#8a9095` | Captions, axes, idle icons (4.5:1 or better) |
| `hair` | `#e9ebee` | `#24282b` | Card borders, rules |
| `hair-2` | `#dadde2` | `#30353a` | Control borders (decorative, 1.4:1) |
| `other` | `#c8ccd2` | `#3d4246` | De-emphasised marks only, never text |
| `tip-bg` / `tip-ink` / `tip-ink-2` / `tip-hair` | `#15171a` / `#f3f4f6` / `#a9aeb5` / `#2e3237` | `#eef0f1` / `#15171a` / `#4d535b` / `#d6d8da` | Inverted tooltip |
| `focus` | `#15171a` | `#eef0f1` | 2px outline, 2px offset |

### Palette (category colours and roles)

| Token | Claret light / dark | Clay light / dark | Role alias and job |
|---|---|---|---|
| `cat-masonry` | `#dd4124` / `#e6593f` | `#c14219` / `#cd534a` | `hawk`: hikes, tightening |
| `cat-steel` | `#009473` / `#28a180` | `#216296` / `#3b7aaf` | `dove`: cuts, easing |
| `cat-site` | `#5654a2` / `#7271cb` | `#1ba09c` / `#239f94` | `gap`: benchmark gap, framework change |
| `cat-cement` | `#3e9c9c` / `#33a7a7` | `#ad9216` / `#ae9200` | `level`: level fills, range bands |
| `cat-earth` | `#a47864` / `#b87251` | `#7c4002` / `#94550f` | `obs`: observation eras |
| `cat-labour` | `#7f1734` / `#b03d57` | `#9c3568` / `#964c72` | Off-cycle and emergency badges |
| `accent` | `#a556d0` / `#d193f6` | `#e2790f` / `#faaf40` | You and now: your level, selected row, pending step, input focus |
| `live` | `#548f27` / `#7bbb44` | `#408341` / `#69bc71` | The live dot only |

Use the role alias (`hawk`, `dove`, `gap`, `level`, `obs`), not the category name. Clay maps hawk and dove to orange and blue, the safest pair for colour-vision deficiency. Hike and cut also differ by glyph, sign and bar direction, so colour is never the only cue. Do not invent hues outside these palettes.

## Typography

**Families:** Inter Variable (optical size) for all words and for numbers inside sentences; Geist Mono Variable only for numbers that stand alone, chart axes and hashes. Fallbacks: `ui-sans-serif, system-ui` and `ui-monospace, SFMono-Regular, Menlo`. Root: 14px on 20px, letter spacing −0.006em, `-webkit-font-smoothing: antialiased`.

| Style | Size / line | Weight | Tracking | Family and use |
|---|---|---|---|---|
| Value | 76 / 80 (phone 56 / 60) | 650 | −0.05em | Inter, tabular. The decision rate |
| Result delta | 40 / 46 | 650 | −0.035em | Inter. Payment change |
| Page title (h1) | 28 / 34 (phone 24 / 30) | 650 | −0.022em | Inter |
| Finding | 17 / 25 (phone 16 / 23) | 600 | −0.012em | Inter, max 62ch. One computed sentence per card |
| Lede | 17 / 27 | 400 | 0 | Inter, `ink`, max 64ch |
| Crumb | 16 / 24 | 600 | −0.01em | Inter |
| Tile heading | 15 / 21 | 600 | −0.01em | Inter |
| Body (`.prose`) | 14 / 22 | 400 | 0 | Inter, `ink-2` |
| Label, kicker | 12 / 16 to 18 | 500 | 0 | Inter, `ink-3` |
| Caption | 12 / 17 | 400 | 0 | Inter, `ink-3` |
| Stat figure | 18 / 24 | 500 | −0.02em | Geist Mono, a number standing alone |
| Figure | 14 / 20 | 500 | 0 | Geist Mono, table and ladder cells, right aligned |
| Axis | 11 | 500 | 0 | Geist Mono, `ink-3` |

Rules: a number inside a sentence is set in the sentence's own font (Inter, tabular figures), never Geist Mono (`[data-prose] .num` inherits). Money in prose uses the full locale format (`₹50,00,000`, `R$ 300.000`), never compact forms such as "R$ 300 mil". Uppercase only for era tags (10px, +0.04em). Sentence case everywhere else. No en or em dashes in copy.

## Components

One `Card` for every section: `radius` 16px, 1px `hair`, `shadow-card`, head anatomy kick (the visitor's question), finding, optional actions, body, optional footer.

| Component | Classes | Purpose and key variants |
|---|---|---|
| Card | `.card`, `.card-head`, `.kick`, `.finding`, `.card-body`, `.card-foot` | The only section container. Spans 4, 5, 7, 8, 12 in a 12-column `.row` |
| Insight tile | `.tiles > .tile` | Question, finding, small visual, caption; a link to its section. Snap row on phones |
| Movement mark | `.mark.hike/.cut/.hold/.framework`, `.move` | Filled disc with glyph (▲ ▽ bar ◆); 14 to 22px. Only place direction colour appears |
| Decision value | `.value-row`, `.value`, `.change`, `.lede`, `.facts` | Hero rate, move pill, lede, four facts |
| Stat strip | `.stats` | Four standalone mono figures between hairlines; hidden on phones |
| Ledger | `.list > .item`, `.ladder > .rung` | Decision rows and country ladder; hover washes, flag lifts, name nudges 3px, arrow slides in |
| Data table | `table.data` | Fixed layout, 58px rows, sortable header, right-aligned mono figures; becomes a ladder below 1000px |
| Segmented | `.seg > .thumb + button` | 2 to 4 modes; thumb slides 200ms |
| Buttons | `.btn`, `.ib`, `.presets`, `.badge`, `.pill`, `kbd` | Pills; one filled `ink` pill per prompt |
| Loan | `.loan`, `.field`, `.input`, `.result` | Inputs with locale prefixes and the payment-change result |
| Country switch | `.switch`, `.palette`, `.cprompt`, `.disc.flag` | Chip, search palette, first-visit prompt; real circular flags |
| Rail | `.frame`, `.rail`, `.rail-btn`, `.toolbar`, `.crumb` | Desktop shell, 64px collapsing to 212px; rolling crumb |
| Phone shell | `.m-topbar`, `.m-round`, `.m-dock`, `.m-tab` | 720px and below: round buttons, centred title, pill dock |
| Tooltip | `.tip` | Inverted readout with swatches and mono figures |
| Step chart | `.chart.rec`, `.mk`, `.halo`, `.tenure`, `.pending` | Stepped line, markers, hovered tenure, latest halo |

States: hover is required on every interactive row; press is a darker fill or scale .96, never a lift; focus is a 2px `focus` outline.

## Layout

**Grid:** 12-column rows of cards, `align-items: stretch`. Footers sit on the same grid.
**Spacing:** gap 16px (`--space`), page gutter 28px, card padding 24px (20px top); phone 14, 16 and 18px.
**Controls:** input 44, switch chip 38, icon button 34, pill button 32, segmented button 28; touch targets 44px or more on phones.
**Chrome:** rail 64px (212px open), toolbar 60px, phone header 68px, dock 56px with 44px tabs.
**Canvas:** `radius` 20px inside the dark frame.

## Depth

| Level | Value | Used for |
|---|---|---|
| Hairline | `1px solid hair` | Cards, tables, footers |
| Rest | light `0 1px 2px rgba(16,24,40,.04), 0 1px 1px rgba(16,24,40,.02)`; dark `0 0 0 1px rgba(0,0,0,.2)` | Cards and tiles |
| Popover | light `0 18px 48px rgba(16,24,40,.18), 0 0 0 1px rgba(16,24,40,.06)`; dark `0 18px 48px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06)` | Palette, prompt, decision stamp |
| Tooltip | `0 10px 30px rgba(0,0,0,.22)` | Chart readout |
| Phone float | `0 0 0 1px rgba(16,24,40,.06), 0 1px 2px rgba(16,24,40,.06), 0 8px 24px rgba(16,24,40,.1)` | Round buttons and dock |

Layers, bottom to top: frame, canvas, card, popover. Radii by role: 16 cards, 20 canvas and phone cards, 18 palette and prompt, 14 results and tooltips, 12 inputs and rows, 6 key caps, 999 controls.

## Motion

The interface eases; the data steps. Tokens: `--ease: cubic-bezier(.22,.61,.36,1)` (enter, move), `--ease-in: cubic-bezier(.4,0,1,1)` (exit), `--spring: cubic-bezier(.3,1.35,.5,1)` (brand mark, stamps, flag lift, markers only).

| What | Behaviour |
|---|---|
| Data cursors, scrubbing, keyboard stepping, filters | Instant, never eased |
| Hover, press, toggles | 100 to 150ms ease |
| Sliding thumbs | 200ms translate and width |
| Value changes | Out 70ms ease-in, in 160ms ease, 9px shift in the direction of change |
| Lists | 4px rise over 180ms, 8ms stagger up to 64ms |
| Country switch | Data changes in place over about 420ms; the page never flashes or re-keys |
| Reduced motion | Final states only |

## Do's and Don'ts

### Do
- Draw policy rates as steps. A range keeps both endpoints; never show a midpoint.
- Start every card with the visitor's question and a computed finding; show the chart as evidence.
- Keep one finding and one visual per card on phones.
- Use real circular flags for countries and the full locale format for money.
- Give every interactive row a visible hover response.

### Don't
- Tint a card, row or heading by direction. Direction colour sits on small marks.
- Add status or trust pills such as "Verified against RBI". Provenance is a footnote.
- Nest a card in a card, or leave a dead area beside a taller neighbour.
- Use gradients, glows or glass, or a shadow on anything that does not float.
- Set a number inside a sentence in Geist Mono, or use en or em dashes in copy.
- Flash or re-mount the page on a country switch.

## Responsive

| Breakpoint | Change |
|---|---|
| 1180px and below | Spans collapse to one column; tiles go single row; upcoming strip two columns |
| 1000px and below | Data table is replaced by the small ladder; toolbar meta hides |
| 720px and below | Phone shell: grey page (`#f2f3f5` light, `#0b0c0d` dark), white floating cards, round buttons, pill dock; legends, captions, footnotes, quotes and stat strips hide; tiles swipe sideways; the switcher is a bottom sheet |

Phone layouts are a deliberate reduction of desktop, not a reflow. No horizontal page scroll at any width; layouts are checked at 360, 768, 1280 and 1440px in both themes.

## Agent Prompt Guide

- Reuse the production classes in `src/styles/atlas.css`; add a class only when no existing one fits, and put colour in tokens, never literals.
- Colour by role: `hawk`, `dove`, `gap`, `level`, `obs`, `accent`, `live`. Direction colour only on marks, pills, lines and bars.
- Numbers: Inter with tabular figures inside sentences, Geist Mono only for numbers that stand alone.
- Every section is a `Card` with kick, finding, body and optional footer. No nested cards, no status pills.
- Draw rates as steps; verify each finding against real data and suppress trivial claims.
- After any visual change, check `/design` and the layouts at 360, 768, 1280 and 1440px in both themes and both palettes.
