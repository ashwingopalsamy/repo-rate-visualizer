import { useState } from 'react';
import ThemeProvider from '../components/ThemeProvider.jsx';
import MobileNav from './MobileNav.jsx';
import MobileOverview from './MobileOverview.jsx';
import MobileTimeline from './MobileTimeline.jsx';
import MobileChanges from './MobileChanges.jsx';
import MobileMore from './MobileMore.jsx';
import useUrlState from '../hooks/useUrlState.js';

const TAB_TO_VIEW = {
  overview: 'timeline',
  timeline: 'timeline',
  changes: 'rate-change',
  more: 'cycles',
};

const VIEW_TO_TAB = {
  'timeline': 'timeline',
  'rate-change': 'changes',
  'cycles': 'more',
};

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState('overview');
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
    activeView: TAB_TO_VIEW[activeTab] || 'timeline',
    dateRange,
    activePreset,
    onViewChange: (view) => {
      const tab = VIEW_TO_TAB[view];
      if (tab) setActiveTab(tab);
    },
    onDateRangeChange: setDateRange,
    onPresetChange: setActivePreset,
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <ThemeProvider>
      <div className="mobile-app">
        <div className="mobile-screen">
          {activeTab === 'overview' && <MobileOverview />}
          {activeTab === 'timeline' && (
            <MobileTimeline
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              activePreset={activePreset}
              onPresetChange={setActivePreset}
            />
          )}
          {activeTab === 'changes' && (
            <MobileChanges
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              activePreset={activePreset}
              onPresetChange={setActivePreset}
            />
          )}
          {activeTab === 'more' && <MobileMore />}
        </div>
        <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </ThemeProvider>
  );
}
