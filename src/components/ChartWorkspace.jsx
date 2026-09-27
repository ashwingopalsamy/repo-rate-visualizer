import { useMemo, useState } from 'react';
import { Layers3 } from 'lucide-react';
import { decisions, macroEvents } from '../data/dataLoader.js';
import FilterBar from './FilterBar.jsx';
import ExportBar from './ExportBar.jsx';
import TimelineChart from './TimelineChart.jsx';
import RegimeBreakdown from './RegimeBreakdown.jsx';
import RateChangeBar from './RateChangeBar.jsx';
import CycleComparison from './CycleComparison.jsx';
import WindowComparison from './WindowComparison.jsx';
import EventsList from './EventsList.jsx';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.jsx';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs.jsx';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.jsx';
import { Separator } from './ui/separator.jsx';
import { VIEWS } from './viewConfig.js';
import AnalysisFilterRail from './AnalysisFilterRail.jsx';
import AnalysisStateStrip from './AnalysisStateStrip.jsx';
import ResearchNotebook from './ResearchNotebook.jsx';
import DecisionTimelineList from './DecisionTimelineList.jsx';
import { CountryTimeline, CountryYearBreakdown, CountryRateChanges, CountryMoveRuns, CountryWindowCompare } from './CountryAnalysisViews.jsx';

const VIEW_COPY = {
  timeline: {
    label: 'Timeline',
    description: 'The effective repo rate, source-backed rate records, directly evidenced RBI decisions, and optional policy context.',
  },
  breakdown: {
    label: 'Breakdown',
    description: 'Stacked decomposition of recorded rate changes and unchanged observations across regimes.',
  },
  'rate-change': {
    label: 'Rate changes',
    description: 'Basis-point moves derived from the recorded rate series.',
  },
  cycles: {
    label: 'Cycles',
    description: 'A normalized comparison of easing and tightening periods.',
  },
  compare: {
    label: 'Compare',
    description: 'A deterministic comparison of two selected date windows.',
  },
};

export default function ChartWorkspace({ activeView, activeDecisionId, dateRange, onDateRangeChange, activePreset, onPresetChange, layers, onLayersChange, onDecisionSelect, cycleSelection, onCycleSelectionChange, recordFilters, onRecordFiltersChange, timelineMode, onTimelineModeChange, rateChangeState, onRateChangeStateChange, breakdownState, onBreakdownStateChange, comparison, onComparisonChange, analysisState, onLoadState, onResetAnalysis, onViewChange, countryModel = null }) {
  const isCountryModel = Boolean(countryModel && countryModel.code !== 'IN');
  const copy = isCountryModel ? ({
    timeline: { label: 'Timeline', description: `Published ${countryModel.instrument} records and their point or range values.` },
    breakdown: { label: 'Breakdown', description: 'Published cuts, hikes, and framework changes grouped by table year.' },
    'rate-change': { label: 'Rate changes', description: 'Numeric published target changes in basis points.' },
    cycles: { label: 'Cycles', description: 'Runs of consecutive published moves in the same direction.' },
    compare: { label: 'Compare', description: 'Compare published target endpoints and move counts across two windows.' },
  }[activeView] || VIEW_COPY.timeline) : VIEW_COPY[activeView] || VIEW_COPY.timeline;
  const [layersOpen, setLayersOpen] = useState(false);
  const activeLayerCount = useMemo(() => isCountryModel
    ? countryModel.capabilities.range && layers?.range !== false ? 1 : 0
    : [layers?.regimes, layers?.events].filter(Boolean).length, [countryModel, isCountryModel, layers]);

  return (
    <section className="chart-workspace scroll-mt-24" aria-labelledby="chart-workspace-title">
      <Card className="workspace-card overflow-hidden rounded-xl border border-border/60 bg-card py-0 gap-0 shadow-2xs">
        <CardHeader className="border-b border-border/60 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <CardTitle id="chart-workspace-title" className="text-base font-bold tracking-tight sm:text-lg">{copy.label}</CardTitle>
            <CardDescription className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{copy.description}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* ── Control Rail ── */}
          <div className="workspace-controls border-b border-border/60 px-3.5 py-3 sm:px-6">
            <div className="workspace-control-rail">
              <div className="workspace-controls__grid">
                {/* View Switcher */}
                <div className="workspace-control-group" data-control-group="view">
                  <span className="workspace-control-label text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:block">View</span>
                  <Tabs className="min-w-0 w-full" value={activeView} onValueChange={onViewChange}>
                    <TabsList aria-label="Analytical views" className="workspace-view-switcher__list w-full grid grid-cols-5 lg:flex lg:w-auto gap-0.5 sm:gap-1 p-0.5 sm:p-1">
                      {VIEWS.map(view => (
                        <TabsTrigger className="workspace-view-switcher__trigger text-center px-0.5 min-[360px]:px-1 sm:px-3 text-[11px] min-[360px]:text-xs sm:text-sm font-medium truncate" key={view.id} value={view.id}>
                          {view.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                <div className="workspace-control-divider hidden h-5 w-px bg-border/60 xl:block" aria-hidden="true" />

                {/* Range */}
                <FilterBar
                  className="workspace-control-group workspace-control-group--range"
                  activePreset={activePreset}
                  dateRange={dateRange}
                  onDateRangeChange={onDateRangeChange}
                  onPresetChange={onPresetChange}
                  coverage={countryModel?.coverage}
                  locale={countryModel?.locale || 'en-IN'}
                />

                <div className="workspace-control-divider hidden h-5 w-px bg-border/60 lg:block" aria-hidden="true" />

                {/* Actions */}
                <div className="workspace-actions flex min-w-0 items-center gap-1.5" aria-label="Chart actions">
                  {!isCountryModel ? <ResearchNotebook analysisState={analysisState} onLoadState={onLoadState} /> : null}
                  <DropdownMenu open={layersOpen} onOpenChange={setLayersOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="h-9 rounded-lg px-2.5 sm:px-3 text-xs gap-1.5 border border-border/60 bg-background/80 hover:bg-muted/60 shadow-2xs"
                        size="sm"
                        variant={layersOpen ? 'secondary' : 'outline'}
                        aria-expanded={layersOpen}
                        aria-label={`Layers, ${activeLayerCount} active`}
                        data-layer-control
                      >
                        <Layers3 className="size-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Layers</span>
                        <span className="font-semibold tabular-nums text-[11px] text-muted-foreground">{activeLayerCount}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="w-60">
                      <DropdownMenuLabel>{isCountryModel ? countryModel.capabilities.range ? 'Target range' : 'Chart context' : 'Chart context'}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {isCountryModel && countryModel.capabilities.range ? <DropdownMenuCheckboxItem
                        checked={layers?.range !== false}
                        disabled={activeView !== 'timeline'}
                        onCheckedChange={checked => onLayersChange?.(current => ({ ...current, range: checked }))}
                      >
                        Published target range band
                      </DropdownMenuCheckboxItem> : isCountryModel ? <p className="m-0 px-2 py-1.5 text-xs leading-5 text-muted-foreground">This policy instrument is published as a point value; no range band is available.</p> : <>
                      <DropdownMenuCheckboxItem
                        checked={Boolean(layers?.regimes)}
                        disabled={activeView !== 'timeline'}
                        onCheckedChange={checked => onLayersChange?.(current => ({ ...current, regimes: checked }))}
                      >
                        Regime bands
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={Boolean(layers?.events)}
                        disabled={activeView !== 'timeline'}
                        onCheckedChange={checked => onLayersChange?.(current => ({ ...current, events: checked }))}
                      >
                        Macro events
                      </DropdownMenuCheckboxItem>
                      </>}
                      <DropdownMenuSeparator />
                      <p className="m-0 px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                        {isCountryModel ? 'Lower and upper target bounds remain separate. No midpoint is calculated.' : activeView === 'timeline'
                          ? 'Context is visible by default. Turn a layer off for a cleaner read.'
                          : 'Context layers are available on the Timeline view.'}
                      </p>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ExportBar className="workspace-export-actions" activeView={activeView} dateRange={dateRange} layers={layers} selectedDecisionId={activeDecisionId} cycleSelection={cycleSelection} recordFilters={recordFilters} timelineMode={timelineMode} rateChangeState={rateChangeState} breakdownState={breakdownState} countryModel={countryModel} />
                </div>
              </div>
            </div>
            <div className="mt-3 border-t border-border/60 pt-3">
              <AnalysisFilterRail recordFilters={recordFilters} onRecordFiltersChange={onRecordFiltersChange} timelineMode={timelineMode} onTimelineModeChange={onTimelineModeChange} actions={isCountryModel ? ['all', 'cut', 'hike', ...(countryModel.capabilities.holds ? ['hold'] : []), ...(countryModel.capabilities.framework ? ['framework'] : [])] : undefined} showEvidence={!isCountryModel} showTimelineMode={!isCountryModel} evidenceLabel={isCountryModel ? 'Evidence · published source rows' : null} holdLabel={isCountryModel ? 'Verified holds' : undefined} />
            </div>
          </div>

          {!isCountryModel ? <AnalysisStateStrip dateRange={dateRange} recordFilters={recordFilters} timelineMode={timelineMode} rateChangeState={rateChangeState} breakdownState={breakdownState} activeDecisionId={activeDecisionId} cycleSelection={cycleSelection} onReset={onResetAnalysis} /> : null}

          {/* Chart body */}
          <div className="workspace-body min-w-0 px-3.5 py-4 sm:px-6 sm:py-6">
            <div className="workspace-main min-w-0">
              {activeView === 'timeline' ? (isCountryModel
                ? <><CountryTimeline model={countryModel} dateRange={dateRange} recordFilters={recordFilters} showBand={layers?.range !== false} /><DecisionTimelineList countryModel={countryModel} activeDecisionId={activeDecisionId} dateRange={dateRange} recordFilters={recordFilters} onRecordFiltersChange={onRecordFiltersChange} onDecisionSelect={onDecisionSelect} /></>
                : <TimelineChart activeDecisionId={activeDecisionId} dateRange={dateRange} recordFilters={recordFilters} timelineMode={timelineMode} onDecisionSelect={onDecisionSelect} onRecordFiltersChange={onRecordFiltersChange} showEvents={layers?.events} showRegimes={layers?.regimes} />) : null}
              {activeView === 'breakdown' ? (isCountryModel ? <CountryYearBreakdown model={countryModel} dateRange={dateRange} recordFilters={recordFilters} /> : <RegimeBreakdown dateRange={dateRange} recordFilters={recordFilters} breakdownState={breakdownState} onBreakdownStateChange={onBreakdownStateChange} onDecisionSelect={onDecisionSelect} onViewChange={onViewChange} />) : null}
              {activeView === 'rate-change' ? (isCountryModel ? <CountryRateChanges model={countryModel} dateRange={dateRange} recordFilters={recordFilters} /> : <RateChangeBar dateRange={dateRange} recordFilters={recordFilters} rateChangeState={rateChangeState} onRateChangeStateChange={onRateChangeStateChange} onDecisionSelect={onDecisionSelect} />) : null}
              {activeView === 'cycles' ? (isCountryModel ? <CountryMoveRuns model={countryModel} dateRange={dateRange} recordFilters={recordFilters} /> : <CycleComparison cycleSelection={cycleSelection} onCycleSelectionChange={onCycleSelectionChange} recordFilters={recordFilters} onDecisionSelect={onDecisionSelect} onViewChange={onViewChange} />) : null}
              {activeView === 'compare' ? (isCountryModel ? <CountryWindowCompare model={countryModel} comparison={comparison} onComparisonChange={onComparisonChange} /> : <WindowComparison comparison={comparison} onComparisonChange={onComparisonChange} recordFilters={recordFilters} />) : null}
            </div>

            {activeView === 'timeline' && !isCountryModel && layers?.events ? (
              <>
                <Separator className="my-6" />
                <aside className="workspace-context" aria-labelledby="chart-context-title">
                  <div className="flex items-center justify-between">
                    <h3 className="m-0 text-sm font-semibold tracking-tight text-foreground" id="chart-context-title">Macro events</h3>
                    <span className="text-xs text-muted-foreground">{macroEvents.length} events</span>
                  </div>
                  <div className="mt-3">
                    <EventsList dateRange={dateRange} />
                  </div>
                </aside>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
