import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import CommandDialog from './ui/command-dialog.jsx';
import { Button } from './ui/button.jsx';
import MobileNav from '../mobile/MobileNav.jsx';
import { VIEWS } from './viewConfig.js';

export default function Header({ activeView = 'timeline', onViewChange, dateRange, activePreset, onDateRangeChange, onPresetChange, layers, onLayersChange }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 12;
      setIsScrolled(prev => (prev !== scrolled ? scrolled : prev));
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    <header
      className="site-header pointer-events-none sticky top-0 z-40 w-full pt-3 sm:pt-4 pb-1 transition-all duration-200"
      data-scrolled={isScrolled}
    >
      <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div
          className={`site-header__navbar pointer-events-auto flex w-full items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-2 sm:py-2.5 transition-all duration-200 ${
            isScrolled ? 'site-header__navbar--scrolled' : ''
          }`}
        >
          <Button asChild className="brand-link group h-9 min-w-0 gap-2.5 px-2 hover:bg-muted/60 rounded-lg" variant="ghost">
            <a href="/" aria-label="RBI Repo Rate home" className="flex items-center gap-2.5">
              <span className="brand-mark flex size-8 shrink-0 items-center justify-center rounded-md border border-black bg-black font-bold text-xs tracking-tight text-white shadow-2xs transition-transform group-hover:scale-105 dark:border-white dark:bg-white dark:text-black">RBI</span>
              <span className="truncate font-semibold tracking-tight text-foreground text-xs sm:hidden">Repo Rate</span>
              <span className="hidden truncate font-semibold tracking-tight text-foreground text-sm sm:inline">India's Federal Repo Rate Data</span>
            </a>
          </Button>

          <div className="site-header__actions flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              aria-label="Open command menu"
              className="header-control hidden h-9 items-center gap-2 rounded-lg border border-border/80 bg-card hover:bg-muted/80 px-3 text-xs text-muted-foreground shadow-2xs hover:text-foreground transition-colors sm:inline-flex"
              size="sm"
              variant="ghost"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="size-3.5" aria-hidden="true" />
              <span>Search</span>
              <kbd className="pointer-events-none ml-0.5 inline-flex items-center rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground/80">
                ⌘K
              </kbd>
            </Button>
            <Button
              aria-label="Search policy records"
              className="size-9 rounded-lg border border-border/80 bg-card hover:bg-muted/80 shadow-2xs text-foreground sm:hidden"
              size="icon"
              variant="ghost"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="size-4" aria-hidden="true" />
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
      </div>
      <CommandDialog commands={commands} open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  );
}
