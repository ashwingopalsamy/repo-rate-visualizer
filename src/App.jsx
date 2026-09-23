import { useCallback, useEffect, useState } from 'react';
import ThemeProvider from './components/ThemeProvider.jsx';
import Header from './components/Header.jsx';
import RateSummary from './components/RateSummary.jsx';
import ChartWorkspace from './components/ChartWorkspace.jsx';
import SourceTransparency from './components/SourceTransparency.jsx';
import DataCitation from './components/DataCitation.jsx';
import DesignPage from './components/DesignPage.jsx';
import ColophonPage from './components/ColophonPage.jsx';
import DecisionDossier from './components/DecisionDossier.jsx';
import useUrlState, { parseUrlState } from './hooks/useUrlState.js';

function initialUrlState() {
  if (typeof window === 'undefined') {
    return parseUrlState('');
  }
  return parseUrlState(window.location.search);
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

  const isDesignPage = currentPath === '/design' || currentPath === '/design/';
  const isColophonPage = currentPath === '/colophon' || currentPath === '/colophon/';
  const dossierMatch = currentPath.match(/^\/decision\/([^/]+)\/?$/);
  const initialState = initialUrlState();

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [activeView, setActiveView] = useState(initialState.activeView);
  const [activeDecisionId, setActiveDecisionId] = useState(initialState.activeDecisionId);
  const [layers, setLayers] = useState(initialState.layers);
  const [cycleSelection, setCycleSelection] = useState({ a: initialState.cycleA, b: initialState.cycleB });
  const [dateRange, setDateRange] = useState(initialState.dateRange);

  const handleViewChange = useCallback((view) => {
    setActiveView(view);
  }, []);
  const [activePreset, setActivePreset] = useState(initialState.activePreset);

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
    activeView,
    dateRange,
    activePreset,
    layers,
    activeDecisionId,
    cycleSelection,
    onViewChange: handleViewChange,
    onDateRangeChange: setDateRange,
    onPresetChange: setActivePreset,
    onLayersChange: setLayers,
    onDecisionSelect: setActiveDecisionId,
    onCycleSelectionChange: setCycleSelection,
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

  if (isColophonPage) {
    return (
      <ThemeProvider>
        <ColophonPage />
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
        />
        <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-4 pb-12 sm:px-6 lg:px-8">
          <main className="flex flex-col gap-6 py-4 sm:gap-8 sm:py-6">
            <RateSummary />

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
              onViewChange={handleViewChange}
            />

            <SourceTransparency />
          </main>

          <DataCitation />
        </div>
      </div>
    </ThemeProvider>
  );
}
