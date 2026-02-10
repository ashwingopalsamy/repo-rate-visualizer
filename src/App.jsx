import { useState } from 'react';
import ThemeProvider from './components/ThemeProvider.jsx';
import Header from './components/Header.jsx';
import HeroCard from './components/HeroCard.jsx';
import FilterBar from './components/FilterBar.jsx';
import ExportBar from './components/ExportBar.jsx';
import TimelineChart from './components/TimelineChart.jsx';
import RateChangeBar from './components/RateChangeBar.jsx';
import CycleComparison from './components/CycleComparison.jsx';
import EventsList from './components/EventsList.jsx';
import DataCitation from './components/DataCitation.jsx';
import useUrlState from './hooks/useUrlState.js';

export default function App() {
  const [activeView, setActiveView] = useState('timeline');
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - 10);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  const [activePreset, setActivePreset] = useState('10Y');

  useUrlState({
    activeView,
    dateRange,
    activePreset,
    onViewChange: setActiveView,
    onDateRangeChange: setDateRange,
    onPresetChange: setActivePreset,
  });

  return (
    <ThemeProvider>
      <div className="app">
        <Header />
        <HeroCard />

        <div className="controls-row">
          <FilterBar
            activeView={activeView}
            onViewChange={setActiveView}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            activePreset={activePreset}
            onPresetChange={setActivePreset}
          />
          <ExportBar dateRange={dateRange} activeView={activeView} />
        </div>

        <div className="main-content">
          <div className="view-content">
            {/* Main Column: Chart + Header/Legend */}
            <div className="view-content__column view-content__column--main">
              {activeView === 'timeline' && (
                <div className="section-header">
                  TIMELINE
                  {/* Legend inside header for alignment */}
                  <div className="legend" role="list" aria-label="Chart legend">
                    <div className="legend__item" role="listitem">
                      <span className="legend__swatch legend__swatch--easing" aria-hidden="true" />
                      Easing
                    </div>
                    <div className="legend__item" role="listitem">
                      <span className="legend__swatch legend__swatch--tightening" aria-hidden="true" />
                      Tightening
                    </div>
                    <div className="legend__item" role="listitem">
                      <span className="legend__swatch legend__swatch--pause" aria-hidden="true" />
                      Pause
                    </div>
                    <div className="legend__item" role="listitem">
                      <span className="legend__line" aria-hidden="true" />
                      Macro Event
                    </div>
                  </div>
                </div>
              )}
              
              <div className="view-content__chart">
                {activeView === 'timeline' && <TimelineChart dateRange={dateRange} />}
                {activeView === 'rate-change' && <RateChangeBar dateRange={dateRange} />}
                {activeView === 'cycles' && <CycleComparison />}
              </div>
            </div>

            {/* Side Column: Events (Only for Timeline) */}
            {activeView === 'timeline' && (
              <div className="view-content__column view-content__column--side">
                <div className="section-header">EVENTS</div>
                <div className="events-scroll">
                  <EventsList dateRange={dateRange} />
                </div>
              </div>
            )}
          </div>
        </div>

        <DataCitation />
      </div>
    </ThemeProvider>
  );
}
