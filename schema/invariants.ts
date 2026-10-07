import { CountryReleaseSchema } from './release.ts';
import type { CountryRelease, Decision, Era, SeriesPoint } from './release.ts';
import { sameLevel, upperBps } from './level.ts';
import { canonicalJson } from './hash.ts';

export type Issue = { code: string; path: string; message: string };

const SECRET_PARAMS = /^(key|apikey|api_key|token|access_token|auth)$/i;
const EXCERPT_MAX = 400;

const decisionDate = (d: Decision) => d.effectiveDate ?? d.announcedAt.slice(0, 10);
const eraOf = (eras: Era[], date: string) => eras.find(e => e.from <= date && (e.to === null || date <= e.to))?.id ?? null;
const levelAt = (series: SeriesPoint[], date: string) => [...series].reverse().find(p => p.date <= date) ?? null;
const pointBefore = (series: SeriesPoint[], date: string) => [...series].reverse().find(p => p.date < date) ?? null;
const hostAllowed = (url: string, allowlist: string[]) => {
  const host = new URL(url).hostname;
  return allowlist.some(domain => host === domain || host.endsWith(`.${domain}`));
};

/** Every rule a release must satisfy before it is written (spec §3 invariants). An empty list means valid. */
export function validateRelease(next: CountryRelease, previous?: CountryRelease, allowlist?: string[]): Issue[] {
  const parsed = CountryReleaseSchema.safeParse(next);
  if (!parsed.success) {
    return parsed.error.issues.map(issue => ({ code: 'shape', path: issue.path.join('.'), message: issue.message }));
  }
  const r = parsed.data;
  const issues: Issue[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });

  r.series.forEach((point, i) => {
    if (i > 0 && point.date <= r.series[i - 1].date) add('series-order', `series.${i}`, `${point.date} does not follow ${r.series[i - 1].date}`);
  });

  r.decisions.forEach((d, i) => {
    const path = `decisions.${i}`;
    const date = decisionDate(d);
    const prev = pointBefore(r.series, date);
    if (prev && d.changeBps !== null && d.level.kind !== 'none') {
      const crossesEra = eraOf(r.eras, prev.date) !== eraOf(r.eras, date);
      if (crossesEra) add('era-change-bps', path, `${d.id} crosses an era boundary; changeBps must be null`);
      else {
        const now = upperBps(d.level), before = upperBps(prev.level);
        if (now !== null && before !== null && d.changeBps !== now - before) {
          add('change-mismatch', path, `${d.id} changeBps ${d.changeBps} but levels moved ${now - before}`);
        }
      }
    }
    if (d.direction === 'hold' && d.evidence !== 'statement') add('hold-evidence', path, `${d.id} is a hold without a parsed statement`);
    if (d.direction === 'unchanged' && d.evidence !== 'series') add('unchanged-evidence', path, `${d.id} is unchanged but not series evidence`);
    if (d.excerpt !== null && d.excerpt.length > EXCERPT_MAX) add('excerpt-length', path, `${d.id} excerpt is ${d.excerpt.length} characters; at most ${EXCERPT_MAX}`);
    if (d.evidence === 'statement' && d.level.kind !== 'none' && r.release.observedThrough >= date) {
      const observed = levelAt(r.series, date);
      if (observed && !sameLevel(observed.level, d.level)) add('series-disagrees', path, `${d.id} disagrees with the official series on ${date}`);
    }
  });

  r.calendar.forEach((m, i) => {
    const count = r.decisions.filter(d => d.meetingId === m.id).length;
    if ((m.status === 'cancelled' || m.status === 'moved') && count > 0) add('cancelled-decision', `calendar.${i}`, `${m.id} is ${m.status} but has a decision`);
    if (m.status === 'held' && r.coverage.ledgerFrom !== null && m.date >= r.coverage.ledgerFrom && count !== 1) {
      add('ledger-gap', `calendar.${i}`, `${m.id} has ${count} decisions; expected exactly one`);
    }
  });

  const known = new Set(r.sources.map(s => s.id));
  const referenced: [string, string][] = [
    ...r.eras.map((e, i) => [e.sourceId, `eras.${i}`] as [string, string]),
    ...r.calendar.map((m, i) => [m.sourceId, `calendar.${i}`] as [string, string]),
    ...r.decisions.flatMap((d, i) => d.sourceIds.map(s => [s, `decisions.${i}`] as [string, string])),
    ...r.series.map((p, i) => [p.sourceId, `series.${i}`] as [string, string]),
    ...r.transmission.map((t, i) => [t.sourceId, `transmission.${i}`] as [string, string]),
    ...r.context.map((c, i) => [c.sourceId, `context.${i}`] as [string, string]),
    ...r.corrections.map((c, i) => [c.sourceId, `corrections.${i}`] as [string, string]),
  ];
  for (const [sourceId, path] of referenced) if (!known.has(sourceId)) add('source-missing', path, `unknown source ${sourceId}`);

  r.sources.forEach((s, i) => {
    const url = new URL(s.url);
    if ([...url.searchParams.keys()].some(k => SECRET_PARAMS.test(k))) add('source-secret', `sources.${i}`, `${s.id} url carries a credential parameter`);
    if (allowlist && s.official && !hostAllowed(s.url, allowlist)) add('source-domain', `sources.${i}`, `${s.id} is official but ${url.hostname} is not allowlisted`);
  });

  if (previous) {
    const corrected = new Set(r.corrections.map(c => c.recordId));
    const nextDecisions = new Map(r.decisions.map(d => [d.id, d]));
    previous.decisions.forEach(d => {
      const next = nextDecisions.get(d.id);
      // A provisional decision inferred from the series may be replaced once its statement is parsed.
      const superseded = d.evidence === 'series' && next?.evidence === 'statement';
      if (!corrected.has(d.id) && !superseded && (!next || canonicalJson(next) !== canonicalJson(d))) add('history-rewrite', `decisions.${d.id}`, `${d.id} changed or disappeared`);
    });
    const nextSeries = new Map(r.series.map(p => [p.date, canonicalJson(p)]));
    previous.series.forEach(p => {
      if (!corrected.has(p.date) && nextSeries.get(p.date) !== canonicalJson(p)) add('history-rewrite', `series.${p.date}`, `series point ${p.date} changed or disappeared`);
    });
  }
  return issues;
}
