import { decisions, sources } from '../data/dataLoader.js';

const actionLabel = {
  initial: 'initial',
  cut: 'cut',
  hike: 'hike',
  hold: 'hold',
};

function formatDate(value) {
  if (!value) return 'Not reported';
  return new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimestamp(value) {
  if (!value) return 'Not reported';
  return new Date(value).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function formatType(type) {
  return type
    .split('-')
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

export default function SourceTransparency() {
  return (
    <section className="source-panel" aria-labelledby="source-panel-title">
      <details open>
        <summary>
          <span>
            <strong id="source-panel-title">Source transparency</strong>
            <small>Exact source records used by this snapshot and their linked decisions.</small>
          </span>
          <span className="source-panel__count">{sources.length} sources</span>
        </summary>

        <div className="source-panel__list" role="list">
          {sources.map(source => {
            const linkedDecisions = decisions.filter(decision => decision.sourceIds.includes(source.id));
            const recentLinkedDecisions = linkedDecisions.slice(-3).reverse();

            return (
              <article className="source-record" key={source.id} role="listitem" data-source-id={source.id}>
                <div className="source-record__heading">
                  <span className="source-record__type">{formatType(source.type)}</span>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title} ↗
                  </a>
                </div>

                <dl className="source-record__facts">
                  <div>
                    <dt>Published</dt>
                    <dd>{formatDate(source.publishedAt)}</dd>
                  </div>
                  <div>
                    <dt>Retrieved</dt>
                    <dd>{formatTimestamp(source.retrievedAt)}</dd>
                  </div>
                  <div>
                    <dt>Checksum</dt>
                    <dd><code>{source.checksum}</code></dd>
                  </div>
                  <div>
                    <dt>Linked decisions</dt>
                    <dd>{linkedDecisions.length}</dd>
                  </div>
                </dl>

                <p className="source-record__linked">
                  {recentLinkedDecisions.length > 0 ? (
                    <>
                      Recent links:{' '}
                      {recentLinkedDecisions.map((decision, index) => (
                        <span key={decision.id}>
                          {index > 0 ? ' · ' : ''}{decision.date} {actionLabel[decision.action] || decision.action}
                        </span>
                      ))}
                      {linkedDecisions.length > recentLinkedDecisions.length ? ` · +${linkedDecisions.length - recentLinkedDecisions.length} more` : ''}
                    </>
                  ) : 'No decision records currently link to this source.'}
                </p>
              </article>
            );
          })}
        </div>
      </details>
    </section>
  );
}
