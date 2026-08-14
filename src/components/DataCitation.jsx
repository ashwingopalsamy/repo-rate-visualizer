import { snapshotMeta, sources } from '../data/dataLoader.js';

const latestSource = [...sources]
  .filter(source => source.publishedAt)
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))[0]
  || sources[0];

const formatDate = (value) => new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export default function DataCitation() {
  return (
    <footer className="data-citation" role="contentinfo" aria-label="Data source information">
      <span className="data-citation__item">
        Latest source: <a className="data-citation__link" href={latestSource?.url || snapshotMeta.sourceUrl} target="_blank" rel="noopener noreferrer">{latestSource?.title || 'RBI official source'}</a>
      </span>
      <span className="data-citation__sep">·</span>
      <span className="data-citation__item">Published: {latestSource?.publishedAt ? formatDate(latestSource.publishedAt.slice(0, 10)) : 'Not reported'}</span>
      <span className="data-citation__sep">·</span>
      <span className="data-citation__item">Last checked: {new Date(snapshotMeta.retrievedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
      <span className="data-citation__sep">·</span>
      <span className="data-citation__item">Snapshot: {snapshotMeta.id}</span>
      <span className="data-citation__sep">·</span>
      <span className="data-citation__item">
        Visualization by <a className="data-citation__link" href="https://linkedin.com/in/ashwingopalsamy" target="_blank" rel="noopener noreferrer">Ashwin Gopalsamy</a>
      </span>
    </footer>
  );
}
