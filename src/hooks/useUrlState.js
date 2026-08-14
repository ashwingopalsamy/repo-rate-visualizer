import { useEffect, useCallback, useRef } from 'react';

// Syncs app state to/from URL search params for deep-linking
export default function useUrlState({ activeView, dateRange, activePreset, onViewChange, onDateRangeChange, onPresetChange }) {
  const hasMounted = useRef(false);

  // Read URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const view = params.get('view');
    if (view && ['timeline', 'rate-change', 'cycles'].includes(view)) {
      onViewChange(view);
    }

    const preset = params.get('range');
    if (preset && ['1Y', '5Y', '10Y', 'ALL', 'CUSTOM'].includes(preset)) {
      onPresetChange(preset);

      if (preset === 'CUSTOM') {
        const start = params.get('start');
        const end = params.get('end');
        onDateRangeChange({ start: start || null, end: end || null });
      } else if (preset === 'ALL') {
        onDateRangeChange({ start: null, end: null });
      } else if (preset !== 'ALL') {
        const years = { '1Y': 1, '5Y': 5, '10Y': 10 }[preset];
        const end = new Date();
        const start = new Date();
        start.setFullYear(start.getFullYear() - years);
        onDateRangeChange({
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        });
      }
    }
  }, []);

  // Write state to URL on change
  const syncToUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set('view', activeView);
    params.set('range', activePreset);

    if (activePreset === 'CUSTOM') {
      if (dateRange.start) params.set('start', dateRange.start);
      if (dateRange.end) params.set('end', dateRange.end);
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  }, [activeView, dateRange, activePreset]);

  useEffect(() => {
    // Let the mount-time URL read establish state before writing anything
    // back. Otherwise the initial defaults can replace a valid deep link.
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    syncToUrl();
  }, [syncToUrl]);
}
