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
  const [activeView, setActiveView] = useState('timeline');
  const [activeDecisionId, setActiveDecisionId] = useState(null);
  const [layers, setLayers] = useState({ regimes: true, events: true });
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date(`${snapshotMeta.latestOfficialDate || currentRate.date}T00:00:00.000Z`);
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 10);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  const handleViewChange = (view) => {
    setActiveView(view);
  };
  const [activePreset, setActivePreset] = useState('10Y');

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
      <div className="chartbook-app mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
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
        <main className="flex flex-col gap-10 py-8 sm:py-10 lg:gap-12 lg:py-12">
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
    </ThemeProvider>
  );
}
