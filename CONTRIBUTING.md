# Contributing

Contributions should make the atlas more useful, more citable or more
maintainable without adding unsupported authority. Keep the existing
visual language, the source-backed boundaries and the immutable release
history intact.

Start with the [documentation](README.md#documentation).

## Data corrections

1. Identify the country, the record date and the release affected
   (`data/manifest.json` points to each country's current release).
2. When parser behaviour is involved, add or update a recorded fixture under
   `tests/fixtures/<cc>/` and a test under `tests/pipeline/`.
3. Cite the original publisher URL and explain the evidence class
   (official or secondary).
4. Never edit a file under `data/releases/` by hand. A change to history
   needs a change in the country's adapter that emits a `corrections` entry
   (`recordId`, `reason`, `sourceId`; see `schema/release.ts`), published
   through the pipeline as a new release. No adapter emits one yet; see
   [docs/data-pipeline.md](docs/data-pipeline.md).

Rebuild the Hugging Face datasets when data changes (`npm run build:hf`)
and commit `hf/`; see [docs/datasets.md](docs/datasets.md).

## Code changes

Prefer small, composable changes. Keep country switches a data change, never
a page reload. Keep everything keyboard-operable and accessible. Add focused
deterministic tests for data and logic, and browser coverage for anything
visible. Any change to analytics must keep the privacy page true;
see [docs/analytics.md](docs/analytics.md).

## Checks to run

Continuous integration (`.github/workflows/validate.yml`) runs these on every
pull request; run the ones your change touches before opening one.

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

```bash
npm run test:data
```

```bash
npm run test:hf-dataset
```

```bash
npm run build:hf
```

```bash
npm run build
```

```bash
npm run test:browser
```

`test:browser` serves the production build, so run `npm run build` first. Locally
it uses an installed Google Chrome; CI installs Chromium instead.

```bash
git diff --check
```

CI also fails if the committed `hf/` differs from a fresh `npm run build:hf`.

The Python dataset steps need a virtual environment; see
[docs/datasets.md](docs/datasets.md).

## Pull requests

Describe the problem, the files or records affected, and how the change was
verified. For data changes, name the affected releases (country and hash).
Do not add AI-generated commentary, forecasts, investment recommendations,
or claims that are not supported by the declared sources.
