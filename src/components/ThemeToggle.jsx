import { useTheme } from './ThemeProvider.jsx';
import Icon from './ui/icon.jsx';
import { Button } from './ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.jsx';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="theme-toggle"
          aria-label={`Switch to ${nextTheme} mode`}
          size="icon"
          variant="outline"
          onClick={toggleTheme}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Switch to {nextTheme} mode</TooltipContent>
    </Tooltip>
  );
}
