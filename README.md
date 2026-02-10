# RBI Repo Rate Visualizer & Open Dataset

An independent public chartbook and verified dataset covering the Reserve Bank of India's policy repo rate decisions from 2000 to the present.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](tests/)

[Live Demo](https://ashwingopalsamy.github.io/repo-rate-visualizer/) • [Hugging Face Dataset](https://huggingface.co/datasets/ashwingopalsamy/rbi-repo-rate-india)

## What it does

Most rate trackers only plot rate hikes and cuts as a line chart. This visualizer treats every official Monetary Policy Committee (MPC) decision (including holds and stance changes) as a first-class policy record.

- **Decision Timeline**: Step-rate trajectory overlaid with MPC holds, hikes, cuts, and macro events.
- **Regime Breakdown**: Hold-to-move ratios, average decision durations, and cumulative basis points across policy regimes.
- **Cycle Comparison**: Side-by-side easing and tightening cycle trajectories indexed from cycle start.
- **Rate Change Distribution**: Histogram and calendar ledger of policy moves.
- **Source Transparency**: Direct links to official RBI resolutions, bulletins, and Gazette notifications for every decision.
- **Data Export**: Export charts as SVG or full series as CSV/JSON.

## Open Dataset

Machine-readable data artifacts are versioned in `hf-dataset/` and published to Hugging Face:

- `decisions`: Complete ledger of MPC decisions with dates, rates, bps change, and official resolution URLs.
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
```

## Data Pipeline

1. **Ingestion**: `scripts/fetch-rbi-data.js` checks the RBI bulletin, current rates page, and policy archives.
2. **Validation**: `src/data/snapshotV2.js` verifies date sorting, rate monotonicity, decision schemas, and official domain whitelist.
3. **Snapshots**: Weekly immutable snapshots are archived under `public/data/snapshots/` with cryptographic manifests in `public/data/manifest.json`.

## Attribution & Disclaimer

This project is an independent educational tool and is not affiliated with, authorised by, or endorsed by the Reserve Bank of India. All policy decisions and historical records are cited to original RBI documents, Ministry of Home Affairs orders, and CBIC notifications. Always verify financial figures against primary source publications before using them in research or reporting.
