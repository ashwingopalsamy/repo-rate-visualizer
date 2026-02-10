import { currentRate, currentRegime, snapshotMeta } from '../data/dataLoader.js';

const formattedDate = new Date(currentRate.date).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const lastActionDate = new Date(snapshotMeta.fetchedAt).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const getDeltaClass = (delta) => {
  if (delta < 0) return 'mobile-overview__delta--cut';
  if (delta > 0) return 'mobile-overview__delta--hike';
  return 'mobile-overview__delta--unchanged';
};

export default function MobileOverview() {
  return (
    <div className="mobile-overview">
      {/* Rate Block */}
      <div className="mobile-overview__rate-block">
        <span className="mobile-overview__label">Current Repo Rate</span>
        <div className="mobile-overview__rate-row">
          <span className="mobile-overview__rate">{currentRate.rate.toFixed(2)}%</span>
          <span className="live-indicator">
            <span className="live-indicator__dot" />
          </span>
        </div>
        <span className="mobile-overview__date">Effective since {formattedDate}</span>
      </div>

      <div className="mobile-overview__divider" />

      {/* Delta Block */}
      <div className="mobile-overview__delta-block">
        <span className="mobile-overview__label">Last MPC Action</span>
        <span className={`mobile-overview__delta ${getDeltaClass(currentRate.changeBps)}`}>
          {currentRate.changeBps > 0 ? '+' : ''}{currentRate.changeBps} bps
        </span>
        <div className={`mobile-overview__regime-pill mobile-overview__regime-pill--${currentRegime?.type || 'pause'}`}>
          <span className="mobile-overview__regime-dot" />
          {currentRegime?.label || 'Unknown'}
        </div>
      </div>

      <div className="mobile-overview__divider" />

      {/* Source */}
      <div className="mobile-overview__source">
        <a
          href="https://www.rbi.org.in"
          target="_blank"
          rel="noopener noreferrer"
          className="mobile-overview__source-link"
        >
          RBI Monetary Policy <span style={{ fontSize: '10px' }}>↗</span>
        </a>
        <span className="mobile-overview__meta">Updated: {lastActionDate}</span>
      </div>
    </div>
  );
}
