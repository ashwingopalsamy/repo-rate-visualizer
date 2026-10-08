/**
 * The dataset cards: which datasets exist, and the README, NOTICE and rights block for each. Every number in a card is
 * read from the tables it describes, so a card cannot drift from its data.
 */
import type { Code } from '../../src/lib/atlas.ts';
import type { CountryInput, Table } from './tables.ts';

export type DatasetSpec = {
  repo: string; version: string; title: string; codes?: Code[];
  /** Hugging Face licence metadata. Unset means no licence is asserted (the publishers' own terms apply). */
  license?: 'odbl';
  tags: string[];
};

const BASE_TAGS = ['tabular', 'timeseries', 'finance', 'economics', 'monetary-policy', 'central-banking', 'interest-rates', 'policy-rate', 'datasets', 'pandas', 'polars', 'mlcroissant'];
export const MULTI = 'central-bank-policy-rates';
export const DATASETS: DatasetSpec[] = [
  { repo: MULTI, version: '1.0.0', title: 'Central Bank Policy Rates: India, US, Euro Area, UK, Canada, Australia and Brazil', tags: ['india', 'united-states', 'euro-area', 'united-kingdom', 'canada', 'australia', 'brazil'] },
  { repo: 'india-repo-rate-dataset', version: '2.0.0', title: 'India RBI Policy Repo Rate and Monetary Policy Decision History', codes: ['IN'], tags: ['india', 'rbi', 'repo-rate'] },
  { repo: 'us-fed-funds-rate-dataset', version: '1.0.0', title: 'US Federal Funds Target Rate and FOMC Decision History', codes: ['US'], tags: ['united-states', 'federal-reserve', 'fomc', 'fed-funds-rate'] },
  { repo: 'euro-area-deposit-facility-rate-dataset', version: '1.0.0', title: 'Euro Area ECB Deposit Facility Rate History', codes: ['EA'], tags: ['euro-area', 'ecb', 'deposit-facility-rate'] },
  { repo: 'uk-bank-rate-dataset', version: '1.0.0', title: 'UK Bank of England Bank Rate History', codes: ['GB'], tags: ['united-kingdom', 'bank-of-england', 'bank-rate'] },
  { repo: 'canada-overnight-rate-dataset', version: '1.0.0', title: 'Canada Bank of Canada Overnight Rate Target History', codes: ['CA'], tags: ['canada', 'bank-of-canada', 'overnight-rate'] },
  { repo: 'australia-cash-rate-dataset', version: '1.0.0', title: 'Australia RBA Cash Rate Target History', codes: ['AU'], tags: ['australia', 'rba', 'cash-rate'] },
  { repo: 'brazil-selic-rate-dataset', version: '1.0.0', title: 'Brazil BCB Selic Target Rate History', codes: ['BR'], tags: ['brazil', 'bcb', 'copom', 'selic'], license: 'odbl' },
];

/* ---------- publishers and their terms (checked on each publisher's own pages, 8 Oct 2026) ---------- */
type Publisher = { name: string; covers: string; terms: string; reuse: string; cite: string };
const PUBLISHERS: Record<Code, Publisher[]> = {
  IN: [
    { name: 'Reserve Bank of India', covers: 'Policy resolutions, press releases, the MPC calendar and current rates', terms: 'https://www.rbi.org.in/Scripts/Disclaimer.aspx', reuse: 'All rights reserved by the RBI; no reuse licence is granted. This dataset records dates and rates as facts, cites every document and keeps only short excerpts.', cite: 'Source: Reserve Bank of India, with a link to the document' },
    { name: 'Reuters and Shriram Finance', covers: 'Repo rate changes before the MPC era (secondary, labelled `secondary`)', terms: 'https://www.reuters.com/', reuse: 'Cited for dates and rates only; no text or tables are reproduced.', cite: 'Cite the linked article' },
  ],
  US: [
    { name: 'Board of Governors of the Federal Reserve System', covers: 'FOMC statements, votes and the meeting calendar', terms: 'https://www.federalreserve.gov/disclaimer.htm', reuse: 'Public domain information that may be copied and distributed; the Board asks to be cited as the source.', cite: 'Source: Board of Governors of the Federal Reserve System' },
    { name: 'FRED, Federal Reserve Bank of St. Louis', covers: 'Target rate series DFEDTAR, DFEDTARU and DFEDTARL', terms: 'https://fred.stlouisfed.org/legal/', reuse: 'The series are Board data marked public domain, citation requested. FRED’s own terms govern use of the FRED service.', cite: 'Source: Board of Governors of the Federal Reserve System, retrieved from FRED' },
  ],
  EA: [{ name: 'European Central Bank', covers: 'Deposit facility rate, ECB Data Portal series FM.D.U2.EUR.4F.KR.DFR.LEV', terms: 'https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html', reuse: 'Free reuse, commercial or not, provided the source is quoted and the statistics are not modified. Values here are unchanged; the table layout is this project’s.', cite: 'Source: ECB statistics' }],
  GB: [{ name: 'Bank of England', covers: 'Bank Rate, database series IUDBEDR', terms: 'https://www.bankofengland.co.uk/legal', reuse: 'Database data under the UK Open Government Licence v3.0.', cite: 'Source: Bank of England, under the Open Government Licence v3.0' }],
  CA: [{ name: 'Bank of Canada', covers: 'Target for the overnight rate, Valet series V39079', terms: 'https://www.bankofcanada.ca/terms/', reuse: 'Free to use, copy and distribute, attributing the Bank of Canada and saying what was changed. Here the daily series is reduced to the dates the rate changed.', cite: 'Source: Bank of Canada' }],
  AU: [{ name: 'Reserve Bank of Australia', covers: 'Cash rate target, statistical table F1 (FIRMMCRTD)', terms: 'https://www.rba.gov.au/copyright/', reuse: 'Cash rate data is under the RBA’s own terms (not CC BY): reproduction and publication allowed, for personal or commercial use, without implying endorsement.', cite: 'Source: Reserve Bank of Australia' }],
  BR: [{ name: 'Banco Central do Brasil', covers: 'Selic target, SGS series 432', terms: 'https://dadosabertos.bcb.gov.br/dataset/432-taxa-de-juros---meta-selic-definida-pelo-copom', reuse: 'Open Data Commons Open Database License (ODbL) 1.0, which requires attribution and that derived databases stay under the ODbL.', cite: 'Source: Banco Central do Brasil, SGS 432, under the ODbL 1.0' }],
};

export function rightsFor(spec: DatasetSpec, xs: CountryInput[]): Record<string, unknown> {
  return {
    dataset_license: spec.license ?? null,
    license_status: spec.license ? 'publisher_licence_applies' : 'not_asserted',
    official_status: 'independent_non_official',
    statement: spec.license === 'odbl'
      ? 'The Banco Central do Brasil publishes SGS series 432 under the ODbL 1.0; this derived database is offered under the same licence.'
      : 'No dataset licence is asserted. Each publisher’s own terms apply to its data; see NOTICE.md.',
    publishers: xs.flatMap(x => PUBLISHERS[x.cc].map(p => ({ country_code: x.cc, name: p.name, terms_url: p.terms, attribution: p.cite }))),
  };
}

export function notice(spec: DatasetSpec, xs: CountryInput[]): string {
  const banks = xs.map(x => x.release.authority.name), list = banks.length > 1 ? `${banks.slice(0, -1).join(', ')} and ${banks[banks.length - 1]}` : banks[0];
  const rows = xs.flatMap(x => PUBLISHERS[x.cc].map(p => `| ${x.release.country.name} | ${p.name} | ${p.covers} | ${p.reuse} | ${p.cite} | [terms](${p.terms}) |`));
  return `# Attribution & Usage

This is an independent, non-official reference compiled from records published by the ${list}${xs.some(x => PUBLISHERS[x.cc].length > 1) ? ', and the other cited publishers' : ''}. It is not created by, affiliated with, authorised by, sponsored by or endorsed by any of them, and no official relationship, approval or representation should be inferred. Source titles, marks and publisher materials remain with their owners.

The data is provided for research and general information only, “as is” and without warranty of any kind, including as to accuracy, completeness, timeliness or fitness for a purpose. Verify every figure against the linked original before relying on it. Nothing here is financial, investment, legal, tax or other professional advice.

## Publishers and their terms

| Country | Publisher | What this dataset uses | Terms, in short | Attribution | Terms page |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

“Terms, in short” summarises each publisher’s page as read on 8 October 2026 and is not legal advice; the linked page governs.

## Licence

${spec.license === 'odbl'
    ? 'The Banco Central do Brasil publishes SGS series 432 under the [Open Data Commons Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). This dataset is a derived database of that series and is offered under the same licence: attribute the Banco Central do Brasil and this dataset, and keep databases derived from it under the ODbL.'
    : `This notice is not a dataset licence, and no blanket redistribution licence is asserted. Each publisher keeps its rights in its material and its own terms, above, apply to its data.${xs.some(x => x.cc === 'BR') ? ' Brazil’s rows are derived from a database published under the ODbL 1.0 and remain under that licence.' : ''} The code that builds this dataset is separate from those rights and is MIT-licensed in [the source repository](https://github.com/ashwingopalsamy/repo-rate-visualizer).`}
`;
}

/* ---------- README ---------- */
const pct = (v: unknown) => `${(v as number).toFixed(2)}%`;
const n = (v: number) => v.toLocaleString('en-GB');
const dateText = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const and = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0] ?? '');
// Release coverage notes are written for the pipeline; this keeps internal names out of the public card.
const publicNote = (s: string) => s.replace('from the v2 record', 'from earlier published histories');
const sizeCategory = (rows: number) => (rows < 1_000 ? 'n<1K' : rows < 10_000 ? '1K<n<10K' : rows < 100_000 ? '10K<n<100K' : '100K<n<1M');

function frontMatter(spec: DatasetSpec, configs: Table[]): string {
  const biggest = Math.max(...configs.map(t => t.rows.length));
  const lines = ['---', 'language:', '- en', `pretty_name: ${JSON.stringify(spec.title)}`];
  if (spec.license) lines.push(`license: ${spec.license}`);
  lines.push('tags:', ...[...BASE_TAGS, ...spec.tags].map(t => `- ${t}`), 'size_categories:', `- ${sizeCategory(biggest)}`, 'configs:');
  for (const t of configs) lines.push(`- config_name: ${t.name}`, ...(t.name === 'rates' ? ['  default: true'] : []), '  data_files:', '  - split: full', `    path: data/${t.name}.parquet`);
  lines.push('---');
  return lines.join('\n');
}

export function readme(spec: DatasetSpec, xs: CountryInput[], configs: Table[]): string {
  const repo = `ashwingopalsamy/${spec.repo}`, multi = !spec.codes, rows = (name: string) => configs.find(t => t.name === name)?.rows ?? [];
  const has = (name: string) => configs.some(t => t.name === name);
  const generated = xs.map(x => x.release.release.observedThrough).sort().at(-1)!;
  const daily = rows('daily'), first = daily.map(d => d.date as string).sort()[0];
  const latest = xs.map(x => {
    const r = x.release, last = r.series[r.series.length - 1], lvl = last.level, cur = rows('rates').filter(p => p.country_code === r.country.code).at(-1)!;
    const text = lvl.kind === 'range' ? `${(lvl.lowBps / 100).toFixed(2)}–${(lvl.highBps / 100).toFixed(2)}%` : pct(cur.rate_pct);
    return `| ${r.country.name} | ${r.authority.name} | ${r.instrument.name} | ${text} | ${dateText(last.date)} | ${r.decisions.length ? n(r.decisions.length) : 'being added'} | ${dateText(r.coverage.seriesFrom)} |`;
  });
  const ledger = xs.filter(x => x.release.decisions.length), seriesOnly = xs.filter(x => !x.release.decisions.length);
  const subject = multi ? 'seven central banks’ policy rates' : `the ${xs[0].release.authority.name} ${xs[0].release.instrument.name.toLowerCase()}`;
  const configRows = configs.map(t => `| \`${t.name}\`${t.name === 'rates' ? ' (default)' : ''} | ${t.grain} | ${n(t.rows.length)} | ${t.description} |`);
  const siblings = DATASETS.filter(d => d.codes && d.repo !== spec.repo).map(d => `[${d.codes![0]}](https://huggingface.co/datasets/ashwingopalsamy/${d.repo})`).join(' · ');
  const q = multi
    ? ['Which central banks are tightening and which are easing right now?', 'How far apart are the Fed and the ECB today, and how has the gap moved since 2000?', 'Which bank moved first in the 2022 tightening, and by how much did each raise rates that year?', 'What rate was in force in every country on a given date?']
    : ledger.length
      ? [`What was the ${xs[0].release.instrument.short.toLowerCase()} on a given date?`, `How did each member vote, and when did the ${xs[0].release.authority.short} hold rather than move?`, `How long did each tightening and easing cycle last, and how far did it go?`, 'How many hikes, cuts and holds were there in a given year?']
      : [`What was the ${xs[0].release.instrument.short.toLowerCase()} on a given date?`, `How long did each tightening and easing cycle last, and how far did it go?`, 'How much did the rate change in a given year?', 'Which day-level rate should I join to my daily or monthly data?'];
  const indiaNote = spec.repo === 'india-repo-rate-dataset'
    ? `\n> **Version 2.0.0 is a rebuild.** It is now built from the same verified releases as [Policy Rate Atlas](https://rates.ashwingopalsamy.in/), and adds every MPC decision since October 2016 including holds, with votes, stance and excerpts, plus the meeting calendar, a daily series and computed cycles. Column names changed; see [CHANGELOG.md](CHANGELOG.md) for the mapping from 1.0.0.\n`
    : '';
  const loadCfg = has('decisions') ? 'decisions' : 'daily';
  return `${frontMatter(spec, configs)}

# ${spec.title}

An independent, reproducible dataset of ${subject}, built from ${multi ? 'each central bank’s' : `the ${xs[0].release.authority.short}’s`} own published series and statements. Every row cites its source, every rate is an exact number of basis points, and the whole dataset is rebuilt automatically when a bank publishes a decision.${multi ? ' One dataset per country is also published: ' + siblings + '.' : ` It is part of [Central Bank Policy Rates](https://huggingface.co/datasets/ashwingopalsamy/${MULTI}), which covers seven banks in one schema.`}
${indiaNote}
**Current build:** data observed through ${dateText(generated)}; daily coverage from ${dateText(first)}; ${n(rows('rates').length)} rate changes${has('decisions') ? `, ${n(rows('decisions').length)} announced decisions` : ''} and ${n(daily.length)} daily rows.

## At a glance

| Country | Central bank | Instrument | Rate now | Since | Decisions | Series from |
| --- | --- | --- | --- | --- | --- | --- |
${latest.join('\n')}

Questions this dataset answers directly:
${q.map(s => `- ${s}`).join('\n')}

This is not an official product of any central bank. For anything that matters, follow the \`source_url\` or \`statement_url\` on the row to the bank’s own publication.

## Configurations

| Configuration | Row grain | Rows | What it holds |
| --- | --- | --- | --- |
${configRows.join('\n')}

Every configuration has one split, \`full\`, because this is a historical record rather than a train/test corpus. The Parquet files under \`data/\` are the only files mapped to configurations. CSV copies of every table and JSONL copies of ${configs.filter(t => ['rates', 'decisions'].includes(t.name)).map(t => `\`${t.name}\``).join(' and ')} are under \`exports/\`, deliberately left out of the configurations so the viewer does not count them twice. Column types are in [\`schema/\`](schema/) and every column is described in [\`schema/data-dictionary.json\`](schema/data-dictionary.json).

## How to read the fields

- **Rates are exact.** \`rate_bps\` is an integer number of basis points; \`rate_pct\` is the same value in percent. For a target range (the Fed since 16 December 2008), \`rate_pct\` is the **upper bound** and \`rate_low_pct\`/\`rate_high_pct\` give both ends. A midpoint is never computed.
- **\`rates\` is the canonical history.** One row per change, with the rate before and after. \`change_bps\` is the signed change against the previous upper bound; it is null for the first point and at an era boundary, where an instrument or its basis changed and the two numbers are not comparable${xs.some(x => x.release.eras.length > 1) ? ` (${xs.flatMap(x => x.release.eras.slice(1).map(e => `${x.release.country.name} from ${dateText(e.from)}`)).join('; ')})` : ''}.
- **Eras say what the number is.** \`era_basis\` is \`policy\` for the policy rate itself and \`observation\` for an earlier proxy kept for history${xs.some(x => x.release.eras.some(e => e.basis === 'observation')) ? ', such as India’s pre-2004 repo auction rate' : ''}. The \`eras\` configuration explains each boundary.
- **Evidence is explicit.** \`evidence\` is \`official\` for the bank’s own series or statement and \`secondary\` for a cited secondary source. Every row carries a \`source_id\` that joins to \`sources\`.
${has('decisions') ? `- **Decisions include holds.** \`decisions\` has one row per announced decision${ledger.length ? ` (${ledger.map(x => `${x.release.authority.short} from ${dateText(x.release.coverage.ledgerFrom!)}`).join(', ')})` : ''}, so a meeting that left the rate unchanged is a row with \`direction = hold\` and \`change_bps = 0\`. \`announced_at\` is UTC; \`announced_at_local\` keeps the bank’s published time and offset. \`effective_date\` can follow the announcement (the Fed’s new range applies the next day).\n` : ''}${seriesOnly.length ? `- **Series-only countries.** ${and(seriesOnly.map(x => x.release.country.name))} ${seriesOnly.length > 1 ? 'have' : 'has'} the full official series of rate changes, but announced decisions (and so holds and votes) are still being added. Their rows in \`annual\` carry null \`hold_count\` and \`decision_count\` rather than zero.\n` : ''}- **\`daily\`** gives the rate in force on every calendar day, including weekends, so it joins directly to other daily or monthly data.
- **\`cycles\`** are runs of consecutive moves in one direction, computed the same way as on [Policy Rate Atlas](https://rates.ashwingopalsamy.in/): a new cycle starts with the first move after a move the other way. Only policy-era moves count.
- **\`annual\`** uses the rate in force on 1 January (the last change before it) and on 31 December, or the last observed date for the current year. \`is_partial_year\` marks a first or current year that the data does not fully cover.
- **\`record_text\`** is one deterministic sentence built from the fields, for search, retrieval and agents. No text is written by a language model.

## Coverage

${xs.map(x => `- **${x.release.country.name}.** ${publicNote(x.release.coverage.grain)}${x.release.eras.length > 1 ? ` Eras: ${x.release.eras.map(e => `${e.instrument} from ${dateText(e.from)}`).join('; ')}.` : ''}`).join('\n')}

## Load it

\`\`\`python
from datasets import load_dataset

repo = "${repo}"
rates = load_dataset(repo, split="full")                 # every change, the default configuration
${loadCfg} = load_dataset(repo, "${loadCfg}", split="full")
${multi ? 'uk = rates.filter(lambda row: row["country_code"] == "GB")\n' : ''}\`\`\`

\`\`\`python
import pandas as pd

daily = pd.read_parquet("hf://datasets/${repo}/data/daily.parquet")
${multi ? 'wide = daily.pivot(index="date", columns="country_code", values="rate_pct")   # one column per bank\n' : 'monthly = daily.set_index("date")["rate_pct"].resample("ME").last()\n'}\`\`\`

\`\`\`python
import polars as pl

cycles = pl.read_parquet("hf://datasets/${repo}/data/cycles.parquet")
print(cycles.filter(pl.col("is_current")))
\`\`\`

\`\`\`sql
-- DuckDB
SELECT ${multi ? 'country_code, ' : ''}year, start_rate_pct, end_rate_pct, net_change_bps, hike_count, cut_count
FROM 'hf://datasets/${repo}/data/annual.parquet'
ORDER BY ${multi ? 'country_code, ' : ''}year;
\`\`\`

## Provenance and verification

Each country’s data comes from one content-addressed release, also served by the site’s open API at \`https://rates.ashwingopalsamy.in/api/v1/\`:

| Country | Release (SHA-256 content hash) | Observed through |
| --- | --- | --- |
${xs.map(x => `| ${x.release.country.name} | \`${x.release.release.hash}\` | ${dateText(x.release.release.observedThrough)} |`).join('\n')}

\`provenance/build-manifest.json\` records those releases, the row count of every configuration and a checksum of every file; \`SHA256SUMS\` covers everything. The build is byte-for-byte reproducible from [the source repository](https://github.com/ashwingopalsamy/repo-rate-visualizer):

\`\`\`bash
npm ci && pip install -r requirements-hf-dataset.txt
npm run build:hf && npm run test:hf-dataset
\`\`\`

## Attribution and terms

Each publisher’s own terms apply to its data. [NOTICE.md](NOTICE.md) lists them with the attribution each asks for. ${spec.license === 'odbl' ? 'This dataset is offered under the ODbL 1.0, as its source is.' : 'No blanket dataset licence is asserted.'}

## Limitations

- Coverage differs by country: ${seriesOnly.length ? `announced decisions are not yet available for ${and(seriesOnly.map(x => x.release.country.name))}` : 'the decision ledger starts where each bank’s own records are available'}. See \`countries.coverage_note\`.
- Dates are the bank’s local dates. Historical announcement times for India before the published calendar use 10:00 IST as a convention.
- \`transmission\` and \`events\` are curated context, not exhaustive and not causal claims.
- Nothing here is a forecast or advice.

## Citation

\`\`\`bibtex
@dataset{gopalsamy_${spec.repo.replace(/-/g, '_')}_${generated.slice(0, 4)},
  author    = {Gopalsamy, Ashwin},
  title     = {${spec.title}},
  year      = {${generated.slice(0, 4)}},
  version   = {${spec.version}},
  publisher = {Hugging Face},
  url       = {https://huggingface.co/datasets/${repo}}
}
\`\`\`

Changes between versions are in [CHANGELOG.md](CHANGELOG.md). The live view of this data is [Policy Rate Atlas](https://rates.ashwingopalsamy.in/).
`;
}
