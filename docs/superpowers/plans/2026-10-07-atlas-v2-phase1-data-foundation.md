# Policy Rate Atlas v2, Phase 1: Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish verified, content-addressed schema v3 releases for India and the United States, refreshed at each central bank's announcement time by a $0 Cloudflare-dispatched GitHub Actions pipeline.

**Architecture:**
- One TypeScript schema (zod) defines the v3 release and its invariants, and every producer and consumer imports it.
- Country adapters are pure parsers over fetched official sources. `run.ts` builds candidate releases per country.
- `publish.ts` merges candidates into `data/`, which holds immutable releases plus a manifest, a schedule and health.
- A free Cloudflare Worker cron reads `data/schedule.json` from GitHub and dispatches `refresh.yml` only when a decision is due.
- India keeps its existing v2 fetcher and Hugging Face build. A deterministic projector maps v2 to v3.

**Tech Stack:**
- Node 24 runs TypeScript directly through type stripping, so there is no build step.
- zod 4 for the schema, `node:test` for tests, `tsc --noEmit` for type checks.
- Cloudflare Workers (cron) and wrangler 4.
- GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-07-policy-rate-atlas-v2-design.md` (§2 countries, §3 data model, §4 pipeline, §5 decision-day state, §9 security, §12 decisions D1–D3).

## Global Constraints

- **Node and TypeScript files.**
  - Node `24` is pinned in `.node-version`; CI uses `actions/setup-node` with `node-version-file: .node-version`.
  - TypeScript under `schema/`, `pipeline/` and `worker/` must be erasable syntax only: no `enum`, no parameter properties, no `namespace`.
  - Imports include the `.ts` extension. `tsconfig.json` sets `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `strict` and `noEmit`.
- **Dependencies** are pinned exactly (`npm i -E`). New runtime dependency: `zod` only. New dev dependencies: `typescript`, `wrangler`, `@cloudflare/workers-types`.
- **Rates** are integer basis points everywhere. A range always has `lowBps < highBps`. Midpoints are never stored or shown.
- **Dates** are plain `YYYY-MM-DD` strings. Instants are zoned ISO strings with an offset (e.g. `2026-10-07T10:00:00+05:30`).
- **Never touch existing v2 India files.** `public/data/snapshots/*`, existing `public/data/manifest.json` entries and `hf-dataset/` history change only through the existing RBI fetcher appending new releases.
- **Content addressing.** `release.hash` is the SHA-256 of canonical JSON with the top-level `release` key removed. Releases are written once to `data/releases/<cc>/<hash>.json` and never rewritten.
- **Fetching.**
  - Every fetch sends the user-agent `PolicyRateAtlas/2.0 (+https://github.com/ashwingopalsamy/repo-rate-visualizer)`. RBA's firewall rejects anonymous agents.
  - Parsers fail closed: unexpected markup throws `SourceParseError`, never returns partial data.
- **Copy.** No en or em dashes in any string that reaches the UI.
- **Test runs.** Tests are deliverables of this plan (approved in the spec). Under AGENTS.md, an executor runs them locally only if the owner says so at execution time; CI always runs them.
- **Commits.** Small, Conventional Commits style, no attribution lines. Push only when the owner asks.

## Review Focus

1. **An official series that lags the announcement.**
   - *Expected behaviour:* the meeting stays `pending`; it is never recorded as `unchanged`.
   - *Covered by:* Task 6 test `resolveMeetings keeps a meeting pending while the series lags`.
2. **A statement page that exists but cannot be parsed** (for example a redesigned Fed page).
   - *Expected behaviour:* that country's leg fails, every other country still publishes, and the last good release stays live.
   - *Covered by:* Task 6 test `run marks the country failed and writes no candidate`, plus Task 8 test `publish merges only the legs that succeeded`.
3. **A re-run with no source change.**
   - *Expected behaviour:* identical bytes, no commit.
   - *Covered by:* Task 7 test `publish is a no-op when the candidate hash equals the manifest`.
4. **A new release that silently drops or edits history.**
   - *Expected behaviour:* validation rejects it.
   - *Covered by:* Task 2 test `validateRelease rejects a release that rewrites an earlier decision`.
5. **Clock edge cases.**
   - *Expected behaviour:* the dispatcher fires once per ladder step, including across a DST change and with a meeting exactly on a tick boundary.
   - *Covered by:* Task 9 tests `dueDispatches fires once per ladder rung` and `dueDispatches handles a DST transition`.

---

## File Structure

```
.node-version                         24
tsconfig.json                         pipeline/schema/worker type checking (noEmit)
schema/level.ts                       Level schema + helpers
schema/release.ts                     CountryRelease and nested schemas (zod) + exported TS types
schema/invariants.ts                  validateRelease(next, previous?) -> Issue[]
schema/hash.ts                        canonicalJson, releaseHash
schema/files.ts                       Manifest, ScheduleFile, HealthFile (shared with the app)
schema/index.ts                       re-exports
pipeline/lib/http.ts                  fetchText with UA, timeout, retries
pipeline/lib/errors.ts                SourceParseError
pipeline/lib/time.ts                  plain-date and zoned-instant helpers
pipeline/countries/registry.ts        static CountryProfile per code (IN, US now)
pipeline/countries/in/eras.ts         India eras (D3)
pipeline/countries/in/project.ts      projectIndia(v2, ctx) -> CountryRelease
pipeline/countries/in/backfill.json   curated official MPC resolution URLs since 2016-10-04 (D2)
pipeline/countries/in/backfill.ts     one-off additive backfill through the existing v2 fetcher
pipeline/countries/in/adapter.ts      runIndia(ctx) -> CountryResult
pipeline/countries/us/series.ts       FRED CSV -> SeriesPoint[]
pipeline/countries/us/statement.ts    FOMC statement HTML -> Decision
pipeline/countries/us/adapter.ts      runUs(ctx) -> CountryResult
pipeline/calendars/in.json            MPC meetings with announceAt
pipeline/calendars/us.json            FOMC meetings with announceAt
pipeline/transmission/in.json         sourced transmission notes
pipeline/transmission/us.json
pipeline/resolve.ts                   resolveMeetings(...) -> MeetingStatus[]
pipeline/run.ts                       CLI: build candidates into .out/<cc>/
pipeline/publish.ts                   CLI: merge .out into data/
pipeline/schedule.ts                  buildSchedule(...) -> ScheduleFile
pipeline/issues.ts                    CLI: sync GitHub issues from .out statuses
data/manifest.json                    { schemaVersion: 1, countries: {...} }
data/schedule.json, data/health.json
data/releases/<cc>/<hash>.json
worker/dispatch/plan.ts               dueDispatches(schedule, now) (pure)
worker/dispatch/index.ts              scheduled handler
worker/dispatch/wrangler.jsonc
.github/workflows/refresh.yml         dispatched refresh + weekly backstop
.github/workflows/validate.yml        replaces validate-app.yml and validate-data.yml
tests/pipeline/*.test.ts              node:test suites
tests/fixtures/us/                    recorded FRED CSV + FOMC statements
```

`.github/workflows/update-data.yml` is deleted in Task 8; `refresh.yml` takes over India.

---

### Task 1: Toolchain for TypeScript pipeline code

**Files:**
- Create: `.node-version`, `tsconfig.json`, `pipeline/lib/errors.ts`, `pipeline/lib/http.ts`, `pipeline/lib/time.ts`
- Modify: `package.json` (deps, scripts), `.gitignore` (add `.out/`)
- Test: `tests/pipeline/time.test.ts`, `tests/pipeline/http.test.ts`

**Interfaces:**
- Produces:
  - `class SourceParseError extends Error`
  - `fetchText(url: string, opts?: { timeoutMs?: number; retries?: number; fetchImpl?: typeof fetch }): Promise<{ body: string; url: string; status: number; contentType: string; fetchedAt: string }>`, default timeout 20000 ms and 2 retries on network or 5xx errors only.
  - `plainDate(iso: string): string`
  - `zonedInstant(date: string, time: 'HH:MM', timeZone: string): string`, returning ISO with the correct offset for that date, DST included.
  - `minutesBetween(aIso: string, bIso: string): number`
- New scripts in `package.json`:
  - `"typecheck": "tsc -p tsconfig.json"`
  - `"test:pipeline": "node --test \"tests/pipeline/**/*.test.ts\""`
  - `"validate:data": "node pipeline/publish.ts --check"`

- [ ] **Step 1:** Run `npm i -E zod@4` and `npm i -D -E typescript@latest wrangler@4 @cloudflare/workers-types@latest`. Write `.node-version` containing `24`. Write `tsconfig.json` with the flags in Global Constraints, `"module": "nodenext"`, `"target": "es2023"`, `"types": ["node"]` and `include` set to `["schema","pipeline","worker","tests/pipeline"]`. Add `@types/node` pinned if `tsc` needs it.
- [ ] **Step 2:** Write the failing tests in `tests/pipeline/time.test.ts`:
  - `zonedInstant('2026-10-07','10:00','Asia/Kolkata') === '2026-10-07T10:00:00+05:30'`
  - `zonedInstant('2026-03-18','14:00','America/New_York') === '2026-03-18T14:00:00-04:00'` (EDT)
  - `zonedInstant('2026-01-28','14:00','America/New_York') === '2026-01-28T14:00:00-05:00'`
  - `minutesBetween('2026-10-07T10:00:00+05:30','2026-10-07T04:40:00Z') === 10`
- [ ] **Step 3:** Write the failing tests in `tests/pipeline/http.test.ts`, using an injected `fetchImpl`:
  - The request carries the exact user-agent from Global Constraints.
  - A 503 then a 200 resolves with the 200 body.
  - A 404 rejects immediately, without retrying.
- [ ] **Step 4:** Run `npm run test:pipeline`. Expected: the new tests fail with module-not-found errors.
- [ ] **Step 5:** Implement the three `pipeline/lib` modules. `zonedInstant` derives the offset with `Intl.DateTimeFormat(..., { timeZone, timeZoneName: 'longOffset' })`.
- [ ] **Step 6:** Run `npm run test:pipeline && npm run typecheck`. Expected: PASS, with 0 type errors.
- [ ] **Step 7:** Commit with `chore(pipeline): add TypeScript toolchain and fetch/time helpers`.

### Task 2: Schema v3, canonical hashing and invariants

**Files:**
- Create: `schema/level.ts`, `schema/release.ts`, `schema/hash.ts`, `schema/invariants.ts`, `schema/index.ts`
- Test: `tests/pipeline/schema.test.ts`, `tests/pipeline/invariants.test.ts`

**Interfaces:**
- Produces, in `schema/release.ts`: zod schemas and inferred types with exactly the fields in spec §3 (including `Era.basis` and `SeriesPoint.evidence`):
  - `LevelSchema`, `EraSchema`, `MeetingSchema`, `DecisionSchema`, `SeriesPointSchema`, `TransmissionSchema`, `SourceSchema`, `ContextEventSchema`, `CountryReleaseSchema`.
  - `Source` is `{ id, type, title, url, official: boolean, publishedAt: string|null, retrievedAt: string|null, sha256: string|null }`.
  - `CountryRelease` also has `corrections: { recordId: string; reason: string; sourceId: string }[]`, default `[]`.
- Produces, in `schema/level.ts`:
  - `upperBps(l: Level): number|null` (point → bps, range → highBps, none → null)
  - `sameLevel(a: Level, b: Level): boolean`
  - `formatLevel(l: Level): string` (`"5.50%"`, `"3.75 to 4.00%"`, or the label of a `none` level)
- Produces, in `schema/hash.ts`:
  - `canonicalJson(v: unknown): string` (keys sorted recursively, no whitespace)
  - `releaseHash(r: CountryRelease): string` (hex SHA-256 of `canonicalJson` without `release`)
- Produces, in `schema/invariants.ts`:
  - `type Issue = { code: string; path: string; message: string }`
  - `validateRelease(next: CountryRelease, previous?: CountryRelease, allowlist?: string[]): Issue[]`

- [ ] **Step 1:** Write the failing tests in `schema.test.ts`:
  - A valid minimal release parses.
  - A range with `lowBps >= highBps` fails.
  - A fractional bps value fails.
  - `releaseHash` is stable under key reordering.
  - `releaseHash` ignores changes inside `release`.
  - `formatLevel({kind:'range',lowBps:375,highBps:400}) === '3.75 to 4.00%'`.
- [ ] **Step 2:** Write the failing tests in `invariants.test.ts`. Each fixture is built inline. Each test asserts that the returned `Issue[]` contains the named `code`:

  | Test | Expected issue code |
  |---|---|
  | `series not strictly ascending` | `series-order` |
  | `decision changeBps disagrees with levels in the same era` | `change-mismatch` |
  | `changeBps must be null across an era boundary` | `era-change-bps` |
  | `hold without a statement` | `hold-evidence` |
  | `held meeting after ledgerFrom without exactly one decision` | `ledger-gap` |
  | `cancelled meeting with a decision` | `cancelled-decision` |
  | `decision level differs from series after its effective date` | `series-disagrees` |
  | `unknown sourceId` | `source-missing` |
  | `official source off the allowlist` | `source-domain` |
  | `source url containing a query key named key, apikey or token` | `source-secret` |
  | `validateRelease rejects a release that rewrites an earlier decision` (previous passed; no matching correction) | `history-rewrite` |
  | `release passes when the only difference is an appended decision` | `[]` |

- [ ] **Step 3:** Run `npm run test:pipeline`. Expected: the new tests fail.
- [ ] **Step 4:** Implement the five schema files. `validateRelease` first runs `CountryReleaseSchema.safeParse` and maps zod errors to `{ code: 'shape' }`, then runs the cross-record checks listed in Step 2.
- [ ] **Step 5:** Run `npm run test:pipeline && npm run typecheck`. Expected: PASS.
- [ ] **Step 6:** Commit with `feat(schema): add v3 release schema, hashing and invariants`.

### Task 3: Country registry, calendars and transmission data for IN and US

**Files:**
- Create: `pipeline/countries/registry.ts`, `pipeline/calendars/in.json`, `pipeline/calendars/us.json`, `pipeline/transmission/in.json`, `pipeline/transmission/us.json`
- Test: `tests/pipeline/registry.test.ts`

**Interfaces:**
- Produces:
  - `type CountryProfile = { code: 'IN'|'US'; name; currency; locale; timeZone; authority: { name; short; body; bodyShort; url }; instrument: { name; short; explainer }; allowlist: string[]; effectiveLagDays: number; announceTime: 'HH:MM' }`
  - `COUNTRIES: Record<string, CountryProfile>`
  - `loadCalendar(code): Meeting[]` (reads JSON and computes `announceAt` via `zonedInstant` when the entry has only `date`)
  - `loadTransmission(code): Transmission[]`
- Values:

  | Field | IN | US |
  |---|---|---|
  | `timeZone` | `Asia/Kolkata` | `America/New_York` |
  | `announceTime` | `10:00` | `14:00` |
  | `effectiveLagDays` | 0 | 1 |
  | `allowlist` | `rbi.org.in`, `rbidocs.rbi.org.in`, `website.rbi.org.in` | `federalreserve.gov`, `fred.stlouisfed.org` |
  | `locale` | `en-IN` | `en-US` |
  | `currency` | `INR` | `USD` |

- [ ] **Step 1:** Transcribe the calendars by hand. Each entry is `{ id, date, meetingStart, status, sourceId }`.
  - **`in.json`:** every MPC meeting from `2016-10-04` (backfill list, Task 5) through FY2026-27. Take the Dec 2026 and Feb 2027 dates from RBI's published 2026-27 MPC schedule press release and record its URL as source `in-mpc-schedule-2026-27`.
  - **`us.json`:** every FOMC meeting from 2021-01-27 through 2027 from `https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm`.
- [ ] **Step 2:** Write the transmission entries in the spec §3 `Transmission` shape. Each source must be an official page; record the URL.
  - **IN:** floating-rate home loans on an external benchmark, reset at least every 3 months, `adjusts: 'both'`, `passThrough: 'direct'`. Source: the RBI circular on external benchmark based lending (2019).
  - **US:** a credit line linked to prime, where prime is the upper bound plus 300 bps, `adjusts: 'payment'`, `passThrough: 'direct'`. Source: FRED `DPRIME`. A second entry covers 30-year fixed mortgages with `passThrough: 'none'`.
- [ ] **Step 3:** Write the failing tests in `registry.test.ts`:
  - Every calendar entry has a unique `id` of the form `${cc}-${date}`.
  - `loadCalendar('US')` gives `2026-09-16` an `announceAt` of `2026-09-16T14:00:00-04:00`.
  - Every calendar `sourceId` and every transmission `sourceId` matches a URL on the country allowlist.
  - Each country has at least two future meetings after `2026-10-07`.
- [ ] **Step 4:** Implement `registry.ts`. Run `npm run test:pipeline`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(pipeline): add IN and US profiles, calendars and transmission notes`.

### Task 4: United States adapters (FRED series and FOMC statements)

**Files:**
- Create: `pipeline/countries/us/series.ts`, `pipeline/countries/us/statement.ts`, `pipeline/countries/us/adapter.ts`, `tests/fixtures/us/DFEDTAR.csv`, `DFEDTARU.csv`, `DFEDTARL.csv`, `monetary20260916a.htm`, `monetary20251210a.htm`, `monetary20250618a.htm`
- Test: `tests/pipeline/us.test.ts`

**Interfaces:**
- Consumes: `fetchText`, `SourceParseError`, `COUNTRIES.US`, `loadCalendar`, and the schema types.
- Produces:
  - `parseFredCsv(csv: string, seriesId: string): { date: string; bps: number }[]`
  - `buildUsSeries(point: Obs[], upper: Obs[], lower: Obs[]): SeriesPoint[]`, change points only. Point levels run to `2008-12-15`; range levels start `2008-12-16`; `evidence: 'official'`.
  - `parseFomcStatement(html: string, meeting: Meeting): Decision`, with the target range, direction, vote and a ≤ 1-sentence excerpt.
  - `runUs(ctx: RunContext): Promise<CountryResult>`
- Shared types, defined here and used by Tasks 5 and 6:
  - `type RunContext = { now: string; fetchImpl?: typeof fetch; previous?: CountryRelease }`
  - `type CountryResult = { release: CountryRelease; statuses: MeetingStatus[] }`
  - `type MeetingStatus = { meetingId: string; state: 'verified'|'pending'|'failed'; detail?: string }`
- Sources:
  - FRED: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<ID>` (keyless).
  - Statements: `https://www.federalreserve.gov/newsevents/pressreleases/monetary<YYYYMMDD>a.htm`.

- [ ] **Step 1:** Record the fixtures with `curl` and the pipeline user-agent. Pick statements that cover a hike (2026-09-16), a hold with a dissent and a cut, choosing the dates from the calendar.
- [ ] **Step 2:** Write the failing tests:
  - `parseFredCsv` skips `.` and empty values and converts `4.00` to `400`.
  - `buildUsSeries`:
    - the 2008-12-16 point is a range `{0,25}`;
    - the last point is `{375,400}` dated `2026-09-17`;
    - no midpoint values appear anywhere.
  - `parseFomcStatement` (2026-09-16 fixture) returns:
    - `level {kind:'range',lowBps:375,highBps:400}`, `direction 'hike'`, `changeBps 25`;
    - `vote.for` equal to the count of names in the "Voting for" sentence;
    - `announcedAt '2026-09-16T14:00:00-04:00'`;
    - `effectiveDate '2026-09-17'`.
  - Mixed fractions parse: `"5-1/4 to 5-1/2 percent"` gives `{525,550}`.
  - A statement with the target-range sentence removed throws `SourceParseError`.
  - `runUs` with an injected `fetchImpl` serving the fixtures produces a release where `validateRelease(...)` is `[]`.
- [ ] **Step 3:** Run the tests. Expected: FAIL.
- [ ] **Step 4:** Implement the three modules.
  - `runUs` fetches the three FRED series, then fetches each `held` calendar meeting from `ledgerFrom` (`2021-01-27`) up to `now` that has no decision in `ctx.previous`.
  - It reuses previous decisions instead of refetching history.
  - It sets `release.generator = 'pipeline/countries/us'`.
- [ ] **Step 5:** Run `npm run test:pipeline && npm run typecheck`. Expected: PASS.
- [ ] **Step 6:** Commit with `feat(pipeline): add US FRED series and FOMC statement adapters`.

### Task 5: India projector, eras and MPC backfill (D2, D3)

**Files:**
- Create: `pipeline/countries/in/eras.ts`, `pipeline/countries/in/project.ts`, `pipeline/countries/in/backfill.json`, `pipeline/countries/in/backfill.ts`, `pipeline/countries/in/adapter.ts`
- Modify: `scripts/fetch-rbi-data.js`. Add an optional `extraEntries` argument to `runUpdate`, so the backfill can feed curated resolution entries through the existing, tested merge. Existing behaviour stays unchanged when the argument is absent.
- Test: `tests/pipeline/india.test.ts`. Existing `tests/data/*.test.js` must still pass.

**Interfaces:**
- Consumes: the v2 snapshot shape (`src/data/snapshot.json`), `parsePolicyDocument` and `runUpdate` from `scripts/`, schema types, `COUNTRIES.IN`, `loadCalendar('IN')`.
- Produces:
  - `IN_ERAS: Era[]`
  - `projectIndia(v2: unknown, ctx: { v2ReleaseId: string; v2Sha256: string; now: string }): CountryRelease`
  - `runIndia(ctx: RunContext): Promise<CountryResult>`, which spawns `node scripts/fetch-rbi-data.js`, reads the resulting bundled snapshot and projects it.
- Mapping rules (spec §3 India):
  - Resolution-backed records become `statement` decisions.
  - Reuters and Shriram records become `secondary` series points only.
  - v2 `events` become `context`.
  - v2 `regimes` are dropped from v3.
  - An unknown v2 source `type` throws `SourceParseError`.
  - A missing vote becomes `null`.
  - Stance carries over.

- [ ] **Step 1:** Verify D3.
  - Locate RBI circular RBI/2004-05/251 (revised LAF scheme, Oct 2004) on `rbi.org.in` and record its URL as source `in-laf-2004`.
  - **If it confirms** the repo/reverse repo nomenclature swap: `IN_ERAS` gets `in-auction` (2000-06-05 to 2004-10-28, `basis: 'observation'`, kind `point`), then `in-repo` (2004-10-29 to 2016-10-03, `policy`) and `in-mpc` (2016-10-04 onward, `policy`).
  - **If it does not confirm:** mark `in-auction` as `policy` and note the open question in the commit body.
- [ ] **Step 2:** Build `backfill.json`: the official RBI press release URL of every MPC resolution from 2016-10-04 to 2026-08-05 that is missing from the current v2 snapshot, including 2026-02-06. Each entry is `{ date, url }`.
- [ ] **Step 3:** Write the failing tests:
  - `projectIndia(currentSnapshot)` passes `validateRelease`.
  - The 2026-10-07 decision projects to `direction 'hike'`, `changeBps 25`, `level 550`, `evidence 'statement'` and stance `'calibrated tightening'`.
  - No decision has `evidence 'secondary'`.
  - Every Reuters point is a `secondary` series point.
  - `release.upstream.sha256` equals `bundledRelease.artifactSha256`.
  - A v2 source with type `'mystery'` throws `SourceParseError`.
  - The projection is deterministic: two calls give the same `releaseHash`.
- [ ] **Step 4:** Implement `eras.ts`, `project.ts` and `adapter.ts`. Run the tests. Expected: PASS.
- [ ] **Step 5:** Implement `backfill.ts`, which fetches each URL, parses it with `parsePolicyDocument` and calls `runUpdate({ extraEntries })`.
  - Run it once: `node pipeline/countries/in/backfill.ts`.
  - **Expected:** a new v2 release is appended, every existing v2 decision is byte-identical (`git diff` on `public/data/snapshots/` shows only one added file), and `npm run test:data` passes.
  - Set `coverage.ledgerFrom` to `2016-10-04` in the projector once the backfill lands.
- [ ] **Step 6:** Commit in two steps: `feat(pipeline): project India v2 snapshots to schema v3`, then `chore(data): backfill MPC resolutions since 2016 (additive)`.

### Task 6: Meeting resolution and the run CLI

**Files:**
- Create: `pipeline/resolve.ts`, `pipeline/run.ts`
- Test: `tests/pipeline/resolve.test.ts`, `tests/pipeline/run.test.ts`

**Interfaces:**
- Consumes: `runIndia`, `runUs`, `validateRelease`, `releaseHash`.
- Produces:
  - `resolveMeetings(calendar: Meeting[], decisions: Decision[], series: SeriesPoint[], profile: CountryProfile, now: string): MeetingStatus[]`
  - CLI `node pipeline/run.ts --countries IN,US [--reason <text>] [--now <iso>]`. For each country it writes `.out/<cc>/status.json` (`{ code, ok, statuses, error? }`). On success it also writes `.out/<cc>/candidate.json` and, for IN, the changed v2 and HF input files under `.out/IN/v2/` with their repo-relative paths preserved. Exit code 0 even when some countries fail; non-zero only on usage errors.
- Resolution rules (spec §3 invariants 4–5, §5):
  - `verified`: a decision exists for the meeting.
  - `pending`: `now >= announceAt` and no decision yet.
  - `failed`: the adapter threw for this meeting.
  - A meeting becomes `unchanged`/`series` only when there is no statement and the series has an observation dated at or after `date + effectiveLagDays` showing no move.

- [ ] **Step 1:** Write the failing tests:
  - `resolveMeetings keeps a meeting pending while the series lags`: a US meeting at `2026-09-16T14:00-04:00`, now `2026-09-16T20:00Z`, series last observed `2026-09-16`, no statement gives `pending`.
  - With the statement decision present it gives `verified`.
  - With no statement and a flat series observed on `2026-09-17` it gives an `unchanged` decision synthesised with `evidence 'series'`.
  - `run marks the country failed and writes no candidate`: an injected US adapter throws `SourceParseError`. `.out/US/status.json` has `ok:false`, no `candidate.json` exists, and the IN leg still writes its candidate.
- [ ] **Step 2:** Implement and run `npm run test:pipeline`. Expected: PASS.
- [ ] **Step 3:** Commit with `feat(pipeline): add meeting resolution and run CLI`.

### Task 7: Publish, manifest, schedule and health

**Files:**
- Create: `schema/files.ts`, `pipeline/publish.ts`, `pipeline/schedule.ts`, `data/manifest.json`, `data/schedule.json`, `data/health.json`
- Test: `tests/pipeline/publish.test.ts`, `tests/pipeline/schedule.test.ts`

**Interfaces:**
- Consumes: `.out/<cc>/*` from Task 6, `validateRelease`, `releaseHash`, `loadCalendar`.
- Produces (the types live in `schema/files.ts` and are re-exported from `schema/index.ts`, so the app imports them without pipeline code):
  - `type Manifest = { schemaVersion: 1; countries: Record<string, { status: 'available'|'planned'; release: string; path: string; latestRecordDate: string; lastChangedAt: string; reason?: string }> }`
  - `type ScheduleFile = { generatedAt: string; items: { cc: string; meetingId: string; announceAt: string; resolved: boolean }[] }`, holding meetings from now−2d to now+365d.
  - `type HealthFile = Record<string, { checkedAt: string; status: 'ok'|'pending'|'failed'; detail?: string }>`
  - `publish(dir: string, now: string): { changed: string[] }`. CLI: `node pipeline/publish.ts [--check]`, where `--check` validates every committed release and the manifest without writing.
- Rules:
  - A candidate is written only when its hash differs from the manifest's.
  - The previous release is passed to `validateRelease` so the append-only check runs.
  - IN v2 files are copied from `.out/IN/v2/` only when the IN v3 candidate validates.
  - `health.json` changes only on a status change or when `checkedAt` is older than 7 days.

- [ ] **Step 1:** Write the failing tests:
  - `publish is a no-op when the candidate hash equals the manifest`: no files change and `changed` is `[]`.
  - A new candidate writes `data/releases/US/<hash>.json` and updates `manifest.countries.US.release` and `latestRecordDate`.
  - `publish merges only the legs that succeeded`: a failed US status leaves the US manifest untouched while IN updates.
  - An invalid candidate (inject a `series-order` issue) leaves `data/` untouched and the process exits non-zero.
  - `buildSchedule` marks `IN-2026-10-07` resolved and `IN-2026-12-xx` unresolved.
  - `--check` on the committed tree exits 0.
- [ ] **Step 2:** Implement, then generate the first IN and US releases locally with `node pipeline/run.ts --countries IN,US && node pipeline/publish.ts`. Inspect `git status`: expect two release files plus the three `data/*.json` files.
- [ ] **Step 3:** Run `npm run test:pipeline && npm run validate:data`. Expected: PASS.
- [ ] **Step 4:** Commit with `feat(pipeline): publish content-addressed v3 releases with schedule and health`, and separately commit `chore(data): first v3 releases for IN and US`.

### Task 8: Workflows (refresh, validate) and issue sync

**Files:**
- Create: `.github/workflows/refresh.yml`, `.github/workflows/validate.yml`, `pipeline/issues.ts`
- Delete: `.github/workflows/update-data.yml`, `.github/workflows/validate-app.yml`, `.github/workflows/validate-data.yml`
- Test: `tests/pipeline/issues.test.ts`

**Interfaces:**
- Consumes: `run.ts`, `publish.ts`, `.out/*/status.json`.
- Produces:
  - `syncIssues(statuses: CountryStatus[], gh: GhClient, now: string): Action[]`, where `GhClient` wraps the `gh` CLI (`list`, `create`, `edit`, `close`).
  - **Issue titles:** `Pipeline: <CC> source failure` and `Pipeline: <CC> decision pending over 6 hours`.
  - **Issue behaviour:** the body is edited in place, never commented on. The issue closes when the status returns to `ok`.
- **`refresh.yml` shape:**
  - **Triggers:**
    - `workflow_dispatch` with inputs `countries` (default `ALL`) and `reason` (default `manual`);
    - `schedule: '17 3 * * 0'`.
  - **Concurrency:** `concurrency: { group: refresh, cancel-in-progress: false }`.
  - **Job `plan`:** outputs a JSON country list (`ALL` → IN, US).
  - **Job `fetch`:**
    - matrix over that list with `fail-fast: false`;
    - runs `npm ci`, then `node pipeline/run.ts --countries ${{ matrix.cc }}`;
    - uploads `.out/<cc>` with `if: always()`.
  - **Job `publish`:**
    - runs `if: ${{ !cancelled() }}` with `permissions: contents: write, issues: write`;
    - downloads all artifacts and runs `node pipeline/publish.ts`;
    - when IN changed, runs `python scripts/build-hf-dataset.py`;
    - runs `npm run validate:data && npm run test:pipeline && npm run test:data && npm run build`;
    - commits as `chore(data): <changed codes> <reason>` and pushes with up to 3 attempts of `git pull --rebase`; manifest conflicts are resolved by re-running `publish.ts`;
    - finally runs `node pipeline/issues.ts`.
  - All actions are pinned to commit SHAs.
- **`validate.yml`:** runs on PRs and on pushes to `main`. It merges the existing app and RBI jobs with a new `pipeline` job (`typecheck`, `test:pipeline`, `validate:data`). Actions are pinned to SHAs.

- [ ] **Step 1:** Write the failing tests for `syncIssues`, using a fake `GhClient`:
  - A failed US status with no open issue creates exactly one issue.
  - A second failure edits it, never creating a second one.
  - An `ok` status closes it.
  - A meeting pending for more than 6 hours since `announceAt` opens the pending issue.
- [ ] **Step 2:** Implement `issues.ts` and both workflows. Run `npm run test:pipeline`. Expected: PASS.
- [ ] **Step 3:** Commit with `ci: dispatchable refresh pipeline and unified validation`. After the owner pushes, run `gh workflow run refresh.yml -f countries=ALL -f reason=first-run`. Expected: the run is green, and the commit touches only `data/` (plus v2 files if RBI changed).

### Task 9: Cloudflare cron dispatcher (D1)

**Files:**
- Create: `worker/dispatch/plan.ts`, `worker/dispatch/index.ts`, `worker/dispatch/wrangler.jsonc`, `tsconfig.worker.json`
- Test: `tests/pipeline/dispatch.test.ts`

**Interfaces:**
- Consumes: the `ScheduleFile` type from `schema/files.ts`.
- Produces:
  - `LADDER_MIN = [10, 25, 45, 90, 180, 360]` and `TICK_MIN = 10`.
  - `dueDispatches(schedule: ScheduleFile, nowIso: string): { countries: string[]; reason: string } | null`. A meeting is due when it is unresolved and `minutes(now − announceAt)` falls in `[r, r + TICK_MIN)` for some rung `r`. Due countries are merged into one dispatch with reason `ladder:<meetingIds>`.
  - Worker `scheduled(event, env)`:
    - cron `*/10 * * * *` fetches `https://raw.githubusercontent.com/ashwingopalsamy/repo-rate-visualizer/main/data/schedule.json` and dispatches when due;
    - cron `17 6 * * *` always dispatches `{ countries: 'ALL', reason: 'sweep' }`;
    - dispatching is a `POST https://api.github.com/repos/ashwingopalsamy/repo-rate-visualizer/actions/workflows/refresh.yml/dispatches` with `{ ref: 'main', inputs }` and the header `Authorization: Bearer ${env.GITHUB_DISPATCH_TOKEN}`.
- `wrangler.jsonc`: name `atlas-dispatch`, `workers_dev: false`, no routes, `triggers.crons` set to the two expressions, observability head sampling `0.1`.

- [ ] **Step 1:** Write the failing tests:
  - `dueDispatches fires once per ladder rung`: for announceAt `T`, now values `T+10m`, `T+25m` and `T+45m` each return a dispatch; `T+5m`, `T+20m` and `T+400m` return `null`.
  - A resolved meeting never dispatches.
  - Two countries due on the same tick merge into one dispatch.
  - `dueDispatches handles a DST transition`: an FOMC meeting on the first Wednesday after the US DST switch uses its zoned `announceAt`, so `+10m` matches in UTC.
- [ ] **Step 2:** Implement `plan.ts` and `index.ts`. Run `npm run test:pipeline && npx tsc -p tsconfig.worker.json`. Expected: PASS.
- [ ] **Step 3:** Owner actions, which need the owner's credentials (Claude does not handle tokens):
  1. Create a fine-grained GitHub token scoped to this repo with "Actions: read and write" only.
  2. Run `npx wrangler secret put GITHUB_DISPATCH_TOKEN -c worker/dispatch/wrangler.jsonc`.
  3. Run `npx wrangler deploy -c worker/dispatch/wrangler.jsonc`.
- [ ] **Step 4:** Commit with `feat(worker): announcement-time dispatcher for the refresh pipeline`. Verify by waiting for the next 06:17 UTC sweep. Expected: a `refresh` run appears with reason `sweep`.

---

## Done when

- `data/` holds valid v3 releases for IN and US, and `npm run validate:data` passes.
- India's ledger is complete from `2016-10-04`.
- The fixtures of the 7 Oct RBI decision and the 16 Sep FOMC decision verify in one run.
- A lagging-series fixture never yields `unchanged`.
- An idle day produces only the 06:17 sweep run.
- v1 still builds and deploys unchanged; Plan 2 replaces it.
