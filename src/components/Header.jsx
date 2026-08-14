import { useEffect, useMemo, useState } from 'react';
import { Command, Search } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import CommandDialog from './ui/command-dialog.jsx';
import { Button } from './ui/button.jsx';
import MobileNav from '../mobile/MobileNav.jsx';
import { VIEWS } from './viewConfig.js';

export default function Header({ activeView = 'timeline', onViewChange, dateRange, activePreset, onDateRangeChange, onPresetChange, layers, onLayersChange }) {
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handleShortcut = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      } else if (event.key === '/' && !isTyping) {
        event.preventDefault();
        setCommandOpen(true);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const commands = useMemo(() => [
    ...VIEWS.map(view => ({
      id: `view-${view.id}`,
      group: 'Navigate',
      label: view.label,
      shortcut: view.id === activeView ? 'current' : undefined,
      execute: () => onViewChange?.(view.id),
    })),
    {
      id: 'focus-timeline',
      group: 'Navigate',
      label: 'Jump to policy workspace',
      execute: () => document.querySelector('.chart-workspace')?.scrollIntoView({ behavior: 'auto', block: 'start' }),
    },
  ], [activeView, onViewChange]);

  return (
    <header className="site-header sticky top-0 z-30 -mx-4 border-b border-border/80 bg-background sm:-mx-6 lg:-mx-8">
      <div className="mx-auto flex min-h-16 w-full max-w-[1180px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Button asChild className="brand-link h-10 gap-2 px-1.5 hover:bg-transparent" variant="ghost">
          <a href="/" aria-label="RBI Repo Rate home">
            <span className="brand-mark flex size-7 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold tracking-[0.08em] text-background">RBI</span>
            <span className="hidden text-muted-foreground sm:inline" aria-hidden="true">/</span>
            <span className="truncate font-semibold tracking-[-0.02em]">Repo Rate</span>
          </a>
        </Button>

        <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
          <span className="size-1.5 rounded-full bg-cut" aria-hidden="true" />
          <span>Source-backed policy reference</span>
        </div>

        <div className="site-header__actions ml-auto flex shrink-0 items-center gap-1.5">
          <Button aria-label="Open command menu" className="hidden gap-2 text-muted-foreground sm:inline-flex" size="sm" variant="outline" onClick={() => setCommandOpen(true)}>
            <Search className="size-4" aria-hidden="true" />
            <span>Search</span>
            <kbd className="ml-1 inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              <Command className="size-3" aria-hidden="true" />K
            </kbd>
          </Button>
          <MobileNav
            activeView={activeView}
            activePreset={activePreset}
            dateRange={dateRange}
            layers={layers}
            onDateRangeChange={onDateRangeChange}
            onLayersChange={onLayersChange}
            onPresetChange={onPresetChange}
            onViewChange={onViewChange}
          />
          <ThemeToggle />
        </div>
      </div>
      <CommandDialog commands={commands} open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  );
}
