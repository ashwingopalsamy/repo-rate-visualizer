# Policy Rate Atlas

Central bank policy rates for seven economies: every change in each official rate series and, where available, every decision with its vote, checked against each bank's own publications.

[![Validate](https://github.com/ashwingopalsamy/repo-rate-visualizer/actions/workflows/validate.yml/badge.svg)](https://github.com/ashwingopalsamy/repo-rate-visualizer/actions/workflows/validate.yml) [![Code licence: MIT](https://img.shields.io/badge/code-MIT-blue)](LICENSE)

Live at **https://rates.ashwingopalsamy.in**

The site opens on India. First-time visitors can pick their own central bank. Each country page shows the latest decision, what it means for a loan, where the rate sits in its cycle, the gap to the Fed, the full record and how it compares with peers. `/world/` compares all seven banks.

## What it covers

| Country | Central bank | Rate | Records |
| --- | --- | --- | --- |
| India | Reserve Bank of India | Policy repo rate | Every MPC decision since Oct 2016 with votes; changes since 2000 |
| United States | Federal Reserve | Federal funds target range | Every FOMC decision since 2021 with votes; changes since 1999 |
| Euro area | European Central Bank | Deposit facility rate | Every change since 1999 |
| United Kingdom | Bank of England | Bank Rate | Every change since 1999 |
| Canada | Bank of Canada | Target for the overnight rate | Every change since 2009 |
| Australia | Reserve Bank of Australia | Cash rate target | Every change since 2011 |
| Brazil | Banco Central do Brasil | Selic target | Every change since 2000 |

A scheduled pipeline refreshes India and the United States at each announcement time, and every country once a day. For the euro area, UK, Canada, Australia and Brazil, decision records with votes are still being added.

## Open data

The site serves a static JSON and CSV API under `https://rates.ashwingopalsamy.in/api/v1/`. Paths below are relative to that base.

| Path | Contents |
| --- | --- |
| `countries.json` | Each country with its current rate, release hash and links |
| `latest.json` | The rate in force in each country and its last decision |
| `schedule.json` | Upcoming announcement times |
| `countries/<cc>.json` | The full current release for one country |
| `countries/<cc>/decisions.csv` | Decision records for one country |
| `countries/<cc>/series.csv` | Rate series for one country |
| `releases/<CC>/<hash>.json` | Immutable release for one country, identified by hash |

Hugging Face datasets are also available. [central-bank-policy-rates](https://huggingface.co/datasets/ashwingopalsamy/central-bank-policy-rates) covers all seven banks in one schema. Each bank has its own dataset:

| Country | Dataset |
| --- | --- |
| India | [india-repo-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/india-repo-rate-dataset) |
| United States | [us-fed-funds-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/us-fed-funds-rate-dataset) |
| Euro area | [euro-area-deposit-facility-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/euro-area-deposit-facility-rate-dataset) |
| United Kingdom | [uk-bank-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/uk-bank-rate-dataset) |
| Canada | [canada-overnight-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/canada-overnight-rate-dataset) |
| Australia | [australia-cash-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/australia-cash-rate-dataset) |
| Brazil | [brazil-selic-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/brazil-selic-rate-dataset) |

Tables include `rates`, `daily`, `decisions`, `meetings`, `cycles` and `annual`. Details are in [docs/datasets.md](docs/datasets.md).

Each data snapshot is also a [GitHub release](https://github.com/ashwingopalsamy/repo-rate-visualizer/releases) with one zip per dataset, so you can download them without cloning.

## Quickstart

Requires Node 24 (see `.node-version`). Run the commands from the repository root.

Install dependencies from the lockfile.

```bash
npm ci
```

Generate the data file the development server reads (`public/atlas.json`, git-ignored). Run it again after data changes.

```bash
node scripts/build-atlas.ts
```

Start the development server at http://localhost:5180.

```bash
npm run dev
```

Build the data bundle, static API, prerendered pages and production site.

```bash
npm run build
```

After building, serve the production build at http://localhost:4180.

```bash
npm run preview
```

The Hugging Face dataset build also needs Python 3.12; see [docs/datasets.md](docs/datasets.md).

## Scripts

All scripts are defined in `package.json`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Data bundle, static API, production build, prerendered pages and the bundle-size check |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Type-check the pipeline, Workers and app |
| `npm run test:app` | Unit tests for the site's findings, API build, analytics collector and dataset tables |
| `npm run test:pipeline` | Data pipeline tests |
| `npm run test:data` | Checks on the India v2 data |
| `npm run test:browser` | Playwright browser tests (layout, motion, accessibility, analytics) |
| `npm run test:hf-dataset` | Hugging Face dataset tests (Python) |
| `npm run validate:data` | Validate the committed releases |
| `npm run build:hf` | Build the Hugging Face datasets into `hf/` |
| `npm run analytics:report` | Print the first-party analytics report |

## Repository map

| Path | What it holds |
| --- | --- |
| `src/` | The site: typed TypeScript pages, charts, motion and styles |
| `scripts/` | Build steps: data bundle, static API, prerender, bundle check, Hugging Face datasets, analytics report |
| `pipeline/` | Fetching, validating and publishing each country's data |
| `schema/` | The release schema and its invariants |
| `data/` | Published releases, manifest, schedule and health |
| `worker/` | Cloudflare Workers: the site (`site/`) and the refresh dispatcher (`dispatch/`) |
| `hf/` | The Hugging Face datasets, generated and committed |
| `tests/` | Unit, pipeline, data and browser tests |
| `design/` | The approved design prototype |
| `docs/` | Operations, pipeline, datasets and analytics guides, plus design specs and plans |

The site is typed TypeScript without a UI framework, built with Vite, prerendered at build time, and served by Cloudflare Workers.

## Documentation

- [Operations](docs/operations.md): deploying, secrets, one-time setup and troubleshooting.
- [Data pipeline](docs/data-pipeline.md): how data is fetched, validated and published, and how to add a country.
- [Hugging Face datasets](docs/datasets.md): tables, columns and how the datasets are built.
- [Analytics](docs/analytics.md): what is counted and how it stays private.
- [Design notes](DESIGN.md): visual and interaction design decisions.
- [Contributing](CONTRIBUTING.md): contribution guidelines.
- [Data licence](DATA-LICENSE.md): terms for the published data.

## Attribution and disclaimer

This project is an independent educational tool. It is not affiliated with, authorised by, or endorsed by any central bank. Every record identifies its evidence class and links to its source; historical observations should not be read as direct central-bank resolutions. Always verify figures against the original publications before using them in research or reporting. Nothing here is financial advice.

Code is licensed under MIT. Data rights are described in [DATA-LICENSE.md](DATA-LICENSE.md) and in each dataset's `NOTICE.md` under `hf/`.
