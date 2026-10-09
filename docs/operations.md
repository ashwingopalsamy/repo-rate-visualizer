# Operations

## Overview

The live site is https://rates.ashwingopalsamy.in. The code is in the `ashwingopalsamy/repo-rate-visualizer` repository on GitHub, and `main` is the production branch. Use Node 24, which `.node-version` sets. The Hugging Face datasets need Python 3.12.

Cloudflare runs two Workers from this repository:

| Worker | Config file | Triggers | What it does |
|---|---|---|---|
| `policy-rate-atlas` | `wrangler.jsonc` (repo root) | Public URL and cron `40 0 * * *` | Serves the built site from `dist/` as static assets. Its code (`worker/site/`) runs only for `/e` (the analytics collector, `POST /e`) and for the daily rollup. |
| `atlas-dispatch` | `worker/dispatch/wrangler.jsonc` | Crons `*/10 * * * *` and `17 6 * * *`, no URL | Starts data refresh runs. |

`atlas-dispatch` starts a data refresh on a retry ladder of 10, 25, 45, 90, 180 and 360 minutes after a scheduled announcement. Its daily sweep covers all countries. Cron times are UTC.

The pipeline runs in GitHub Actions and commits fresh data to `main`. Visitors see new data only after a deploy, because the site serves the build output in `dist/`. Until Workers Builds is connected, that deploy is manual (see Deploy). Pipeline details are in [data-pipeline.md](data-pipeline.md).

The main workflows are `refresh.yml`, `hf-publish.yml` and `validate.yml`. Routine operations covers each one.

## Deploy

The site deploys by hand today. Once Workers Builds is connected, a push to `main` deploys it instead. The dispatcher is a separate Worker and deploys separately.

### Manual deploy

Run these three commands from the repo root, on an up-to-date `main`.

```bash
git pull
```

```bash
npm run build
```

```bash
npx wrangler deploy
```

### Workers Builds

Connect the repository in the Cloudflare dashboard: Workers & Pages, then Create, then Import repository. Use these settings.

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build` |
| Deploy command | `npx wrangler deploy` |
| Environment variable | `NODE_VERSION=24` |
| Production branch | `main` |

Once connected, every push to `main` redeploys, including the bot's data commits. Also add `VITE_CF_BEACON_TOKEN` to the build environment. Without it, no Web Analytics beacon loads.

### Dispatcher

Set `GITHUB_DISPATCH_TOKEN` first (see Secrets and variables). Then deploy `atlas-dispatch` from the repo root. The dispatcher has no URL.

```bash
npx wrangler deploy --config worker/dispatch/wrangler.jsonc
```

### Analytics D1 (optional)

The daily rollup writes to D1. Without D1 and the rollup secrets, events older than three months are lost. The collector and rollup are described in [analytics.md](analytics.md).

Create the database:

```bash
npx wrangler d1 create atlas-analytics
```

In `wrangler.jsonc`, add a comma at the end of the `observability` line. Then remove the `//` at the start of the `d1_databases` line, and replace `<id>` with the printed id. Apply the migrations:

```bash
npx wrangler d1 migrations apply atlas-analytics --remote
```

Add your account id as a variable in `wrangler.jsonc` (an account id is an identifier, not a secret):

```jsonc
"vars": { "CF_ACCOUNT_ID": "<your account id>" }
```

Set `CF_ANALYTICS_READ_TOKEN` (see Secrets and variables), then deploy `policy-rate-atlas` again. `npx wrangler whoami` prints the account id.

### Vercel v1 host

`vercel.json` is the old v1 host. After cutover, change it to a redirect-only deploy to `https://rates.ashwingopalsamy.in`.

## Secrets and variables

Store each value only in Cloudflare or GitHub, never in a file in the repository. The table lists names only.

| Name | Where it is set | What it does | Without it |
|---|---|---|---|
| `HF_TOKEN` | GitHub repository secret | Hugging Face write token used to publish the datasets | Publishing is skipped |
| `ANALYTICS_SALT_KEY` | Wrangler secret on `policy-rate-atlas` | Key for the daily anonymous visitor id | Events are counted but unique visitors are not |
| `CF_ANALYTICS_READ_TOKEN` | Wrangler secret on `policy-rate-atlas` | Account Analytics read token for the daily rollup into D1 | Rollup does nothing |
| `CF_ACCOUNT_ID` | Wrangler variable on `policy-rate-atlas` | Cloudflare account id for the rollup | Rollup does nothing |
| `VITE_CF_BEACON_TOKEN` | Build environment (Workers Builds) | Public site token for the Cloudflare Web Analytics beacon | No beacon is loaded |
| `GITHUB_DISPATCH_TOKEN` | Wrangler secret on `atlas-dispatch` | Fine-grained token (this repo, Actions read and write) that starts refresh runs | Refreshes run only on the weekly schedule or by hand |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ANALYTICS_TOKEN` | GitHub repository secrets | Weekly analytics report workflow | The report is skipped |
| `SITE_LIVE` | GitHub repository variable (`true`) | Turns on the verify-live job | verify-live does not run |

`CF_ANALYTICS_READ_TOKEN` and `CLOUDFLARE_ANALYTICS_TOKEN` can be the same Account Analytics read token.

The secret commands below prompt for the value, so it stays out of shell history. Set the Wrangler secret for the site:

```bash
npx wrangler secret put ANALYTICS_SALT_KEY
```

Set the dispatcher's Wrangler secret by adding its config file:

```bash
npx wrangler secret put GITHUB_DISPATCH_TOKEN --config worker/dispatch/wrangler.jsonc
```

Set the GitHub secret:

```bash
gh secret set HF_TOKEN --repo ashwingopalsamy/repo-rate-visualizer
```

`SITE_LIVE` is not a secret, so its value goes on the command line:

```bash
gh variable set SITE_LIVE --body true --repo ashwingopalsamy/repo-rate-visualizer
```

## One-time setup

Status as of 9 Oct 2026. Update the marks as items are done.

- ☑ Site deployed to Cloudflare with the custom domain
- ☑ `HF_TOKEN` set and the Hugging Face datasets published
- ☐ Connect Workers Builds (see Deploy)
- ☐ Web Analytics: in the Cloudflare dashboard, set the site to the JavaScript snippet (a manual step) and turn automatic injection off for `rates.ashwingopalsamy.in`. Then set `VITE_CF_BEACON_TOKEN` (see Secrets and variables). Reason: automatic injection ignores Global Privacy Control and Do Not Track, which the privacy page promises to respect.
- ☐ Set `ANALYTICS_SALT_KEY` (see Secrets and variables)
- ☐ D1 and the rollup secrets, optional (see Analytics D1). Without them, events older than three months are lost.
- ☐ Dispatcher: set `GITHUB_DISPATCH_TOKEN` and deploy `atlas-dispatch` (see Dispatcher)
- ☐ Set `SITE_LIVE` to `true`, once Workers Builds is connected (see Verify-live)
- ☐ Turn the Vercel deploy into a redirect to the new domain (see Vercel v1 host)
- ☐ Optional: turn off Bot Fight Mode JavaScript detections. They inject an inline script that the site's CSP blocks, which causes one console error per page. The site works either way.

## Routine operations

Most routine work runs in GitHub Actions. Refresh runs start from the dispatcher, from a weekly schedule, or by hand. Pipeline problems appear as GitHub issues.

### Data refresh

`.github/workflows/refresh.yml` runs when the dispatcher starts it, weekly on Sundays (`17 3 * * 0`), or by hand. Its inputs are `countries` (for example `ALL` or `IN,US`) and `reason`. The jobs are plan, fetch (one job per country), publish, and verify-live. The publish job writes `data/`, rebuilds and tests the Hugging Face datasets when the data changed, then commits to `main` as `github-actions[bot]`, publishes to Hugging Face, and syncs the pipeline issues.

Start a run by hand:

```bash
gh workflow run refresh.yml -f countries=ALL -f reason=manual
```

### Verify-live

Five minutes after a data push, the verify-live job compares the live `/api/v1/latest.json` with `data/manifest.json`. On a mismatch, it opens one issue titled "Pipeline: live site behind manifest", which closes automatically on recovery. The job needs `SITE_LIVE` set to `true`. Enable it only after Workers Builds is connected, because until then the live site lags behind each data push.

### Pipeline issues

The pipeline keeps one GitHub issue per country and failure class, with the label `pipeline`. It edits that issue in place and closes it on recovery.

### Hugging Face publishing

`.github/workflows/hf-publish.yml` runs on pushes to `main` that change `hf/**`. To run it by hand, use the Actions tab, or check what it would publish first:

```bash
gh workflow run hf-publish.yml -f dry_run=true
```

Details are in [datasets.md](datasets.md).

### CI

`.github/workflows/validate.yml` runs on every pull request and on every push to `main`.

## Troubleshooting

### The site still shows the old version after a deploy

HTML is served with `max-age=0, must-revalidate`, and assets have hashed names. Hard-refresh the page with Cmd+Shift+R. To check the cache header, run:

```bash
curl -sI https://rates.ashwingopalsamy.in/ | grep -i cache-control
```

### Console shows a Content Security Policy error

Cloudflare zone features, such as Bot Fight Mode JavaScript detections, inject an inline script that changes on every request, so the site's CSP blocks it. The site's own inline script is hashed in `dist/_headers` by `scripts/prerender.ts`. Turning off the Bot Fight Mode JavaScript detections removes the error, and the site works either way.

### `python: command not found` or missing modules

macOS has only `python3`. Create the virtual environment described in [datasets.md](datasets.md), then run Python scripts with `.venv/bin/python`.

### Publishing to Hugging Face fails with 403

The `HF_TOKEN` secret holds a read-only token. Create a Write token at https://huggingface.co/settings/tokens, then update the secret (see Secrets and variables).

### Workers Builds or `wrangler deploy` fails the bundle budget

`scripts/check-bundle.ts` fails the build when gzipped JavaScript is over 90 KB or gzipped CSS is over 25 KB. It runs last in `npm run build`, so the same failure shows up locally.
