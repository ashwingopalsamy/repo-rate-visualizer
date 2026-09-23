import { useCallback, useEffect, useRef } from 'react';
import { currentRate, decisions, regimes, snapshotMeta } from '../data/dataLoader.js';

export const VALID_VIEWS = Object.freeze(['timeline', 'breakdown', 'rate-change', 'cycles']);
export const VALID_PRESETS = Object.freeze(['1Y', '5Y', '10Y', 'ALL', 'CUSTOM']);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DECISION_IDS = new Set(decisions.map(decision => decision.id));
const CYCLE_COUNT = regimes.filter(regime => regime.type !== 'pause').length;

function isDateOnly(value) {
  if (!DATE_ONLY_PATTERN.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function rangeForYears(years) {
  const end = new Date(`${snapshotMeta.latestRecordedDate || currentRate.date}T00:00:00.000Z`);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - years);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function parseLayers(value) {
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

function parseCycleIndex(value) {
  if (value === null) return null;
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < CYCLE_COUNT ? String(index) : null;
}

export function parseUrlState(search = '') {
  const params = new URLSearchParams(search);
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
    dateRange = rangeForYears({ '1Y': 1, '5Y': 5, '10Y': 10 }[preset]);
  }

  return {
    activeView: view,
    activePreset: preset,
    dateRange,
    layers: parseLayers(params.get('layers')),
    activeDecisionId: DECISION_IDS.has(params.get('decision')) ? params.get('decision') : null,
    cycleA: parseCycleIndex(params.get('a')),
    cycleB: parseCycleIndex(params.get('b')),
  };
}

export function serializeUrlState({ activeView = 'timeline', activePreset = 'ALL', dateRange = {}, layers = {}, activeDecisionId = null, cycleSelection = {} } = {}) {
  const params = new URLSearchParams();
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

  const normalizedLayers = {
    regimes: layers.regimes !== false,
    events: layers.events !== false,
  };
  if (!normalizedLayers.regimes || !normalizedLayers.events) {
    const layerNames = ['regimes', 'events'].filter(layer => normalizedLayers[layer]);
    params.set('layers', layerNames.join(','));
  }
  if (DECISION_IDS.has(activeDecisionId)) params.set('decision', activeDecisionId);
  const cycleA = parseCycleIndex(cycleSelection.a);
  const cycleB = parseCycleIndex(cycleSelection.b);
  if (cycleA !== null) params.set('a', cycleA);
  if (cycleB !== null) params.set('b', cycleB);
  return params.toString();
}

function applyParsedState(parsed, callbacks) {
  callbacks.onViewChange?.(parsed.activeView);
  callbacks.onPresetChange?.(parsed.activePreset);
  callbacks.onDateRangeChange?.(parsed.dateRange);
  callbacks.onLayersChange?.(parsed.layers);
  callbacks.onDecisionSelect?.(parsed.activeDecisionId);
  callbacks.onCycleSelectionChange?.({ a: parsed.cycleA, b: parsed.cycleB });
}

// Sync app state to/from URL search params for deep-linking and browser history.
export default function useUrlState({
  activeView,
  dateRange,
  activePreset,
  layers,
  activeDecisionId,
  cycleSelection,
  onViewChange,
  onDateRangeChange,
  onPresetChange,
  onLayersChange,
  onDecisionSelect,
  onCycleSelectionChange,
}) {
  const hasMounted = useRef(false);
  const skipNextSync = useRef(false);

  const readUrl = useCallback(() => {
    skipNextSync.current = true;
    applyParsedState(parseUrlState(window.location.search), {
      onViewChange,
      onDateRangeChange,
      onPresetChange,
      onLayersChange,
      onDecisionSelect,
      onCycleSelectionChange,
    });
  }, [onCycleSelectionChange, onDateRangeChange, onDecisionSelect, onLayersChange, onPresetChange, onViewChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    readUrl();
    hasMounted.current = true;
    window.addEventListener('popstate', readUrl);
    return () => window.removeEventListener('popstate', readUrl);
  }, [readUrl]);

  const syncToUrl = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (['/design', '/design/', '/colophon', '/colophon/'].includes(window.location.pathname) || window.location.pathname.startsWith('/decision/')) return;
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const query = serializeUrlState({ activeView, activePreset, dateRange, layers, activeDecisionId, cycleSelection });
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
    if (`${window.location.pathname}${window.location.search}` !== newUrl) {
      window.history.pushState(null, '', newUrl);
    }
  }, [activeDecisionId, activePreset, activeView, cycleSelection, dateRange, layers]);

  useEffect(() => {
    if (!hasMounted.current) return;
    syncToUrl();
  }, [syncToUrl]);
}
