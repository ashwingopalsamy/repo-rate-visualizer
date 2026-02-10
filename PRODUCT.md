# RBI Repo Rate Visualizer

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React/Vite/D3

## Product purpose

Provide a static, source-backed public reference for the Reserve Bank of India policy repo rate. The product answers the current-data question first, then supports historical and recent-policy exploration through a decision-aware timeline, ledger, source transparency, and exports.

## Audience

Journalists, researchers, students, analysts, developers, and members of the public who need a clear current repo-rate reference and an evidence-backed view of the official decisions behind its history.

## Confirmed product truth

- Current-data reference is the primary job; historical and recent-policy exploration is the secondary job.
- Official RBI decisions are the canonical policy records. Cuts, hikes, and holds are all valid decisions and must be visible when source-backed.
- The product separates the latest official decision date, the latest source publication date, and the last successful automated check time.
- No calendar-month decisions are inferred or invented. The data represents official RBI decisions only.
- The browser consumes the generated static snapshot. It does not make client-side live RBI requests.
- CI refreshes data on a schedule and via manual dispatch. Verified changes are published through the existing host deployed from `main`.
- The ingestion process preserves raw snapshots and fails closed when a source is unavailable or parsing is uncertain.
- Each decision links to usable official source provenance. The generated source record includes title, URL, publication date, retrieval time, and checksum.
- React, Vite, and D3 remain the implementation stack.
- Existing themes, routes/deep links, share actions, SVG/CSV exports, and accessible responsive behavior are product contracts to preserve while the interface is improved.
- The interface is an independent, non-official educational reference: it is not created by, affiliated with, authorised by, sponsored by, or endorsed by the Reserve Bank of India. Its persistent Attribution & Usage notice disclaims warranties and professional advice, identifies third-party ownership, and directs users to verify figures and context against original sources.

## Source policy

The primary RBI references are:

- [RBI historical-data guidance](https://www.rbi.org.in/Scripts/bs_viewcontent.aspx?Id=624), which points users to DBIE Key Rates for historical policy-rate data.
- [RBI Bulletin](https://bulletin.rbi.org.in/), which publishes Monetary Policy Statements and MPC resolutions.
- [RBI policy archive](https://www.rbi.org.in/scripts/Annualpolicy.aspx), used for policy statements, resolutions, and related official records.
- [Reuters historical series](https://www.reuters.com/world/india/changes-indias-repo-rate-since-june-2000-2025-12-05/), imported for the dated 2000–2025 benchmark observations in the current snapshot.
- [Shriram Finance historical reference](https://www.shriramfinance.in/fixed-deposit/articles/detailed-historical-repo-rate-trends-in-india), surfaced as a secondary cross-reference; its month-only or conflicting entries are not used to infer additional decisions.
- Macro-event context is curated only from official RBI/RBI Docs, MHA, and CBIC records; the review and citation rationale live in [`MACRO_EVENTS_RESEARCH.md`](MACRO_EVENTS_RESEARCH.md).

## Freshness language

The interface must use source metadata rather than the browser’s current date to describe freshness. “Latest official decision,” “latest source published,” and “last checked” are separate facts. A retrieval timestamp does not become a decision date, and a successful check does not imply that a new decision occurred.

## Non-goals

- Real-time browser-side polling of RBI.
- Filling gaps with estimates or synthetic monthly observations.
- Treating rate changes as the complete policy history.
- Replacing official source links with unattributed summaries.
- Introducing a database or changing the React/Vite/D3 stack.
