# RBI Repo Rate Visualizer — Luna execution handoff

Status: Chunk 7 complete; production host gate unverified

## Product purpose and audience

The RBI Repo Rate Visualizer is a static, source-led public reference for understanding how the Reserve Bank of India’s policy repo rate has changed over time. It should answer the current-data question first, then support historical and recent-policy exploration through a trustworthy timeline, decision ledger, source record, and exportable data.

Primary audiences are journalists, researchers, students, analysts, developers, and curious members of the public who need a clear answer to “what is the repo rate now?” and an evidence-backed way to understand the decisions behind the rate history.

## Non-negotiables

- Current-data reference comes first; historical and recent-policy exploration comes second.
- Every official RBI decision represented by the product is source-backed, including holds where the policy rate did not change.
- The product distinguishes the latest official decision, latest source publication, and last successful automated check.
- The visualizer is static at runtime. It must not make client-side live RBI requests.
- The ingestion pipeline fails closed when RBI is unavailable or parsing is uncertain.
- Calendar-month decisions must never be invented. Only official RBI decisions are represented.
- Raw snapshots are retained until migration and verification are complete.
- CI refreshes verified data on a schedule and by manual dispatch, then publishes through the existing host from `main`.
- React, Vite, and D3 remain the application stack.
- Existing routes, deep links, share actions, themes, accessibility behavior, and exports remain usable during the overhaul.
- The existing `LICENSE` deletion and `src/styles/mobile.css` modification are user work and must be preserved.

## Anti-goals

- Do not present retrieval time as the date of a policy decision.
- Do not imply that a static build is live or browser-connected to RBI.
- Do not fill flat periods with fabricated monthly observations.
- Do not replace official source references with a generic homepage link when a precise source exists.
- Do not introduce a second framework, a new hosted data service, or a runtime database.
- Do not use decorative glassmorphism, blur, gradients, fake live pulses, or load-stagger animation as the primary visual language.
- Do not make a destructive cleanup of historical snapshots or unrelated working-tree changes.

## Current defects and baseline

The repository baseline was inspected on 2026-08-14.

Known working-tree changes that must remain intact:

```text
 D LICENSE
 M src/styles/mobile.css
```

The current application has these known defects or limitations:

- `src/main.jsx` chooses either the desktop or mobile React tree once using `window.innerWidth`, so resizing after load can leave the wrong layout mounted and the product contains duplicated application shells.
- The incumbent visual system relies heavily on glass surfaces, blur, gradients, rounded controls, large shadows, pulses, and load-stagger motion. It does not yet provide a calm policy-register/chartbook presentation.
- The current hero uses the browser’s current date for a snapshot label and treats the fetched date as a policy-action date. It does not separate current rate, latest official decision, latest source publication, and last successful automated check.
- `src/data/snapshot.json` stores rate changes but has no canonical decision record, so unchanged official decisions such as holds cannot be represented.
- The current data snapshot has `snapshot_id` `2026-08-12-v1`, `fetched_at` `2026-08-12T07:27:15.395Z`, and a latest rate record dated `2025-12-05`. That is a documented freshness mismatch against the 2026-08-14 repository baseline, not evidence of a current 2026 policy decision.
- The updater in `scripts/fetch-rbi-data.js` is a timestamp-only placeholder. It does not fetch, parse, checksum, or verify RBI sources.
- Source provenance is snapshot-level rather than attached to every decision, and exports do not include complete decision/source provenance.
- The timeline shows rate points and macro events but has no marker for every official policy decision, especially holds during flat periods.
- The mobile implementation uses a separate component tree and constrained shell flow; it is not yet one coherent responsive experience.
- The production build passes but emits an esbuild CSS syntax warning caused by an orphaned declaration around `src/styles/base.css:954`.
- The current update workflow schedules and manually dispatches the placeholder updater but does not validate the generated data or build before pushing.

Baseline command:

```text
npm run build
```

Baseline result: passed on 2026-08-14; 617 modules transformed and the production bundle was emitted. Known warning: esbuild reported `Expected identifier but found whitespace` and `Unexpected "var("` for the orphaned `font-size: var(--text-3xl)` declaration in the generated CSS. This warning is intentionally deferred to Chunk 3.

## Execution rules for Luna

- Execute one chunk at a time.
- Inspect `git status` before every chunk.
- Do not start the next chunk until the previous acceptance checks pass.
- Preserve the existing `LICENSE` deletion and `src/styles/mobile.css` modification unless explicitly requested otherwise.
- Keep raw snapshots until the new data migration is verified.
- No client-side live RBI requests.
- Never invent calendar-month decisions; only represent official RBI decisions.
- After each chunk, report changed files, commands run, failures, and remaining risks.

## Chunks

### Chunk 0 — Safety baseline and product record

Goal: establish the handoff and protect existing work.

Tasks:

- Add `IMPLEMENTATION_PLAN.md`.
- Add `PRODUCT.md` containing the confirmed product truth.
- Record the current build warning and current data freshness mismatch.
- Run and record the baseline build.
- Do not redesign UI or change data yet.

Acceptance checks:

- `IMPLEMENTATION_PLAN.md` and `PRODUCT.md` exist.
- The `LICENSE` deletion and `src/styles/mobile.css` modification remain intact.
- Baseline behavior, warning, and freshness mismatch are documented.
- No unrelated files are changed.

### Chunk 1 — Canonical data contract and migration

Goal: separate policy decisions from rate changes.

Tasks:

- Introduce `SnapshotV2` with `meta`, `current`, `sources`, `decisions`, `rateSeries`, `events`, and `regimes`.
- Make `decisions[]` the canonical record.
- Represent each decision with date, repo rate, action, change in bps, optional stance/summary, and source IDs.
- Derive the step-line and rate-change view from decisions.
- Migrate existing historical rate data without deleting old snapshots.
- Add Node-based data tests using the built-in `node:test` module.

Acceptance checks:

- Existing historical rate values are preserved.
- Hold decisions are representable.
- Duplicate IDs, invalid dates, missing rates, and unsorted records fail validation.
- The application builds against the migrated data.

### Chunk 2 — Real RBI ingestion and verification

Goal: replace the timestamp-only updater with a truthful source pipeline.

Tasks:

- Replace the no-op behavior in [`scripts/fetch-rbi-data.js`](./scripts/fetch-rbi-data.js).
- Add source adapters for RBI current policy rates, RBI DBIE historical Key Rates, and RBI policy statements, resolutions, and minutes.
- Store exact source title, URL, publication date, retrieval time, and checksum.
- Add parser fixtures for representative RBI pages/documents.
- Run the update daily and through manual dispatch.
- Commit only when source content changes, not merely because retrieval time changes.
- Run data validation and build before pushing.
- Fail without committing when RBI is unavailable or parsing is uncertain.

Acceptance checks:

- The generated snapshot contains source-backed decision records, including holds.
- `latestOfficialDate` is distinct from `retrievedAt`.
- Every decision has a usable source reference.
- Failed fetches leave the previous valid snapshot untouched.
- The existing host can rebuild after a verified `main` push.

### Chunk 3 — Shared responsive shell and new visual system

Goal: remove the outdated glassmorphism and duplicated mobile implementation.

Tasks:

- Render one shared React application tree.
- Remove the one-time `window.innerWidth` desktop/mobile selection.
- Rebuild the layout around a flat policy-register/chartbook system with neutral surfaces, strong typographic hierarchy, ruled divisions, and restrained semantic cut/hike/hold colors.
- Remove blur, gradients, fake live pulses, and load-stagger animation from the primary experience.
- Fix the orphaned CSS declaration around `src/styles/base.css:954`.
- Preserve light/dark themes, deep links, share actions, and exports.
- Make mobile use normal page flow with a compact bottom navigation.

Acceptance checks:

- No horizontal overflow at desktop, tablet, or mobile widths.
- Resizing after load does not leave the wrong layout mounted.
- Theme, focus states, and reduced-motion behavior work.
- The production build has no CSS warnings.

### Chunk 4 — Current overview and recent policy ledger

Goal: make the latest information obvious and trustworthy.

Tasks:

- Replace the current hero with current repo rate, effective date, latest official decision, action and bps change, current stance when reported, latest source link, and last successful automated check.
- Show “latest official decision,” “latest source published,” and “last checked” separately.
- Add a recent decision ledger showing source-backed decisions even when the rate remains unchanged.
- Remove misleading “live” language when the site is static.

Acceptance checks:

- A visitor can identify the current rate and latest decision immediately.
- A long hold period still shows multiple decision rows.
- No freshness label is derived from the current browser date alone.
- Each recent record links to its source.

### Chunk 5 — Decision-aware timeline

Goal: make the chart tell the complete policy story.

Tasks:

- Keep the step-line for the effective repo rate.
- Add a marker for every official decision: cut, hike, or hold.
- Keep macro events and regime bands as separate optional layers.
- Add accessible focusable markers and a non-hover decision list.
- Improve dense-label collision handling and touch selection.
- Ensure date ranges and URL state continue to work.

Acceptance checks:

- Marker count matches the filtered decision count.
- Holds are visible during flat periods such as 2023–2025.
- Keyboard and screen-reader users can access every decision.
- Mobile chart interaction remains usable without hover.

### Chunk 6 — Secondary views, sources, and exports

Goal: preserve useful analysis while making it evidence-led.

Tasks:

- Reframe rate-change analysis as a derived view.
- Rebuild cycle comparison from the canonical decision/rate series.
- Add a source-transparency surface showing source type, publication date, retrieval date, checksum, and linked decisions.
- Update CSV export to include all decisions, holds, action, stance, source title, and source URL.
- Keep SVG export and permalink sharing.

Acceptance checks:

- Exported data contains source provenance.
- Analysis views remain consistent with the main chart.
- Source records are discoverable without inspecting the repository.

### Chunk 7 — Final quality gate and production verification

Goal: prove the complete system before handoff.

Tasks:

- Add focused browser checks for the current overview, decision markers, source links, date ranges, exports, mobile navigation, theme, and reduced motion.
- Run data tests, build, `git diff --check`, accessibility checks, and the Impeccable detector once on changed UI targets.
- Verify the existing host displays the newly committed snapshot.
- If the host URL or deployment connection cannot be verified, report that gate as unverified rather than claiming production success.

Acceptance checks:

- All focused checks pass or have an explicitly documented, non-blocking limitation.
- The final working tree preserves unrelated user changes.
- Production verification is evidenced, or the unavailable host/deployment gate is explicitly marked unverified.

## Official RBI sources

- [RBI historical-data guidance](https://www.rbi.org.in/Scripts/bs_viewcontent.aspx?Id=624)
- [RBI Bulletin](https://bulletin.rbi.org.in/)
- [RBI policy archive](https://www.rbi.org.in/scripts/Annualpolicy.aspx)

## Final definition of done

- The site shows the newest verified RBI source separately from the last policy decision.
- Every official decision, including unchanged decisions, appears in the ledger and chart.
- CI refreshes and publishes verified snapshots automatically.
- Desktop and mobile are one coherent responsive experience.
- Builds are warning-free and exports include provenance.
- No unrelated user changes are lost.
