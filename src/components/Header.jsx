import { useEffect, useMemo, useState } from 'react';
import ThemeToggle from './ThemeToggle.jsx';
import CommandDialog from './ui/command-dialog.jsx';
import Icon from './ui/icon.jsx';
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
    <header className="site-header sticky top-0 z-30 -mx-5 border-b border-border/70 bg-background sm:-mx-8 lg:-mx-10">
      <div className="mx-auto flex min-h-16 w-full max-w-[1120px] items-center gap-4 px-5 sm:px-8 lg:px-10">
        <a className="flex min-w-0 shrink-0 items-center gap-2 text-sm font-semibold tracking-[-0.02em] text-foreground" href="/" aria-label="RBI Repo Rate home">
          <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold tracking-[0.08em] text-background">RBI</span>
          <span className="hidden text-muted-foreground sm:inline" aria-hidden="true">/</span>
          <span className="truncate">Repo Rate</span>
        </a>

        <div className="site-header__actions ml-auto flex shrink-0 items-center gap-1.5">
          <Button aria-label="Open command menu" className="hidden h-9 gap-2 rounded-md px-3 text-muted-foreground hover:text-foreground sm:inline-flex" variant="ghost" onClick={() => setCommandOpen(true)}>
            <Icon name="search" size={15} />
            <span>Search</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
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
