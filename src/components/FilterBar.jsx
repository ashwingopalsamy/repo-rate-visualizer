import { useCallback, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { currentRate, decisions, snapshotMeta } from '../data/dataLoader.js';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from './ui/popover.jsx';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs.jsx';

export const RANGE_PRESETS = [
  { id: '1Y', label: '1Y', years: 1 },
  { id: '5Y', label: '5Y', years: 5 },
  { id: '10Y', label: '10Y', years: 10 },
  { id: 'ALL', label: 'Max', years: null },
];

const coverageStart = decisions[0]?.date || '';
const coverageEnd = snapshotMeta.latestOfficialDate || currentRate.date;

function rangeForPreset(years) {
  if (years === null) return { start: null, end: null };
  const end = new Date(`${coverageEnd}T00:00:00.000Z`);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - years);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

function formatShortDate(value) {
  if (!value) return 'Any date';
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatCompactRange(start, end) {
  if (!start || !end) return 'Custom';
  const startYear = new Date(`${start}T00:00:00.000Z`).getUTCFullYear();
  const endYear = new Date(`${end}T00:00:00.000Z`).getUTCFullYear();
  return startYear === endYear ? `Custom · ${startYear}` : `Custom · ${startYear}–${endYear}`;
}

function validDate(value) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export default function FilterBar({ dateRange, onDateRangeChange, activePreset, onPresetChange, onApplyRange, onReset, className = '' }) {
  const [customDatesOpen, setCustomDatesOpen] = useState(false);
  const [draftRange, setDraftRange] = useState(() => ({
    start: dateRange.start || coverageStart,
    end: dateRange.end || coverageEnd,
  }));

  const validationMessage = useMemo(() => {
    if (!validDate(draftRange.start) || !validDate(draftRange.end)) return 'Choose both a start and end date.';
    if (draftRange.start > draftRange.end) return 'Start date must be on or before the end date.';
    return '';
  }, [draftRange]);

  const handlePreset = useCallback((presetId) => {
    const preset = RANGE_PRESETS.find(item => item.id === presetId);
    if (!preset) return;
    onPresetChange?.(preset.id);
    onDateRangeChange?.(rangeForPreset(preset.years));
  }, [onDateRangeChange, onPresetChange]);

  const handleOpenChange = (open) => {
    if (open) {
      setDraftRange({
        start: dateRange.start || coverageStart,
        end: dateRange.end || coverageEnd,
      });
    }
    setCustomDatesOpen(open);
  };

  const handleApply = () => {
    if (validationMessage) return;
    const nextRange = { start: draftRange.start, end: draftRange.end };
    onPresetChange?.('CUSTOM');
    onDateRangeChange?.(nextRange);
    onApplyRange?.(nextRange);
    setCustomDatesOpen(false);
  };

  const handleReset = () => {
    const nextRange = rangeForPreset(null);
    onReset?.(nextRange);
    if (!onReset) {
      onPresetChange?.('ALL');
      onDateRangeChange?.(nextRange);
    }
    setCustomDatesOpen(false);
  };

  return (
    <div className={`range-control flex min-w-0 items-center gap-2.5 ${className}`} role="toolbar" aria-label="Timeline range controls">
      <span className="range-control__label text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Range</span>
      <Tabs value={activePreset === 'CUSTOM' ? undefined : activePreset} onValueChange={handlePreset}>
        <TabsList aria-label="Time range presets" className="range-control__presets gap-1">
          {RANGE_PRESETS.map(preset => (
            <TabsTrigger className="px-2.5 sm:px-3" key={preset.id} value={preset.id}>
              {preset.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Popover open={customDatesOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
            <Button
              className="range-control__custom-trigger h-9 rounded-lg border border-border/60 bg-background/80 px-2 sm:px-3 text-xs font-medium hover:bg-muted/60 transition-colors shadow-2xs shrink-0"
              variant={activePreset === 'CUSTOM' ? 'secondary' : 'outline'}
              aria-expanded={customDatesOpen}
              aria-label={activePreset === 'CUSTOM' ? `Custom dates, ${formatShortDate(dateRange.start)} through ${formatShortDate(dateRange.end)}` : 'Choose custom date range'}
              data-custom-range-trigger
            >
              <CalendarDays className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline truncate">{activePreset === 'CUSTOM' ? formatCompactRange(dateRange.start, dateRange.end) : 'Custom'}</span>
              {activePreset === 'CUSTOM' ? <span className="sm:hidden text-[11px] truncate max-w-[60px]">{formatCompactRange(dateRange.start, dateRange.end)}</span> : null}
            </Button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} collisionPadding={16} className="w-[min(340px,calc(100vw-2rem))]">
          <PopoverHeader>
            <PopoverTitle>Custom date range</PopoverTitle>
            <PopoverDescription>Apply a precise window from the dataset coverage.</PopoverDescription>
          </PopoverHeader>
          {/* Always stack vertically for reliable mobile layout */}
          <div className="mt-4 grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="range-start">Start date</Label>
              <Input
                className="h-10 text-sm tabular-nums"
                id="range-start"
                type="date"
                min={coverageStart}
                max={coverageEnd}
                value={draftRange.start || ''}
                aria-invalid={Boolean(validationMessage && !validDate(draftRange.start))}
                onChange={event => setDraftRange(current => ({ ...current, start: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="range-end">End date</Label>
              <Input
                className="h-10 text-sm tabular-nums"
                id="range-end"
                type="date"
                min={coverageStart}
                max={coverageEnd}
                value={draftRange.end || ''}
                aria-invalid={Boolean(validationMessage && !validDate(draftRange.end))}
                onChange={event => setDraftRange(current => ({ ...current, end: event.target.value }))}
              />
            </div>
          </div>
          <p className="mt-3 mb-0 text-xs text-muted-foreground">Available {formatShortDate(coverageStart)} – {formatShortDate(coverageEnd)}</p>
          <p id="range-error" className={`mt-2 mb-0 text-xs text-destructive ${validationMessage ? '' : 'sr-only'}`} aria-live="polite">{validationMessage || 'No date range error.'}</p>
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/80 pt-3">
            <Button className="px-0" size="sm" variant="ghost" onClick={handleReset}>Reset to Max</Button>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCustomDatesOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleApply} disabled={Boolean(validationMessage)} aria-describedby="range-error">Apply</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
