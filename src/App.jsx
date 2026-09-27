import { useCallback, useEffect, useState } from 'react';
import ThemeProvider from './components/ThemeProvider.jsx';
import Header from './components/Header.jsx';
import CountryOverview from './components/CountryOverview.jsx';
import ChartWorkspace from './components/ChartWorkspace.jsx';
import SourceTransparency from './components/SourceTransparency.jsx';
import DataCitation from './components/DataCitation.jsx';
import DesignPage from './components/DesignPage.jsx';
import ColophonPage from './components/ColophonPage.jsx';
import DecisionDossier from './components/DecisionDossier.jsx';
import useUrlState, { parseUrlState, serializeUrlState } from './hooks/useUrlState.js';
import { DEFAULT_BREAKDOWN_STATE, DEFAULT_RATE_CHANGE_STATE, DEFAULT_RECORD_FILTERS } from './lib/analysisState.js';
import AsOfLookup from './components/AsOfLookup.jsx';
import ReleaseDiffPage from './components/ReleaseDiffPage.jsx';
import DataLimitations from './components/DataLimitations.jsx';
import { CountryIdentity, CountryIndex } from './components/CountryAtlas.jsx';
import { loadCountryManifest } from './data/countrySnapshot.js';
import { createCountryModel, loadCountryModel } from './data/countryModel.js';

function initialUrlState() {
  if (typeof window === 'undefined') {
    return parseUrlState('');
  }
  return parseUrlState(window.location.search);
}

function initialCountryCode(path = '/', search = '') {
  const params = new URLSearchParams(search);
  const requestedCountry = params.get('country') || '';
  if (/^[A-Z]{2}$/.test(requestedCountry)) return requestedCountry;
  return /^\/country\/us\/?$/.test(path) ? 'US' : 'IN';
}

const FALLBACK_COUNTRIES = [
  { code: 'IN', name: 'India', status: 'available', instrument: 'Policy repo rate', centralBank: 'Reserve Bank of India', locale: 'en-IN' },
  { code: 'US', name: 'United States', status: 'available', instrument: 'Federal funds target rate or range', centralBank: 'Federal Reserve', locale: 'en-US' },
];

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });
  const [countryCode, setCountryCode] = useState(() => typeof window === 'undefined' ? 'IN' : initialCountryCode(window.location.pathname, window.location.search));
  const [manifestState, setManifestState] = useState({ manifest: null, error: '' });
  const [countryState, setCountryState] = useState({ code: 'IN', model: createCountryModel(FALLBACK_COUNTRIES[0]), loading: false, error: '' });

  const isDesignPage = currentPath === '/design' || currentPath === '/design/';
  const isColophonPage = currentPath === '/colophon' || currentPath === '/colophon/';
  const isAsOfPage = currentPath === '/as-of' || currentPath === '/as-of/';
  const isReleaseDiffPage = currentPath === '/releases' || currentPath === '/releases/';
  const isLimitationsPage = currentPath === '/limitations' || currentPath === '/limitations/';
  const isCountryIndex = currentPath === '/countries' || currentPath === '/countries/';
  const dossierMatch = currentPath.match(/^\/decision\/([^/]+)\/?$/);
  const initialState = initialUrlState();

  const countries = manifestState.manifest?.countries || FALLBACK_COUNTRIES;
  const availableCountries = countries.filter(country => country.status === 'available');
  const selectedEntry = manifestState.manifest
    ? availableCountries.find(country => country.code === countryCode) || null
    : countryCode === 'IN' ? FALLBACK_COUNTRIES[0] : null;
  const countryModel = countryState.code === countryCode ? countryState.model : null;

  useEffect(() => {
    let live = true;
    loadCountryManifest().then(manifest => { if (live) setManifestState({ manifest, error: '' }); })
      .catch(error => { if (live) setManifestState({ manifest: null, error: error.message || 'Country manifest unavailable.' }); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (countryCode === 'IN' && !selectedEntry) {
      setCountryState({ code: 'IN', model: createCountryModel(FALLBACK_COUNTRIES[0]), loading: false, error: '' });
      return undefined;
    }
    if (!selectedEntry) {
      const requestedEntry = manifestState.manifest?.countries.find(country => country.code === countryCode);
      const error = manifestState.error || (manifestState.manifest
        ? requestedEntry?.status === 'planned'
          ? `${requestedEntry.name} is planned but does not have a published atlas release yet.`
          : `${requestedEntry?.name || countryCode} is not available in the policy-rate atlas.`
        : '');
      setCountryState({ code: countryCode, model: null, loading: !manifestState.manifest && !manifestState.error, error });
      return undefined;
    }
    let live = true;
    if (countryCode === 'IN') {
      setCountryState({ code: countryCode, model: createCountryModel(selectedEntry), loading: false, error: '' });
      return undefined;
    }
    setCountryState({ code: countryCode, model: null, loading: true, error: '' });
    loadCountryModel(selectedEntry).then(model => { if (live) setCountryState({ code: countryCode, model, loading: false, error: '' }); })
      .catch(error => { if (live) setCountryState({ code: countryCode, model: null, loading: false, error: error.message || 'Country release unavailable.' }); });
    return () => { live = false; };
  }, [countryCode, manifestState.error, selectedEntry]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setCountryCode(initialCountryCode(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!/^\/country\/us\/?$/.test(currentPath) || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('country', 'US');
    const search = params.toString();
    window.history.replaceState(null, '', `/${search ? `?${search}` : ''}`);
    setCurrentPath('/');
  }, [currentPath]);

  const [activeView, setActiveView] = useState(initialState.activeView);
  const [activeDecisionId, setActiveDecisionId] = useState(initialState.activeDecisionId);
  const [layers, setLayers] = useState(initialState.layers);
  const [cycleSelection, setCycleSelection] = useState({ a: initialState.cycleA, b: initialState.cycleB });
  const [dateRange, setDateRange] = useState(initialState.dateRange);
  const [recordFilters, setRecordFilters] = useState(initialState.recordFilters);
  const [timelineMode, setTimelineMode] = useState(initialState.timelineMode);
  const [rateChangeState, setRateChangeState] = useState(initialState.rateChangeState);
  const [breakdownState, setBreakdownState] = useState(initialState.breakdownState);
  const [comparison, setComparison] = useState(initialState.comparison);

  useEffect(() => {
    if (!countryModel || countryModel.code === 'IN') return;
    const validActions = new Set([
      'all', 'cut', 'hike',
      ...(countryModel.capabilities.holds ? ['hold'] : []),
      ...(countryModel.capabilities.framework ? ['framework'] : []),
    ]);
    if (!validActions.has(recordFilters.action)) setRecordFilters(current => ({ ...current, action: 'all' }));
    if (activeDecisionId && !countryModel.records.some(record => record.id === activeDecisionId)) setActiveDecisionId(null);
  }, [activeDecisionId, countryModel, recordFilters.action]);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
  }, []);
  const [activePreset, setActivePreset] = useState(initialState.activePreset);

  const handleCountryChange = useCallback((nextCode) => {
    if (nextCode === countryCode || !availableCountries.some(country => country.code === nextCode)) return;
    const nextLayers = nextCode === 'IN' ? { regimes: true, events: true } : { range: true };
    const query = serializeUrlState({
      country: nextCode,
      activeView: 'timeline',
      activePreset: 'ALL',
      dateRange: { start: null, end: null },
      layers: nextLayers,
      recordFilters: DEFAULT_RECORD_FILTERS,
      timelineMode: 'all',
      rateChangeState: DEFAULT_RATE_CHANGE_STATE,
      breakdownState: DEFAULT_BREAKDOWN_STATE,
    });
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/${query ? `?${query}` : ''}`);
    }
    setCurrentPath('/');
    setCountryCode(nextCode);
    setActiveView('timeline');
    setActivePreset('ALL');
    setDateRange({ start: null, end: null });
    setLayers(nextLayers);
    setActiveDecisionId(null);
    setCycleSelection({ a: null, b: null });
    setRecordFilters(DEFAULT_RECORD_FILTERS);
    setTimelineMode('all');
    setRateChangeState(DEFAULT_RATE_CHANGE_STATE);
    setBreakdownState(DEFAULT_BREAKDOWN_STATE);
    setComparison(null);
  }, [availableCountries, countryCode]);

  const resetAnalysis = useCallback(() => {
    setActiveDecisionId(null);
    setCycleSelection({ a: null, b: null });
    setRecordFilters(DEFAULT_RECORD_FILTERS);
    setTimelineMode('all');
    setRateChangeState(DEFAULT_RATE_CHANGE_STATE);
    setBreakdownState(DEFAULT_BREAKDOWN_STATE);
    setComparison(null);
  }, []);

  const analysisState = {
    activeView,
    activePreset,
    dateRange,
    layers,
    activeDecisionId,
    cycleSelection,
    recordFilters,
    timelineMode,
    rateChangeState,
    breakdownState,
    comparison,
  };

  const loadAnalysisState = useCallback((savedState = {}) => {
    if (savedState.activeView) setActiveView(savedState.activeView);
    if (savedState.activePreset) setActivePreset(savedState.activePreset);
    if (savedState.dateRange) setDateRange(savedState.dateRange);
    if (savedState.layers) setLayers(savedState.layers);
    setActiveDecisionId(savedState.activeDecisionId || null);
    setCycleSelection(savedState.cycleSelection || { a: null, b: null });
    setRecordFilters(savedState.recordFilters || DEFAULT_RECORD_FILTERS);
    setTimelineMode(savedState.timelineMode || 'all');
    setRateChangeState(savedState.rateChangeState || DEFAULT_RATE_CHANGE_STATE);
    setBreakdownState(savedState.breakdownState || DEFAULT_BREAKDOWN_STATE);
    setComparison(savedState.comparison || null);
  }, []);

  useEffect(() => {
    if (dossierMatch || typeof window === 'undefined') return undefined;
    let recordId = null;
    try {
      recordId = window.sessionStorage.getItem('rbi-return-focus');
    } catch {
      return undefined;
    }
    if (!recordId) return undefined;

    let frame = null;
    let attempts = 0;
    const restoreFocus = () => {
      const focusTarget = [...document.querySelectorAll('.decision-record [data-decision-id]')]
        .filter(element => element.getAttribute('data-decision-id') === recordId)
        .flatMap(element => [...element.querySelectorAll('button[aria-pressed]')])
        .find(button => button.getClientRects().length > 0);
      if (focusTarget) {
        focusTarget.focus({ preventScroll: true });
        try {
          window.sessionStorage.removeItem('rbi-return-focus');
        } catch {
          // Ignore storage cleanup failures.
        }
        return;
      }
      attempts += 1;
      if (attempts < 60) frame = window.requestAnimationFrame(restoreFocus);
    };
    frame = window.requestAnimationFrame(restoreFocus);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [dossierMatch, activeDecisionId, activeView, dateRange.end, dateRange.start]);

  useUrlState({
    country: countryCode,
    coverageEnd: selectedEntry?.coverageThrough || countryModel?.coverage.through || null,
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
    onViewChange: handleViewChange,
    onDateRangeChange: setDateRange,
    onPresetChange: setActivePreset,
    onLayersChange: setLayers,
    onDecisionSelect: setActiveDecisionId,
    onCycleSelectionChange: setCycleSelection,
    onRecordFiltersChange: setRecordFilters,
    onTimelineModeChange: setTimelineMode,
    onRateChangeStateChange: setRateChangeState,
    onBreakdownStateChange: setBreakdownState,
    onComparisonChange: setComparison,
  });

  if (dossierMatch) {
    const recordId = decodeURIComponent(dossierMatch[1]);
    const requestedReleaseId = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('snapshot')
      : null;
    return (
      <ThemeProvider>
        <DecisionDossier recordId={recordId} requestedReleaseId={requestedReleaseId} />
      </ThemeProvider>
    );
  }

  if (isDesignPage) {
    return (
      <ThemeProvider>
        <DesignPage />
      </ThemeProvider>
    );
  }

  if (isCountryIndex) {
    return <ThemeProvider><CountryIndex /></ThemeProvider>;
  }

  if (isColophonPage) {
    return (
      <ThemeProvider>
        <ColophonPage />
      </ThemeProvider>
    );
  }

  if (isAsOfPage) {
    return (
      <ThemeProvider>
        <AsOfLookup />
      </ThemeProvider>
    );
  }

  if (isReleaseDiffPage) {
    return (
      <ThemeProvider>
        <ReleaseDiffPage />
      </ThemeProvider>
    );
  }

  if (isLimitationsPage) {
    return (
      <ThemeProvider>
        <DataLimitations />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="chartbook-app flex min-h-screen w-full flex-col">
        <Header
          activePreset={activePreset}
          activeView={activeView}
          dateRange={dateRange}
          layers={layers}
          onDateRangeChange={setDateRange}
          onLayersChange={setLayers}
          onPresetChange={setActivePreset}
          onViewChange={handleViewChange}
          countryModel={countryModel}
          countryCode={countryCode}
          countryName={countries.find(country => country.code === countryCode)?.name || countryCode}
          countries={availableCountries}
          onCountryChange={handleCountryChange}
          onDecisionSelect={setActiveDecisionId}
          onRecordFiltersChange={setRecordFilters}
        />
        <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-4 pb-12 sm:px-6 lg:px-8">
          <main className="flex flex-col gap-6 py-4 sm:gap-8 sm:py-6">
            <CountryIdentity country={countryCode} countries={countries} onCountryChange={handleCountryChange} />
            {countryState.error ? <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">{countryState.error}</p> : null}
            {countryState.loading && !countryModel ? <p className="py-8 text-sm text-muted-foreground" role="status">Loading and verifying {countryCode} country release…</p> : null}
            {countryModel ? <>
            <CountryOverview model={countryModel} />

            <ChartWorkspace
              activePreset={activePreset}
              activeView={activeView}
              activeDecisionId={activeDecisionId}
              dateRange={dateRange}
              layers={layers}
              onDateRangeChange={setDateRange}
              onLayersChange={setLayers}
              onPresetChange={setActivePreset}
              onDecisionSelect={setActiveDecisionId}
              cycleSelection={cycleSelection}
              onCycleSelectionChange={setCycleSelection}
              recordFilters={recordFilters}
              onRecordFiltersChange={setRecordFilters}
              timelineMode={timelineMode}
              onTimelineModeChange={setTimelineMode}
              rateChangeState={rateChangeState}
              onRateChangeStateChange={setRateChangeState}
              breakdownState={breakdownState}
              onBreakdownStateChange={setBreakdownState}
              comparison={comparison}
              onComparisonChange={setComparison}
              analysisState={analysisState}
              onLoadState={loadAnalysisState}
              onResetAnalysis={resetAnalysis}
              onViewChange={handleViewChange}
              countryModel={countryModel}
            />

            <SourceTransparency countryModel={countryModel} />
            </> : null}
          </main>

          <DataCitation countryModel={countryModel || (countryCode !== 'IN' ? {
            code: countryCode,
            name: countries.find(country => country.code === countryCode)?.name || countryCode,
            centralBank: countries.find(country => country.code === countryCode)?.centralBank || 'central bank',
            entry: countries.find(country => country.code === countryCode) || null,
          } : null)} />
        </div>
      </div>
    </ThemeProvider>
  );
}
