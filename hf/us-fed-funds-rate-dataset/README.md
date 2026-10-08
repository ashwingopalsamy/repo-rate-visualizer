---
language:
- en
pretty_name: "US Federal Funds Target Rate and FOMC Decision History"
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
- united-states
- federal-reserve
- fomc
- fed-funds-rate
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
- config_name: decisions
  data_files:
  - split: full
    path: data/decisions.parquet
- config_name: meetings
  data_files:
  - split: full
    path: data/meetings.parquet
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

# US Federal Funds Target Rate and FOMC Decision History

An independent, reproducible dataset of the Federal Reserve federal funds target range, built from the Fed’s own published series and statements. Every row cites its source, every rate is an exact number of basis points, and the whole dataset is rebuilt automatically when a bank publishes a decision. It is part of [Central Bank Policy Rates](https://huggingface.co/datasets/ashwingopalsamy/central-bank-policy-rates), which covers seven banks in one schema.

**Current build:** data observed through 6 Oct 2026; daily coverage from 1 Jan 2000; 76 rate changes, 46 announced decisions and 9,776 daily rows.

## At a glance

| Country | Central bank | Instrument | Rate now | Since | Decisions | Series from |
| --- | --- | --- | --- | --- | --- | --- |
| United States | Federal Reserve | Federal funds target range | 3.75–4.00% | 17 Sept 2026 | 46 | 16 Nov 1999 |

Questions this dataset answers directly:
- What was the fed funds target on a given date?
- How did each member vote, and when did the Fed hold rather than move?
- How long did each tightening and easing cycle last, and how far did it go?
- How many hikes, cuts and holds were there in a given year?

This is not an official product of any central bank. For anything that matters, follow the `source_url` or `statement_url` on the row to the bank’s own publication.

## Configurations

| Configuration | Row grain | Rows | What it holds |
| --- | --- | --- | --- |
| `rates` (default) | One row per change in the rate | 76 | Every change point of the policy rate, with the level before and after, its era and its source. |
| `daily` | One row per calendar day per country | 9,776 | The rate in force on every calendar day, from 1 Jan 2000 (or the first point of the series, if later) to the date the official series was last observed. Ready to join to any daily or monthly data. |
| `decisions` | One row per announced decision, including holds | 46 | Every announced decision in the ledger, from the bank’s own statement or resolution: hikes, cuts and holds, with the vote, stance, a short excerpt and the statement link. |
| `meetings` | One row per scheduled meeting, past and upcoming | 56 | The meeting calendar, including meetings still to come, with the decision each held meeting produced. |
| `cycles` | One row per tightening or easing cycle | 9 | Each run of consecutive moves in one direction since the policy-rate era began, computed exactly as on the site: a cycle starts with the first move after a move the other way. |
| `annual` | One row per country per calendar year | 27 | Yearly summaries computed from `rates` and `decisions`: the rate at each end of the year, its range, the net and gross change, and how many hikes, cuts and holds there were. |
| `countries` | One row per country | 1 | What each country’s data covers: the bank, the instrument, the dates covered and the release it was built from. |
| `eras` | One row per instrument period | 2 | The periods in which one instrument and basis applied. A change of era is why `change_bps` is null at its first point. |
| `sources` | One row per source | 52 | Every source the rows cite: official series, statements, calendars and labelled secondary sources. |
| `transmission` | One row per loan product per country | 2 | How the policy rate reaches common loans: the benchmark each is priced off, how often it resets and how directly a change passes through. Curated reference notes. |

Every configuration has one split, `full`, because this is a historical record rather than a train/test corpus. The Parquet files under `data/` are the only files mapped to configurations. CSV copies of every table and JSONL copies of `rates` and `decisions` are under `exports/`, deliberately left out of the configurations so the viewer does not count them twice. Column types are in [`schema/`](schema/) and every column is described in [`schema/data-dictionary.json`](schema/data-dictionary.json).

## How to read the fields

- **Rates are exact.** `rate_bps` is an integer number of basis points; `rate_pct` is the same value in percent. For a target range (the Fed since 16 December 2008), `rate_pct` is the **upper bound** and `rate_low_pct`/`rate_high_pct` give both ends. A midpoint is never computed.
- **`rates` is the canonical history.** One row per change, with the rate before and after. `change_bps` is the signed change against the previous upper bound; it is null for the first point and at an era boundary, where an instrument or its basis changed and the two numbers are not comparable (United States from 16 Dec 2008).
- **Eras say what the number is.** `era_basis` is `policy` for the policy rate itself and `observation` for an earlier proxy kept for history. The `eras` configuration explains each boundary.
- **Evidence is explicit.** `evidence` is `official` for the bank’s own series or statement and `secondary` for a cited secondary source. Every row carries a `source_id` that joins to `sources`.
- **Decisions include holds.** `decisions` has one row per announced decision (Fed from 27 Jan 2021), so a meeting that left the rate unchanged is a row with `direction = hold` and `change_bps = 0`. `announced_at` is UTC; `announced_at_local` keeps the bank’s published time and offset. `effective_date` can follow the announcement (the Fed’s new range applies the next day).
- **`daily`** gives the rate in force on every calendar day, including weekends, so it joins directly to other daily or monthly data.
- **`cycles`** are runs of consecutive moves in one direction, computed the same way as on [Policy Rate Atlas](https://rates.ashwingopalsamy.in/): a new cycle starts with the first move after a move the other way. Only policy-era moves count.
- **`annual`** uses the rate in force on 1 January (the last change before it) and on 31 December, or the last observed date for the current year. `is_partial_year` marks a first or current year that the data does not fully cover.
- **`record_text`** is one deterministic sentence built from the fields, for search, retrieval and agents. No text is written by a language model.

## Coverage

- **United States.** Every scheduled FOMC meeting from 27 Jan 2021, from its statement; target changes before then from the official FRED series (effective dates). Eras: Federal funds target rate from 27 Sept 1982; Federal funds target range from 16 Dec 2008.

## Load it

```python
from datasets import load_dataset

repo = "ashwingopalsamy/us-fed-funds-rate-dataset"
rates = load_dataset(repo, split="full")                 # every change, the default configuration
decisions = load_dataset(repo, "decisions", split="full")
```

```python
import pandas as pd

daily = pd.read_parquet("hf://datasets/ashwingopalsamy/us-fed-funds-rate-dataset/data/daily.parquet")
monthly = daily.set_index("date")["rate_pct"].resample("ME").last()
```

```python
import polars as pl

cycles = pl.read_parquet("hf://datasets/ashwingopalsamy/us-fed-funds-rate-dataset/data/cycles.parquet")
print(cycles.filter(pl.col("is_current")))
```

```sql
-- DuckDB
SELECT year, start_rate_pct, end_rate_pct, net_change_bps, hike_count, cut_count
FROM 'hf://datasets/ashwingopalsamy/us-fed-funds-rate-dataset/data/annual.parquet'
ORDER BY year;
```

## Provenance and verification

Each country’s data comes from one content-addressed release, also served by the site’s open API at `https://rates.ashwingopalsamy.in/api/v1/`:

| Country | Release (SHA-256 content hash) | Observed through |
| --- | --- | --- |
| United States | `03ec07b603a974f34ed004641972824ef876a33b09f49ab41002ad807fd72f2d` | 6 Oct 2026 |

`provenance/build-manifest.json` records those releases, the row count of every configuration and a checksum of every file; `SHA256SUMS` covers everything. The build is byte-for-byte reproducible from [the source repository](https://github.com/ashwingopalsamy/repo-rate-visualizer):

```bash
npm ci && pip install -r requirements-hf-dataset.txt
npm run build:hf && npm run test:hf-dataset
```

## Attribution and terms

Each publisher’s own terms apply to its data. [NOTICE.md](NOTICE.md) lists them with the attribution each asks for. No blanket dataset licence is asserted.

## Limitations

- Coverage differs by country: the decision ledger starts where each bank’s own records are available. See `countries.coverage_note`.
- Dates are the bank’s local dates. Historical announcement times for India before the published calendar use 10:00 IST as a convention.
- `transmission` and `events` are curated context, not exhaustive and not causal claims.
- Nothing here is a forecast or advice.

## Citation

```bibtex
@dataset{gopalsamy_us_fed_funds_rate_dataset_2026,
  author    = {Gopalsamy, Ashwin},
  title     = {US Federal Funds Target Rate and FOMC Decision History},
  year      = {2026},
  version   = {1.0.0},
  publisher = {Hugging Face},
  url       = {https://huggingface.co/datasets/ashwingopalsamy/us-fed-funds-rate-dataset}
}
```

Changes between versions are in [CHANGELOG.md](CHANGELOG.md). The live view of this data is [Policy Rate Atlas](https://rates.ashwingopalsamy.in/).
