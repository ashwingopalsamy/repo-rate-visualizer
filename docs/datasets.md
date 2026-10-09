# Hugging Face datasets

## The datasets

This repo publishes eight datasets to the Hugging Face Hub under `ashwingopalsamy/`. Each one is built into `hf/<repo>/` from the same verified releases as the site, https://rates.ashwingopalsamy.in.

| Dataset | Covers | Version |
| --- | --- | --- |
| [central-bank-policy-rates](https://huggingface.co/datasets/ashwingopalsamy/central-bank-policy-rates) | All seven banks in one schema | 1.0.0 |
| [india-repo-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/india-repo-rate-dataset) | Reserve Bank of India policy repo rate | 2.0.0 |
| [us-fed-funds-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/us-fed-funds-rate-dataset) | Federal Reserve federal funds target | 1.0.0 |
| [euro-area-deposit-facility-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/euro-area-deposit-facility-rate-dataset) | ECB deposit facility rate | 1.0.0 |
| [uk-bank-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/uk-bank-rate-dataset) | Bank of England Bank Rate | 1.0.0 |
| [canada-overnight-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/canada-overnight-rate-dataset) | Bank of Canada overnight rate target | 1.0.0 |
| [australia-cash-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/australia-cash-rate-dataset) | RBA cash rate target | 1.0.0 |
| [brazil-selic-rate-dataset](https://huggingface.co/datasets/ashwingopalsamy/brazil-selic-rate-dataset) | BCB Selic target | 1.0.0 |

Each per-country dataset is exactly the multi-country tables filtered to that country. A table with no rows for a country is left out. EA, GB, CA, AU and BR have no `decisions` or `meetings` yet, so their per-country datasets have neither table.

## Tables

Each table is a Parquet configuration with one split named `full`. `rates` is the default configuration.

| Table | One row per | Notes |
| --- | --- | --- |
| `rates` (default) | change in the rate | rate before and after, era, evidence, source |
| `daily` | calendar day | the rate in force each day, from 1 Jan 2000 or the series start |
| `decisions` | announced decision | includes holds, with vote, stance, excerpt and statement link (India and US) |
| `meetings` | scheduled meeting | past and upcoming, linked to the decision |
| `cycles` | tightening or easing cycle | computed exactly as on the site |
| `annual` | country and year | start, end, range, net and gross change, counts |
| `countries` | country | coverage dates and release hash |
| `eras` | instrument period | why `change_bps` is null at an era boundary |
| `events` | context event | context only (India) |
| `sources` | source | URL and whether it is official |
| `transmission` | loan product | how the rate reaches loans |

Rates follow one convention. `rate_pct` is the point rate or the upper bound of a range, never a midpoint; `rate_low_pct` and `rate_high_pct` give both ends.

Each dataset folder also contains the following.

| Path | Contents |
| --- | --- |
| `data/<table>.parquet` | One Parquet file per table |
| `exports/<table>.csv` | CSV copy of every table |
| `exports/rates.jsonl` | JSONL copy of `rates` |
| `exports/decisions.jsonl` | JSONL copy of `decisions`, where the dataset has it |
| `schema/` | JSON schema per table, and `data-dictionary.json` |
| `provenance/build-manifest.json` | Releases used, row count per configuration, checksum per file |
| `SHA256SUMS` | Checksums of every file, compared by the publish script |
| `README.md`, `NOTICE.md`, `VERSION` | Generated dataset card, licence notice and version |
| `CHANGELOG.md` | Hand-written version history |

## Local setup

The build needs the packages pinned in `requirements-hf-dataset.txt`: pyarrow, datasets, PyYAML and huggingface_hub. The pins are for Python 3.12. macOS has no `python` command, and its `python3` does not have these packages, so use a virtual environment. If `python3` is not 3.12, create the environment with a 3.12 interpreter instead.

```bash
python3 -m venv .venv
```

```bash
.venv/bin/pip install -r requirements-hf-dataset.txt
```

`.venv/` is git-ignored.

## Build and test

`npm run build:hf` runs two steps. The first step runs the TypeScript file `scripts/build-hf-tables.ts` with `node`. `scripts/hf/tables.ts` declares every column and builds the rows, and `scripts/hf/cards.ts` writes each README and NOTICE. That step writes `.out/hf/bundle.json`. The second step, `python3 scripts/build-hf-datasets.py`, writes the dataset folders.

```bash
npm run build:hf
```

The npm script calls `python3`, so it fails if `python3` lacks the packages. In that case, run the two steps by hand, using the venv for the second.

```bash
node scripts/build-hf-tables.ts
```

```bash
.venv/bin/python scripts/build-hf-datasets.py
```

The build is byte-for-byte reproducible. CI (`validate.yml`) rebuilds `hf/` from `data/` and fails if the committed copy differs. Commit `hf/` whenever the data or the dataset code changes.

`npm run test:hf-dataset` builds twice and checks:

- identical output from the two builds
- front matter
- row counts
- each per-country dataset equals the filtered multi-country tables
- the daily series has no gaps
- range and era rules
- every table loads with the `datasets` library

```bash
npm run test:hf-dataset
```

The npm script also calls `python3`. With the venv, run the same test directly.

```bash
.venv/bin/python -m unittest tests/data/test_hf_datasets.py
```

TypeScript tests for the tables are in `tests/app/hf-tables.test.ts`. They run with the app tests.

```bash
npm run test:app
```

## Publish

`scripts/publish-hf.py` uploads a folder under `hf/` only when its `SHA256SUMS` differs from the copy on the Hub. It creates missing repos as public, and it removes remote files that the build no longer produces. Always run a dry run first. It needs no token.

```bash
.venv/bin/python scripts/publish-hf.py --dry-run
```

Then publish with a Hugging Face write token in `HF_TOKEN`. Do not paste the token into a chat or commit it.

```bash
HF_TOKEN=<your write token> .venv/bin/python scripts/publish-hf.py
```

Add `--only <folder>` to limit a run to one dataset, for example `--only india-repo-rate-dataset`. A 403 error means the token is read-only.

## Versions and changelogs

Each dataset's version is set in `DATASETS` in `scripts/hf/cards.ts`. Each `hf/<repo>/CHANGELOG.md` is written by hand. Its first `## ` heading must start with that version, or the build fails.

| Change | Version rule |
| --- | --- |
| Data refresh | Keep the version |
| Columns or tables added | Bump the minor version |
| Columns or tables renamed or removed | Bump the major version |

India moved to 2.0.0 for this reason, and its changelog maps every 1.0.0 column.

`VERSION`, `README.md`, `NOTICE.md`, `data/`, `exports/`, `schema/` and `provenance/` are generated. Do not edit them by hand.

## Licensing

Each publisher's own terms apply to its data. `NOTICE.md` in every dataset lists those terms and the attribution each publisher asks for. The source of truth is `PUBLISHERS` in `scripts/hf/cards.ts`, checked against the publishers' pages on 8 Oct 2026.

The Banco Central do Brasil publishes the Selic series under the ODbL 1.0. So `brazil-selic-rate-dataset` is published under the ODbL, and Brazil's rows in `central-bank-policy-rates` remain under it. No other dataset licence is asserted.

See also [DATA-LICENSE.md](../DATA-LICENSE.md).

## Automatic updates

When the refresh workflow (`.github/workflows/refresh.yml`) publishes new data, it rebuilds `hf/`, runs the tests, commits the result, and publishes to Hugging Face, all in the same job. Pushes made by the workflow do not trigger other workflows.

`.github/workflows/hf-publish.yml` publishes changes that people merge. It runs on pushes to `main` that touch `hf/**`, and it can be run by hand with a `dry_run` option.

Both workflows need the `HF_TOKEN` repository secret. See [operations.md](operations.md).
