function recordShape(record) {
  return {
    date: record.date,
    repoRate: record.repoRate,
    action: record.action,
    changeBps: record.changeBps,
    sourceIds: record.sourceIds,
  };
}

export function diffReleaseSnapshots(fromSnapshot, toSnapshot) {
  const from = new Map((fromSnapshot?.decisions || []).map(record => [record.id, record]));
  const to = new Map((toSnapshot?.decisions || []).map(record => [record.id, record]));
  const added = [...to.values()].filter(record => !from.has(record.id));
  const removed = [...from.values()].filter(record => !to.has(record.id));
  const changed = [...to.values()]
    .filter(record => from.has(record.id) && JSON.stringify(recordShape(from.get(record.id))) !== JSON.stringify(recordShape(record)))
    .map(record => ({ previous: from.get(record.id), current: record }));

  const fromSources = new Map((fromSnapshot?.sources || []).map(source => [source.id, source]));
  const toSources = new Map((toSnapshot?.sources || []).map(source => [source.id, source]));
  const sourceChanges = [...toSources.values()]
    .filter(source => fromSources.has(source.id) && JSON.stringify(fromSources.get(source.id)) !== JSON.stringify(source))
    .map(source => ({ previous: fromSources.get(source.id), current: source }));

  return { added, removed, changed, sourceChanges };
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function diffRows(diff) {
  return [
    ...diff.added.map(record => ({ category: 'added', record })),
    ...diff.removed.map(record => ({ category: 'removed', record })),
    ...diff.changed.map(item => ({ category: 'changed', record: item.current, previous: item.previous })),
  ];
}

export function buildReleaseDiffCsv({ diff, fromRelease, toRelease }) {
  const headers = ['Category', 'Record ID', 'Previous Date', 'Date', 'Previous Rate (%)', 'Rate (%)', 'Previous Action', 'Action', 'Previous Source IDs', 'Source IDs', 'From Release', 'To Release'];
  const rows = diffRows(diff).map(({ category, record, previous }) => [
    category,
    record.id,
    previous?.date || '',
    record.date,
    previous?.repoRate ?? '',
    record.repoRate,
    previous?.action || '',
    record.action,
    previous?.sourceIds?.join(' | ') || '',
    record.sourceIds?.join(' | ') || '',
    fromRelease.releaseId,
    toRelease.releaseId,
  ].map(csvCell).join(','));
  return [headers.map(csvCell).join(','), ...rows].join('\n');
}

export function buildReleaseDiffText({ diff, fromRelease, toRelease }) {
  return [
    `RBI release diff: ${fromRelease.releaseId} → ${toRelease.releaseId}`,
    `Added records: ${diff.added.length}; removed records: ${diff.removed.length}; changed records: ${diff.changed.length}; changed sources: ${diff.sourceChanges.length}.`,
    ...diffRows(diff).map(({ category, record, previous }) => `${category}: ${record.id} ${previous ? `${previous.date} ${previous.repoRate}% ${previous.action} → ` : ''}${record.date} ${record.repoRate}% ${record.action}`),
  ].join('\n');
}
