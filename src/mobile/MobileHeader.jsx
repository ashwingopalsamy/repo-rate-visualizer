import { useState } from 'react';
import { useTheme } from '../components/ThemeProvider.jsx';

export default function MobileHeader() {
  const { theme, toggleTheme } = useTheme();
  const [pressedAction, setPressedAction] = useState(null);

  const handlePress = (action, callback) => {
    setPressedAction(action);
    requestAnimationFrame(() => {
      setTimeout(() => {
        callback();
        setPressedAction(null);
      }, 150); // Tactile delay matching footer
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'RBI Repo Rate Visualizer',
        text: 'Check out the historical timeline of India\'s Repo Rate.',
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href)
        .then(() => alert('Link copied to clipboard!'))
        .catch(console.error);
    }
  };

  return (
    <header className="mobile-header">
      <div className="mobile-header__content">
        <h1 className="mobile-header__title">Repo Rate Visualizer</h1>

        <div className="mobile-header__actions">
          {/* Share Button */}
          <button
            className={`mobile-header__action ${pressedAction === 'share' ? 'mobile-header__action--pressed' : ''}`}
            onClick={() => handlePress('share', handleShare)}
            aria-label="Share"
          >
            <div className="mobile-header__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </div>
          </button>

          {/* Theme Toggle */}
          <button
            className={`mobile-header__action ${pressedAction === 'theme' ? 'mobile-header__action--pressed' : ''}`}
            onClick={() => handlePress('theme', toggleTheme)}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <div className="mobile-header__icon">
              <svg
                className={`mobile-header__sun ${theme === 'dark' ? 'mobile-header__icon--hidden' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <svg
                className={`mobile-header__moon ${theme === 'dark' ? '' : 'mobile-header__icon--hidden'}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
