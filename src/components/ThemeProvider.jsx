import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const ThemeContext = createContext(null);

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => {
      if (!localStorage.getItem('theme')) {
        const next = e.matches ? 'light' : 'dark';
        themeRef.current = next;
        setThemeState(next);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = themeRef.current === 'dark' ? 'light' : 'dark';
    themeRef.current = nextTheme;

    const applyTheme = () => {
      document.documentElement.setAttribute('data-theme', nextTheme);
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      localStorage.setItem('theme', nextTheme);
      setThemeState(nextTheme);
    };

    const isReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isReducedMotion || typeof document === 'undefined' || !document.startViewTransition) {
      applyTheme();
      return;
    }

    try {
      document.startViewTransition(applyTheme);
    } catch {
      applyTheme();
    }
  }, []);

  const setTheme = useCallback((t) => {
    themeRef.current = t;
    setThemeState(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}


