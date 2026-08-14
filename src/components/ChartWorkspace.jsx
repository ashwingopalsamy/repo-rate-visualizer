import { useMemo, useState } from 'react';
import FilterBar from './FilterBar.jsx';
import ExportBar from './ExportBar.jsx';
import TimelineChart from './TimelineChart.jsx';
import RateChangeBar from './RateChangeBar.jsx';
import CycleComparison from './CycleComparison.jsx';
import EventsList from './EventsList.jsx';
import Icon from './ui/icon.jsx';
import { Button } from './ui/button.jsx';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs.jsx';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.jsx';
import { VIEWS } from './viewConfig.js';

const VIEW_COPY = {
  timeline: {
    label: 'Timeline',
    description: 'Effective repo rates and every source-backed MPC decision in the selected range.',
  },
  'rate-change': {
    label: 'Rate changes',
    description: 'Basis-point moves derived from the canonical decision series.',
  },
  cycles: {
    label: 'Cycles',
    description: 'Easing and tightening periods derived from official policy decisions.',
  },
};

export default function ChartWorkspace({ activeView, activeDecisionId, dateRange, onDateRangeChange, activePreset, onPresetChange, layers, onLayersChange, onDecisionSelect, onViewChange }) {
  const copy = VIEW_COPY[activeView] || VIEW_COPY.timeline;
  const [layersOpen, setLayersOpen] = useState(false);
  const activeLayerCount = useMemo(() => [layers?.regimes, layers?.events].filter(Boolean).length, [layers]);

  return (
    <section className="chart-workspace scroll-mt-24" aria-labelledby="chart-workspace-title">
      <header className="workspace-header flex flex-col gap-4 py-6 sm:py-7">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Policy workspace</p>
          <h2 id="chart-workspace-title" className="m-0 text-2xl font-semibold tracking-[-0.045em] text-foreground sm:text-3xl">Repo rate explorer</h2>
          <p className="mt-2 mb-0 max-w-2xl text-sm leading-6 text-muted-foreground">{copy.description}</p>
        </div>
      </header>

      <div className="workspace-controls">
        <div className="workspace-control-rail">
          <div className="workspace-controls__grid">
          <div className="workspace-control-group" data-control-group="view">
            <span className="workspace-control-label shrink-0 text-xs font-medium text-muted-foreground">View</span>
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
                  className="h-9 rounded-md px-3"
                  size="sm"
                  variant={layersOpen || activeLayerCount > 0 ? 'secondary' : 'ghost'}
                  aria-expanded={layersOpen}
                  aria-label={`Layers, ${activeLayerCount} active`}
                  data-layer-control
                >
                  <Icon name="layers" size={14} />
                  <span>Layers</span>
                  <span className="tabular-nums text-xs text-muted-foreground">{activeLayerCount}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="w-56 rounded-xl">
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
                <div className="px-2 py-1.5 text-xs leading-5 text-muted-foreground">
                  {activeView === 'timeline'
                    ? 'Context is shown by default. Turn either layer off when you need a cleaner read.'
                    : 'Context layers are available on the Timeline view.'}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <ExportBar className="workspace-export-actions" activeView={activeView} dateRange={dateRange} />
          </div>
          </div>
        </div>
      </div>

      <div className="workspace-body min-w-0 py-5 sm:py-6">
        <div className="workspace-main min-w-0">
          {activeView === 'timeline' ? <TimelineChart activeDecisionId={activeDecisionId} dateRange={dateRange} onDecisionSelect={onDecisionSelect} showEvents={layers?.events} showRegimes={layers?.regimes} /> : null}
          {activeView === 'rate-change' ? <RateChangeBar dateRange={dateRange} /> : null}
          {activeView === 'cycles' ? <CycleComparison /> : null}
        </div>

        {activeView === 'timeline' && layers?.events ? (
          <aside className="workspace-context mt-7 border-t border-border/70 pt-5" aria-labelledby="chart-context-title">
            <div className="max-w-[820px]">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground" id="chart-context-title">Context</p>
                <span className="text-sm font-medium text-foreground">Macro events</span>
              </div>
              <span className="mt-1 block text-xs text-muted-foreground">Source-linked context</span>
            </div>
            <div className="mt-3">
              <EventsList dateRange={dateRange} />
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
