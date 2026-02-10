import { snapshotMeta } from '../data/dataLoader.js';

const updatedDate = new Date(snapshotMeta.fetchedAt).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export default function DataCitation() {
  return (
    <footer className="data-citation" role="contentinfo" aria-label="Data source information">
      <span className="data-citation__item">
        Data: <a className="data-citation__link" href={snapshotMeta.sourceUrl} target="_blank" rel="noopener noreferrer">RBI Monetary Policy</a>
      </span>
      <span className="data-citation__sep">·</span>
      <span className="data-citation__item">Updated: {updatedDate}</span>
      <span className="data-citation__sep">·</span>
      <span className="data-citation__item">Snapshot: {snapshotMeta.id}</span>
      <span className="data-citation__sep">·</span>
      <span className="data-citation__item">
        Visualization by <a className="data-citation__link" href="https://linkedin.com/in/ashwingopalsamy" target="_blank" rel="noopener noreferrer">Ashwin Gopalsamy</a>
      </span>
    </footer>
  );
}
