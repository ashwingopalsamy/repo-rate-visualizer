import { decisions, sources } from '../data/dataLoader.js';

const sourceById = new Map(sources.map(source => [source.id, source]));

function visibleDecisions(dateRange) {
  return decisions.filter(decision => {
    if (dateRange.start && decision.dateObj < new Date(dateRange.start)) return false;
    if (dateRange.end && decision.dateObj > new Date(dateRange.end)) return false;
    return true;
  });
}

function actionLabel(action) {
  if (action === 'cut') return 'Cut';
  if (action === 'hike') return 'Hike';
  if (action === 'hold') return 'Hold';
  return 'Initial';
}

function formatDate(value) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatChange(changeBps) {
  return `${changeBps > 0 ? '+' : ''}${changeBps} bps`;
}

export default function DecisionTimelineList({ dateRange }) {
  const filteredDecisions = visibleDecisions(dateRange);

  return (
    <section
      className="decision-timeline-list"
      aria-labelledby="timeline-decisions-title"
      data-decision-count={filteredDecisions.length}
    >
      <div className="decision-timeline-list__header">
        <div>
          <h2 id="timeline-decisions-title">Decision record</h2>
          <p>Keyboard and touch-readable records for every official decision in this range.</p>
        </div>
        <span>{filteredDecisions.length} decisions</span>
      </div>

      <div className="decision-timeline-list__items" role="list">
        {filteredDecisions.slice().reverse().map(decision => {
          const source = decision.sourceIds.map(sourceId => sourceById.get(sourceId)).find(Boolean);
          return (
            <div
              className={`timeline-decision-row timeline-decision-row--${decision.action}`}
              key={decision.id}
              role="listitem"
              data-decision-id={decision.id}
            >
              <time dateTime={decision.date}>{formatDate(decision.date)}</time>
              <span className={`timeline-decision-row__action timeline-decision-row__action--${decision.action}`}>
                {actionLabel(decision.action)}
              </span>
              <span className="timeline-decision-row__rate">{decision.repoRate.toFixed(2)}%</span>
              <span className="timeline-decision-row__change">{formatChange(decision.changeBps)}</span>
              <span className="timeline-decision-row__stance">{decision.stance || 'Stance not reported'}</span>
              {source ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open source for ${formatDate(decision.date)}`}
                >
                  Source ↗
                </a>
              ) : (
                <span className="timeline-decision-row__missing">Source unavailable</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
