# Contributing

Contributions should make the chartbook more useful, more citable, or more
maintainable without adding unsupported authority. Keep the static Vite
architecture, existing visual language, and source-backed boundaries intact.

## Data corrections

1. Identify the exact record date and release affected.
2. Add or update a fixture under `tests/fixtures/rbi/` when parser behaviour is
   involved.
3. Cite the original publisher URL and explain the declared source class.
4. Run `npm run test:data`, `npm run test:hf-dataset`, `npm run build`, and
   `git diff --check`.

Do not silently replace an immutable release. New source evidence should create
a new release and leave the previous artifact addressable.

## Application changes

Prefer small, composable changes. Keep analytical state URL-addressable,
keyboard-operable, and reflected in exports. Add focused deterministic tests
for new data or state logic and browser coverage for user-visible workflows.

## Pull requests

Describe the user or contributor problem, the files or records affected, and
how the change was verified. For data changes, include the generated release
change report. Do not add AI-generated commentary, forecasts, investment
recommendations, or claims that are not supported by the declared sources.
