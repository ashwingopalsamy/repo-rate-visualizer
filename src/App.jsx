import { useEffect, useState } from 'react';
import ThemeProvider from './components/ThemeProvider.jsx';
import Header from './components/Header.jsx';
import RateSummary from './components/RateSummary.jsx';
import ChartWorkspace from './components/ChartWorkspace.jsx';
import SourceTransparency from './components/SourceTransparency.jsx';
import DataCitation from './components/DataCitation.jsx';
import useUrlState from './hooks/useUrlState.js';
import { currentRate, snapshotMeta } from './data/dataLoader.js';

export default function App() {
  const [activeView, setActiveView] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      if (['timeline', 'breakdown', 'rate-change', 'cycles'].includes(view)) return view;
    }
    return 'timeline';
  });
  const [activeDecisionId, setActiveDecisionId] = useState(null);
  const [layers, setLayers] = useState({ regimes: true, events: true });
  const [dateRange, setDateRange] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const range = params.get('range');
      if (range === 'CUSTOM') {
        return {
          start: params.get('start') || null,
          end: params.get('end') || null,
        };
      }
      if (range && ['1Y', '5Y', '10Y'].includes(range)) {
        const years = { '1Y': 1, '5Y': 5, '10Y': 10 }[range];
        const end = new Date(`${snapshotMeta.latestOfficialDate || currentRate.date}T00:00:00.000Z`);
        const start = new Date(end);
        start.setFullYear(start.getFullYear() - years);
        return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        };
      }
    }
    return {
      start: null,
      end: null,
    };
  });

  const handleViewChange = (view) => {
    setActiveView(view);
  };
  const [activePreset, setActivePreset] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const range = params.get('range');
      if (['1Y', '5Y', '10Y', 'ALL', 'MAX', 'CUSTOM'].includes(range)) {
        return range === 'MAX' ? 'ALL' : range;
      }
    }
    return 'ALL';
  });

  useEffect(() => {
    setActiveDecisionId(null);
  }, [activeView, dateRange.start, dateRange.end]);

  useUrlState({
    activeView,
    dateRange,
    activePreset,
    onViewChange: handleViewChange,
    onDateRangeChange: setDateRange,
    onPresetChange: setActivePreset,
  });

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
