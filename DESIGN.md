# RBI Repo Rate Visualizer — Design System & Engineering Notes

> **Internal Reference & Design Colophon**  
> A living specification of the visual principles, semantic tokens, component geometry, data-visualization language, and interaction patterns behind the RBI Repo Rate Visualizer.

---

## 1. Product Intent & Aesthetic Character

The RBI Repo Rate Visualizer is an institutional-grade, open-access monetary policy observatory. It visualizes every benchmark repo rate decision made by the Reserve Bank of India (RBI) from 2000 to the present day.

The visual interface is deliberately designed at the intersection of two distinct disciplines:

1. **Central Bank / Financial Research Publications**: The typographic restraint, tabular precision, and editorial authority of institutions like the Bank for International Settlements (BIS), the St. Louis Fed (FRED), and the Financial Times.
2. **Modern Software Engineering Craft**: The tactile micro-feedback, high-density layout, keyboard shortcuts, and crisp hairline geometry pioneered by modern technical tools (Linear, shadcn/ui, Radix).

### The Core Feeling
- **Authoritative, not decorative**: Every visual element communicates empirical data. There are no ornamental gradients, meaningless background blobs, or arbitrary floating shapes.
- **Calm, neutral canvas**: The interface uses a near-monochrome foundation (`oklch` slates) so that the semantic monetary policy colors (easing, tightening, pause) immediately command visual attention.
- **Provenance first**: Data is never anonymous. Every rate observation links directly to an official RBI resolution document with timestamped retrieval records and SHA-256 checksums.
- **High information density without claustrophobia**: Spacing is calibrated so that dozens of historical decisions can be scanned rapidly while retaining generous touch targets and comfortable reading lines.

---

## 2. Core Visual Principles

### 1. Form Follows Policy Mechanics
Central bank policy rates are **discrete step functions**, not continuous analog curves. Rates are held constant across policy horizons and change instantaneously at Monetary Policy Committee (MPC) resolution dates.
- Charts *must* render using stepped interpolation (`d3.curveStepAfter`). Smooth bezier splines or linear point-to-point diagonals misrepresent the legal reality of monetary policy.
- Every rate inflection point features an interactive decision node (`circle.rate-dot` / `.decision-marker`) that binds directly to the canonical policy record.

### 2. Semantic Monetary Policy Grammar
Color is strictly semantic, derived from monetary policy dynamics rather than general UI tropes:
- **Easing / Rate Cuts**: Emerald green (`oklch(0.60 0.19 148)` light / `oklch(0.74 0.16 148)` dark). Represents monetary accommodation, liquidity injection, and economic stimulus.
- **Tightening / Rate Hikes**: Crimson / Rose-amber (`oklch(0.58 0.22 25)` light / `oklch(0.74 0.18 25)` dark). Represents monetary restriction, inflation cooling, and policy tightening.
- **Pause / Holds**: Cobalt indigo (`oklch(0.56 0.19 255)` light / `oklch(0.74 0.16 255)` dark). Represents status quo maintenance, neutral stances, and observation periods.
- **Data Provenance**: Slate steel (`oklch(0.34 0.010 240)` light / `oklch(0.84 0.006 240)` dark). Represents official citations, resolution PDFs, and integrity records.

### 3. Hairline Architecture Over Shadow Soup
Depth is established primarily through **hairline borders** (`1px solid oklch(0.962 0.001 240)` in light mode, `1px solid oklch(1 0 0 / 5.5%)` in dark mode) and **inset background wells** (`--muted/20` to `--muted/40`), rather than heavy, blurry drop shadows. Shadows are reserved solely for floating modal overlays and tooltips.

### 4. Tabular Numeracy Everywhere
All numerical data—including interest rates, basis point changes, dates, calendar years, and axis labels—*must* use tabular figures (`tabular-nums` / `font-variant-numeric: tabular-nums`). This prevents jitter during hover interactions, aligns decimal points across tables, and ensures clean vertical scanning.

### 5. Multi-Surface Synchronization
Interactions are coordinated across representations. Hovering or clicking a policy marker in the D3 chart simultaneously:
- Focuses and highlights the corresponding row in the desktop decision table / mobile card feed.
- Spawns a collision-aware chart readout positioned dynamically to never obscure data points.
- Updates the active decision status bar.

---

## 3. Typography & Numerical Hierarchy

The typography system is built on two variable fonts loaded locally via `@fontsource-variable`:

- **Primary Sans**: `Inter Variable` (`--font-sans`) — used for all editorial copy, headings, controls, labels, and table cells.
- **Data & Monospace**: `JetBrains Mono Variable` (`--font-mono`) — used for keyboard shortcuts (`<kbd>`), technical hashes, checksum strings, and machine-readable citations.

### Type Scale & Hierarchy

| Role | Classes / CSS | Size | Weight | Tracking | Case / Alignment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Current Rate** | `text-5xl lg:text-[4rem] xl:text-[4.25rem]` | 48px – 68px | Bold (700) | `-0.04em` | Tabular, leading-none |
| **Hero Secondary Stat** | `text-3xl sm:text-4xl lg:text-[2.75rem]` | 30px – 44px | Semibold (600) | `-0.03em` | Tabular, leading-none |
| **Page / Card Heading** | `text-base sm:text-lg` | 16px – 18px | Bold (700) | `-0.02em` | Sentence case |
| **Section Title** | `text-sm sm:text-base` | 14px – 16px | Bold (700) | `-0.015em` | Sentence case |
| **Subheadings / Copy** | `text-xs sm:text-sm` | 12px – 14px | Normal (400) | `-0.006em` | Relaxed (1.5–1.6) |
| **Kickers & Overlines** | `text-[10px]` / `text-[11px]` | 10px – 11px | Semibold (600) | `+0.08em` to `+0.14em` | UPPERCASE |
| **Table Headings** | `text-[11px]` | 11px | Semibold (600) | `+0.10em` | UPPERCASE |
| **Table Cells / Data** | `text-xs sm:text-sm` | 12px – 14px | Medium (500) | `normal` | Tabular nums |
| **Chart Axis Labels** | SVG `axis text` | 10px – 11px | Medium (500) | `normal` | Tabular nums |
| **Chart Micro Labels** | SVG `annotation-label` | 8px – 9px | Semibold (600) | `+0.035em` | UPPERCASE |
| **Integrity Hashes** | `font-mono text-[11px]` | 11px | Normal (400) | `0` | Monospace, break-all |

### Letter-Spacing Rules
- The application root sets `letter-spacing: -0.006em` for crisp text rendering on modern displays.
- Large numerical headlines tighten tracking to `-0.03em` / `-0.05em` to prevent loose glyph spacing.
- All uppercase metadata labels, kickers, and table headers apply positive letter-spacing (`+0.08em` to `+0.14em`) to ensure legibility at micro sizes.

---

## 4. Color Palette & Semantic System

Colors are authored in native modern CSS using the **OKLCH** color space (with `oklab` color mixing). OKLCH provides uniform perceived lightness across hues, ensuring seamless light/dark mode parity without muddy contrast shifts.

### 1. Canvas & Structural Neutrals

```css
/* Light Mode */
--background:        oklch(0.985 0.001 240);  /* Soft cool off-white canvas */
--foreground:        oklch(0.18 0.004 240);   /* High-contrast ink text */
--card:              oklch(1 0 0);            /* Pure white elevated cards */
--card-foreground:   oklch(0.18 0.004 240);
--muted:             oklch(0.955 0.002 240);  /* Inset well backgrounds */
--muted-foreground:  oklch(0.48 0.006 240);   /* Secondary metadata */
--border:            oklch(0.962 0.001 240);  /* Hairline borders */
--border-strong:     oklch(0.90 0.002 240);   /* Hover / active borders */
--ring:              oklch(0.50 0.14 240);    /* Focus ring */

/* Dark Mode */
--background:        oklch(0.165 0.004 240);  /* Deep slate zinc canvas */
--foreground:        oklch(0.99 0.002 240);   /* Pure crisp white text */
--card:              oklch(0.18 0.004 240);   /* Lifted dark card surface */
--card-foreground:   oklch(0.99 0.002 240);
--muted:             oklch(0.22 0.004 240);   /* Inset well surface */
--muted-foreground:  oklch(0.68 0.005 240);   /* Legible dark metadata */
--border:            oklch(1 0 0 / 5.5%);     /* Ultra-subtle translucent hairline */
--border-strong:     oklch(1 0 0 / 12%);      /* Emphasized divider */
--ring:              oklch(0.72 0.12 240);    /* Luminous dark focus ring */
```

### 2. Monetary Policy Semantic Palette

```css
/* Light Mode */
--cut:               oklch(0.60 0.19 148);    /* Easing / Rate Cut (Emerald) */
--cut-foreground:    oklch(0.99 0.01 148);
--hike:              oklch(0.58 0.22 25);     /* Tightening / Rate Hike (Crimson) */
--hike-foreground:   oklch(0.99 0.008 25);
--hold:              oklch(0.56 0.19 255);    /* Pause / Status Quo (Cobalt) */
--hold-foreground:   oklch(0.99 0.008 255);
--source:            oklch(0.34 0.010 240);   /* Official RBI Provenance (Slate) */
--source-foreground: oklch(0.99 0.001 240);

/* Dark Mode */
--cut:               oklch(0.74 0.16 148);    /* Boosted luminance for dark theme */
--cut-foreground:    oklch(0.16 0.02 148);
--hike:              oklch(0.74 0.18 25);
--hike-foreground:   oklch(0.16 0.02 25);
--hold:              oklch(0.74 0.16 255);
--hold-foreground:   oklch(0.16 0.02 255);
--source:            oklch(0.84 0.006 240);
--source-foreground: oklch(0.16 0.005 240);
```

### 3. Alpha Mixes & Chart Overlays
- **Regime Bands**: `color-mix(in oklab, var(--cut) 14%, transparent)` (Easing), `color-mix(in oklab, var(--hike) 14%, transparent)` (Tightening), `color-mix(in oklab, var(--hold) 14%, transparent)` (Pause).
- **Grid Lines**: `color-mix(in oklab, var(--border) 60%, transparent)` (Light), `color-mix(in oklab, var(--border) 70%, transparent)` (Dark).
- **Step Line Fill Gradient**: `linearGradient` fading from 20% stroke opacity at top to 0.0% opacity at baseline.

### 4. Macro Event Categorization
- **Fiscal / Structural Reform**: Amber badge (`bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20`).
- **External Shock / Crisis / Pandemic**: Rose badge (`bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20`).
- **Monetary Policy Framework**: Blue badge (`bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20`).

---

## 5. Surfaces, Borders, Shadows & Spatial Depth

The interface builds visual depth through a 4-tier spatial hierarchy:

| Layer | Surface Name | Styling Tokens & Geometry |
| :--- | :--- | :--- |
| **Layer 3** | Floating Popovers, Command Dialog & Tooltips | `bg-popover`, `--shadow-popover`, `rounded-xl`, `border-border` |
| **Layer 2** | Inset Wells & Sub-panels | `bg-muted/20` to `/40`, `divide-x divide-border/50`, `rounded-xl` |
| **Layer 1** | Structural Cards & Navigation Bar | `bg-card`, 1px `border-border/70`, `rounded-2xl` / `rounded-xl` |
| **Layer 0** | Canvas Background | `bg-background` |

### Radii & Component Geometry

The design system is governed by a base radius of `0.875rem` (14px):

```css
--radius:     0.875rem;                 /* 14px base */
--radius-sm:  calc(var(--radius) * 0.6); /* ~8.4px  (mini badges, inner controls) */
--radius-md:  calc(var(--radius) * 0.8); /* ~11.2px (buttons, tabs, inputs) */
--radius-lg:  var(--radius);             /* 14px    (navbars, dropdowns, controls) */
--radius-xl:  calc(var(--radius) * 1.4); /* ~19.6px (cards, workspace containers) */
--radius-2xl: calc(var(--radius) * 1.8); /* ~25.2px (hero containers) */
--radius-3xl: calc(var(--radius) * 2.2); /* ~30.8px (outer wrappers) */
```

### Shadow Specifications
- **Cards & Hero Surface**: `box-shadow: 0 4px 20px -4px rgba(0, 0, 0, 0.02), 0 1px 3px 0 rgba(0, 0, 0, 0.015)` (Subtle ambient lift, zero heavy black edges).
- **Scrolled Navbar**: `0 8px 24px -4px rgba(0, 0, 0, 0.035), 0 2px 6px -1px rgba(0, 0, 0, 0.015)` (Light) / `0 10px 28px -4px rgba(0, 0, 0, 0.28)` (Dark).
- **Tooltips & Popovers**: `--shadow-popover: 0 6px 20px color-mix(in oklch, var(--foreground) 5%, transparent)` (Light) / `0 10px 24px rgb(0 0 0 / 0.20)` (Dark).
- **Segmented Track Inset**: `box-shadow: inset 0 1px 1.5px rgba(0,0,0,0.05)` (Light) / `inset 0 1px 2px rgba(0,0,0,0.3)` (Dark).

---

## 6. Controls & Interaction Patterns

### 1. The 36px Standard Control Rail
On desktop viewports, all primary controls conform strictly to `--control-height: 2.25rem` (36px, `h-9`):
- Segmented View Tabs (`Timeline`, `Breakdown`, `Rate changes`, `Cycles`)
- Time Range Presets (`1Y`, `5Y`, `10Y`, `Max`)
- Custom Date Trigger Popover
- Layers Multi-select Dropdown
- Export Menu (SVG, PNG, CSV) and Share URL button
- Command Palette Search Trigger (`⌘K`)
- Theme Toggle Button

This creates an uninterrupted, unified horizontal baseline across the entire analytical control bar.

### 2. Segmented Tabs / View Switchers
- **Track**: Inset muted track (`bg-muted/80 border border-border/80 p-1`) with an inner shadow.
- **Active Trigger**: Elevated card pill (`bg-background text-foreground font-semibold shadow-xs border border-border/80`).
- **Inactive Trigger**: `text-muted-foreground hover:text-foreground hover:bg-background/40`.

### 3. Tactile Micro-Press Feedback
All interactive buttons and cards implement a physics-inspired active state:
```css
transition: all 150ms ease-out;
active:scale-[0.98];
```
This gives controls an immediate mechanical response when clicked or tapped.

### 4. Dynamic Collision-Avoiding Readout (`positionReadout`)
Tooltips in data-dense D3 charts frequently obscure adjacent data points or active markers. The visualizer employs a bespoke collision-avoidance positioning engine ([`chartReadout.js`](file:///Users/ashwin/Desktop/projects/finance/repo-rate-visualizer/src/lib/chartReadout.js)):
- Calculates bounding boxes for all visible chart points, decision markers, and macro event labels.
- Evaluates four directional candidate placements (`top`, `bottom`, `left`, `right`) with pixel scoring.
- Selects the placement that maintains clear visibility of all nearby points while preventing viewport clipping.
- Readouts lock in place when a decision marker is clicked (`persistent=true`), allowing keyboard navigation via `Escape` to dismiss.

### 5. Keyboard Navigation & Command Menu
- Pressing `⌘K` or `/` opens a fuzzy search Command Dialog powered by `cmdk`.
- Key navigation across the chart decision markers supports `Tab`, `Enter`, `Space`, and `Escape`.
- Full focus rings (`focus-visible:ring-[3px] focus-visible:ring-ring/50`) ensure complete accessibility compliance.

---

## 7. Data Visualization Language

The visualizer provides four specialized D3 analytical views, each addressing a distinct monetary policy question:

| View | Analytical Question & Visual Representation |
| :--- | :--- |
| **1. Timeline** | *"How has the policy rate evolved over time?"*<br>Step function (`curveStepAfter`) with 20% vertical gradient fill, terminal pulse callout, peak annotation, translucent regime bands, and macro-event vertical pins. |
| **2. Breakdown** | *"What is the policy composition across regimes & years?"*<br>Stacked bar charts decomposing decisions into Holds, Cuts, and Hikes with hold-to-move ratio badges and bps volume metrics. |
| **3. Rate Changes** | *"What was the magnitude and distribution of moves?"*<br>Diverging zero-line bar chart showing basis-point shifts with border highlights on extreme moves ($\ge 50\text{ bps}$). |
| **4. Cycles** | *"How do historical easing & tightening phases compare?"*<br>Normalized trajectory overlay starting at $t=0$ to compare transmission velocity (bps/mo) and terminal levels. |

### Chart Styling Tokens & Details
- **Step Line**: `stroke: var(--color-line)`, `stroke-width: 2.25`, `stroke-linecap: square`, `stroke-linejoin: round`.
- **Inflection Dots**: `circle.rate-dot` with radius `2.5px`, fill `--background`, stroke `--color-line`, stroke-width `1.25px`.
- **Live Terminal Callout**: Pulsing outer halo (`animation: calloutPulse 2.4s ease-in-out infinite`) with solid center dot.
- **Diverging Bars**: `rx: 2px`, positive hikes filled with `--color-hike` (opacity 0.82 $\rightarrow$ 1.0 on hover), negative cuts filled with `--color-cut`.
- **Grid Lines**: Dashed lines (`stroke-dasharray: 4 6`), `stroke-opacity: 0.5`.

---

## 8. Light / Dark Theme Behavior

### Seamless View Transition Architecture
Theme switching does not cause sudden flashes of unstyled content or jarring color pops:
- Leverages the browser **View Transition API** (`document.startViewTransition`) paired with a GPU-accelerated 160ms cubic-bezier crossfade:
```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 160ms;
  animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
```
- The theme toggle button features a morphing Sun/Moon icon pair that smoothly rotates and scales through 45 degrees.
- SVG chart elements (axes, gridlines, step paths, annotations, readouts) react instantaneously to CSS custom variable updates without requiring D3 DOM reconstructions.

---

## 9. Responsive & Mobile Philosophy

The mobile experience is not a stripped-down afterthought; it is a full-featured, touch-optimized adaptation of the desktop observatory:

| Desktop Pattern ($\ge 1024\text{px}$) | Mobile Adaptation ($< 768\text{px}$) |
| :--- | :--- |
| **3-column horizontal Hero Summary** with vertical hairline dividers. | **Stacked Hero card** with 2-column metric sub-grid and inline provenance pill. |
| **Single-row 36px Control Rail** with inline tabs, range, & exports. | **Floating hamburger** opening right slide-over Drawer (`vaul`) with grouped tools. |
| **6-column Decision Spine Table** displaying complete historical data. | **Sleek 2-row Decision Cards** with expandable "Show More" feed. |
| **Chart aspect ratio**: `clamp(280px, 36vw, 460px)` with full macro labels. | **Chart aspect ratio**: `clamp(240px, 74vw, 340px)` with simplified compact axis ticks. |
| **36px control click targets** (`h-9`). | **Expanded 40px–44px touch targets** for mobile fingertips. |

### Mobile Layout Safeguards
- **Safe Area Inset Support**: All headers, drawers, and footers incorporate `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- **Zero Horizontal Overflow**: Strict `overflow-x: hidden` and `max-width: 100vw` prevent unwanted lateral shifts.
- **Touch-optimized Decision Cards**: Tap a card to select the decision in the chart, with an isolated external source link button that avoids accidental link-triggering.

---

## 10. Motion & Micro-Interactions

| Interaction | Duration | Easing Curve | Purpose |
| :--- | :--- | :--- | :--- |
| **Button / Tab Press** | `150ms` | `cubic-bezier(0.22, 1, 0.36, 1)` | Tactile scale depression (`scale-[0.98]`) |
| **Theme Crossfade** | `160ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Flawless view transition between themes |
| **Collapsible Drawer / Sources** | `180ms` | `cubic-bezier(0.22, 1, 0.36, 1)` | Smooth accordion expansion |
| **Terminal Rate Pulse** | `2.4s` | `ease-in-out infinite` | Draws eye to latest live policy stance |
| **Chart Hover Halo** | `120ms` | `ease-out` | Smooth tracking of mouse cursor over step curve |
| **Decision Row Selection** | `150ms` | `ease-out` | Instant background highlight on active decision |

### Accessibility & Reduced Motion
All animations, transitions, and pulsing dots are strictly disabled when `prefers-reduced-motion: reduce` is detected:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

---

## 11. Design Rules & Guardrails for Contributors

When extending the site or building new features, adhere to these explicit design judgment rules:

### What Patterns to Follow (The "DO's")
1. **Always use step functions (`curveStepAfter`)** for interest rate representations.
2. **Always enable `tabular-nums`** on any element rendering a number, rate, bps count, or date.
3. **Preserve the semantic triad**: Cut = Emerald (`--cut`), Hike = Rose (`--hike`), Hold = Cobalt (`--hold`).
4. **Anchor all controls to the 36px baseline (`h-9`)** on desktop.
5. **Always attach data provenance**: Every metric must be source-backed with official RBI citations.
6. **Use hairline borders and muted inset wells** rather than heavy drop shadows.
7. **Ensure zero layout shifts** across theme toggles and responsive breakpoints.

### What Visually Feels WRONG (The "DON'Ts")
1. **NO smooth bezier curves or spline interpolations** for policy rates.
2. **NO generic stock-market green/red inversion** (treating rate cuts as universally "good" or hikes as "bad"; use semantic easing/tightening colors).
3. **NO heavy glossy gradients, glassmorphism blurs, or glow effects** behind cards.
4. **NO bubbly, oversized consumer-app buttons** with excessive padding or playful rounding.
5. **NO proportional/wobbly numbers** in data tables, metric cards, or chart axes.
6. **NO unsourced or speculative commentary** in official data panels.
7. **NO horizontal scrolling on mobile viewports**.
8. **NO triple-stacked headers** (overline kicker + title + decorative subtitle). Keep headings direct, clean, and unpadded.
9. **NO card-inside-card nesting**. Use single-tier structural cards with flat internal dividers or unbordered metric strips, never bordered card boxes nested inside another card.
