# Policy Rate Atlas v2, Phase 2: Production Experience and Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1 app with the production Policy Rate Atlas: an insight-first, prerendered React 19 site for IN, US, EA, GB, CA, AU and BR on `rates.ashwingopalsamy.in`. Automated layout, typography and accessibility guards enforce its design system.

**Architecture:**
- **Delivery.** A Vite + React 19 + TypeScript single-page app. Every route is prerendered with `renderToString` and then hydrated from embedded release data.
- **Logic and charts.** All findings are pure functions over schema v3 releases (Plan 1). Charts are hand-built SVG components.
- **Design system.** One token file (Agam language, Claret and Clay palettes) and one `Card` component. CSS Modules everywhere else.
- **Hosting.** Cloudflare Workers static assets, with no Worker code in this phase. Phase 4 adds `/mcp`.

**Tech Stack:** React 19, react-dom 19, Vite (latest major), TypeScript, CSS Modules, `lucide-react`, `@fontsource-variable/inter`, `@fontsource-variable/geist-mono`, zod (shared schema), Playwright with `@axe-core/playwright`, `node:test`, wrangler 4.

**Spec:** `docs/superpowers/specs/2026-10-07-policy-rate-atlas-v2-design.md`. The relevant sections:
- §1 Value proposition
- §5 Decision-day state
- §6.1–6.8 Experience: IA, phone layout, signature concepts, motion table, visual system, accessibility, rendering
- §7 REST
- §8 Hosting

**Depends on:** Plan 1 completed. `data/` holds IN and US v3 releases, `data/schedule.json` and `schema/`.

## Revision 3 (7 Oct 2026): typed vanilla TypeScript instead of React

The approved prototype is framework-free, and its switch contract (queued text swaps committed on one frame, in-card FLIP, keyed tweens on one rAF clock) works on DOM nodes directly. Porting it to React would mean re-deriving that contract around reconciliation. The production site is therefore the prototype's code, typed, in `src/lib` (findings, motion, formatting), `src/charts`, `src/app` (pages, shell, routing) and `src/analytics`, with one global stylesheet ported from `design/prototype/styles.css`. Where a task below names a React component, hook or `.tsx` file, read it as the corresponding typed module. Prerendering runs the same modules against linkedom (`scripts/prerender.ts`). Results: 36 KB JS and 10 KB CSS gzip, against budgets of 90 and 25.

## Revision 2 (7 Oct 2026): what the approved prototype changes

The owner approved the HTML prototype in `design/prototype/`. It is the reference implementation. Port its logic and measurements; do not re-derive them:
- `lib.js`: findings, keyed tweens, `morph`, `sampleStep`, `transact`;
- `charts.js`: persistent charts;
- `app.js`: page composition and copy;
- `styles.css`: tokens and the phone shell;
- `check.mjs`: guards.

The amendments below override the original text of the tasks they name. Owner decisions: all 7 countries at launch, two stacked PRs, and `/mcp` plus WebMCP stay in Phase 4.

- **Branch and PR.**
  - Work on `v2/experience`, stacked on `v2/phase1-data-foundation` (PR #3).
  - The PR targets that branch until #3 merges, then `main`.
- **Countries.**
  - IN, US, EA, GB, CA, AU and BR, all through the same shell.
  - Every list (world page, peer ladder, pulse, ⌘K, API) reads `data/manifest.json`. No country code is hard-coded.
  - Countries without decision records show "Every move" and the line "Votes and statements for the {bank} are being added".
- **Visual system** (overrides the Global Constraints colour and type lines and Task 2's token source).
  - Tokens are copied from `design/prototype/styles.css` `:root`: cool neutral greys for light; the existing dark values; the Claret and Clay data palettes unchanged.
  - Tabular figures apply only to figure classes, never to `body`, so hyphens in prose keep their normal width.
  - No status pills ("Verified against …").
  - Circular flags come from HatScripts/circle-flags (MIT), vendored under `public/flags/` with the licence. `Flag({ cc })` replaces `Disc`.
  - Negative rates use a true minus sign.
  - No internal jargon in UI copy.
- **Phone shell (≤ 720 px)** (overrides Task 6's rail-on-phone behaviour).
  - The shell copies home.ashwingopalsamy.in (`ravanan-kudil/src/styles/mobile/base.css`):
    - a `#f2f3f5` page with white soft-shadow cards;
    - a fixed top bar in five 44 px columns: round mark (scroll to top), centred title (the country name, or "World"), theme button, flag button (opens the switcher);
    - a floating pill dock with Decision, Loan, Cycle, Record and World, where the active tab is an ink pill with its label that glides between tabs.
  - Cards are calm by default, with one finding and one visual each. Hidden on phones: card footers, the quote, glance stats, tile captions, the loan note and its last two result rows, transmission notes, the cycle list, legends, gap stats, the Live/Announced/Decided control, and all footer columns but the first.
  - Insight tiles swipe sideways (scroll-snap).
  - The world league table becomes a list below 1000 px.
- **Desktop shell.**
  - The theme toggle is a round button in the toolbar beside the country chip; the rail keeps the palette and collapse buttons.
  - The rolling title uses a single-flight `roll()`: anything still leaving is dropped when a newer label arrives. Scroll-spy is throttled to rAF.
- **Country switch** (Task 6 contract, spec §6.5).
  - `useSwitchTransaction` ports `transact`. `useMorph` ports `morph` and `tween`.
  - The record and gap charts use a fixed 2000-to-today x axis. Series starting later sweep their start edge and carry a "Series starts …" or "Comparison starts …" label.
  - The y scale tweens and has a floor below zero for negative rates. Gridlines crossfade through a tick layer.
  - Markers land left to right after the line.
  - Cycle analogs and histograms crossfade.
  - The peer ladder keeps its rows and moves only `.cur`.
- **Motion on lists.** Country rows (peer ladder, league table, latest moves, ⌘K) respond to hover: the background washes in, the flag scales to 1.1 on a spring, the name nudges 3 px, and the peer row's arrow slides in. In ⌘K the mouse moves the highlight. Rates in ⌘K sit in a fixed two-column grid (mark, then a right-aligned value).
- **Copy rules.**
  - Quotes carry paired marks.
  - The gap note is written for both signs ("Holding rupees earns more than holding dollars, which supports the rupee; …").
  - A single earlier cycle is "previous", never "median", and draws no median line.
  - "Not on our calendar yet" when a bank has no calendar.
- **Guards** (extends Task 2). Port every `check.mjs` guard into `tests/browser/guards.ts`:
  - page overflow;
  - content escaping its card;
  - clipped text;
  - text overlap (including SVG text);
  - mono in prose;
  - equal row heights;
  - empty card areas over 24 px;
  - toolbar and phone top-bar collisions;
  - dock pill under the active tab;
  - dock clearance;
  - table edge alignment;
  - figure wrapping;
  - footer on the grid.

  Add these specs:
  - switch smoothness (node identity, no opacity dip, at least 3 distinct record paths, exact landing; via ⌘K, peer row, five rapid previews, and phone);
  - rolling title under fast scroll;
  - a copy audit on every page (null/undefined/NaN, double spaces, a space before punctuation, `1 months`-style plurals, unbalanced quotes or brackets);
  - reduced motion.
- **New Task 0** (before Task 1): series adapters for EA, GB, CA, AU and BR. Details below.
- **New Task 13** (after Task 12): analytics. Details below.
- **Task 11.** The API and prerender cover all 7 countries.
- **Task 12.**
  - `wrangler.jsonc` gains `main: "worker/site/index.ts"` and `assets.run_worker_first: ["/e"]` (every other path stays free static assets).
  - It also gains the `EVENTS` Analytics Engine binding, `observability.enabled`, and the Task 13 cron and D1 binding.
  - CSP in `_headers` allows the Web Analytics beacon.

### Task 0: Series adapters for EA, GB, CA, AU and BR

**Files:**
- Create: `pipeline/countries/{ea,gb,ca,au,br}/adapter.ts`, `pipeline/transmission/{ea,gb,ca,au,br}.json`
- Test: `tests/fixtures/{ea,gb,ca,au,br}/*` and `tests/pipeline/series-adapters.test.ts`
- Modify: `pipeline/countries/registry.ts`

**Interfaces:**
- Consumes: the Plan 1 adapter contract (`pipeline/types.ts`), `pipeline/lib/http.ts`, `validateRelease`.
- Produces: one adapter per country. Each fetches the official series, maps change points to `Level` (point) series with `evidence: 'official'`, and emits `CountryRelease` with no decisions, one `policy` era, sources and transmission notes. Sources are the ones `design/prototype/build-data.ts` used:
  - ECB Data Portal (deposit facility rate);
  - BoE IADB (Bank Rate);
  - BoC Valet (overnight target, from 2009);
  - RBA F1 (cash rate target, from 2011);
  - BCB SGS 432 (Selic target).
- No calendars yet, so the dispatcher's daily 06:17 UTC sweep refreshes them.

- [ ] **Step 1:** Write failing tests against captured fixtures. For each country:
  - change points parse;
  - the latest level equals the prototype snapshot (EA 2.50%, GB 3.75%, CA 2.25%, AU 4.60%, BR 13.75%);
  - `validateRelease` passes;
  - a malformed payload throws `SourceFormatError`.
- [ ] **Step 2:** Implement and register the adapters. Run `npm run test:pipeline`. Expected: PASS.
- [ ] **Step 3:** Run `node pipeline/run.ts --countries EA,GB,CA,AU,BR` and then `node pipeline/publish.ts`. Commit the first releases with `feat(pipeline): series adapters for EA, GB, CA, AU and BR`.

### Task 13: Analytics: $0, cookie-less, no personal data

**Files:**
- Create:
  - `worker/site/index.ts`, `worker/site/events.ts`, `worker/site/rollup.ts`;
  - `src/analytics/track.ts`, `src/analytics/beacon.ts`;
  - `src/pages/PrivacyPage.tsx`;
  - `scripts/analytics-report.ts`;
  - `.github/workflows/analytics-weekly.yml`.
- Test: `tests/app/events.test.ts`, `tests/app/track.test.ts`, `tests/browser/analytics.spec.ts`

**Interfaces:**
- **Traffic.**
  - The Cloudflare Web Analytics beacon is a manual snippet. Its token is a public site id, `VITE_CF_BEACON_TOKEN`, provided at build time; there is no beacon when it is unset.
  - The beacon loads only when `navigator.globalPrivacyControl` is not true and `doNotTrack` is not `"1"`.
  - It provides page views, visits, referrers, countries and Core Web Vitals, including soft navigations.
- **Product events.**
  - `track(name, props)` queues events in memory and flushes with `navigator.sendBeacon('/e', …)` on `pagehide` or `visibilitychange: hidden`, or once 10 events are queued. It does nothing under GPC or DNT.
  - Allowlisted events:
    - `page {route, cc}`;
    - `country_switch {from, to, via: palette|ladder|dock|link|table}`;
    - `loan_calc {cc, mode}` (no amounts);
    - `tile_open {cc, tile}`;
    - `replay {cc}`;
    - `dday_preview {cc, state}`;
    - `palette_open {via}`;
    - `source_click {cc}`;
    - `theme {to}`;
    - `decision_window {cc}`, for a visit within 48 h of a decision.
- **`worker/site/events.ts`: `handleEvents(req, env)`.**
  - Accepts POST only, at most 2 KB and 20 events, validated with zod against the allowlist. It returns 204 and never echoes input.
  - It drops events whose user agent matches the bot pattern.
  - The visitor id is `hmac(env.ANALYTICS_SALT_KEY, utcDate | ip | ua)`, truncated to 16 hex characters. The IP and UA are then discarded.
  - Each event is written with `env.EVENTS.writeDataPoint({ indexes: [name], blobs: [name, route, cc, a, b, cf.country, visitorId], doubles: [1] })`.
  - Any other path falls through to `env.ASSETS.fetch(req)`.
- **Retention.** `rollup.ts` is a daily `scheduled` handler. It queries the Analytics Engine SQL API, using `SUM(_sample_interval)`, with the secret `CF_ANALYTICS_READ_TOKEN`, and upserts yesterday's aggregates into D1 table `daily(date, event, cc, country, count, visitors)`.
- **Reporting.**
  - `npm run analytics:report` (a local script, `CLOUDFLARE_ACCOUNT_ID` plus `CLOUDFLARE_ANALYTICS_TOKEN` from the environment) prints, for the last 7, 30 and 90 days:
    - visits;
    - unique visitors;
    - top countries and routes;
    - the country-switch matrix;
    - events per country.
  - The optional weekly workflow writes the same report to the job summary once the owner adds the secrets.
- **`/privacy`.** No cookies, no browser storage, no personal data, what is counted, how long it is kept (Analytics Engine 3 months, D1 aggregates indefinitely), and that GPC or DNT stops all of it. Linked from the footer.
- **Owner actions:**
  - create the Web Analytics site;
  - `wrangler secret put ANALYTICS_SALT_KEY` and `CF_ANALYTICS_READ_TOKEN`;
  - `wrangler d1 create atlas-analytics`, with its id pasted into `wrangler.jsonc`.

- [ ] **Step 1:** Write the failing tests:
  - `handleEvents` returns 405 on GET, 413 over 2 KB, and 400 for an unknown event or a value outside the enums.
  - Written data points never contain the IP, UA or raw hash input, and the same IP and UA on two dates give different ids.
  - `track` flushes on `pagehide` and sends nothing under GPC.
  - Playwright with `navigator.globalPrivacyControl = true` makes no request to `/e` or `cloudflareinsights.com`. Without it, a country switch posts one `country_switch` event.
- [ ] **Step 2:** Implement and run the suites. Expected: PASS. `npx wrangler deploy --dry-run` validates.
- [ ] **Step 3:** Commit with `feat(analytics): cookie-less traffic and product events on Cloudflare`.

## Global Constraints

- **Work branch.** Do all work on `v2/experience` (Revision 2). v1 stays live from `main` until the cutover in Task 12.
- **Type and numbers** (spec §6.6, owner rule):
  - A number inside a sentence is Inter with tabular figures, never Geist Mono.
  - Mono (`.data` class or the `<Num>` component) only for numbers standing alone (table cells, stat values, number-only chips), chart axes and hashes.
  - In prose, money uses the full locale format, never compact notation.
- **Cards** (spec §6.6, owner rule):
  - Every section is a `Card`: 16 px radius, 1 px `--hair` border, neutral `--surface`, padding 20 px (mobile) or 24 px (≥ 768).
  - Header anatomy: kick, finding, actions.
  - Cards in one `Row` stretch to equal height, with no dead areas.
  - Never tint a card by direction.
- **Colour.**
  - Hawk is Tangerine Tango, dove is Emerald, the gap is Kikyo, "you" and the accent is Orchid, level fills are Aqua Sky.
  - Values come exactly from spec §6.6.
  - Clay is the alternative palette.
  - No gradients, glows or glass. No en or em dashes in UI strings.
- **Motion.** Durations, easings and behaviours follow the spec §6.5 table exactly:
  - "the interface eases, the data steps";
  - `prefers-reduced-motion` gives final states;
  - composited properties only.
- **Rates and dates.**
  - Rates come from v3 `Level` via `formatLevel`; a midpoint is never computed.
  - Dates are plain dates formatted in UTC.
  - Prerendered HTML contains no relative or clock-dependent text; that is computed after mount.
- **Budgets.** Main JS ≤ 90 KB gzip, CSS ≤ 25 KB gzip. Lighthouse performance and accessibility ≥ 95 on the IN page with a mobile profile.
- **Dependencies** are pinned exactly. No Tailwind, Radix, shadcn, cmdk, vaul or d3.
- **Test runs.** Tests are deliverables. Executors run them locally only if the owner says so (AGENTS.md); CI always runs them.

## Review Focus

1. **Long and wide values at narrow widths.**
   - *Inputs:* range values ("3.75 to 4.00%"), Brazilian or Indian money strings ("R$ 300.000", "₹50,00,000"), long bank names, all at 360 px.
   - *Expected:* nothing overlaps, clips or wraps inside a value.
   - *Covered by:* the Task 2 guard suite, run on every page in Tasks 7–10.
2. **A country with no comparable history.** No earlier cycle, a single earlier cycle, a gap that never narrowed, or a negative rate.
   - *Expected:* the finding sentences stay grammatical and true.
   - *Covered by:* the Task 4 tests on synthetic releases.
3. **Hydration on a different day from the build.**
   - *Expected:* no hydration warning. Relative text and decision-day state update after mount.
   - *Covered by:* Task 11 test `prerendered page hydrates without console errors when the clock is 3 days after build`.
4. **Keyboard-only and screen-reader use of every chart and the switcher.**
   - *Expected:* all of it is reachable and announced, with no axe serious or critical violations.
   - *Covered by:* the Task 2 axe guard plus the Task 6 and Task 8 keyboard flow tests.
5. **A schedule that says a decision is due while static data is stale.**
   - *Expected:* "until today's decision is confirmed" copy and the hatched pending step, never the stale rate presented as today's.
   - *Covered by:* Task 8 test `due meeting shows pending state, not the stale rate as today`.

---

## File Structure

```
index.html                         template with <!--app-head-->, <!--app-html-->, <!--app-data-->
vite.config.ts, tsconfig.app.json, playwright.config.ts
src/main.tsx                       hydrateRoot(App, embedded state)
src/app/router.ts                  Route type, parseRoute, href helpers, useRoute, navigate
src/app/data.ts                    ReleaseStore (embedded, cache, prefetch), useNow
src/app/App.tsx                    route -> page inside AppShell
src/design/tokens.css, base.css    tokens (spec §6.6), type rules, motion tokens
src/design/{Card,Row,Pill,Disc,Segmented,IconButton,Kbd,Num,Prose,Tooltip,Sheet}.tsx (+ .module.css)
src/design/motion.ts               swap, staggerIn, flip, drawIn, useReducedMotion
src/dev/Primitives.tsx             dev-only /__primitives harness (not in production build)
src/lib/format.ts, src/lib/model.ts
src/lib/findings/{lede,level,cycles,gap,pulse,league,loan}.ts
src/charts/{scale.ts,StepChart.tsx,CycleChart.tsx,GapChart.tsx,PulseChart.tsx,Spark.tsx}
src/shell/{AppShell,Rail,Toolbar,Crumb,CountrySwitcher,ThemeToggle,PaletteToggle}.tsx, useSectionSpy.ts
src/pages/{CountryPage,WorldPage,DecisionPage,MethodologyPage,NotFound}.tsx
src/pages/country/{DecisionCard,InsightTiles,LoanCard,TransmissionCard,CycleCard,CycleList,GapCard,RecordCard,LedgerCard}.tsx, decisionDay.ts
src/pages/world/{PulseCard,LatestDecisionsCard,LeagueTableCard}.tsx
src/prerender.tsx                  render(url, state) -> { html, head }
scripts/build-api.ts, scripts/prerender.ts, scripts/check-bundle.ts
public/_headers, public/robots.txt
wrangler.jsonc, vercel.json (Task 12)
tests/app/*.test.ts                node:test (format, model, findings, build-api)
tests/browser/guards.ts            reusable guard assertions
tests/browser/*.spec.ts            guard and flow specs per page
tests/fixtures/v3/{IN,US}.json     copies of Plan 1 releases; synthetic fixtures built in tests
```

---

### Task 1: Migrate the toolchain and retire v1

**Files:**
- Delete:
  - `src/components/**`, `src/styles/**`, `src/hooks/**`, `src/lib/**`, `src/mobile/**`, `src/App.jsx`, `src/main.jsx`;
  - `src/data/*` except the RBI files moved below;
  - `components.json`, `jsconfig.json`, `tests/browser/*.spec.js`;
  - the v1-only tests in `tests/data/` (all except `rbiSources`, `snapshotV2`, `supplementalHistory`, `releaseManifest`, `test_hf_dataset.py`).
- Move:
  - `src/data/snapshotV2.js`, `src/data/supplementalHistory.js` → `pipeline/legacy/in/`;
  - `src/data/snapshot.json`, `src/data/releaseMeta.js` → `data/legacy/in/`.

  Update the imports and paths in `scripts/fetch-rbi-data.js` (`BUILD_SNAPSHOT`), `scripts/build-hf-dataset.py` (`DEFAULT_INPUT`), `pipeline/countries/in/*`, `.github/workflows/refresh.yml` (the `git add` paths) and the kept tests.
- Create: `vite.config.ts`, `tsconfig.app.json`, a new `index.html`, `src/main.tsx`, `src/app/App.tsx` (renders "Policy Rate Atlas"), `playwright.config.ts`.
- Modify: `package.json`.
  - Dependencies: add `react@19`, `react-dom@19`, `lucide-react`, `@fontsource-variable/inter`, `@fontsource-variable/geist-mono`. Remove every v1 UI dependency.
  - Dev dependencies: `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `@playwright/test`, `@axe-core/playwright`.
  - Scripts: `dev`, `build`, `typecheck` (covering app and pipeline), `test:app` (`node --test "tests/app/**/*.test.ts"`), `test:browser`, `check:bundle`.

**Interfaces:**
- Produces: `npm run build` emits `dist/`. `vite.config.ts` aliases `@schema` to `schema/` and `@` to `src/`.

- [ ] **Step 1:** Create branch `v2-experience`. Make the moves and deletions, then update paths.
- [ ] **Step 2:** Run `npm run test:data && npm run test:hf-dataset && npm run test:pipeline`. Expected: PASS, proving the RBI pipeline survived the move.
- [ ] **Step 3:** Run `npm run build && npm run typecheck`. Expected: `dist/index.html` exists and there are 0 errors.
- [ ] **Step 4:** Commit with `refactor!: retire the v1 app and move RBI legacy modules`.

### Task 2: Design tokens, primitives and the guard suite

**Files:**
- Create: `src/design/tokens.css`, `src/design/base.css`, the primitives listed in File Structure, `src/design/motion.ts`, `src/dev/Primitives.tsx`, `tests/browser/guards.ts`, `tests/browser/primitives.spec.ts`

**Interfaces:**
- Produces:
  - **Tokens.** Copy the Agam tokens and the Claret and Clay palettes, light and dark, verbatim from the specimen's token blocks (spec §6.6 values). Role tokens: `--hawk`, `--dove`, `--gap`, `--band`, `--obs`, `--accent`, `--live`. Type tokens: `--font-ui`, `--font-data`. Motion tokens: `--ease`, `--ease-in`, `--spring`. Palette and theme are switched with `data-palette` and `data-theme` on `<html>`.
  - **Type rule.** `body` sets `font-variant-numeric: tabular-nums` on Inter. The `.data` class switches to `--font-data`.
  - `Card({ id?, kick?: { icon: LucideIcon; text: string }, finding?: ReactNode, actions?: ReactNode, footer?: ReactNode, children }): JSX.Element`, rendering `<section data-card>`. The finding is wrapped in `<Prose>`.
  - `Row({ children, cols: number[] })`: a 12-column grid with `align-items: stretch`; `cols` are spans per child at ≥ 1180 px and stack below that. Renders `data-row`.
  - `Pill({ dir?: 'hike'|'cut'|'framework', children })`, `Disc({ code })`.
  - `Segmented({ options: {value,label}[], value, onChange, label })`, with a sliding thumb and roving tabindex.
  - `IconButton({ icon, label, onClick })`, `Kbd`.
  - `Num({ value: string })`, which renders `.data`.
  - `Prose({ as?, children })`, which renders `data-prose`.
  - `TooltipProvider` and `useTooltip(): { show(html: ReactNode, x: number, y: number): void; hide(): void }`.
  - `Sheet({ open, onClose, children })`: a bottom sheet below 720 px and a centred dialog above.
  - `motion.ts`: `swap(el, render, dir)`, `staggerIn(nodes)`, `flip(container, mutate)`, `drawIn(paths)`, `useReducedMotion()`. Timings per spec §6.5.
  - `guards.ts`:
    - `expectNoOverflow(page)`
    - `expectNoTextOverlap(page)`: leaf text boxes, ancestors and descendants excluded, more than 2 px² of overlap fails.
    - `expectNoClippedText(page)`: `nowrap` or `ellipsis` elements with `scrollWidth > clientWidth + 1`.
    - `expectNoMonoInProse(page)`
    - `expectEqualHeightRows(page)`: `[data-row]` children within 1 px.
    - `expectAxeClean(page)`: no serious or critical violations.
    - `runGuards(page, url)`: runs all six at widths 360, 768, 1280 and 1440, in light and dark.

- [ ] **Step 1:** Write `tests/browser/primitives.spec.ts`:
  - `runGuards` on `/__primitives`.
  - Segmented keyboard: ArrowRight moves the selection and the thumb ends under the selected label (bounding-box centres within 2 px).
  - `Prose` containing a `Num` fails `expectNoMonoInProse`. This is a negative test, so wrap it in `expect(...).rejects`.
- [ ] **Step 2:** Run `npx playwright test tests/browser/primitives.spec.ts`. Expected: FAIL (no route).
- [ ] **Step 3:** Implement the tokens, base CSS, primitives, motion helpers and `/__primitives`. The harness only mounts when `import.meta.env.DEV`. It shows every primitive in every state, with the long values from Review Focus 1.
- [ ] **Step 4:** Run the spec again. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(design): tokens, primitives and layout guard suite`.

### Task 3: Release client, model and formatting

**Files:**
- Create: `src/app/data.ts`, `src/lib/model.ts`, `src/lib/format.ts`, `tests/fixtures/v3/IN.json`, `tests/fixtures/v3/US.json`
- Test: `tests/app/format.test.ts`, `tests/app/model.test.ts`

**Interfaces:**
- Consumes: `CountryRelease`, `Level`, `formatLevel` from `@schema`.
- Produces:
  - `type Move = { date: string; level: Level; changeBps: number|null; dir: 'hike'|'cut'; eraChange: boolean; evidence: 'official'|'secondary'; decision?: Decision }`
  - `type Cycle = { dir: 'hike'|'cut'; moves: Move[]; from: Level; totalBps: number; days: number }`
  - `type CountryModel = { release: CountryRelease; policyFrom: string; moves: Move[]; cycles: Cycle[]; latest: Move; levelAt(date: string): Level; lastDecision: Decision|null }`. Moves and cycles count only series points inside `basis: 'policy'` eras.
  - `buildModel(release: CountryRelease): CountryModel`
  - `formatDate(date, locale)`, `formatMonth(date, locale, long?)`, `formatBps(n, { sign: true })` returning e.g. `"+25 bps"` or `"−25 bps"` (true minus), `formatMoney(v, currency, locale)` (full format only), `formatShare(p)` returning e.g. `"72%"`.
  - `ReleaseStore`: `get(cc): CountryModel | undefined`, `load(cc): Promise<CountryModel>`, `prefetch(cc): void`, `latest(): LatestFile`, `schedule(): ScheduleFile`. It is seeded from `<script type="application/json" id="atlas-state">`.
  - `useNow(): string`: the build date during SSR and hydration, then the client date after mount.
  - Adds `type LatestFile = { generatedAt: string; countries: { cc: string; level: Level; latestMove: { date: string; changeBps: number|null; dir: 'hike'|'cut' }; release: string }[] }` to `schema/files.ts`.

- [ ] **Step 1:** Write the failing tests:
  - `formatMoney(5000000,'INR','en-IN') === '₹50,00,000'`
  - `formatMoney(300000,'BRL','pt-BR') === 'R$ 300.000'` (normalise NBSP in the assertion)
  - `formatBps(-25,{sign:true}) === '−25 bps'`
  - `formatDate('2026-10-07','en-US') === 'Oct 7, 2026'`, regardless of the `TZ` env (run once with `TZ=America/Los_Angeles`)
  - `buildModel(IN)`:
    - `latest` is `{ date:'2026-10-07', changeBps:25, dir:'hike' }`;
    - no move has a date before `2004-10-29` (D3 era excluded);
    - the last cycle is `{ dir:'hike', totalBps:25 }`.
  - `buildModel(US)`: the 2008-12-16 move has `eraChange:true`, `changeBps:null`, `dir:'cut'`.
- [ ] **Step 2:** Implement, run `npm run test:app`, and expect PASS.
- [ ] **Step 3:** Commit with `feat(app): release store, country model and locale formatting`.

### Task 4: Findings library

**Files:**
- Create: `src/lib/findings/{lede,level,cycles,gap,pulse,league,loan}.ts`
- Test: `tests/app/findings.test.ts`

**Interfaces:**
- Consumes: `CountryModel`, the formatters.
- Produces (each returns structured data plus a `text` string; numbers in `text` are plain, and the UI wraps nothing in mono):
  - `lede(m: CountryModel, today: string): string`
  - `moveContext(m, move): string`, e.g. `"first hike since February 2023"`, `"fifth cut in a row"`, `"target range introduced"`
  - `levelFinding(m, today): { share: number; side: 'lower'|'higher'; since: string; bins: { fromPct: number; days: number; current: boolean }[]; text }`
  - `cycleFinding(m, today): { current: Cycle; past: Cycle[]; medianBps: number|null; medianDays: number|null; holdingDays: number; text }`, where `past` only counts same-direction cycles with ≥ 2 moves
  - `gapFinding(a: CountryModel, b: CountryModel, today): { bps: number; yearAgoBps: number; share: number; word: 'narrower'|'wider'|'smaller discount'|'deeper discount'; sinceDate: string|null; text }`, where `sinceDate` is null unless it is more than 365 days back
  - `pulseFinding(models: CountryModel[], today): { quarters: { q: string; hikes: Move[]; cuts: Move[] }[]; text }`, with a 90-day window and a "widest since" search per spec §6.4
  - `leagueRows(models, today, benchmark: 'US'): LeagueRow[]`
  - `loanImpact({ amount, years, ratePct, deltaBps }): { before: number; after: number; delta: number; tenureMonths: number|null; interestDelta: number }`, where `tenureMonths` is null when the payment no longer covers interest

- [ ] **Step 1:** Write the failing tests:

  | Call | Expected |
  |---|---|
  | `lede(IN,'2026-10-07')` | `"The RBI raised the policy repo rate by 25 bps to 5.50% on 7 Oct 2026, its first hike since February 2023, after ten months unchanged at 5.25%."` |
  | `levelFinding(IN)` | `side 'lower'`, `Math.round(share*100) === 72`, `since '2004-10-29'` |
  | `cycleFinding(IN)` | `past.length === 5`, `medianBps === 250`, `Math.round(medianDays/30.44) === 9` |
  | `gapFinding(IN, US)` | `bps 150`, `yearAgoBps 125`, `word 'narrower'`, `Math.round(share*100) === 85`, `sinceDate null` |
  | `loanImpact({amount:5000000, years:20, ratePct:8.5, deltaBps:25})` | `before ≈ 43391.16`, `after ≈ 44185.54`, `delta ≈ 794.37` (±0.01), `Math.round(tenureMonths) === 12`, `interestDelta ≈ 190649.71` |

  Synthetic releases built in the test cover the remaining branches:
  - no earlier cycle: text contains `"no earlier"`;
  - exactly one earlier cycle: text contains `"The previous one ran"`;
  - a negative rate (EA-like −50 bps): it formats as `−0.50%`;
  - a gap equal to the year-ago value: there is no "since" clause.
- [ ] **Step 2:** Implement, porting the logic validated in the specimen (`findings` section). Run `npm run test:app`. Expected: PASS.
- [ ] **Step 3:** Commit with `feat(app): deterministic findings library`.

### Task 5: Chart components

**Files:**
- Create: `src/charts/scale.ts`, `src/charts/{StepChart,CycleChart,GapChart,PulseChart,Spark}.tsx` (+ `.module.css`)
- Modify: `src/dev/Primitives.tsx` (add the charts with fixture data)
- Test: `tests/app/scale.test.ts`, `tests/browser/charts.spec.ts`

**Interfaces:**
- Produces:
  - `linear(domain: [number, number], range: [number, number]): Scale & { ticks(n: number): number[] }`, with `ticks` returning nice steps from {25, 50, 100, 200, 250, 500, 1000}
  - `time(domain: [string, string], range): Scale & { yearTicks(maxLabels: number): string[] }`
  - `StepChart({ model, range: 'cycle'|'2008'|'all', overlay?: { kind: 'pending'; date: string } | { kind: 'ceremony'; move: Move }, onSelect?(move) })`. Task 8 maps the decision-day state onto `overlay`. It draws:
    - eras (observation eras shaded in `--obs`);
    - the range band;
    - markers (▲ filled hawk, ▽ dove, ◆ gap colour), with the latest marker haloed.
    Interactions:
    - scrub snaps within 12 px;
    - the keyboard steps through moves (Arrow, Home, End);
    - the tooltip comes from `useTooltip`.
    The decision-day overlays are pending hatch, ceremony and stamp. Replay is exposed via a ref handle `replay(): void`.
  - `CycleChart({ finding: CycleFinding, highlighted?: number, onHighlight? })`
  - `GapChart({ finding: GapFinding })`
  - `PulseChart({ finding: PulseFinding, onQuarter?(q) })`
  - `Spark({ kind: 'step'|'bars'|'gauge'|'dots', data, width })`. It renders at measured pixel width, so circles are never stretched.

- [ ] **Step 1:** Write the failing tests:
  - `linear([0,550],[300,0]).ticks(6)` gives `[0,100,200,300,400,500]`.
  - `time` year ticks never exceed `maxLabels`.
  - `charts.spec.ts` on `/__primitives`:
    - focus the StepChart and press End: the tooltip contains `7 Oct 2026` and `+25 bps`;
    - press Home: the first policy-era move appears;
    - with `reducedMotion: 'reduce'`, the record path renders fully on first paint (clip width equals the chart width);
    - `runGuards`.
- [ ] **Step 2:** Implement, then run `npm run test:app && npx playwright test tests/browser/charts.spec.ts`. Expected: PASS.
- [ ] **Step 3:** Commit with `feat(charts): step, cycle, gap, pulse and spark charts`.

### Task 6: Shell, router and country switcher

**Files:**
- Create: `src/app/router.ts`, `src/shell/*`, `src/shell/useSectionSpy.ts`
- Modify: `src/app/App.tsx`
- Test: `tests/browser/shell.spec.ts`

**Interfaces:**
- Produces:
  - `type Route = { kind: 'world' } | { kind: 'country'; cc: string } | { kind: 'decision'; cc: string; date: string } | { kind: 'methodology' } | { kind: 'notFound' }`
  - `parseRoute(pathname: string): Route`. Paths: `/`, `/in/`, `/us/`, `/in/decisions/2026-10-07/`, `/methodology/`. Codes are lower-case in paths and upper-case in data.
  - `navigate(href)` uses the History API. `AppShell` provides the rail, the toolbar with its rolling crumb (spec §6.5 timings) and the country chip.
  - `CountrySwitcher` opens on ⌘K, Ctrl+K or `/`. Arrow keys preview a country (it renders without committing the URL), Enter commits and Esc reverts. It renders as `Sheet` below 720 px.
  - `ThemeToggle` and `PaletteToggle` persist to `localStorage` keys `atlas-theme` and `atlas-palette`, wrapped in try/catch.
  - **Country switch contract (spec §6.5, "A country is data, not identity").**
    - Country is a prop, never a key. No `key={cc}` on the page, cards or charts, so a switch never remounts them.
    - `useSwitchTransaction()` measures rows before the switch, commits every text change on one frame, then FLIPs row heights and in-card blocks.
    - `<Swap value>` animates only when its value changes.
    - Charts use `useMorph(target)` on one shared rAF clock. It tweens sampled series and scales from the geometry on screen, so a switch mid-flight never jumps.
    - Only shapes that differ in kind crossfade.

- [ ] **Step 1:** Write the failing tests in `shell.spec.ts`:
  - `parseRoute` cases, run through the page: visiting `/us/` shows the US heading.
  - ⌘K, ArrowDown, then Esc returns to IN with the URL unchanged.
  - ⌘K, typing "fed", then Enter navigates to `/us/`, and browser Back returns to `/in/`.
  - After scrolling to each section and waiting 450 ms, exactly one `.crumb` is visible and its text matches the section.
  - The palette toggle changes `--hawk` on `<html>` from `#dd4124` to `#c14219`.
  - Switching IN → US (⌘K), IN → BR (peer row) and five rapid ⌘K previews:
    - keeps every card, chart `<svg>` and axis node (same element identity);
    - never drops a card, row or shell element below opacity 1;
    - renders at least 3 distinct record-line paths during the switch;
    - lands exactly on a fresh static render of the target country.
    - The prototype's `design/prototype/check.mjs` "switch smoothness" suite is the reference implementation.
- [ ] **Step 2:** Implement, run the spec, and expect PASS.
- [ ] **Step 3:** Commit with `feat(shell): rail, rolling crumb, router and country switcher`.

### Task 7: Country page, rows A and B (decision, insights, loan)

**Files:**
- Create: `src/pages/CountryPage.tsx`, `src/pages/country/{DecisionCard,InsightTiles,LoanCard,TransmissionCard}.tsx`
- Test: `tests/browser/country-top.spec.ts`

**Interfaces:**
- Consumes: `ReleaseStore`, the findings, `Spark`, the primitives.
- Layout (spec §6.4 and the owner card rules):
  - Row A `cols [7,5]`:
    - `DecisionCard`: kick (authority · instrument), the value as `Num` large, a move pill, the lede in `Prose`, and fact pills.
    - One fact pill is the next decision from `schedule.json`, in the bank's time and, after mount, the viewer's ("Fri 4 Dec, 10:00 IST · 05:30 your time"). The countdown uses `role="timer"` and `aria-live="off"`, updates each minute and on `visibilitychange`, and only state changes are announced.
    - Its footer is a "Record at a glance": a 5-year `Spark` step plus three facts (moves since policy start, range since policy start, days at this level). This makes its height match the tiles honestly.
    - `InsightTiles` is a 2×2 of mini cards, each a button linking to its section.
  - Row B `cols [7,5]`:
    - `LoanCard`, with a segmented "This decision" / "Since I borrowed" and inputs labelled with the currency symbol.
    - Outputs: the payment change, the term alternative, interest over the loan, and the rate.
    - `TransmissionCard` beside it.

- [ ] **Step 1:** Write the failing tests:
  - `runGuards('/in/')` and `runGuards('/us/')`.
  - The IN loan defaults show `+₹794` a month, `₹43,391 to ₹44,186`, `12 more months` and `+₹1,90,650`.
  - Switching to "Since I borrowed" and entering `2024-03-01` shows a net change in the finding sentence.
  - Row A cards' heights are equal (covered by the guard), and the decision card has no direction-tinted background: its computed `background-color` equals `--surface`.
  - The US page lede, value and transmission note mention prime, with the value shown as "3.75 to 4.00%" on one line.
- [ ] **Step 2:** Implement, run the spec, and expect PASS.
- [ ] **Step 3:** Commit with `feat(country): decision card, insight tiles and loan impact`.

### Task 8: Country page, rows C to E (cycle, gap, record, decision day)

**Files:**
- Create: `src/pages/country/{CycleCard,CycleList,GapCard,RecordCard,LedgerCard}.tsx`, `src/pages/country/decisionDay.ts`
- Test: `tests/app/decisionDay.test.ts`, `tests/browser/country-bottom.spec.ts`

**Interfaces:**
- Produces:
  - `decisionDayState(schedule: ScheduleFile, model: CountryModel, now: string): { state: 'scheduled'|'in-session'|'due'|'verifying'|'verified'; meetingId?: string; announceAt?: string }`, per spec §5.
  - Rows:
    - C `cols [8,4]`: CycleCard + CycleList, highlight synced both ways.
    - D `cols [12]`: GapCard.
    - E `cols [8,4]`: RecordCard (StepChart, range segmented, Replay) + LedgerCard (recent decisions, synced with the chart).

- [ ] **Step 1:** Write the failing tests:
  - `decisionDayState`:
    - `due` at announceAt + 5 min with no decision;
    - `verified` once the release has the decision;
    - `in-session` between `meetingStart` and `announceAt`.
  - `due meeting shows pending state, not the stale rate as today`: with a fixture schedule that makes IN due, the decision card reads "5.25% until today's decision is confirmed" and the record shows the hatched pending element.
  - Hovering a cycle row highlights the matching chart line, and the reverse.
  - Hovering a ledger row lights the tenure bar.
  - `runGuards('/in/')` again, now including rows C to E.
- [ ] **Step 2:** Implement, run the tests, and expect PASS.
- [ ] **Step 3:** Commit with `feat(country): cycle, gap, record and decision-day states`.

### Task 9: World page

**Files:**
- Create: `src/pages/WorldPage.tsx`, `src/pages/world/{PulseCard,LatestDecisionsCard,LeagueTableCard}.tsx`
- Test: `tests/browser/world.spec.ts`

**Interfaces:**
- Layout:
  - Row `cols [8,4]`: PulseCard + LatestDecisionsCard (quarter hover highlights matching decisions).
  - Row `cols [12]`: LeagueTableCard.
- The league table:
  - uses `table-layout: fixed` with an explicit `<colgroup>`;
  - right-aligns numeric columns in `Num`, with dates in Inter;
  - sorts by any header (`aria-sort`), animated with `flip`;
  - opens a country when a row is clicked.

- [ ] **Step 1:** Write the failing tests:
  - `runGuards('/')`.
  - Clicking "Rate" toggles `aria-sort`, and the row order matches the sorted rates.
  - Every body cell in a column shares the same left edge, within 1 px, across rows.
  - Hovering the latest pulse quarter highlights the 2026-10-07 RBI entry in the latest-decisions list.
  - Clicking the IN row runs `document.startViewTransition` with `view-transition-name: rate-IN` on both the table cell and the DecisionCard value (spec §6.5, 240 ms), and skips it under reduced motion. Assert the navigation lands on `/in/` and that `view-transition-name` is set on the value.
- [ ] **Step 2:** Implement, run, and expect PASS.
- [ ] **Step 3:** Commit with `feat(world): pulse, latest decisions and league table`.

### Task 10: Decision, methodology and not-found pages

**Files:**
- Create: `src/pages/DecisionPage.tsx`, `src/pages/MethodologyPage.tsx`, `src/pages/NotFound.tsx`
- Test: `tests/browser/pages.spec.ts`

**Interfaces:**
- **DecisionPage** (spec §6.3) shows:
  - the date, level and change;
  - the vote, or "Vote not captured";
  - the statement excerpt as a blockquote with its link;
  - the effective date and the previous and next decisions;
  - "Same week elsewhere";
  - a citation with a copy button.
- **MethodologyPage** covers evidence classes, invariants, eras (including D3) and coverage per country, generated from releases.
- **NotFound** lists the available countries.

- [ ] **Step 1:** Write the failing tests:
  - `runGuards` on `/in/decisions/2026-10-07/` and `/methodology/`.
  - The decision page shows "+25 bps", "5.50%" and a link to `rbi.org.in`.
  - An unknown decision date gives NotFound with the IN and US links.
- [ ] **Step 2:** Implement, run, and expect PASS.
- [ ] **Step 3:** Commit with `feat(pages): decision, methodology and not-found pages`.

### Task 11: Static API, prerender, SEO and hydration

**Files:**
- Create: `scripts/build-api.ts`, `scripts/prerender.ts`, `src/prerender.tsx`, `public/robots.txt`
- Modify: the `package.json` `build` script becomes `node scripts/build-api.ts && vite build && vite build --ssr src/prerender.tsx --outDir dist-ssr && node scripts/prerender.ts && node scripts/check-bundle.ts`
- Test: `tests/app/build-api.test.ts`, `tests/browser/prerender.spec.ts`

**Interfaces:**
- `build-api.ts` writes into `public/api/v1/`:
  - `countries.json`, `latest.json`, `schedule.json`;
  - `countries/{cc}.json`, `countries/{cc}/decisions.csv` (cells starting `= + - @` are prefixed with `'`);
  - `releases/{cc}/{hash}.json`.

  It fails the build if `dist/` would exceed 19,000 files (Cloudflare free plan cap 20,000). It also writes `public/_redirects` with one 301 per v1 decision id (`/decision/<v1-id> /in/decisions/<date>/ 301`), plus `/countries / 301`, `/country/us /us/ 301` and `/limitations /methodology/ 301`.
- `prerender.ts` renders every route (`/`, each country, each decision page, `/methodology/`, `/as-of/`) into `dist/<route>/index.html`. Each page gets:
  - a `<title>` per spec §6.8, e.g. `RBI repo rate: 5.50%, raised 7 Oct 2026 · Policy Rate Atlas`;
  - a meta description, canonical, OG and Twitter tags;
  - `Dataset` JSON-LD on country pages, with `<` escaped;
  - `atlas-state` embedded JSON.

  `/` and `/as-of/` carry the inline legacy-redirect script for `?country=` and `?date=`. It also writes `dist/sitemap.xml`.

- [ ] **Step 1:** Write the failing tests:
  - A CSV cell `=HYPERLINK(...)` is written as `'=HYPERLINK(...)`.
  - `_redirects` contains `/decision/decision-2026-08-05-9da8f60a /in/decisions/2026-08-05/ 301`.
  - `dist/in/index.html` contains the exact title above and no relative-time strings (regex `/\b(ago|in \d+ (days|hours))\b/`).
  - `prerendered page hydrates without console errors when the clock is 3 days after build`: Playwright `clock.install` at build + 3 days, and the console has no errors or hydration warnings.
  - `/?country=US` lands on `/us/`.
- [ ] **Step 2:** Implement, then run `npm run build && npm run test:app && npx playwright test tests/browser/prerender.spec.ts`. Expected: PASS, and `check-bundle` reports main JS ≤ 90 KB and CSS ≤ 25 KB gzip.
- [ ] **Step 3:** Commit with `feat(build): static API, prerendered routes, SEO and legacy redirects`.

### Task 12: Hosting, CI and cutover

**Files:**
- Create: `wrangler.jsonc`, `public/_headers`
- Modify: `.github/workflows/refresh.yml`. Add a job `verify-live` (needs `publish`, sleeps 300 s, `curl`s `https://rates.ashwingopalsamy.in/api/v1/latest.json`, compares each country's `release` with `data/manifest.json`, and on a mismatch runs `node pipeline/issues.ts --deploy-mismatch`; add that flag to `issues.ts`, opening or updating the issue titled `Pipeline: live site behind manifest`).
- Modify: `.github/workflows/validate.yml`. The app job runs `typecheck`, `test:app`, `build` and Playwright (all specs, chromium) against `vite preview`, with actions pinned to SHAs. Later, `vercel.json` becomes the redirect-only file.

**Interfaces:**
- `wrangler.jsonc`:
  - `name: "policy-rate-atlas"`, `compatibility_date` set to the execution date;
  - `assets: { directory: "./dist", not_found_handling: "404-page" }`;
  - `routes: [{ pattern: "rates.ashwingopalsamy.in", custom_domain: true }]`;
  - `workers_dev: false`, `preview_urls: false`;
  - no `main` (assets only until Phase 4).
- `_headers`, with `! Cache-Control` first in each block:
  - `/assets/*` and `/api/v1/releases/*`: `public, max-age=31536000, immutable`;
  - `/*` and `/api/v1/*`: `public, max-age=0, must-revalidate`;
  - `/api/*`: `Access-Control-Allow-Origin: *`.
- `vercel.json` after cutover: `{ "redirects": [{ "source": "/(.*)", "destination": "https://rates.ashwingopalsamy.in/$1", "statusCode": 301 }] }`.

- [ ] **Step 1:** Write `wrangler.jsonc`, `_headers` and the CI job. Run `npx wrangler deploy --dry-run`. Expected: it validates without errors.
- [ ] **Step 2:** Owner actions, which need the owner's Cloudflare and Vercel accounts:
  1. In Cloudflare, Workers & Pages → Create → Import repository. Build command `npm ci && npm run build`, deploy command `npx wrangler deploy`, environment variable `NODE_VERSION=24`, production branch `main`.
  2. Confirm `rates.ashwingopalsamy.in` attaches as a custom domain.
  3. After the merge to `main` is live, in Vercel: Project → Settings → Git → Disconnect, then deploy the redirect-only `vercel.json` once with `vercel --prod`.
- [ ] **Step 3:** Cutover verification:
  - `curl -sI https://rates.ashwingopalsamy.in/in/` returns 200 with `cache-control: public, max-age=0, must-revalidate`;
  - `curl -sI https://reporatevisualizer.vercel.app/?country=US` returns 301 to the new domain;
  - a Lighthouse mobile run on `/in/` scores ≥ 95 for performance and accessibility.
- [ ] **Step 4:** Commit with `ci,deploy: Cloudflare static hosting and v2 validation`. Open the PR `v2-experience → main` for the owner to review and merge. Do not merge without the owner.

---

## Done when

- All seven countries render through one shell, on desktop and in the phone shell.
- Switching countries passes the switch-smoothness suite, and analytics passes its privacy tests.
- Every guard passes at 360, 768, 1280 and 1440 px in both themes.
- Findings match the pinned values.
- Decision-day states pass on fixtures.
- Budgets and Lighthouse targets are met.
- The site is live on `rates.ashwingopalsamy.in`, with v1 URLs redirecting.
