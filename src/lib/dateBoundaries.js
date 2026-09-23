export function toUtcDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  return new Date(`${value}${String(value).length === 10 ? 'T00:00:00.000Z' : ''}`);
}

export function isWithinDateRange(value, { start = null, end = null } = {}) {
  const date = toUtcDate(value);
  if (!date || Number.isNaN(date.getTime())) return false;
  const startDate = toUtcDate(start);
  const endDate = toUtcDate(end);
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
}

export function filterByDateRange(items, dateRange, getDate = item => item.dateObj || item.date) {
  return items.filter(item => isWithinDateRange(getDate(item), dateRange));
}

/**
 * Regime intervals are start-inclusive and end-exclusive, except for the
 * final regime, whose published end date is part of the visible coverage.
 */
export function isWithinRegime(value, regime, isFinal = false) {
  const date = toUtcDate(value);
  const start = toUtcDate(regime?.startObj || regime?.startDate);
  const end = toUtcDate(regime?.endObj || regime?.endDate);
  if (!date || !start || !end) return false;
  return date >= start && (date < end || (isFinal && date <= end));
}

export function decisionsForRegime(decisions, regimes, regimeIndex) {
  const regime = regimes[regimeIndex];
  return decisions.filter(decision => isWithinRegime(decision.dateObj || decision.date, regime, regimeIndex === regimes.length - 1));
}
