import { currentRate, currentRegime, snapshotMeta } from '../data/dataLoader.js';

const formattedDate = new Date(currentRate.date).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

// Renamed and adjusted for clarity based on new structure
const lastAction = {
  delta: currentRate.changeBps,
  date: new Date(snapshotMeta.fetchedAt).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }),
};

const getDeltaClass = (delta) => {
  if (delta < 0) {
    return 'hero-card__delta--cut';
  } else if (delta > 0) {
    return 'hero-card__delta--hike';
  } else {
    return 'hero-card__delta--unchanged';
  }
};

export default function HeroCard() {
  return (
    <section className="hero-card" aria-label="Current RBI Repo Rate">
      {/* Last MPC Action - Left Aligned -> Now Centered as requested */}
      <div className="hero-card__section hero-card__section--center">
        <span className="hero-card__label">Last MPC Action</span>
        <span className={`hero-card__delta ${getDeltaClass(lastAction.delta)}`}>
          {lastAction.delta > 0 ? '+' : ''}{lastAction.delta} bps
        </span>
        <div className={`hero-card__regime-pill hero-card__regime-pill--${currentRegime?.type || 'pause'}`}>
          <span className="hero-card__regime-dot"></span>
          {currentRegime?.label || 'Unknown'}
        </div>
      </div>

      <div className="hero-card__divider" />

      {/* Current Rate - Center Aligned */}
      <div className="hero-card__section hero-card__section--center">
        <span className="hero-card__label">Current Repo Rate</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
          <span className="hero-card__rate">{currentRate.rate.toFixed(2)}%</span>
          <span className="live-indicator">
            <span className="live-indicator__dot"></span>
          </span>
        </div>
        <span className="hero-card__date">Effective since {formattedDate}</span>
      </div>

      <div className="hero-card__divider" />

      {/* Meta / Source - Right Aligned */}
      <div className="hero-card__section hero-card__section--end">
        <span className="hero-card__label">Data Source</span>
        <a 
          href="https://www.rbi.org.in" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hero-card__source-link"
        >
          RBI Monetary Policy <span style={{ fontSize: '10px' }}>↗</span>
        </a>
        <span className="hero-card__meta">Updated: {lastAction.date}</span>
        <span className="hero-card__meta">Snapshot: {new Date().toISOString().split('T')[0]}</span>
      </div>
    </section>
  );
}
