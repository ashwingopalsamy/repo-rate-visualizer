# Analytics

This page describes what the site measures, how it is collected, and the rules that keep it private. The public version is the privacy page at `/privacy/`.

## What is counted

Two sources, neither of which uses cookies.

- **Page traffic.** Cloudflare Web Analytics counts page views, referrers, visitor country and Core Web Vitals. The beacon in `src/analytics/beacon.ts` loads only when the build sets `VITE_CF_BEACON_TOKEN`. Single-page navigations count as page views.
- **Product events.** The site sends a fixed set of actions to its own collector at `POST /e`. They are listed under Events.

Never collected:

- Loan amounts, rates or dates that people type.
- Cookies.
- IP addresses or user agents. The collector uses them only to derive the daily visitor id, and never writes them.

With Global Privacy Control (GPC) or Do Not Track (DNT) set, the site loads no beacon and sends no events. The check is `optedOut()` in `src/analytics/track.ts`.

## Events

The `EVENTS` object in `src/analytics/schema.ts` is the single allowlist. The browser and the collector both import it.

| Event | Properties and allowed values |
| --- | --- |
| `page` | `route`: world, country, privacy, notfound; `cc`: country code |
| `country_switch` | `from`: country code; `to`: country code; `via`: palette, ladder, latest, league, dock, link, history, prompt |
| `loan_calc` | `cc`: country code; `mode`: decision, since |
| `tile_open` | `cc`: country code; `tile`: record, cycle, gap, peers |
| `replay` | `cc`: country code |
| `dday_preview` | `cc`: country code; `state`: live, announced, decided |
| `palette_open` | `from`: keyboard, button |
| `source_click` | `cc`: country code |
| `theme` | `to`: light, dark |
| `decision_window` | `cc`: country code |
| `prompt` | `action`: shown, pick, keep, close; `cc`: country code |

Anything not in this allowlist is rejected by the collector. For `prompt`, `cc` is the suggested country when the prompt is shown, or the one the visitor picked.

## The collector

The browser queues events in memory and sends them with `navigator.sendBeacon('/e', ...)`. A batch is sent when 20 events are queued, 4 seconds after the first queued event, or when the page is hidden or unloads.

`worker/site/events.ts` handles `POST /e` in the Worker `policy-rate-atlas`. Worker code runs for `/e` and for the daily cron. Every other path is served as a static asset without running Worker code. The collector's rules:

- Only `POST` is accepted. Other methods get 405.
- An `Origin` header for another host, or `Sec-Fetch-Site: cross-site`, gets 403. A request with no `Origin` header is not refused for that reason.
- A body larger than 2048 bytes gets 413.
- Invalid JSON, a batch of more than 20 events, or any event or value outside the allowlist gets 400. So does a missing or wrong `v`, a `path` that is not lowercase letters, digits, `/` and `-` (64 characters at most), an empty batch, or any extra field. Validation uses zod.
- If the Analytics Engine binding is missing, a valid batch gets 204 and nothing is written.
- A valid batch from a bot or crawler, or with no user agent, gets 204 and nothing is written.
- The daily visitor id is the first 16 hex characters of HMAC-SHA256 over the UTC date, the IP address (from `cf-connecting-ip`) and the user agent, keyed with the secret `ANALYTICS_SALT_KEY`. It changes every day and cannot be reversed without the key. If the key or the IP address is missing, the id is blank.
- Each event becomes one Analytics Engine data point in the dataset `atlas_events`.
- Responses never echo input.

Each data point has seven blobs:

| Blob | Holds |
| --- | --- |
| 1 | Event name |
| 2 | Route (page events only) |
| 3 | Country shown, or the `from` country of a switch |
| 4 | First remaining property, in allowlist order |
| 5 | Second remaining property |
| 6 | Visitor country |
| 7 | Daily visitor id |

For `palette_open`, blob 3 holds `keyboard` or `button`, because that event has no country.

## Retention

Analytics Engine keeps each event for three months.

A daily cron runs at 00:40 UTC in the same Worker. The code is in `worker/site/rollup.ts`. It copies the previous UTC day's totals per event, route, country shown and visitor country into the D1 table `daily`. The day's unique visitors are stored in a row whose event is `_all`. The table is defined in `worker/site/migrations/0001_daily.sql`. The rollup is idempotent: re-running a day updates that day's rows.

The rollup needs the D1 binding (`DB`), `CF_ACCOUNT_ID` and `CF_ANALYTICS_READ_TOKEN` (an Account Analytics read token). Without them it logs a message and does nothing. Setup is in [operations.md](operations.md).

The privacy page promises these daily totals. Until D1 is set up, they are not kept, and events older than three months are lost.

## Reports

`npm run analytics:report` prints a Markdown report of first-party events from Analytics Engine. Cloudflare Web Analytics figures are in the Cloudflare dashboard, not in this report.

By default the report covers 7, 30 and 90 days. `--days` takes a comma-separated list of spans, and spans outside 1 to 92 are ignored. Each span shows page views, visitor-days, visitor countries, pages, country switches and product events.

Visitor-days count a visitor once for each day they came back, because the visitor id changes every day. They are not unique visitors over the window.

The report reads Analytics Engine directly, so it only sees events from the last three months. It reads two environment variables and exits with an error if either is missing:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ANALYTICS_TOKEN` (an Account Analytics read token)

Read the token from a prompt so it stays out of shell history (the input is hidden):

```bash
read -rs CLOUDFLARE_ANALYTICS_TOKEN && export CLOUDFLARE_ANALYTICS_TOKEN
```

```bash
CLOUDFLARE_ACCOUNT_ID=<id> npm run analytics:report -- --days 7
```

The optional workflow `.github/workflows/analytics-weekly.yml` writes the same report to the job summary every Monday at 07:00 UTC. It is skipped until both repository secrets exist, and it can also be started by hand.

## Keeping the privacy page true

`src/app/privacy.ts`, served at `/privacy/`, states what is counted, how long it is kept and how to switch it off. Any change to `src/analytics/`, `worker/site/` or what is stored must update that page in the same change.

Two test files check the promises:

- `tests/browser/analytics.spec.ts` checks that GPC and DNT send nothing, and what a batch contains.
- `tests/app/events.test.ts` checks the collector's rejections, and that no IP address, user agent or key is ever written.
