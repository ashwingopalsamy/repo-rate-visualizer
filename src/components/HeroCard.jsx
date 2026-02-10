import { currentRate, currentRegime, snapshotMeta } from '../data/dataLoader.js';

const formattedDate = new Date(currentRate.date).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const deltaClass = currentRate.changeBps < 0
  ? 'hero-card__delta--cut'
  : currentRate.changeBps > 0
    ? 'hero-card__delta--hike'
    : 'hero-card__delta--unchanged';

const deltaText = currentRate.changeBps > 0
  ? `+${currentRate.changeBps}`
  : `${currentRate.changeBps}`;

const regimeType = currentRegime?.type || 'pause';
const regimeLabel = currentRegime?.label || 'Unknown';

const updatedDate = new Date(snapshotMeta.fetchedAt).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export default function HeroCard() {
  return (
    <section className="hero-card" aria-label="Current RBI Repo Rate">
      {/* Current Rate */}
      <div className="hero-card__section">
        <span className="hero-card__label">Current Repo Rate</span>
        <span className="hero-card__rate">{currentRate.rate.toFixed(2)}%</span>
        <span className="hero-card__date">Effective since {formattedDate}</span>
      </div>

      <div className="hero-card__divider" role="presentation" />

      {/* Delta from previous */}
      <div className="hero-card__section hero-card__section--center">
        <span className="hero-card__label">Last MPC Action</span>
        <span className={`hero-card__delta ${deltaClass}`}>
          {deltaText} bps
        </span>
        <span className={`hero-card__regime-pill hero-card__regime-pill--${regimeType}`}>
          <span className="hero-card__regime-dot" />
          {regimeLabel}
        </span>
      </div>

      <div className="hero-card__divider" role="presentation" />

      {/* Source & Audit */}
      <div className="hero-card__section hero-card__section--end">
        <span className="hero-card__label">Data Source</span>
        <a
          className="hero-card__source-link"
          href={snapshotMeta.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          RBI Monetary Policy →
        </a>
        <span className="hero-card__meta">
          Updated: {updatedDate}
        </span>
        <span className="hero-card__meta">
          Snapshot: {snapshotMeta.id}
        </span>
      </div>
    </section>
  );
}
