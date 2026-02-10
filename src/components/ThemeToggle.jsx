import { useTheme } from './ThemeProvider.jsx';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.jsx';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="theme-toggle relative size-9 rounded-lg border border-border/80 bg-card hover:bg-muted/80 shadow-2xs text-foreground overflow-hidden"
          aria-label={`Switch to ${nextTheme} mode`}
          size="icon"
          variant="outline"
          onClick={toggleTheme}
        >
          <span className="relative flex size-4 items-center justify-center pointer-events-none" aria-hidden="true">
            <Sun
              className={`size-4 absolute transition-all duration-200 ease-in-out ${
                theme === 'dark'
                  ? 'scale-100 opacity-100 rotate-0'
                  : 'scale-75 opacity-0 rotate-45'
              }`}
            />
            <Moon
              className={`size-4 absolute transition-all duration-200 ease-in-out ${
                theme === 'dark'
                  ? 'scale-75 opacity-0 -rotate-45'
                  : 'scale-100 opacity-100 rotate-0'
              }`}
            />
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Switch to {nextTheme} mode</TooltipContent>
    </Tooltip>
  );
}
