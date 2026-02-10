import { useState, useMemo } from 'react';
import { useTheme } from '../components/ThemeProvider.jsx';
import { repoRateData, regimes, snapshotMeta } from '../data/dataLoader.js';

const cycles = regimes.filter(r => r.type !== 'pause').map(r => {
  const rateData = repoRateData.filter(d => d.dateObj >= r.startObj && d.dateObj <= r.endObj);
  const totalBps = rateData.length > 1
    ? Math.round((rateData.at(-1).rate - rateData[0].rate) * 100)
    : 0;
  const durationMonths = Math.round((r.endObj - r.startObj) / (1000 * 60 * 60 * 24 * 30.44));
  return {
    ...r,
    rateData,
    totalBps,
    durationMonths,
    avgBpsPerMonth: durationMonths > 0 ? (totalBps / durationMonths).toFixed(1) : 0,
  };
});

export default function MobileMore() {
  const { theme, toggleTheme } = useTheme();
  const [activeCycle, setActiveCycle] = useState(cycles.length - 1);

  const selected = cycles[activeCycle];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('Link copied!');
    });
  };

  const handleDownloadCSV = () => {
    const header = 'Date,Rate,Change (bps),Source\n';
    const rows = repoRateData.map(d =>
      `${d.date},${d.rate},${d.changeBps},"${d.source || 'RBI'}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rbi-repo-rate.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mobile-more">
      <div className="mobile-status-header">
        <div>
          <div className="mobile-status-header__title">More</div>
          <div className="mobile-status-header__subtitle">Settings & Tools</div>
        </div>
      </div>

      {/* Appearance */}
      <div className="mobile-more__section">
        <div className="mobile-more__section-title">Appearance</div>
        <div className="mobile-theme-toggle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
            {theme === 'dark' ? (
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            ) : (
              <>
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </>
            )}
          </svg>
          <span className="mobile-theme-toggle__label">
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <button
            className={`mobile-theme-toggle__switch ${theme === 'dark' ? 'mobile-theme-toggle__switch--dark' : ''}`}
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className="mobile-theme-toggle__knob">
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                </svg>
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Cycle Comparison */}
      <div className="mobile-more__section">
        <div className="mobile-more__section-title">Cycle Comparison</div>
        <div className="mobile-cycles">
          <div className="mobile-cycles__chips">
            {cycles.map((c, i) => (
              <button
                key={i}
                className={`mobile-chip ${activeCycle === i ? 'mobile-chip--active' : ''}`}
                onClick={() => setActiveCycle(i)}
              >
                {c.label.length > 20 ? c.label.slice(0, 18) + '…' : c.label}
              </button>
            ))}
          </div>

          {selected && (
            <div className="mobile-cycles__stat-card">
              <span className="mobile-cycles__stat-label">{selected.label}</span>
              <span className="mobile-cycles__stat-value" style={{ color: selected.type === 'easing' ? 'var(--color-cut)' : 'var(--color-hike)' }}>
                {selected.totalBps > 0 ? '+' : ''}{selected.totalBps} bps
              </span>
              <span className="mobile-cycles__stat-meta">
                {selected.startDate.slice(0, 4)}–{selected.endDate.slice(0, 4)} · {selected.durationMonths}mo · {selected.avgBpsPerMonth} bps/mo
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Share & Export */}
      <div className="mobile-more__section">
        <div className="mobile-more__section-title">Share & Export</div>
        <button className="mobile-more__row" onClick={handleCopyLink}>
          <svg className="mobile-more__row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span className="mobile-more__row-label">Copy Permalink</span>
        </button>
        <button className="mobile-more__row" onClick={handleDownloadCSV}>
          <svg className="mobile-more__row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="mobile-more__row-label">Download CSV</span>
        </button>
      </div>

      {/* Data Source */}
      <div className="mobile-more__section">
        <div className="mobile-more__section-title">Data Source</div>
        <a
          className="mobile-more__row"
          href="https://www.rbi.org.in"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg className="mobile-more__row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span className="mobile-more__row-label">RBI Monetary Policy</span>
          <svg className="mobile-more__row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </a>
        <div style={{ padding: '8px 16px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            Snapshot: {snapshotMeta.id} · Fetched: {new Date(snapshotMeta.fetchedAt).toLocaleDateString('en-IN')}
          </span>
        </div>
      </div>
    </div>
  );
}
