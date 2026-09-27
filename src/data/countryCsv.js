const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

export function buildCountryCsv(model, records = model.records) {
  const sources = new Map(model.sources.map(source => [source.id, source]));
  const publishedChangesOnly = records.length > 0 && records.every(record => record.recordType === 'policy_change');
  const headers = [
    'Country code', 'Country', 'Central bank', 'Instrument', 'Record ID', 'Record type',
    publishedChangesOnly ? 'Published date' : 'Record date', 'Decision date', 'Effective date', 'Value kind', 'Lower bound (bps)',
    'Upper bound (bps)', 'Action', publishedChangesOnly ? 'Published change (bps)' : 'Change (bps)', 'Source IDs', 'Source titles',
    'Source URLs', 'Snapshot release ID', 'Artifact SHA-256', 'Snapshot retrieved at',
  ];
  const rows = records.map(record => {
    const linked = record.sourceIds.map(id => sources.get(id)).filter(Boolean);
    const action = record.changeBps === null ? 'framework_change'
      : record.changeBps === undefined ? 'rate_observation'
        : record.changeBps > 0 ? 'hike' : record.changeBps < 0 ? 'cut'
          : record.recordType === 'policy_decision' ? 'hold' : 'rate_observation';
    return [
      model.code, model.name, model.centralBank, model.instrument, record.id, record.recordType,
      record.recordDate, record.decisionDate || '', record.effectiveDate || '', record.value.kind,
      record.value.lowBps, record.value.highBps, action,
      record.changeBps === null || record.changeBps === undefined ? '' : record.changeBps,
      record.sourceIds.join(' | '), linked.map(source => source.title).join(' | '), linked.map(source => source.url).join(' | '),
      model.release.releaseId || '', model.release.artifactSha256 || '', model.release.retrievedAt || '',
    ].map(cell).join(',');
  });
  return [headers.map(cell).join(','), ...rows].join('\n');
}

export function downloadCountryCsv(model, records = model.records) {
  const blob = new Blob([buildCountryCsv(model, records)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${model.code.toLowerCase()}-${model.release.releaseId || 'policy-rate-history'}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
