import FilterBar from '../components/FilterBar.jsx';
import ExportBar from '../components/ExportBar.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Icon from '../components/ui/icon.jsx';
import { Button } from '../components/ui/button.jsx';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../components/ui/drawer.jsx';
import { VIEWS } from '../components/viewConfig.js';

function LayerOption({ label, description, checked, disabled, onToggle }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className="mobile-layer-option flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      data-checked={checked}
      onClick={onToggle}
    >
      <span className="mobile-layer-option__indicator flex size-5 shrink-0 items-center justify-center rounded-md border border-border-strong text-transparent" aria-hidden="true">
        <Icon name="check" size={13} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

export default function MobileNav({ activeView, activePreset, dateRange, layers, onDateRangeChange, onLayersChange, onPresetChange, onViewChange }) {
  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button aria-label="Open navigation and tools" className="md:hidden" size="icon" variant="ghost">
          <Icon name="menu" size={19} />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[100dvh] w-[min(92vw,24rem)] max-w-none rounded-l-3xl border-l border-border bg-background shadow-xl">
        <DrawerHeader className="border-b border-border/70 p-5 text-left">
          <DrawerTitle className="text-base tracking-[-0.02em]">Repo Rate</DrawerTitle>
          <DrawerDescription>Navigate the policy chartbook and its tools.</DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="space-y-7">
            <section aria-labelledby="mobile-view-heading">
              <h2 id="mobile-view-heading" className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Views</h2>
              <div className="grid gap-1">
                {VIEWS.map(view => (
                  <DrawerClose asChild key={view.id}>
                    <Button className="h-auto min-h-10 justify-start rounded-md px-3 py-2.5 text-left" variant={activeView === view.id ? 'secondary' : 'ghost'} onClick={() => onViewChange?.(view.id)}>
                      <span className="flex flex-col items-start gap-0.5">
                        <span>{view.label}</span>
                        <span className="text-xs font-normal text-muted-foreground">{view.description}</span>
                      </span>
                    </Button>
                  </DrawerClose>
                ))}
              </div>
            </section>

            <section aria-labelledby="mobile-range-heading">
              <h2 id="mobile-range-heading" className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Range</h2>
              <FilterBar
                activePreset={activePreset}
                className="mobile-range-control"
                dateRange={dateRange}
                onDateRangeChange={onDateRangeChange}
                onPresetChange={onPresetChange}
              />
            </section>

            <section aria-labelledby="mobile-layers-heading">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 id="mobile-layers-heading" className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Layers</h2>
                <span className="text-xs tabular-nums text-muted-foreground">{activeView === 'timeline' ? `${[layers?.regimes, layers?.events].filter(Boolean).length} active` : 'Timeline only'}</span>
              </div>
              <div className="grid gap-1" role="group" aria-label="Chart context layers">
                <LayerOption
                  label="Regime bands"
                  description={activeView === 'timeline' ? 'Show easing, pause, and tightening periods.' : 'Available on the Timeline view.'}
                  checked={Boolean(layers?.regimes)}
                  disabled={activeView !== 'timeline'}
                  onToggle={() => onLayersChange?.(current => ({ ...current, regimes: !current.regimes }))}
                />
                <LayerOption
                  label="Macro events"
                  description={activeView === 'timeline' ? 'Show source-linked policy context.' : 'Available on the Timeline view.'}
                  checked={Boolean(layers?.events)}
                  disabled={activeView !== 'timeline'}
                  onToggle={() => onLayersChange?.(current => ({ ...current, events: !current.events }))}
                />
              </div>
              {activeView !== 'timeline' ? <p className="mt-2 text-xs leading-5 text-muted-foreground">Switch to Timeline to change the context layers.</p> : null}
            </section>

            <section aria-labelledby="mobile-actions-heading" className="space-y-3">
              <h2 id="mobile-actions-heading" className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Actions</h2>
              <div className="flex min-h-11 items-center justify-between border-y border-border/70 py-2">
                <span className="text-sm text-foreground">Theme</span>
                <ThemeToggle />
              </div>
              <ExportBar activeView={activeView} dateRange={dateRange} />
            </section>
          </div>
        </div>

        <DrawerFooter className="border-t border-border/70 p-5">
          <DrawerClose asChild>
            <Button className="w-full rounded-md" variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
