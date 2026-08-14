import { currentRate, decisions, sources, snapshotMeta } from '../data/dataLoader.js';

const sourceById = new Map(sources.map(source => [source.id, source]));
const latestDecision = decisions.at(-1);

const latestPublishedSource = [...sources]
  .filter(source => source.publishedAt)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0]
  || sourceById.get(latestDecision?.sourceIds?.[0]);

const formatDate = (value, options = {}) => new Date(`${value}${value?.length === 10 ? 'T00:00:00.000Z' : ''}`).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  ...options,
});

const formatTimestamp = (value) => new Date(value).toLocaleString('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});

const actionLabel = {
  initial: 'Initial record',
  cut: 'Cut',
  hike: 'Hike',
  hold: 'Hold',
};

const actionClass = (action) => action === 'hold' || action === 'initial' ? 'unchanged' : action;

export default function HeroCard() {
  const decisionActionClass = actionClass(latestDecision.action);
  const stance = latestDecision.stance || 'Not reported';

  return (
    <section className="hero-card" aria-label="Current RBI Repo Rate overview">
      <div className="hero-card__section hero-card__section--start">
        <span className="hero-card__label">Current repo rate</span>
        <span className="hero-card__rate">{currentRate.rate.toFixed(2)}%</span>
        <span className="hero-card__date">
          Effective {formatDate(currentRate.date)}
        </span>
        <span className="hero-card__meta">Stance: {stance}</span>
      </div>

      <div className="hero-card__divider" aria-hidden="true" />

      <div className="hero-card__section hero-card__section--center">
        <span className="hero-card__label">Latest official decision</span>
        <div className="hero-card__action-row">
          <span className={`hero-card__action hero-card__action--${decisionActionClass}`}>
            {actionLabel[latestDecision.action] || latestDecision.action}
          </span>
          <span className={`hero-card__delta hero-card__delta--${decisionActionClass}`}>
            {latestDecision.changeBps > 0 ? '+' : ''}{latestDecision.changeBps} bps
          </span>
        </div>
        <span className="hero-card__date">Decision date: {formatDate(latestDecision.date)}</span>
        <a
          className="hero-card__source-link"
          href={sourceById.get(latestDecision.sourceIds[0])?.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open decision source ↗
        </a>
      </div>

      <div className="hero-card__divider" aria-hidden="true" />

      <div className="hero-card__section hero-card__section--end">
        <span className="hero-card__label">Latest verified source</span>
        <a
          className="hero-card__source-link hero-card__source-link--source"
          href={latestPublishedSource?.url || snapshotMeta.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {latestPublishedSource?.title || 'RBI official source'} ↗
        </a>
        <span className="hero-card__meta">
          Published: {latestPublishedSource?.publishedAt ? formatDate(latestPublishedSource.publishedAt.slice(0, 10)) : 'Not reported'}
        </span>
        <span className="hero-card__meta">Last successful check: {formatTimestamp(snapshotMeta.retrievedAt)}</span>
      </div>
    </section>
  );
}
