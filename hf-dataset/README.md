---
language: en
pretty_name: India RBI Policy Repo Rate and Monetary Policy Decision History
tags:
  - tabular
  - timeseries
  - finance
  - economics
  - monetary-policy
  - central-banking
  - india
  - rbi
  - interest-rates
  - datasets
  - pandas
  - mlcroissant
size_categories:
  - n<1K
configs:
  - config_name: decisions
    default: true
    data_files:
      - split: full
        path: data/decisions.parquet
  - config_name: annual
    data_files:
      - split: full
        path: data/annual.parquet
  - config_name: sources
    data_files:
      - split: full
        path: data/sources.parquet
  - config_name: events
    data_files:
      - split: full
        path: data/events.parquet
  - config_name: regimes
    data_files:
      - split: full
        path: data/regimes.parquet
---

# India RBI Policy Repo Rate and Monetary Policy Decision History

An independent, reproducible dataset of the Reserve Bank of India (RBI) policy
repo rate and its monetary-policy decision history. The canonical table is a
decision ledger: each row is one dated rate observation, including unchanged
policy decisions. Annual summaries, source metadata, contextual events, and
repository-provided regime intervals are separate configurations derived from
or accompanying that ledger.

<!-- BUILD-SUMMARY:START -->
**Current build:** SnapshotV2 `2026-08-14-v2`, retrieved `2026-08-14T07:35:45.400Z`; coverage `2000-06-05` to `2026-08-05`; 107 canonical records, 27 annual rows, 9 sources, 8 contextual events, and 15 regime intervals.
<!-- BUILD-SUMMARY:END -->

## At a glance

- `decisions` is the default configuration: one row per canonical policy-rate observation or identified policy decision.
- `effective_date` orders the rate history; `decision_date` is null when a source does not identify a separate formal decision date.
- `policy_rate_pct` is convenient numeric percent; `policy_rate_bps` is the exact integer basis-point representation.
- `change_bps`, `action`, and `is_rate_change` describe the transition from the previous canonical record.
- `provenance_class` and `verification_status` distinguish directly verified RBI records from legacy imported history.
- `record_text` is deterministic factual text for search, RAG, and agent context; it is not LLM-written.

This dataset is designed for questions such as: What was India’s repo rate at the
end of 2019? How much did RBI tighten during 2022? Which years had the most rate
cuts? Which rows are formal MPC decisions rather than historical observations?

This is not an official RBI product. It is a derived research artifact created
from repository-maintained source records; users should consult the linked RBI
source document for authoritative policy information.

## Why the decision ledger is canonical

The `decisions` configuration has one row per canonical SnapshotV2 record. It
preserves hikes, cuts, and holds rather than reducing the history to one row per
year. The `annual` configuration is calculated entirely from this ledger, so a
year can contain multiple transitions without losing ordering, rate-before/rate-after
semantics, stance, or provenance.

The Parquet files under `data/` are the only files mapped into Hugging Face
configurations. CSV and JSONL files under `exports/` are deliberately not listed
in the frontmatter, so they cannot be ingested by the Dataset Viewer as duplicate
records.

## Configurations

| Configuration | Row grain | Intended use |
| --- | --- | --- |
| `decisions` (default) | One canonical monetary-policy/rate observation | Exact history, event ordering, RAG, search, and agent answers |
| `annual` | One row per calendar year from the earliest through latest snapshot year | Yearly analytics and compact question answering |
| `sources` | One row per source document/resource | Citation, retrieval, and provenance joins |
| `events` | One row per contextual macro/policy event | Independent timeline context; not causal annotations |
| `regimes` | One row per repository-provided regime interval | Contextual interval joins |

All configurations use a custom `full` split because this is a historical data
ledger, not an ML train/test corpus. The exact Arrow/Parquet schema is available
in [`schema/`](schema/), and field-level semantics are in
[`schema/data-dictionary.json`](schema/data-dictionary.json).

## Important field semantics

In `decisions`:

- `effective_date` is the canonical ordering and rate-effective/observation date.
- `decision_date` is populated only for the three RBI policy-resolution records
  in the current snapshot. Imported historical observations intentionally use
  null rather than an invented decision date.
- `policy_rate_pct` is a convenient numeric percentage and
  `policy_rate_bps` is the exact integer representation. `change_bps` is signed:
  positive is a hike, negative is a cut, and zero is a hold.
- `previous_policy_rate_bps` is the previous canonical ledger rate, not a
  previous row in an annual summary. The first observation has null previous
  rates and action `initial`.
- `canonical_key` is stable and globally readable, for example
  `IN:RBI:policy_repo_rate:2026-08-05`. `decision_id` is a stable dataset-level
  identifier, while `snapshot_decision_id` preserves the source ledger ID.
- `record_text` and `decision_summary` are deterministic factual text generated
  from structured fields. They are not LLM-written and do not repeat long RBI
  source prose.
- `regime_id` joins to `regimes` using start-inclusive/end-exclusive intervals.
  Dates in a gap remain null. Regime labels are repository context, not official
  RBI classifications.

Source quality is explicit. `official_primary` identifies a direct RBI policy
resolution or direct RBI rate-data source; `official_secondary` identifies RBI
archive, minutes, or current-rate context; `legacy_import` identifies imported
Reuters/Shriram historical material. `verification_status` makes the distinction
visible as `verified_primary_source`, `historical_legacy_source`,
`official_secondary_source`, or `mixed_provenance`. The current build contains
104 `historical_rate_observation` rows with legacy provenance and three
`policy_decision` rows backed by RBI policy resolutions.

## Annual calculation rules

The annual table includes every year from the earliest effective year through the
latest snapshot year, including years with zero canonical ledger records. In the
current build, 2021 is represented with `decision_count = 0` and carries forward
the rate in force from 2020.

- `start_policy_rate_pct` is the latest rate effective strictly before January 1.
- `end_policy_rate_pct` is the latest rate effective on or before December 31.
- `min_policy_rate_pct` and `max_policy_rate_pct` consider known in-force rates,
  including a carry-in rate.
- `net_change_bps` is end minus start and is null when either boundary is unknown.
  This is why 2000 has a null net change: the available history begins during
  that year.
- `gross_hikes_bps` sums positive canonical transitions and `gross_cuts_bps`
  sums the absolute values of negative canonical transitions. Holds are retained
  in `decision_count` and `hold_count`; the initial observation is neither a hike
  nor a cut.
- `year_end_source_id` supports the rate in force at year end, including a
  carry-in source for a zero-decision year. `year_end_action` and
  `year_end_stance` are null when no decision occurred in that year.

## Load examples

The default configuration is the decision ledger:

```python
from datasets import load_dataset

repo = "ashwingopalsamy/india-repo-rate-dataset"
decisions = load_dataset(repo, split="full")
annual = load_dataset(repo, "annual", split="full")
print(decisions.features)
print(decisions.filter(lambda row: row["action"] == "cut")[0])
```

For a local checkout or downloaded artifact, point `data_files` at the canonical
Parquet file explicitly:

```python
from datasets import load_dataset

annual = load_dataset(
    "parquet",
    data_files={"full": "hf-dataset/data/annual.parquet"},
    split="full",
)
```

Pandas and Polars preserve the typed Parquet columns:

```python
import pandas as pd
import polars as pl

df = pd.read_parquet("hf-dataset/data/decisions.parquet")
cuts = df.loc[df["action"].eq("cut"), ["effective_date", "policy_rate_bps", "change_bps"]]

pl_df = pl.read_parquet("hf-dataset/data/annual.parquet")
print(pl_df.filter(pl.col("decision_count") == 0))
```

DuckDB can query the canonical file without loading a database:

```sql
SELECT year, net_change_bps, hike_count, cut_count, hold_count
FROM read_parquet('hf-dataset/data/annual.parquet')
ORDER BY year;
```

For RAG or an autonomous agent, retrieve `decisions.record_text` and retain
`canonical_key`, `effective_date`, `change_bps`, `stance`,
`verification_status`, and `primary_source_url` in the answer context. The
sentence is deterministic, while the structured fields remain the source of
truth for filtering and exact arithmetic. A source URL should be cited when a
claim matters. Events are independent context and should not be described as
causal explanations for decisions.

## Source methodology and provenance

The build reads only `src/data/snapshot.json`, validates SnapshotV2, and does
not use historical V1 snapshots or website runtime exports as additional inputs.
The canonical rate transitions are checked with decimal arithmetic. Source IDs,
source checksums, retrieval timestamps, and publication timestamps are preserved
or normalized without replacing unknown values with sentinel strings.

The repository’s current history contains a Reuters historical series covering
the older rate observations, with a Shriram Finance reference retained in the
source table. Those rows remain useful for historical continuity but are visibly
marked `legacy_import` and `historical_legacy_source`; they are not represented
as equivalent to a row tied to a specific RBI policy resolution. The three latest
policy-resolution records are marked `official_primary` and
`verified_primary_source`. Source priority is deterministic and prefers a policy
resolution over minutes, contextual pages, and legacy material when a row has
multiple sources.

## Reproduce and verify

From the repository root, install the pinned build/test dependencies and rebuild:

```bash
python3 -m pip install -r requirements-hf-dataset.txt
python3 scripts/build-hf-dataset.py
python3 -m unittest tests/data/test_hf_dataset.py
npm run test:hf-dataset
```

`generated_at` is intentionally the SnapshotV2 retrieval timestamp, not the wall
clock, so rebuilding the same snapshot is byte-identical. The manifest records
the snapshot ID/checksum, generator and schema versions, row counts, coverage,
and output checksums. `SHA256SUMS` covers every artifact except itself.

The semantic dataset schema version is `1.0.0`; a data refresh that adds a new
policy decision does not by itself require a schema-version change. The source
snapshot identity and freshness are separate fields.

## Attribution & Usage

This is an independent, non-official educational reference compiled from publicly available records published by the Reserve Bank of India and other cited publishers. Source titles, marks, and publisher materials remain with their respective owners; this project does not claim ownership of third-party material. This project is not created by, affiliated with, authorised by, sponsored by, or endorsed by the Reserve Bank of India; no official relationship, approval, or representation should be inferred.

The information is provided for research and general information only, “as is” and without representation or warranty, express or implied, including as to accuracy, completeness, timeliness, availability, or fitness for a particular purpose, to the fullest extent permitted by applicable law. Verify every figure, interpretation, and update against the original publication before relying on it; this project should not be used as the sole basis for any decision.

Nothing here constitutes financial, investment, legal, tax, accounting, or other professional advice, an offer, recommendation, solicitation, or fiduciary relationship. Links and citations are provided for identification and verification only, not as a licence to reproduce protected third-party content. Nothing in this notice limits any right or remedy that cannot lawfully be excluded.

Reference material: [RBI data dissemination material](https://rbi.org.in/scripts/PublicationsView.aspx?Id=18086).

This notice is not a dataset license. No blanket redistribution license is asserted.
The transformation code is separate from rights in RBI, Reuters, Shriram Finance,
and other third-party source material. Review source-specific terms before
redistributing or using the data commercially. The machine-readable rights summary
is in [`provenance/build-manifest.json`](provenance/build-manifest.json) and
[`schema/data-dictionary.json`](schema/data-dictionary.json).

## Limitations

The source records provide a strong machine-readable transition history but do
not make every historical observation an identified RBI policy-resolution event.
Older rows therefore have null stance and decision dates where the source does
not provide them. Regime labels and contextual events are repository-maintained
annotations, not official RBI classifications or causal evidence. Rate values
and exact decision claims should be checked against the linked primary RBI source
where one exists.

Suggested citation:

> *India RBI Policy Repo Rate and Monetary Policy Decision History*, independent
> derived dataset from the `repo-rate-visualizer` SnapshotV2 ledger, schema
> version 1.0.0. Cite the snapshot ID, checksum, and the relevant source URL from
> `provenance/build-manifest.json` and the `sources` configuration.

## Links

- [Dataset page](https://huggingface.co/datasets/ashwingopalsamy/india-repo-rate-dataset)
- [Source repository](https://github.com/ashwingopalsamy/repo-rate-visualizer)
- [RBI disclaimer and copyright policy](https://www.rbi.org.in/Scripts/Disclaimer.aspx)
- [RBI data dissemination material](https://rbi.org.in/scripts/PublicationsView.aspx?Id=18086)
- [RBI historical data](https://www.rbi.org.in/Scripts/bs_viewcontent.aspx?Id=624)
- [Hugging Face manual dataset configuration](https://huggingface.co/docs/hub/en/datasets-manual-configuration)
- [Hugging Face dataset file names and custom splits](https://huggingface.co/docs/hub/main/datasets-file-names-and-splits)
- [Hugging Face Parquet Viewer processing](https://huggingface.co/docs/dataset-viewer/parquet_process)
- [Hugging Face Croissant metadata](https://huggingface.co/docs/dataset-viewer/croissant)
