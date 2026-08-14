import { decisions, sources } from '../data/dataLoader.js';

const sourceById = new Map(sources.map(source => [source.id, source]));

const actionLabel = {
  initial: 'Initial',
  cut: 'Cut',
  hike: 'Hike',
  hold: 'Hold',
};

const formatDate = (value) => new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const formatChange = (changeBps) => {
  if (changeBps > 0) return `+${changeBps} bps`;
  return `${changeBps} bps`;
};

const decisionDescription = (decision) => {
  if (decision.action === 'hold') return `Repo rate held at ${decision.repoRate.toFixed(2)}%.`;
  if (decision.action === 'initial') return `First recorded repo rate: ${decision.repoRate.toFixed(2)}%.`;
  return `Repo rate moved to ${decision.repoRate.toFixed(2)}%.`;
};

export default function DecisionLedger({ limit = 8 }) {
  const recentDecisions = [...decisions].reverse().slice(0, limit);

  return (
    <section className="decision-ledger" aria-labelledby="decision-ledger-title">
      <div className="decision-ledger__header">
        <div>
          <h2 className="decision-ledger__title" id="decision-ledger-title">Recent policy decisions</h2>
          <p className="decision-ledger__description">
            Official decision records, including unchanged repo-rate decisions.
          </p>
        </div>
        <span className="decision-ledger__count">Latest {recentDecisions.length} of {decisions.length}</span>
      </div>

      <div className="decision-ledger__list" role="list">
        {recentDecisions.map(decision => {
          const decisionSource = decision.sourceIds
            .map(sourceId => sourceById.get(sourceId))
            .find(Boolean);
          const action = actionLabel[decision.action] || decision.action;

          return (
            <article
              className={`decision-row decision-row--${decision.action}`}
              key={decision.id}
              role="listitem"
              data-decision-id={decision.id}
              data-action={decision.action}
            >
              <div className="decision-row__date">
                <time dateTime={decision.date}>{formatDate(decision.date)}</time>
                <span>Official decision</span>
              </div>
              <div className="decision-row__main">
                <div className="decision-row__headline">
                  <span className={`decision-row__action decision-row__action--${decision.action}`}>{action}</span>
                  <span className="decision-row__rate">{decision.repoRate.toFixed(2)}%</span>
                  <span className="decision-row__change">{formatChange(decision.changeBps)}</span>
                </div>
                <p className="decision-row__description">{decisionDescription(decision)}</p>
              </div>
              <div className="decision-row__meta">
                <span className="decision-row__stance">Stance: {decision.stance || 'Not reported'}</span>
                {decisionSource ? (
                  <a
                    className="decision-row__source"
                    href={decisionSource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open source for ${formatDate(decision.date)}`}
                  >
                    {decisionSource.title} ↗
                  </a>
                ) : (
                  <span className="decision-row__source decision-row__source--missing">Source unavailable</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
