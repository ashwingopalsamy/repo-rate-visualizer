# RBI Repo Rate Visualizer & Open Dataset

An independent public chartbook and versioned dataset of Reserve Bank of India repo-rate records from 2000 through the latest published snapshot.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](tests/)

[Live Demo](https://ashwingopalsamy.github.io/repo-rate-visualizer/) • [Hugging Face Dataset](https://huggingface.co/datasets/ashwingopalsamy/india-repo-rate-dataset)

## What it does

Most rate trackers only plot rate hikes and cuts as a line chart. This visualizer keeps rate observations and directly evidenced Monetary Policy Committee (MPC) decisions as distinct, citable records.

- **Decision Timeline**: Step-rate trajectory overlaid with rate records, identified policy actions, and macro events.
- **Regime Breakdown**: Hold-to-move ratios, average decision durations, and cumulative basis points across policy regimes.
- **Cycle Comparison**: Side-by-side easing and tightening cycle trajectories indexed from cycle start.
- **Rate Change Distribution**: Histogram and calendar ledger of policy moves.
- **Source Transparency**: Evidence labels and source cards distinguish direct RBI resolutions, official context, and historical observations.
- **Data Export**: Export charts and records as provenance-rich SVG, PNG, CSV, JSON, and copyable citations.
- **Research workflows**: Look up the nearest recorded rate for a date, compare two windows, compare immutable releases, and save local analysis states.

## Open Dataset

Machine-readable data artifacts are versioned in `hf-dataset/` and published to Hugging Face:

- `decisions`: Canonical rate records with dates, rates, recorded changes, evidence status, and source URLs where available.
- `annual`: Year-by-year summary of rate changes, holds, and net policy movement.
- `regimes`: Classified easing, tightening, and neutral policy cycles.
- `events`: Contextual macro events with verified citations.
- `sources`: Source provenance registry with SHA-256 validation checksums.

Available in Parquet, CSV, and JSONL formats.

## Quickstart

### Prerequisites
- Node.js 18+
- npm or yarn

### Install and Run
```bash
# Clone repository
git clone https://github.com/ashwingopalsamy/repo-rate-visualizer.git
cd repo-rate-visualizer

# Install dependencies
npm install

# Start local development server
npm run dev
```

### Build for Production
```bash
npm run build
npm run preview
```

### Run Tests
```bash
# Run data pipeline and validation tests
npm run test:data
npm run test:app
npm run test:browser
```

## Research routes

- `/as-of?date=2026-08-05` looks up the nearest recorded rate and creates a pinned citation.
- `/releases` compares two verified content-addressed snapshot releases.
- `/limitations` documents coverage boundaries, evidence classes, record grain, and derived-value limits.
- The **Compare** workspace compares two date windows using the active release and filters.
- **Notebook** saves analysis state locally in the browser; it does not upload data or create an account.

## Data Pipeline

1. **Ingestion**: `scripts/fetch-rbi-data.js` checks the RBI bulletin, current rates page, and policy archives.
2. **Validation**: `src/data/snapshotV2.js` verifies date ordering, rate-change derivation, record schemas, and trusted source domains.
3. **Snapshots**: Append-only, content-addressed releases are archived under `public/data/snapshots/` and registered in `public/data/manifest.json`.

Scheduled refreshes also produce a reviewable release change report as a GitHub Actions artifact before generated files are committed.

## Attribution & Disclaimer

This project is an independent educational tool and is not affiliated with, authorised by, or endorsed by the Reserve Bank of India. Records identify their evidence class and link to the declared source; historical observations should not be read as direct RBI resolution citations. Read the [data limitations](https://ashwingopalsamy.github.io/repo-rate-visualizer/limitations) page and always verify figures against primary source publications before using them in research or reporting.

Code is licensed under MIT. Dataset and third-party source rights are described in [`DATA-LICENSE.md`](DATA-LICENSE.md) and `hf-dataset/NOTICE.md`.
