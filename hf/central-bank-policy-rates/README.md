---
language:
- en
pretty_name: "Central Bank Policy Rates: India, US, Euro Area, UK, Canada, Australia and Brazil"
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
- india
- united-states
- euro-area
- united-kingdom
- canada
- australia
- brazil
size_categories:
- 10K<n<100K
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
- config_name: events
  data_files:
  - split: full
    path: data/events.parquet
- config_name: sources
  data_files:
  - split: full
    path: data/sources.parquet
- config_name: transmission
  data_files:
  - split: full
    path: data/transmission.parquet
---

# Central Bank Policy Rates: India, US, Euro Area, UK, Canada, Australia and Brazil

An independent, reproducible dataset of seven central banks’ policy rates, built from each central bank’s own published series and statements. Every row cites its source, every rate is an exact number of basis points, and the whole dataset is rebuilt automatically when a bank publishes a decision. One dataset per country is also published: [IN](https://huggingface.co/datasets/ashwingopalsamy/india-repo-rate-dataset) · [US](https://huggingface.co/datasets/ashwingopalsamy/us-fed-funds-rate-dataset) · [EA](https://huggingface.co/datasets/ashwingopalsamy/euro-area-deposit-facility-rate-dataset) · [GB](https://huggingface.co/datasets/ashwingopalsamy/uk-bank-rate-dataset) · [CA](https://huggingface.co/datasets/ashwingopalsamy/canada-overnight-rate-dataset) · [AU](https://huggingface.co/datasets/ashwingopalsamy/australia-cash-rate-dataset) · [BR](https://huggingface.co/datasets/ashwingopalsamy/brazil-selic-rate-dataset).

**Current build:** data observed through 7 Oct 2026; daily coverage from 1 Jan 2000; 507 rate changes, 108 announced decisions and 60,860 daily rows.

## At a glance

| Country | Central bank | Instrument | Rate now | Since | Decisions | Series from |
| --- | --- | --- | --- | --- | --- | --- |
| India | Reserve Bank of India | Policy repo rate | 5.50% | 7 Oct 2026 | 62 | 5 Jun 2000 |
| United States | Federal Reserve | Federal funds target range | 3.75–4.00% | 17 Sept 2026 | 46 | 16 Nov 1999 |
| Euro area | European Central Bank | Deposit facility rate | 2.50% | 16 Sept 2026 | being added | 5 Nov 1999 |
| United Kingdom | Bank of England | Bank Rate | 3.75% | 18 Dec 2025 | being added | 4 Nov 1999 |
| Canada | Bank of Canada | Target for the overnight rate | 2.25% | 30 Oct 2025 | being added | 21 Apr 2009 |
| Australia | Reserve Bank of Australia | Cash rate target | 4.60% | 30 Sept 2026 | being added | 4 Jan 2011 |
| Brazil | Banco Central do Brasil | Selic target | 13.75% | 17 Sept 2026 | being added | 1 Jan 2000 |

Questions this dataset answers directly:
- Which central banks are tightening and which are easing right now?
- How far apart are the Fed and the ECB today, and how has the gap moved since 2000?
- Which bank moved first in the 2022 tightening, and by how much did each raise rates that year?
- What rate was in force in every country on a given date?

This is not an official product of any central bank. For anything that matters, follow the `source_url` or `statement_url` on the row to the bank’s own publication.

## Configurations

| Configuration | Row grain | Rows | What it holds |
| --- | --- | --- | --- |
| `rates` (default) | One row per change in the rate | 507 | Every change point of the policy rate, with the level before and after, its era and its source. |
| `daily` | One row per calendar day per country | 60,860 | The rate in force on every calendar day, from 1 Jan 2000 (or the first point of the series, if later) to the date the official series was last observed. Ready to join to any daily or monthly data. |
| `decisions` | One row per announced decision, including holds | 108 | Every announced decision in the ledger, from the bank’s own statement or resolution: hikes, cuts and holds, with the vote, stance, a short excerpt and the statement link. |
| `meetings` | One row per scheduled meeting, past and upcoming | 117 | The meeting calendar, including meetings still to come, with the decision each held meeting produced. |
| `cycles` | One row per tightening or easing cycle | 68 | Each run of consecutive moves in one direction since the policy-rate era began, computed exactly as on the site: a cycle starts with the first move after a move the other way. |
| `annual` | One row per country per calendar year | 169 | Yearly summaries computed from `rates` and `decisions`: the rate at each end of the year, its range, the net and gross change, and how many hikes, cuts and holds there were. |
| `countries` | One row per country | 7 | What each country’s data covers: the bank, the instrument, the dates covered and the release it was built from. |
| `eras` | One row per instrument period | 9 | The periods in which one instrument and basis applied. A change of era is why `change_bps` is null at its first point. |
| `events` | One row per context event | 8 | Dated events that help read the rate history. Context only, not causal claims. |
| `sources` | One row per source | 144 | Every source the rows cite: official series, statements, calendars and labelled secondary sources. |
| `transmission` | One row per loan product per country | 14 | How the policy rate reaches common loans: the benchmark each is priced off, how often it resets and how directly a change passes through. Curated reference notes. |

Every configuration has one split, `full`, because this is a historical record rather than a train/test corpus. The Parquet files under `data/` are the only files mapped to configurations. CSV copies of every table and JSONL copies of `rates` and `decisions` are under `exports/`, deliberately left out of the configurations so the viewer does not count them twice. Column types are in [`schema/`](schema/) and every column is described in [`schema/data-dictionary.json`](schema/data-dictionary.json).

## How to read the fields

- **Rates are exact.** `rate_bps` is an integer number of basis points; `rate_pct` is the same value in percent. For a target range (the Fed since 16 December 2008), `rate_pct` is the **upper bound** and `rate_low_pct`/`rate_high_pct` give both ends. A midpoint is never computed.
- **`rates` is the canonical history.** One row per change, with the rate before and after. `change_bps` is the signed change against the previous upper bound; it is null for the first point and at an era boundary, where an instrument or its basis changed and the two numbers are not comparable (India from 29 Oct 2004; United States from 16 Dec 2008).
- **Eras say what the number is.** `era_basis` is `policy` for the policy rate itself and `observation` for an earlier proxy kept for history, such as India’s pre-2004 repo auction rate. The `eras` configuration explains each boundary.
- **Evidence is explicit.** `evidence` is `official` for the bank’s own series or statement and `secondary` for a cited secondary source. Every row carries a `source_id` that joins to `sources`.
- **Decisions include holds.** `decisions` has one row per announced decision (RBI from 4 Oct 2016, Fed from 27 Jan 2021), so a meeting that left the rate unchanged is a row with `direction = hold` and `change_bps = 0`. `announced_at` is UTC; `announced_at_local` keeps the bank’s published time and offset. `effective_date` can follow the announcement (the Fed’s new range applies the next day).
- **Series-only countries.** Euro area, United Kingdom, Canada, Australia and Brazil have the full official series of rate changes, but announced decisions (and so holds and votes) are still being added. Their rows in `annual` carry null `hold_count` and `decision_count` rather than zero.
- **`daily`** gives the rate in force on every calendar day, including weekends, so it joins directly to other daily or monthly data.
- **`cycles`** are runs of consecutive moves in one direction, computed the same way as on [Policy Rate Atlas](https://rates.ashwingopalsamy.in/): a new cycle starts with the first move after a move the other way. Only policy-era moves count.
- **`annual`** uses the rate in force on 1 January (the last change before it) and on 31 December, or the last observed date for the current year. `is_partial_year` marks a first or current year that the data does not fully cover.
- **`record_text`** is one deterministic sentence built from the fields, for search, retrieval and agents. No text is written by a language model.

## Coverage

- **India.** Every MPC decision from 4 Oct 2016 from its official resolution; earlier rate changes from earlier published histories, with secondary sources labelled. Historical announcement times use 10:00 IST as a convention. Eras: Repo rate (pre-2004 usage: absorption) from 5 Jun 2000; Policy repo rate from 29 Oct 2004.
- **United States.** Every scheduled FOMC meeting from 27 Jan 2021, from its statement; target changes before then from the official FRED series (effective dates). Eras: Federal funds target rate from 27 Sept 1982; Federal funds target range from 16 Dec 2008.
- **Euro area.** Every change in the deposit facility rate from the ECB Data Portal (dates of change). Decision records and votes are being added.
- **United Kingdom.** Every change in Bank Rate from the Bank of England database (daily series). Decision records and votes are being added.
- **Canada.** Every change in the overnight rate target from Bank of Canada Valet (daily series from April 2009). Decision records are being added.
- **Australia.** Every change in the cash rate target from RBA table F1 (daily series from January 2011). Decision records are being added.
- **Brazil.** Every change in the Selic target from BCB SGS series 432 (daily). Decision records are being added.

## Load it

```python
from datasets import load_dataset

repo = "ashwingopalsamy/central-bank-policy-rates"
rates = load_dataset(repo, split="full")                 # every change, the default configuration
decisions = load_dataset(repo, "decisions", split="full")
uk = rates.filter(lambda row: row["country_code"] == "GB")
```

```python
import pandas as pd

daily = pd.read_parquet("hf://datasets/ashwingopalsamy/central-bank-policy-rates/data/daily.parquet")
wide = daily.pivot(index="date", columns="country_code", values="rate_pct")   # one column per bank
```

```python
import polars as pl

cycles = pl.read_parquet("hf://datasets/ashwingopalsamy/central-bank-policy-rates/data/cycles.parquet")
print(cycles.filter(pl.col("is_current")))
```

```sql
-- DuckDB
SELECT country_code, year, start_rate_pct, end_rate_pct, net_change_bps, hike_count, cut_count
FROM 'hf://datasets/ashwingopalsamy/central-bank-policy-rates/data/annual.parquet'
ORDER BY country_code, year;
```

## Provenance and verification

Each country’s data comes from one content-addressed release, also served by the site’s open API at `https://rates.ashwingopalsamy.in/api/v1/`:

| Country | Release (SHA-256 content hash) | Observed through |
| --- | --- | --- |
| India | `6b9bdc02c553c5cdb32c49c1a749a6e7760d2e0adcfe28990fed8b9719739060` | 7 Oct 2026 |
| United States | `03ec07b603a974f34ed004641972824ef876a33b09f49ab41002ad807fd72f2d` | 6 Oct 2026 |
| Euro area | `499b2f064dfe033ce9bc5d0dabb98ef8e48b2db44d66ff48a02ec929e91acb1b` | 7 Oct 2026 |
| United Kingdom | `38d45b4be6a03ceca1a86a766772e94f807c1b0db7ca30408eed922982835ff1` | 6 Oct 2026 |
| Canada | `5c0b58687989dd75230cd64f7ab6d37381e4eddaece2a82bb73a8d3ba6c41cf5` | 6 Oct 2026 |
| Australia | `fd81f8557e007c68c78b0ef835dd5464cb7313612afd0e3bdd3f7f3ce319324a` | 6 Oct 2026 |
| Brazil | `59c6949350fb38008d952ac1510c310429ae0f266d9f4524660a0ba9ff53155a` | 7 Oct 2026 |

`provenance/build-manifest.json` records those releases, the row count of every configuration and a checksum of every file; `SHA256SUMS` covers everything. The build is byte-for-byte reproducible from [the source repository](https://github.com/ashwingopalsamy/repo-rate-visualizer):

```bash
npm ci && pip install -r requirements-hf-dataset.txt
npm run build:hf && npm run test:hf-dataset
```

## Attribution and terms

Each publisher’s own terms apply to its data. [NOTICE.md](NOTICE.md) lists them with the attribution each asks for. No blanket dataset licence is asserted.

## Limitations

- Coverage differs by country: announced decisions are not yet available for Euro area, United Kingdom, Canada, Australia and Brazil. See `countries.coverage_note`.
- Dates are the bank’s local dates. Historical announcement times for India before the published calendar use 10:00 IST as a convention.
- `transmission` and `events` are curated context, not exhaustive and not causal claims.
- Nothing here is a forecast or advice.

## Citation

```bibtex
@dataset{gopalsamy_central_bank_policy_rates_2026,
  author    = {Gopalsamy, Ashwin},
  title     = {Central Bank Policy Rates: India, US, Euro Area, UK, Canada, Australia and Brazil},
  year      = {2026},
  version   = {1.0.0},
  publisher = {Hugging Face},
  url       = {https://huggingface.co/datasets/ashwingopalsamy/central-bank-policy-rates}
}
```

Changes between versions are in [CHANGELOG.md](CHANGELOG.md). The live view of this data is [Policy Rate Atlas](https://rates.ashwingopalsamy.in/).
