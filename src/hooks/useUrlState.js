import { useCallback, useEffect, useRef } from 'react';
import { currentRate, decisions, regimes, snapshotMeta } from '../data/dataLoader.js';
import { URL_ACTION_FILTERS, BREAKDOWN_GROUPS, BREAKDOWN_METRICS, EVIDENCE_FILTERS, RATE_CHANGE_SIZE_BANDS, RATE_CHANGE_SORTS, RATE_CHANGE_VIEWS, normalizeBreakdownState, normalizeComparison, normalizeRateChangeState, normalizeRecordFilters, normalizeTimelineMode } from '../lib/analysisState.js';

export const VALID_VIEWS = Object.freeze(['timeline', 'breakdown', 'rate-change', 'cycles', 'compare']);
export const VALID_PRESETS = Object.freeze(['1Y', '5Y', '10Y', 'ALL', 'CUSTOM']);
export const VALID_TIMELINE_MODES = Object.freeze(['all', 'changes']);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DECISION_IDS = new Set(decisions.map(decision => decision.id));
const CYCLE_COUNT = regimes.filter(regime => regime.type !== 'pause').length;

function isDateOnly(value) {
  if (!DATE_ONLY_PATTERN.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function rangeForYears(years, latestDate = snapshotMeta.latestRecordedDate || currentRate.date) {
  const end = new Date(`${latestDate}T00:00:00.000Z`);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - years);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function parseLayers(value, country) {
  if (country !== 'IN') {
    if (value === null) return { range: true };
    return { range: value.split(',').includes('range') };
  }
  if (value === null) return { regimes: true, events: true };
  const selected = new Set(value.split(',').filter(Boolean));
  return {
    regimes: selected.has('regimes'),
    events: selected.has('events'),
  };
}

function parseCustomRange(params) {
  const start = params.get('start');
  const end = params.get('end');
  if (!isDateOnly(start) || !isDateOnly(end) || start > end) return null;
  return { start, end };
}

function parseCycleIndex(value, country = 'IN') {
  if (value === null) return null;
  const index = Number(value);
  const upperBound = country === 'IN' ? CYCLE_COUNT : 10000;
  return Number.isInteger(index) && index >= 0 && index < upperBound ? String(index) : null;
}

export function parseUrlState(search = '', { coverageEnd = null } = {}) {
  const params = new URLSearchParams(search);
  const requestedCountry = params.get('country') || '';
  const country = /^[A-Z]{2}$/.test(requestedCountry) ? requestedCountry : 'IN';
  const view = VALID_VIEWS.includes(params.get('view')) ? params.get('view') : 'timeline';
  const rawPreset = params.get('range');
  let preset = rawPreset === 'MAX' ? 'ALL' : VALID_PRESETS.includes(rawPreset) ? rawPreset : 'ALL';
  let dateRange = { start: null, end: null };

  if (preset === 'CUSTOM') {
    dateRange = parseCustomRange(params);
    if (!dateRange) {
      preset = 'ALL';
      dateRange = { start: null, end: null };
    }
  } else if (preset !== 'ALL') {
    dateRange = rangeForYears({ '1Y': 1, '5Y': 5, '10Y': 10 }[preset], country === 'IN' ? undefined : (coverageEnd || new Date().toISOString().slice(0, 10)));
  }

  return {
    activeView: view,
    activePreset: preset,
    dateRange,
    layers: parseLayers(params.get('layers'), country),
    activeDecisionId: country === 'IN' ? (DECISION_IDS.has(params.get('decision')) ? params.get('decision') : null) : (/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(params.get('decision') || '') ? params.get('decision') : null),
    cycleA: parseCycleIndex(params.get('a'), country),
    cycleB: parseCycleIndex(params.get('b'), country),
    recordFilters: normalizeRecordFilters({
      action: URL_ACTION_FILTERS.includes(params.get('action')) && (params.get('action') !== 'framework' || country !== 'IN') ? params.get('action') : 'all',
      evidence: EVIDENCE_FILTERS.includes(params.get('evidence')) ? params.get('evidence') : 'all',
    }),
    timelineMode: normalizeTimelineMode(params.get('mode')),
    rateChangeState: normalizeRateChangeState({
      sizeBand: RATE_CHANGE_SIZE_BANDS.includes(params.get('moveBand')) ? params.get('moveBand') : 'all',
      sort: RATE_CHANGE_SORTS.includes(params.get('moveSort')) ? params.get('moveSort') : 'date',
      view: RATE_CHANGE_VIEWS.includes(params.get('moveView')) ? params.get('moveView') : 'distribution',
    }),
    breakdownState: normalizeBreakdownState({
      group: BREAKDOWN_GROUPS.includes(params.get('breakdown')) ? params.get('breakdown') : 'regime',
      metric: BREAKDOWN_METRICS.includes(params.get('metric')) ? params.get('metric') : 'count',
    }),
    comparison: normalizeComparison({
      aStart: params.get('aStart'),
      aEnd: params.get('aEnd'),
      bStart: params.get('bStart'),
      bEnd: params.get('bEnd'),
    }),
  };
}

export function serializeUrlState({ country = 'IN', activeView = 'timeline', activePreset = 'ALL', dateRange = {}, layers = {}, activeDecisionId = null, cycleSelection = {}, recordFilters = {}, timelineMode = 'all', rateChangeState = {}, breakdownState = {}, comparison = null } = {}) {
  const params = new URLSearchParams();
  if (country && country !== 'IN') params.set('country', country);
  params.set('view', VALID_VIEWS.includes(activeView) ? activeView : 'timeline');
  let preset = activePreset === 'MAX' ? 'ALL' : VALID_PRESETS.includes(activePreset) ? activePreset : 'ALL';
  if (preset === 'CUSTOM' && (!isDateOnly(dateRange.start) || !isDateOnly(dateRange.end) || dateRange.start > dateRange.end)) {
    preset = 'ALL';
  }
  params.set('range', preset);

  if (preset === 'CUSTOM') {
    if (isDateOnly(dateRange.start)) params.set('start', dateRange.start);
    if (isDateOnly(dateRange.end)) params.set('end', dateRange.end);
  }

  if (country !== 'IN') {
    // An empty value is meaningful: it records that the user hid the interval band.
    params.set('layers', layers.range === false ? '' : 'range');
  } else {
    const normalizedLayers = {
      regimes: layers.regimes !== false,
      events: layers.events !== false,
    };
    if (!normalizedLayers.regimes || !normalizedLayers.events) {
      const layerNames = ['regimes', 'events'].filter(layer => normalizedLayers[layer]);
      params.set('layers', layerNames.join(','));
    }
  }
  if ((country === 'IN' && DECISION_IDS.has(activeDecisionId)) || (country !== 'IN' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(activeDecisionId || ''))) params.set('decision', activeDecisionId);
  const cycleA = parseCycleIndex(cycleSelection.a, country);
  const cycleB = parseCycleIndex(cycleSelection.b, country);
  if (cycleA !== null) params.set('a', cycleA);
  if (cycleB !== null) params.set('b', cycleB);
  const normalizedFilters = normalizeRecordFilters(recordFilters);
  if (normalizedFilters.action !== 'all') params.set('action', normalizedFilters.action);
  if (normalizedFilters.evidence !== 'all') params.set('evidence', normalizedFilters.evidence);
  const normalizedMode = normalizeTimelineMode(timelineMode);
  if (normalizedMode !== 'all') params.set('mode', normalizedMode);
  const normalizedRateChange = normalizeRateChangeState(rateChangeState);
  if (normalizedRateChange.sizeBand !== 'all') params.set('moveBand', normalizedRateChange.sizeBand);
  if (normalizedRateChange.sort !== 'date') params.set('moveSort', normalizedRateChange.sort);
  if (normalizedRateChange.view !== 'distribution') params.set('moveView', normalizedRateChange.view);
  const normalizedBreakdown = normalizeBreakdownState(breakdownState);
  if (normalizedBreakdown.group !== 'regime') params.set('breakdown', normalizedBreakdown.group);
  if (normalizedBreakdown.metric !== 'count') params.set('metric', normalizedBreakdown.metric);
  const normalizedComparison = normalizeComparison(comparison || {});
  if (normalizedComparison) {
    params.set('aStart', normalizedComparison.aStart);
    params.set('aEnd', normalizedComparison.aEnd);
    params.set('bStart', normalizedComparison.bStart);
    params.set('bEnd', normalizedComparison.bEnd);
  }
  return params.toString();
}

function applyParsedState(parsed, callbacks) {
  callbacks.onViewChange?.(parsed.activeView);
  callbacks.onPresetChange?.(parsed.activePreset);
  callbacks.onDateRangeChange?.(parsed.dateRange);
  callbacks.onLayersChange?.(parsed.layers);
  callbacks.onDecisionSelect?.(parsed.activeDecisionId);
  callbacks.onCycleSelectionChange?.({ a: parsed.cycleA, b: parsed.cycleB });
  callbacks.onRecordFiltersChange?.(parsed.recordFilters);
  callbacks.onTimelineModeChange?.(parsed.timelineMode);
  callbacks.onRateChangeStateChange?.(parsed.rateChangeState);
  callbacks.onBreakdownStateChange?.(parsed.breakdownState);
  callbacks.onComparisonChange?.(parsed.comparison);
}

function serializeParsedState(parsed, country) {
  return serializeUrlState({
    country,
    activeView: parsed.activeView,
    activePreset: parsed.activePreset,
    dateRange: parsed.dateRange,
    layers: parsed.layers,
    activeDecisionId: parsed.activeDecisionId,
    cycleSelection: { a: parsed.cycleA, b: parsed.cycleB },
    recordFilters: parsed.recordFilters,
    timelineMode: parsed.timelineMode,
    rateChangeState: parsed.rateChangeState,
    breakdownState: parsed.breakdownState,
    comparison: parsed.comparison,
  });
}

// Sync app state to/from URL search params for deep-linking and browser history.
export default function useUrlState({
  country = 'IN',
  coverageEnd = null,
  activeView,
  dateRange,
  activePreset,
  layers,
  activeDecisionId,
  cycleSelection,
  recordFilters,
  timelineMode,
  rateChangeState,
  breakdownState,
  comparison,
  onViewChange,
  onDateRangeChange,
  onPresetChange,
  onLayersChange,
  onDecisionSelect,
  onCycleSelectionChange,
  onRecordFiltersChange,
  onTimelineModeChange,
  onRateChangeStateChange,
  onBreakdownStateChange,
  onComparisonChange,
}) {
  const hasMounted = useRef(false);
  const pendingRestore = useRef(null);

  const readUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedCountry = params.get('country') || '';
    const urlCountry = /^[A-Z]{2}$/.test(requestedCountry) ? requestedCountry : 'IN';
    const parsed = parseUrlState(window.location.search, { coverageEnd });
    pendingRestore.current = serializeParsedState(parsed, urlCountry);
    applyParsedState(parsed, {
      onViewChange,
      onDateRangeChange,
      onPresetChange,
      onLayersChange,
      onDecisionSelect,
      onCycleSelectionChange,
      onRecordFiltersChange,
      onTimelineModeChange,
      onRateChangeStateChange,
      onBreakdownStateChange,
      onComparisonChange,
    });
  }, [coverageEnd, onBreakdownStateChange, onComparisonChange, onCycleSelectionChange, onDateRangeChange, onDecisionSelect, onLayersChange, onPresetChange, onRateChangeStateChange, onRecordFiltersChange, onTimelineModeChange, onViewChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    readUrl();
    hasMounted.current = true;
    window.addEventListener('popstate', readUrl);
    return () => window.removeEventListener('popstate', readUrl);
  }, [readUrl]);

  const syncToUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (['/design', '/design/', '/colophon', '/colophon/', '/as-of', '/as-of/', '/releases', '/releases/', '/limitations', '/limitations/'].includes(window.location.pathname) || window.location.pathname.startsWith('/decision/')) return;
    const query = serializeUrlState({ country, activeView, activePreset, dateRange, layers, activeDecisionId, cycleSelection, recordFilters, timelineMode, rateChangeState, breakdownState, comparison });
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (pendingRestore.current !== null) {
      if (query !== pendingRestore.current) return;
      pendingRestore.current = null;
      if (`${window.location.pathname}${window.location.search}` !== newUrl) {
        window.history.replaceState(null, '', newUrl);
      }
      return;
    }
    if (`${window.location.pathname}${window.location.search}` !== newUrl) {
      window.history.pushState(null, '', newUrl);
    }
  }, [country, activeDecisionId, activePreset, activeView, breakdownState, comparison, cycleSelection, dateRange, layers, rateChangeState, recordFilters, timelineMode]);

  useEffect(() => {
    if (!hasMounted.current) return;
    syncToUrl();
  }, [syncToUrl]);
}
