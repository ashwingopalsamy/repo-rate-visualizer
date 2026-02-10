const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

/**
 * Build a provenance-complete decision export without depending on the DOM.
 * Decisions remain the canonical export rows; rate-change views are derived.
 */
export function buildDecisionCsv({ decisions, sources, macroEvents, regimes, dateRange }) {
  const sourceById = new Map(sources.map(source => [source.id, source]));
  let data = decisions;

  if (dateRange?.start) {
    data = data.filter(decision => decision.dateObj >= new Date(dateRange.start));
  }
  if (dateRange?.end) {
    data = data.filter(decision => decision.dateObj <= new Date(dateRange.end));
  }

  const headers = [
    'Decision ID',
    'Date',
    'Repo Rate (%)',
    'Action',
    'Change (bps)',
    'Stance',
    'Decision Summary',
    'Source ID(s)',
    'Source Title(s)',
    'Source URL(s)',
    'Event',
    'Regime',
  ];

  const rows = data.map(decision => {
    const event = macroEvents.find(item => item.date === decision.date)?.label || '';
    const regime = regimes.find(item => decision.dateObj >= item.startObj && decision.dateObj <= item.endObj)?.label || '';
    const decisionSources = decision.sourceIds.map(sourceId => sourceById.get(sourceId)).filter(Boolean);

    return [
      decision.id,
      decision.date,
      decision.repoRate,
      decision.action,
      decision.changeBps,
      decision.stance || '',
      decision.summary || '',
      decision.sourceIds.join(' | '),
      decisionSources.map(source => source.title).join(' | '),
      decisionSources.map(source => source.url).join(' | '),
      event,
      regime,
    ].map(csvCell).join(',');
  });

  return [headers.map(csvCell).join(','), ...rows].join('\n');
}
