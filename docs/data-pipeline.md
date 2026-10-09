# Data pipeline

This page explains how policy-rate data gets from central banks into `data/`, how the refresh runs, and how to add a country.

Each country's adapter fetches its official sources, and `pipeline/run.ts` writes the result as a candidate in `.out/<CC>/`. `pipeline/publish.ts` validates each candidate and writes it to `data/` only if it passes. The refresh workflow then commits the result to main.

## Releases and the manifest

Seven countries publish through the pipeline. IN and US have decision ledgers and meeting calendars. The calendars live in `pipeline/calendars/`. The other five are series-only: their data is every change in the official series, and their decisions are still to be added.

| Code | Country | Coverage |
|---|---|---|
| IN | India | Decision ledger and meeting calendar |
| US | United States | Decision ledger and meeting calendar |
| EA | Euro area | Series only |
| GB | United Kingdom | Series only |
| CA | Canada | Series only |
| AU | Australia | Series only |
| BR | Brazil | Series only |

Each release is one JSON file named by its hash, `data/releases/<CC>/<sha256>.json`, in schema v3. The schema is defined with zod in `schema/release.ts`. A level is a point, a range or none (`schema/level.ts`).

The hash covers everything except the `release` block. A release therefore changes only when the data does, and a refresh that finds no new data produces the same file name.

A release holds eras, series points, calendar entries, decisions, transmission notes, context, sources and corrections.

| File | Holds |
|---|---|
| `data/manifest.json` | The current release for each country |
| `data/schedule.json` | Announcement times for upcoming meetings |
| `data/health.json` | The latest health check per country (ok, pending or failed), rewritten when the state changes or after seven days |

Releases are append-only. History changes only through an explicit `corrections` entry (`recordId`, `reason`, `sourceId`), which a country's adapter must emit. No adapter emits one yet, so a correction to history needs a code change in that adapter. Never edit a file under `data/releases/` by hand.

## The refresh workflow

`.github/workflows/refresh.yml` runs the refresh. The dispatcher triggers it. It also runs weekly (`17 3 * * 0`, Sundays at 03:17 UTC), and someone can start it by hand with the inputs `countries` and `reason`.

The workflow runs four jobs in this order:

1. `plan` validates the country list against the registry.
2. `fetch` runs one job per country. Each runs `pipeline/run.ts` and uploads its candidate.
3. `publish` runs `pipeline/publish.ts`. It rebuilds the Hugging Face datasets when data changed, runs the checks, commits to main as `github-actions[bot]`, publishes to Hugging Face and syncs pipeline issues.
4. `verify-live` runs only when the repository variable `SITE_LIVE` is `true`. Five minutes later, it checks that the live API serves the new releases.

## The dispatcher

The dispatcher is a Cloudflare Worker in `worker/dispatch/`, deployed as `atlas-dispatch`. It runs only on a cron schedule, every 10 minutes, and reads `data/schedule.json` from main.

Unresolved meetings retry on a ladder of six rungs, counted from the announcement time. On each tick, the dispatcher starts at most one refresh. It covers every country with an unresolved meeting whose elapsed time falls in a rung's window, and its `reason` lists those meeting ids after a `ladder:` prefix. Once a meeting is resolved, its rungs stop.

| Rung | Minutes after announcement |
|---|---|
| 1 | 10 |
| 2 | 25 |
| 3 | 45 |
| 4 | 90 |
| 5 | 180 |
| 6 | 360 |

Each rung owns one 10-minute window that starts at its minute value, so it fires once. The dispatcher also starts a sweep of all countries daily at 06:17 UTC. Series-only countries have no calendar, so the daily sweep keeps them current.

The Worker needs the `GITHUB_DISPATCH_TOKEN` secret. See [operations.md](operations.md).

## Validation

Before a release is written, `schema/invariants.ts` checks its shape with zod, then applies the main rules below and compares the release with the previous one.

| Rule | Requirement |
|---|---|
| Series order | Series dates strictly increase |
| Change in basis points | `changeBps` equals the change in the upper bound, and is null across an era boundary |
| Holds | A hold needs statement evidence |
| Excerpts | At most 400 characters |
| Official levels | Statement levels agree with the official series where the series covers the decision date |
| Ledger coverage | Every held meeting since the ledger start has exactly one decision |
| Sources | Every source id resolves |
| Official hosts | Official sources come from the country's allowlisted hosts |
| Credentials | Source URLs carry no credential parameter, such as `key` or `token` |
| History | Earlier decisions and series points cannot change or disappear without a `corrections` entry. A series-based decision may be replaced by its parsed statement |

The complete set is in [invariants.ts](../schema/invariants.ts).

To run the pipeline by hand from the repository root, fetch candidates for India and the United States:

```bash
node pipeline/run.ts --countries IN,US --reason manual
```

Then validate the candidates and write `data/`:

```bash
node pipeline/publish.ts
```

To check the committed data:

```bash
npm run validate:data
```

That script runs `node pipeline/publish.ts --check`.

## Pipeline issues

`pipeline/run.ts` exits 0 even when a country fails, so the other countries still publish. Failures are reported through pipeline issues.

`pipeline/issues.ts` keeps one GitHub issue for each country and failure class, labelled `pipeline`: "Pipeline: XX source failure" and "Pipeline: XX decision pending over 6 hours". They come from the statuses `pipeline/run.ts` writes. The publish job syncs these issues, editing each one in place and closing it on recovery. The verify-live job adds one more issue, titled "Pipeline: live site behind manifest". Errors raised by `pipeline/publish.ts` itself appear only in the job log.

## Adding a country

Work through these steps in order. Step 4 is optional.

1. Add the code to the `CountryCode` union in `pipeline/countries/registry.ts`, then add a profile. `COUNTRIES` is typed as a record over the union, so the type checker requires the profile. The profile holds the official source hosts (the allowlist), the time zone and the announcement time, which turn each calendar date into an announcement instant. Set `independentSeries` to true only when an official level series exists apart from the decision statements, since an unchanged meeting can be inferred only from such a series.
2. Write `pipeline/countries/<cc>/adapter.ts`, using the lowercase code as the existing directories do. A series-only country can reuse `seriesAdapter` from `pipeline/countries/series.ts` and supply a parser for its official series. Register the adapter: series-only adapters go in `SERIES_ADAPTERS` (`pipeline/countries/series.ts`), others in `DEFAULT_ADAPTERS` (`pipeline/run.ts`). Without this, `run.ts` reports "No adapter" for the country.
3. Add transmission notes in `pipeline/transmission/<cc>.json`. The registry reads this file for every country, so the step is required even for series-only countries.
4. Optionally add a meeting calendar at `pipeline/calendars/<cc>.json`. Without one, the country has no meetings and cites no calendar source.
5. Add tests under `tests/pipeline/` and recorded fixtures under `tests/fixtures/<cc>/`. India's fixtures sit in `tests/fixtures/rbi/`, not `in/`.
6. Add the country to the site. These lists name every country, and each must include it:
   - the `Code` union in `src/lib/types.ts`;
   - `ORDER`, `META`, `PLURAL` and `FLAGS` in `src/lib/atlas.ts`;
   - `CODES` in `src/analytics/schema.ts`, or the analytics collector rejects its events;
   - `ORDER` in `scripts/hf/tables.ts`;
   - the time-zone patterns and `REGIONS` in `src/lib/locale.ts`, used to suggest a country to first-time visitors.

   Check the currency wording in the gap note in `src/app/country.ts`, which special-cases Brazil's real.

   Add a circular flag to `public/flags/` and point `FLAGS` at it. The euro area flag is `european_union.svg`.
7. Add the dataset entries (`DATASETS` and `PUBLISHERS`) in `scripts/hf/cards.ts`, and a hand-written `hf/<repo>/CHANGELOG.md`, for example `hf/india-repo-rate-dataset/CHANGELOG.md`.
8. Run these checks:

   ```bash
   npm run typecheck
   ```

   ```bash
   npm run test:pipeline
   ```

   ```bash
   npm run validate:data
   ```

   ```bash
   npm run test:app
   ```

   The multi-country dataset changes too, so rebuild and test the datasets (see [datasets.md](datasets.md)):

   ```bash
   npm run build:hf
   ```

   ```bash
   npm run test:hf-dataset
   ```
