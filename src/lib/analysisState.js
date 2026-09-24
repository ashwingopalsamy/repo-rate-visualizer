import { isWithinDateRange } from './dateBoundaries.js';

export const ACTION_FILTERS = Object.freeze(['all', 'cut', 'hike', 'hold']);
export const EVIDENCE_FILTERS = Object.freeze(['all', 'primary-decision', 'official-context', 'historical-secondary', 'mixed']);
export const TIMELINE_MODES = Object.freeze(['all', 'changes']);
export const RATE_CHANGE_SIZE_BANDS = Object.freeze(['all', '0-25', '26-50', '51-75', '75-plus']);
export const RATE_CHANGE_SORTS = Object.freeze(['date', 'latest', 'magnitude']);
export const RATE_CHANGE_VIEWS = Object.freeze(['distribution', 'cumulative']);
export const BREAKDOWN_GROUPS = Object.freeze(['regime', 'year']);
export const BREAKDOWN_METRICS = Object.freeze(['count', 'bps']);

export const DEFAULT_RECORD_FILTERS = Object.freeze({
  action: 'all',
  evidence: 'all',
});

export const DEFAULT_ANALYSIS_STATE = Object.freeze({
  recordFilters: DEFAULT_RECORD_FILTERS,
  timelineMode: 'all',
});

export const DEFAULT_RATE_CHANGE_STATE = Object.freeze({
  sizeBand: 'all',
  sort: 'date',
  view: 'distribution',
});

export const DEFAULT_BREAKDOWN_STATE = Object.freeze({
  group: 'regime',
  metric: 'count',
});

export const EVIDENCE_FILTER_LABELS = Object.freeze({
  all: 'All evidence',
  'primary-decision': 'Direct RBI decisions',
  'official-context': 'Official context',
  'historical-secondary': 'Historical observations',
  mixed: 'Mixed evidence',
});

export function normalizeRecordFilters(filters = {}) {
  return {
    action: ACTION_FILTERS.includes(filters.action) ? filters.action : 'all',
    evidence: EVIDENCE_FILTERS.includes(filters.evidence) ? filters.evidence : 'all',
  };
}

export function normalizeTimelineMode(mode) {
  return TIMELINE_MODES.includes(mode) ? mode : 'all';
}

export function normalizeRateChangeState(state = {}) {
  return {
    sizeBand: RATE_CHANGE_SIZE_BANDS.includes(state.sizeBand) ? state.sizeBand : 'all',
    sort: RATE_CHANGE_SORTS.includes(state.sort) ? state.sort : 'date',
    view: RATE_CHANGE_VIEWS.includes(state.view) ? state.view : 'distribution',
  };
}

export function normalizeBreakdownState(state = {}) {
  return {
    group: BREAKDOWN_GROUPS.includes(state.group) ? state.group : 'regime',
    metric: BREAKDOWN_METRICS.includes(state.metric) ? state.metric : 'count',
  };
}

export function normalizeComparison(comparison = {}) {
  const values = ['aStart', 'aEnd', 'bStart', 'bEnd'].map(key => comparison[key] || null);
  if (!values.every(value => /^\d{4}-\d{2}-\d{2}$/.test(value || ''))) return null;
  if (values[0] > values[1] || values[2] > values[3]) return null;
  return { aStart: values[0], aEnd: values[1], bStart: values[2], bEnd: values[3] };
}

export function filterDecisions(decisions = [], { dateRange = {}, recordFilters = DEFAULT_RECORD_FILTERS, timelineMode = 'all' } = {}) {
  const filters = normalizeRecordFilters(recordFilters);
  const mode = normalizeTimelineMode(timelineMode);
  return decisions.filter(decision => {
    if (!isWithinDateRange(decision.dateObj || new Date(`${decision.date}T00:00:00.000Z`), dateRange)) return false;
    if (filters.action !== 'all' && decision.action !== filters.action) return false;
    if (filters.evidence !== 'all' && decision.evidenceStatus !== filters.evidence) return false;
    if (mode === 'changes' && !['cut', 'hike'].includes(decision.action)) return false;
    return true;
  });
}

export function filterRateChanges(rateChanges = [], { dateRange = {}, recordFilters = DEFAULT_RECORD_FILTERS, sizeBand = 'all', sort = 'date' } = {}) {
  const filters = normalizeRecordFilters(recordFilters);
  const filtered = rateChanges.filter(change => {
    if (!isWithinDateRange(change.dateObj || new Date(`${change.date}T00:00:00.000Z`), dateRange)) return false;
    if (filters.action !== 'all' && change.action && change.action !== filters.action) return false;
    const magnitude = Math.abs(change.changeBps || 0);
    if (sizeBand === '0-25' && magnitude > 25) return false;
    if (sizeBand === '26-50' && (magnitude < 26 || magnitude > 50)) return false;
    if (sizeBand === '51-75' && (magnitude < 51 || magnitude > 75)) return false;
    if (sizeBand === '75-plus' && magnitude < 75) return false;
    return true;
  });
  return filtered.slice().sort((a, b) => {
    if (sort === 'latest') return String(b.date).localeCompare(String(a.date));
    if (sort === 'magnitude') return Math.abs(b.changeBps || 0) - Math.abs(a.changeBps || 0) || String(a.date).localeCompare(String(b.date));
    return String(a.date).localeCompare(String(b.date));
  });
}

export function analysisFilterKey({ recordFilters = DEFAULT_RECORD_FILTERS, timelineMode = 'all' } = {}) {
  const filters = normalizeRecordFilters(recordFilters);
  return `${filters.action}:${filters.evidence}:${normalizeTimelineMode(timelineMode)}`;
}

export function formatRangeLabel(dateRange = {}, fallback = 'All available records') {
  if (!dateRange.start && !dateRange.end) return fallback;
  return `${dateRange.start || 'coverage start'} – ${dateRange.end || 'coverage end'}`;
}

export function asOfLookup(decisions = [], dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue || '')) return null;
  const target = new Date(`${dateValue}T00:00:00.000Z`);
  if (Number.isNaN(target.getTime())) return null;
  const ordered = decisions.slice().sort((a, b) => a.dateObj - b.dateObj);
  const preceding = ordered.filter(decision => decision.dateObj <= target).at(-1) || null;
  const exact = preceding?.date === dateValue ? preceding : null;
  const next = ordered.find(decision => decision.dateObj > target) || null;
  return { date: dateValue, exact, preceding, next };
}

export function windowSummary(decisions = [], dateRange = {}) {
  const records = decisions
    .filter(decision => isWithinDateRange(decision.dateObj, dateRange))
    .slice()
    .sort((a, b) => a.dateObj - b.dateObj);
  const moves = records.filter(decision => ['cut', 'hike'].includes(decision.action));
  const first = records[0] || null;
  const last = records.at(-1) || null;
  const netBps = first && last ? Math.round((last.repoRate - first.repoRate) * 100) : 0;
  const largestMove = moves.slice().sort((a, b) => Math.abs(b.changeBps) - Math.abs(a.changeBps))[0] || null;
  return {
    dateRange,
    records,
    totalRecords: records.length,
    moveCount: moves.length,
    cutCount: moves.filter(decision => decision.action === 'cut').length,
    hikeCount: moves.filter(decision => decision.action === 'hike').length,
    holdCount: records.filter(decision => decision.action === 'hold').length,
    first,
    last,
    netBps,
    largestMove,
    sourceCount: new Set(records.flatMap(decision => decision.sourceIds || [])).size,
  };
}
