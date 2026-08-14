import { useMemo, useState } from 'react';
import { Layers3 } from 'lucide-react';
import { decisions, macroEvents } from '../data/dataLoader.js';
import FilterBar from './FilterBar.jsx';
import ExportBar from './ExportBar.jsx';
import TimelineChart from './TimelineChart.jsx';
import RateChangeBar from './RateChangeBar.jsx';
import CycleComparison from './CycleComparison.jsx';
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

const VIEW_COPY = {
  timeline: {
    label: 'Timeline',
    description: 'The effective repo rate, every source-backed MPC decision, and optional policy context.',
  },
  'rate-change': {
    label: 'Rate changes',
    description: 'Basis-point moves derived from the canonical decision series.',
  },
  cycles: {
    label: 'Cycles',
    description: 'A normalized comparison of easing and tightening periods.',
  },
};

export default function ChartWorkspace({ activeView, activeDecisionId, dateRange, onDateRangeChange, activePreset, onPresetChange, layers, onLayersChange, onDecisionSelect, onViewChange }) {
  const copy = VIEW_COPY[activeView] || VIEW_COPY.timeline;
  const [layersOpen, setLayersOpen] = useState(false);
  const activeLayerCount = useMemo(() => [layers?.regimes, layers?.events].filter(Boolean).length, [layers]);
  const selectedDecisionCount = useMemo(() => decisions.filter(decision => {
    if (dateRange.start && decision.date < dateRange.start) return false;
    if (dateRange.end && decision.date > dateRange.end) return false;
    return true;
  }).length, [dateRange.end, dateRange.start]);

  return (
    <section className="chart-workspace scroll-mt-24" aria-labelledby="chart-workspace-title">
      <Card className="workspace-card overflow-hidden rounded-2xl border-border/80 bg-card shadow-none">
        <CardHeader className="gap-3 border-b border-border/80 px-5 py-5 sm:px-7 sm:py-6">
          <div className="min-w-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Policy workspace</p>
            <CardTitle id="chart-workspace-title" className="text-2xl tracking-[-0.055em] sm:text-3xl">{copy.label}</CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-sm leading-6">{copy.description}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="workspace-controls border-b border-border/80 px-4 py-3 sm:px-6">
            <div className="workspace-control-rail">
              <div className="workspace-controls__grid">
                <div className="workspace-control-group" data-control-group="view">
                  <span className="workspace-control-label text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">View</span>
                  <Tabs className="min-w-0" value={activeView} onValueChange={onViewChange}>
                    <TabsList variant="line" aria-label="Analytical views" className="workspace-view-switcher__list max-w-full overflow-x-auto">
                      {VIEWS.map(view => (
                        <TabsTrigger className="workspace-view-switcher__trigger min-h-8 px-3 text-xs" key={view.id} value={view.id}>
                          {view.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                <FilterBar
                  className="workspace-control-group workspace-control-group--range"
                  activePreset={activePreset}
                  dateRange={dateRange}
                  onDateRangeChange={onDateRangeChange}
                  onPresetChange={onPresetChange}
                />

                <div className="workspace-actions flex min-w-0 items-center gap-1.5" aria-label="Chart actions">
                  <DropdownMenu open={layersOpen} onOpenChange={setLayersOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="h-9 px-3"
                        size="sm"
                        variant={layersOpen ? 'secondary' : 'outline'}
                        aria-expanded={layersOpen}
                        aria-label={`Layers, ${activeLayerCount} active`}
                        data-layer-control
                      >
                        <Layers3 className="size-4" aria-hidden="true" />
                        <span>Layers</span>
                        <span className="font-mono text-xs text-muted-foreground">{activeLayerCount}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="w-60">
                      <DropdownMenuLabel>Chart context</DropdownMenuLabel>
                      <DropdownMenuSeparator />
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
                      <DropdownMenuSeparator />
                      <p className="m-0 px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                        {activeView === 'timeline'
                          ? 'Context is visible by default. Turn a layer off for a cleaner read.'
                          : 'Context layers are available on the Timeline view.'}
                      </p>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <ExportBar className="workspace-export-actions" activeView={activeView} dateRange={dateRange} />
                </div>
              </div>
            </div>
          </div>

          <div className="workspace-body min-w-0 px-4 py-6 sm:px-7 sm:py-8">
            <div className="workspace-main min-w-0">
              {activeView === 'timeline' ? <TimelineChart activeDecisionId={activeDecisionId} dateRange={dateRange} onDecisionSelect={onDecisionSelect} showEvents={layers?.events} showRegimes={layers?.regimes} /> : null}
              {activeView === 'rate-change' ? <RateChangeBar dateRange={dateRange} /> : null}
              {activeView === 'cycles' ? <CycleComparison /> : null}
            </div>

            {activeView === 'timeline' && layers?.events ? (
              <>
                <Separator className="my-8" />
                <aside className="workspace-context" aria-labelledby="chart-context-title">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground" id="chart-context-title">Context</p>
                      <h3 className="m-0 text-sm font-semibold tracking-[-0.02em] text-foreground">Macro events</h3>
                    </div>
                    <div className="flex max-w-full flex-wrap justify-end gap-x-3 gap-y-1 text-right text-xs text-muted-foreground">
                      <span>{macroEvents.length} source-linked events</span>
                      <span aria-hidden="true">·</span>
                      <span><strong className="font-medium text-foreground">{selectedDecisionCount} in range</strong> · <strong className="font-medium text-foreground">{decisions.length} decisions</strong> · 5 Jun 2000 – 5 Aug 2026</span>
                    </div>
                  </div>
                  <div className="mt-4">
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
