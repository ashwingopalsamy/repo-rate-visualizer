import { Check, Menu } from 'lucide-react';
import FilterBar from '../components/FilterBar.jsx';
import ExportBar from '../components/ExportBar.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
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
    <Button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className="mobile-layer-option h-auto min-h-11 w-full justify-start gap-3 whitespace-normal px-3 py-2.5 text-left"
      variant="ghost"
      data-checked={checked}
      onClick={onToggle}
    >
      <span className="mobile-layer-option__indicator flex size-5 shrink-0 items-center justify-center rounded-md border border-border-strong text-transparent" aria-hidden="true">
        <Check className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs font-normal leading-5 text-muted-foreground">{description}</span>
      </span>
    </Button>
  );
}

export default function MobileNav({ activeView, activePreset, dateRange, layers, onDateRangeChange, onLayersChange, onPresetChange, onViewChange }) {
  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button aria-label="Open navigation and tools" className="md:hidden size-9 rounded-xl border border-border/80 bg-card hover:bg-muted/80 shadow-2xs text-foreground" size="icon" variant="outline">
          <Menu className="size-4" aria-hidden="true" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[100dvh] w-[min(92vw,25rem)] max-w-none rounded-l-2xl border-l border-border bg-background shadow-2xl flex flex-col">
        <DrawerHeader className="border-b border-border/80 px-4 py-3.5 sm:px-5 sm:py-4 text-left shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="text-base font-bold tracking-tight">Repo Rate Explorer</DrawerTitle>
              <DrawerDescription className="text-xs text-muted-foreground mt-0.5">Policy chartbook navigation and analytical tools.</DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-6">
          <section aria-labelledby="mobile-view-heading">
            <h2 id="mobile-view-heading" className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Views</h2>
            <div className="grid gap-1.5">
              {VIEWS.map(view => {
                const isActive = activeView === view.id;
                return (
                  <DrawerClose asChild key={view.id}>
                    <Button
                      className={`h-auto min-h-12 w-full justify-start rounded-xl px-3.5 py-2.5 text-left transition-all ${
                        isActive
                          ? 'bg-accent text-accent-foreground font-semibold shadow-2xs border border-border-strong/70'
                          : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                      }`}
                      variant="ghost"
                      onClick={() => onViewChange?.(view.id)}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="flex flex-col items-start gap-0.5">
                          <span className={`text-sm ${isActive ? 'font-bold text-foreground' : 'font-medium text-foreground/90'}`}>{view.label}</span>
                          <span className="text-xs font-normal text-muted-foreground">{view.description}</span>
                        </span>
                        {isActive ? (
                          <span className="size-2 rounded-full bg-foreground shrink-0" aria-hidden="true" />
                        ) : null}
                      </div>
                    </Button>
                  </DrawerClose>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="mobile-range-heading">
            <h2 id="mobile-range-heading" className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Range</h2>
            <FilterBar
              activePreset={activePreset}
              className="mobile-range-control"
              dateRange={dateRange}
              onDateRangeChange={onDateRangeChange}
              onPresetChange={onPresetChange}
            />
          </section>

          <section aria-labelledby="mobile-layers-heading">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 id="mobile-layers-heading" className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Layers</h2>
              <span className="text-xs tabular-nums text-muted-foreground">{activeView === 'timeline' ? `${[layers?.regimes, layers?.events].filter(Boolean).length} active` : 'Timeline only'}</span>
            </div>
            <div className="grid gap-1.5" role="group" aria-label="Chart context layers">
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
            {activeView !== 'timeline' ? <p className="mt-2 mb-0 text-xs leading-5 text-muted-foreground">Switch to Timeline to change the context layers.</p> : null}
          </section>

          <section aria-labelledby="mobile-actions-heading" className="space-y-3">
            <h2 id="mobile-actions-heading" className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Actions &amp; Tools</h2>
            <div className="flex min-h-11 items-center justify-between rounded-xl border border-border/80 bg-card/60 px-3.5 py-2">
              <span className="text-sm font-medium text-foreground">Theme</span>
              <ThemeToggle />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild className="w-full justify-center rounded-xl px-3 py-2 text-center border border-border/80 bg-card/60 hover:bg-muted/80 text-foreground text-xs" variant="ghost">
                <a href="/design">
                  <span className="font-medium">Design System</span>
                </a>
              </Button>
              <Button asChild className="w-full justify-center rounded-xl px-3 py-2 text-center border border-border/80 bg-card/60 hover:bg-muted/80 text-foreground text-xs" variant="ghost">
                <a href="/colophon">
                  <span className="font-medium">Colophon</span>
                </a>
              </Button>
            </div>
            <div className="rounded-xl border border-border/80 bg-card/60 p-3">
              <span className="text-xs font-semibold text-muted-foreground mb-2 block">Share &amp; Export</span>
              <ExportBar activeView={activeView} dateRange={dateRange} />
            </div>
          </section>
        </div>

        <DrawerFooter className="border-t border-border/80 p-4 sm:p-5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <DrawerClose asChild>
            <Button className="w-full h-10 rounded-xl" variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
