import { useState } from 'react';
import { repoRateData, macroEvents, regimes } from '../data/dataLoader.js';

// Icons
const ShareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
);

export default function ExportBar({ dateRange, activeView }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadCSV = () => {
    // Filter data based on range
    let data = repoRateData;
    if (dateRange.start) {
      data = data.filter(d => d.dateObj >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      data = data.filter(d => d.dateObj <= new Date(dateRange.end));
    }

    const headers = ['Date', 'Rate (%)', 'Change (bps)', 'Event', 'Regime'];
    const rows = data.map(d => {
      const event = macroEvents.find(e => e.date === d.date)?.label || '';
      const regime = regimes.find(r => d.dateObj >= r.startObj && d.dateObj <= r.endObj)?.label || '';
      return [
        d.date,
        d.rate,
        d.changeBps,
        `"${event}"`, // quote to handle commas
        regime
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rbi_repo_rate_${dateRange.start}_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSVG = () => {
    const svgEl = document.querySelector('.chart-svg');
    if (!svgEl) return;

    // Clone to add styles inline or ensure background
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.style.background = 'white'; // Ensure white bg for export

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clone);

    // Add XML declaration
    if (!source.match(/^<\?xml/)) {
      source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    }

    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rbi_repo_rate_chart_${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="filter-bar" aria-label="Share and Export toolbar" style={{ gap: 'var(--space-2)' }}>
      {/* Share Section */}
      <div className="filter-bar__group">
        <span className="filter-bar__icon" aria-hidden="true">
          <ShareIcon />
        </span>
        <button 
          className={`filter-bar__range-btn ${copied ? 'filter-bar__range-btn--active' : ''}`}
          onClick={handleCopyLink}
          aria-label="Copy link with current filters"
        >
          {copied ? 'Copied' : 'Link'}
        </button>
      </div>

      <div className="filter-bar__separator" role="presentation" />

      {/* Export Section */}
      <div className="filter-bar__group">
        <span className="filter-bar__icon" aria-hidden="true">
          <DownloadIcon />
        </span>
        <button className="filter-bar__range-btn" onClick={downloadCSV}>CSV</button>
        {activeView === 'timeline' && (
          <button className="filter-bar__range-btn" onClick={downloadSVG}>SVG</button>
        )}
      </div>
    </div>
  );
}
