import { useState } from 'react';

const RANGE_PRESETS = [
  { id: '1Y', label: '1Y', years: 1 },
  { id: '5Y', label: '5Y', years: 5 },
  { id: '10Y', label: '10Y', years: 10 },
  { id: 'ALL', label: 'All', years: null },
];

const VIEWS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'rate-change', label: 'Rate Changes' },
  { id: 'cycles', label: 'Cycle Comparison' },
];

export default function FilterBar({ activeView, onViewChange, dateRange, onDateRangeChange, activePreset, onPresetChange }) {
  const [showCustom, setShowCustom] = useState(false);

  const handlePreset = (preset) => {
    onPresetChange(preset.id);
    setShowCustom(false);

    if (preset.years === null) {
      onDateRangeChange({ start: null, end: null });
    } else {
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - preset.years);
      onDateRangeChange({
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      });
    }
  };

  const handleCustomStart = (e) => {
    onPresetChange('CUSTOM');
    setShowCustom(true);
    onDateRangeChange({ ...dateRange, start: e.target.value });
  };

  const handleCustomEnd = (e) => {
    onPresetChange('CUSTOM');
    setShowCustom(true);
    onDateRangeChange({ ...dateRange, end: e.target.value });
  };

  return (
    <div className="filter-bar" role="toolbar" aria-label="View and filter controls">
      {/* View tabs */}
      <div className="filter-bar__view-tabs" role="tablist" aria-label="Chart views">
        {VIEWS.map(v => (
          <button
            key={v.id}
            role="tab"
            className={`filter-bar__view-tab ${activeView === v.id ? 'filter-bar__view-tab--active' : ''}`}
            aria-selected={activeView === v.id}
            onClick={() => onViewChange(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="filter-bar__separator" role="presentation" />

      {/* Range presets */}
      <div className="filter-bar__range-presets" role="group" aria-label="Time range presets">
        {RANGE_PRESETS.map(p => (
          <button
            key={p.id}
            className={`filter-bar__range-btn ${activePreset === p.id ? 'filter-bar__range-btn--active' : ''}`}
            onClick={() => handlePreset(p)}
            aria-pressed={activePreset === p.id}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      <div className="filter-bar__custom-range">
        <input
          type="date"
          className="filter-bar__date-input"
          value={dateRange.start || ''}
          onChange={handleCustomStart}
          aria-label="Start date"
        />
        <span className="filter-bar__date-sep">→</span>
        <input
          type="date"
          className="filter-bar__date-input"
          value={dateRange.end || ''}
          onChange={handleCustomEnd}
          aria-label="End date"
        />
      </div>

      <div className="filter-bar__spacer" />
    </div>
  );
}
