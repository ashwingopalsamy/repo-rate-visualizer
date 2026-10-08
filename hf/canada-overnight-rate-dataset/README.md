---
language:
- en
pretty_name: "Canada Bank of Canada Overnight Rate Target History"
tags:
- tabular
- timeseries
- finance
- economics
- monetary-policy
- central-banking
- interest-rates
- policy-rate
- datasets
- pandas
- polars
- mlcroissant
- canada
- bank-of-canada
- overnight-rate
size_categories:
- 1K<n<10K
configs:
- config_name: rates
  default: true
  data_files:
  - split: full
    path: data/rates.parquet
- config_name: daily
  data_files:
  - split: full
    path: data/daily.parquet
- config_name: cycles
  data_files:
  - split: full
    path: data/cycles.parquet
- config_name: annual
  data_files:
  - split: full
    path: data/annual.parquet
- config_name: countries
  data_files:
  - split: full
    path: data/countries.parquet
- config_name: eras
  data_files:
  - split: full
    path: data/eras.parquet
- config_name: sources
  data_files:
  - split: full
    path: data/sources.parquet
- config_name: transmission
  data_files:
  - split: full
    path: data/transmission.parquet
---

# Canada Bank of Canada Overnight Rate Target History

An independent, reproducible dataset of the Bank of Canada target for the overnight rate, built from the BoC’s own published series and statements. Every row cites its source, every rate is an exact number of basis points, and the whole dataset is rebuilt automatically when a bank publishes a decision. It is part of [Central Bank Policy Rates](https://huggingface.co/datasets/ashwingopalsamy/central-bank-policy-rates), which covers seven banks in one schema.

**Current build:** data observed through 6 Oct 2026; daily coverage from 21 Apr 2009; 33 rate changes and 6,378 daily rows.

## At a glance

| Country | Central bank | Instrument | Rate now | Since | Decisions | Series from |
| --- | --- | --- | --- | --- | --- | --- |
| Canada | Bank of Canada | Target for the overnight rate | 2.25% | 30 Oct 2025 | being added | 21 Apr 2009 |

Questions this dataset answers directly:
- What was the policy rate on a given date?
- How long did each tightening and easing cycle last, and how far did it go?
- How much did the rate change in a given year?
- Which day-level rate should I join to my daily or monthly data?

This is not an official product of any central bank. For anything that matters, follow the `source_url` or `statement_url` on the row to the bank’s own publication.

## Configurations

| Configuration | Row grain | Rows | What it holds |
| --- | --- | --- | --- |
| `rates` (default) | One row per change in the rate | 33 | Every change point of the policy rate, with the level before and after, its era and its source. |
| `daily` | One row per calendar day per country | 6,378 | The rate in force on every calendar day, from 1 Jan 2000 (or the first point of the series, if later) to the date the official series was last observed. Ready to join to any daily or monthly data. |
| `cycles` | One row per tightening or easing cycle | 6 | Each run of consecutive moves in one direction since the policy-rate era began, computed exactly as on the site: a cycle starts with the first move after a move the other way. |
| `annual` | One row per country per calendar year | 18 | Yearly summaries computed from `rates` and `decisions`: the rate at each end of the year, its range, the net and gross change, and how many hikes, cuts and holds there were. |
| `countries` | One row per country | 1 | What each country’s data covers: the bank, the instrument, the dates covered and the release it was built from. |
| `eras` | One row per instrument period | 1 | The periods in which one instrument and basis applied. A change of era is why `change_bps` is null at its first point. |
| `sources` | One row per source | 2 | Every source the rows cite: official series, statements, calendars and labelled secondary sources. |
| `transmission` | One row per loan product per country | 2 | How the policy rate reaches common loans: the benchmark each is priced off, how often it resets and how directly a change passes through. Curated reference notes. |

Every configuration has one split, `full`, because this is a historical record rather than a train/test corpus. The Parquet files under `data/` are the only files mapped to configurations. CSV copies of every table and JSONL copies of `rates` are under `exports/`, deliberately left out of the configurations so the viewer does not count them twice. Column types are in [`schema/`](schema/) and every column is described in [`schema/data-dictionary.json`](schema/data-dictionary.json).

## How to read the fields

- **Rates are exact.** `rate_bps` is an integer number of basis points; `rate_pct` is the same value in percent. For a target range (the Fed since 16 December 2008), `rate_pct` is the **upper bound** and `rate_low_pct`/`rate_high_pct` give both ends. A midpoint is never computed.
- **`rates` is the canonical history.** One row per change, with the rate before and after. `change_bps` is the signed change against the previous upper bound; it is null for the first point and at an era boundary, where an instrument or its basis changed and the two numbers are not comparable.
- **Eras say what the number is.** `era_basis` is `policy` for the policy rate itself and `observation` for an earlier proxy kept for history. The `eras` configuration explains each boundary.
- **Evidence is explicit.** `evidence` is `official` for the bank’s own series or statement and `secondary` for a cited secondary source. Every row carries a `source_id` that joins to `sources`.
- **Series-only countries.** Canada has the full official series of rate changes, but announced decisions (and so holds and votes) are still being added. Their rows in `annual` carry null `hold_count` and `decision_count` rather than zero.
- **`daily`** gives the rate in force on every calendar day, including weekends, so it joins directly to other daily or monthly data.
- **`cycles`** are runs of consecutive moves in one direction, computed the same way as on [Policy Rate Atlas](https://rates.ashwingopalsamy.in/): a new cycle starts with the first move after a move the other way. Only policy-era moves count.
- **`annual`** uses the rate in force on 1 January (the last change before it) and on 31 December, or the last observed date for the current year. `is_partial_year` marks a first or current year that the data does not fully cover.
- **`record_text`** is one deterministic sentence built from the fields, for search, retrieval and agents. No text is written by a language model.

## Coverage

- **Canada.** Every change in the overnight rate target from Bank of Canada Valet (daily series from April 2009). Decision records are being added.

## Load it

```python
from datasets import load_dataset

repo = "ashwingopalsamy/canada-overnight-rate-dataset"
rates = load_dataset(repo, split="full")                 # every change, the default configuration
daily = load_dataset(repo, "daily", split="full")
```

```python
import pandas as pd

daily = pd.read_parquet("hf://datasets/ashwingopalsamy/canada-overnight-rate-dataset/data/daily.parquet")
monthly = daily.set_index("date")["rate_pct"].resample("ME").last()
```

```python
import polars as pl

cycles = pl.read_parquet("hf://datasets/ashwingopalsamy/canada-overnight-rate-dataset/data/cycles.parquet")
print(cycles.filter(pl.col("is_current")))
```

```sql
-- DuckDB
SELECT year, start_rate_pct, end_rate_pct, net_change_bps, hike_count, cut_count
FROM 'hf://datasets/ashwingopalsamy/canada-overnight-rate-dataset/data/annual.parquet'
ORDER BY year;
```

## Provenance and verification

Each country’s data comes from one content-addressed release, also served by the site’s open API at `https://rates.ashwingopalsamy.in/api/v1/`:

| Country | Release (SHA-256 content hash) | Observed through |
| --- | --- | --- |
| Canada | `5c0b58687989dd75230cd64f7ab6d37381e4eddaece2a82bb73a8d3ba6c41cf5` | 6 Oct 2026 |

`provenance/build-manifest.json` records those releases, the row count of every configuration and a checksum of every file; `SHA256SUMS` covers everything. The build is byte-for-byte reproducible from [the source repository](https://github.com/ashwingopalsamy/repo-rate-visualizer):

```bash
npm ci && pip install -r requirements-hf-dataset.txt
npm run build:hf && npm run test:hf-dataset
```

## Attribution and terms

Each publisher’s own terms apply to its data. [NOTICE.md](NOTICE.md) lists them with the attribution each asks for. No blanket dataset licence is asserted.

## Limitations

- Coverage differs by country: announced decisions are not yet available for Canada. See `countries.coverage_note`.
- Dates are the bank’s local dates. Historical announcement times for India before the published calendar use 10:00 IST as a convention.
- `transmission` and `events` are curated context, not exhaustive and not causal claims.
- Nothing here is a forecast or advice.

## Citation

```bibtex
@dataset{gopalsamy_canada_overnight_rate_dataset_2026,
  author    = {Gopalsamy, Ashwin},
  title     = {Canada Bank of Canada Overnight Rate Target History},
  year      = {2026},
  version   = {1.0.0},
  publisher = {Hugging Face},
  url       = {https://huggingface.co/datasets/ashwingopalsamy/canada-overnight-rate-dataset}
}
```

Changes between versions are in [CHANGELOG.md](CHANGELOG.md). The live view of this data is [Policy Rate Atlas](https://rates.ashwingopalsamy.in/).
