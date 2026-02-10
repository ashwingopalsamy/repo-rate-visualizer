import { assertValidSnapshotV2, deriveRateSeries } from './snapshotV2.js';

// The Reuters article supplied with this snapshot reports the historical rate
// observations newest-first. Keep the normalized series oldest-first so it can
// be merged into the canonical decision ledger without another data source.
export const REUTERS_HISTORY_SOURCE = {
  id: 'source-reuters-historical-2025',
  type: 'historical-rate-series',
  title: "Reuters — Changes to India's repo rate since June 2000",
  url: 'https://www.reuters.com/world/india/changes-indias-repo-rate-since-june-2000-2025-12-05/',
  publishedAt: '2025-12-05T00:00:00.000Z',
  retrievedAt: '2026-08-14T10:24:42Z',
  // SHA-256 of the normalized date\t rate payload supplied for import.
  checksum: 'sha256:74557e9615be4bfa54c049e2f334bce4c5116a20e651aea2f2598cf57dfd5ae3',
};

export const SHRIRAM_HISTORY_SOURCE = {
  id: 'source-shriram-historical-2025',
  type: 'secondary-historical-reference',
  title: 'Shriram Finance — Detailed Historical Repo Rate Trends (2010–2025)',
  url: 'https://www.shriramfinance.in/fixed-deposit/articles/detailed-historical-repo-rate-trends-in-india',
  publishedAt: '2025-12-10T00:00:00.000Z',
  retrievedAt: '2026-08-14T10:24:42Z',
  checksum: 'sha256:ce997168aa014c7caccc95f5cf50180ba53f6ca805a2a47fbf2b68c747665282',
};

export const SUPPLEMENTAL_HISTORY_SOURCES = [
  REUTERS_HISTORY_SOURCE,
  SHRIRAM_HISTORY_SOURCE,
];

const REUTERS_ROWS = [
  ['2000-06-05', 9.05],
  ['2000-06-07', 9],
  ['2000-06-09', 9.05],
  ['2000-06-12', 9.25],
  ['2000-06-13', 9.55],
  ['2000-06-14', 10.85],
  ['2000-06-19', 13.5],
  ['2000-06-20', 14],
  ['2000-06-21', 13.5],
  ['2000-06-22', 13],
  ['2000-06-23', 13.05],
  ['2000-06-27', 12.6],
  ['2000-06-28', 12.25],
  ['2000-07-13', 9],
  ['2000-07-21', 10],
  ['2000-08-09', 16],
  ['2000-08-30', 15],
  ['2000-09-06', 13.5],
  ['2000-10-13', 10.25],
  ['2000-11-06', 10],
  ['2001-03-09', 9],
  ['2001-04-30', 8.75],
  ['2001-06-07', 8.5],
  ['2002-03-28', 8],
  ['2002-11-12', 7.5],
  ['2003-03-07', 7.1],
  ['2003-03-19', 7],
  ['2004-03-31', 6],
  ['2005-10-26', 6.25],
  ['2006-01-24', 6.5],
  ['2006-06-08', 6.75],
  ['2006-07-25', 7],
  ['2006-10-30', 7.25],
  ['2007-01-31', 7.5],
  ['2007-03-30', 7.75],
  ['2008-06-11', 8],
  ['2008-06-24', 8.5],
  ['2008-07-29', 9],
  ['2008-10-20', 8],
  ['2008-11-03', 7.5],
  ['2008-12-08', 6.5],
  ['2009-01-02', 5.5],
  ['2009-03-04', 5],
  ['2009-04-21', 4.75],
  ['2010-03-19', 5],
  ['2010-04-20', 5.25],
  ['2010-07-02', 5.5],
  ['2010-07-27', 5.75],
  ['2010-09-16', 6],
  ['2010-11-02', 6.25],
  ['2011-01-25', 6.5],
  ['2011-03-17', 6.75],
  ['2011-05-03', 7.25],
  ['2011-06-16', 7.5],
  ['2011-07-26', 8],
  ['2011-09-16', 8.25],
  ['2011-10-25', 8.5],
  ['2012-04-17', 8],
  ['2013-01-29', 7.75],
  ['2013-03-19', 7.5],
  ['2013-05-03', 7.25],
  ['2013-09-20', 7.5],
  ['2013-10-29', 7.75],
  ['2014-01-28', 8],
  ['2015-01-15', 7.75],
  ['2015-03-04', 7.5],
  ['2015-06-02', 7.25],
  ['2015-09-29', 6.75],
  ['2016-04-05', 6.5],
  ['2016-10-04', 6.25],
  ['2017-08-02', 6],
  ['2018-06-06', 6.25],
  ['2018-08-01', 6.5],
  ['2019-02-07', 6.25],
  ['2019-04-04', 6],
  ['2019-06-06', 5.75],
  ['2019-08-07', 5.4],
  ['2019-10-04', 5.15],
  ['2019-12-05', 5.15],
  ['2020-02-06', 5.15],
  ['2020-03-27', 4.4],
  ['2020-05-22', 4],
  ['2022-05-04', 4.4],
  ['2022-06-08', 4.9],
  ['2022-08-05', 5.4],
  ['2022-09-30', 5.9],
  ['2022-12-07', 6.25],
  ['2023-02-08', 6.5],
  ['2023-04-06', 6.5],
  ['2023-06-08', 6.5],
  ['2023-10-06', 6.5],
  ['2023-12-08', 6.5],
  ['2024-02-08', 6.5],
  ['2024-04-05', 6.5],
  ['2024-06-07', 6.5],
  ['2024-08-08', 6.5],
  ['2024-10-09', 6.5],
  ['2024-12-06', 6.5],
  ['2025-02-07', 6.25],
  ['2025-04-09', 6],
  ['2025-06-06', 5.5],
  ['2025-08-06', 5.5],
  ['2025-10-01', 5.5],
  ['2025-12-05', 5.25],
];

export const REUTERS_HISTORY = REUTERS_ROWS.map(([date, repoRate]) => ({ date, repoRate }));

const LEGACY_SOURCE_ID = 'legacy-snapshot';
const sourceIds = new Set(SUPPLEMENTAL_HISTORY_SOURCES.map(source => source.id));
const LAST_REUTERS_DATE = REUTERS_HISTORY.at(-1).date;

function actionForChange(changeBps, isFirst) {
  if (isFirst) return 'initial';
  if (changeBps === 0) return 'hold';
  return changeBps < 0 ? 'cut' : 'hike';
}

function decisionIdFor(date) {
  return `decision-${date}-reuters`;
}

/**
 * Merge the supplied historical series into a SnapshotV2 while preserving
 * newer official RBI decisions and any source links already attached to them.
 * The function is idempotent so the verified ingestion pipeline can call it
 * on every refresh.
 */
export function mergeSupplementalHistory(snapshot) {
  // The incumbent legacy series used a different rate definition in its early
  // history. Drop its rows through the Reuters cutoff rather than retaining
  // dates that belong to that other series, then overlay newer source links.
  const decisionsByDate = new Map(
    snapshot.decisions
      .filter(decision => decision.date > LAST_REUTERS_DATE)
      .map(decision => [decision.date, decision]),
  );

  for (const row of REUTERS_HISTORY) {
    const existing = decisionsByDate.get(row.date);
    const preservedSourceIds = existing?.sourceIds?.filter(sourceId => (
      sourceId !== LEGACY_SOURCE_ID && !sourceIds.has(sourceId)
    )) || [];
    decisionsByDate.set(row.date, {
      ...(existing || {}),
      id: existing?.id || decisionIdFor(row.date),
      date: row.date,
      repoRate: row.repoRate,
      stance: existing?.stance ?? null,
      summary: 'Reuters historical rate series',
      sourceIds: [...new Set([REUTERS_HISTORY_SOURCE.id, ...preservedSourceIds])],
    });
  }

  const decisions = [...decisionsByDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((decision, index, sorted) => {
      const previous = sorted[index - 1];
      const changeBps = index === 0
        ? 0
        : Math.round((decision.repoRate - previous.repoRate) * 100);
      return {
        ...decision,
        action: actionForChange(changeBps, index === 0),
        changeBps,
        sourceIds: [...new Set(decision.sourceIds.filter(sourceId => sourceId !== LEGACY_SOURCE_ID))],
      };
    });

  const sources = [
    ...snapshot.sources.filter(source => source.id !== LEGACY_SOURCE_ID && !sourceIds.has(source.id)),
    ...SUPPLEMENTAL_HISTORY_SOURCES,
  ];
  const latestDecision = decisions.at(-1);
  const currentRateSourceIds = snapshot.sources
    .filter(source => source.type === 'current-policy-rates')
    .map(source => source.id);

  return assertValidSnapshotV2({
    ...snapshot,
    meta: {
      ...snapshot.meta,
      latestOfficialDate: latestDecision.date,
    },
    current: {
      ...snapshot.current,
      repoRate: latestDecision.repoRate,
      effectiveDate: latestDecision.date,
      decisionId: latestDecision.id,
      stance: latestDecision.stance,
      sourceIds: [...new Set([
        ...(snapshot.current.sourceIds || []),
        ...currentRateSourceIds,
        ...latestDecision.sourceIds,
      ])],
    },
    sources,
    decisions,
    rateSeries: deriveRateSeries(decisions),
  });
}
