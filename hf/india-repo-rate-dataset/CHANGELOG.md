# Changelog

## 2.0.0 — 2026-10-08

A rebuild from the verified v3 release that powers [Policy Rate Atlas](https://rates.ashwingopalsamy.in/), in the same schema as [Central Bank Policy Rates](https://huggingface.co/datasets/ashwingopalsamy/central-bank-policy-rates). Breaking: configurations and columns are renamed.

**Added**
- `decisions` is now the full MPC ledger: every decision since 4 Oct 2016, including holds, with the vote (`vote_for`, `vote_against`, `dissents`), the stated stance, a short excerpt and the resolution link. 1.0.0 had four resolution-backed rows.
- `meetings`: the MPC calendar, including scheduled meetings.
- `daily`: the repo rate in force on every calendar day.
- `cycles`: tightening and easing cycles, computed as on the site.
- `eras`: the pre-2004 auction-rate period is now an explicit era (`era_basis = observation`), so `change_bps` is null where the instrument changed.
- `countries` and `transmission` (how the repo rate reaches home loans).

**Changed (1.0.0 → 2.0.0)**

| 1.0.0 | 2.0.0 |
| --- | --- |
| `decisions` (rate history and four resolutions) | `rates` for the rate history; `decisions` for announced MPC decisions |
| `decision_id`, `canonical_key` (`IN:RBI:policy_repo_rate:<date>`) | `rates`: `country_code` + `effective_date`; `decisions.decision_id` (`IN-<date>`) |
| `decision_date` | `decisions.announced_date` (and `announced_at`, `announced_at_local`) |
| `policy_rate_pct`, `policy_rate_bps` | `rate_pct`, `rate_bps` |
| `previous_policy_rate_pct` | `previous_rate_pct` |
| `action` | `rates.direction` (`initial`, `hike`, `cut`, `era_change`); `decisions.direction` (`hike`, `cut`, `hold`) |
| `provenance_class`, `verification_status` | `evidence` (`official`, `secondary`) and `era_basis` |
| `primary_source_*` | `source_id`, `source_url`; details in `sources` |
| `regimes`, `regime_*` | `cycles` (computed, reproducible) |
| `snapshot_id`, `snapshot_checksum` | `release_hash` |
| `annual.start_policy_rate_pct` and siblings | `annual.start_rate_pct` and siblings |

**Removed**: `year_end_*` columns, `decision_summary` (see `record_text`) and the repository-labelled `regimes`.

## 1.0.0 — 2026-08-14

- Initial publication-ready Hugging Face artifact built from SnapshotV2.
- Added canonical `decisions`, derived `annual`, `sources`, contextual `events`, and `regimes` configurations.
- Added typed Parquet, interoperability CSV, agent-friendly JSONL, explicit schemas, a data dictionary, and reproducibility checksums.
- Exposed the distinction between directly verified RBI policy-resolution records and imported Reuters/Shriram historical material.
- Added a standalone attribution notice and machine-readable rights metadata without asserting a dataset license.
- Added deterministic README build facts, trusted contextual-event citation validation, and exact artifact-layout checks.
