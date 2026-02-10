/**
 * Helper to compute policy decomposition data for regimes, years, and cycles.
 * All numbers are derived strictly from the canonical decisions and regimes.
 */

function formatRatio(holds, moves) {
  if (moves === 0) {
    return holds > 0 ? 'Hold' : '0:1';
  }
  const ratio = (holds / moves).toFixed(1);
  return `${ratio.endsWith('.0') ? Math.round(holds / moves) : ratio}:1`;
}

/**
 * Compute breakdown by policy regime.
 * @param {Array<Object>} regimes
 * @param {Array<Object>} decisions
 * @param {Object} [dateRange]
 */
export function getRegimeBreakdowns(regimes, decisions, dateRange = {}) {
  const startDate = dateRange.start ? new Date(dateRange.start) : null;
  const endDate = dateRange.end ? new Date(dateRange.end) : null;

  return regimes
    .filter(r => {
      if (startDate && r.endObj < startDate) return false;
      if (endDate && r.startObj > endDate) return false;
      return true;
    })
    .map((r, index) => {
      const regimeDecisions = decisions.filter(d => {
        if (d.dateObj < r.startObj || d.dateObj > r.endObj) return false;
        if (startDate && d.dateObj < startDate) return false;
        if (endDate && d.dateObj > endDate) return false;
        return true;
      });

      const cuts = regimeDecisions.filter(d => d.action === 'cut');
      const hikes = regimeDecisions.filter(d => d.action === 'hike');
      const holds = regimeDecisions.filter(d => d.action === 'hold' || d.action === 'initial');

      const cutBps = cuts.reduce((sum, d) => sum + Math.abs(d.changeBps), 0);
      const hikeBps = hikes.reduce((sum, d) => sum + d.changeBps, 0);
      const netBps = hikeBps - cutBps;
      const moves = cuts.length + hikes.length;
      const ratio = formatRatio(holds.length, moves);

      const durationMonths = Math.max(1, Math.round((r.endObj - r.startObj) / (1000 * 60 * 60 * 24 * 30.44)));
      const startYear = r.startDate.slice(0, 4);
      const endYear = r.endDate.slice(0, 4);
      const periodLabel = startYear === endYear ? startYear : `${startYear}–${endYear.slice(2)}`;

      const startRate = regimeDecisions[0]?.repoRate ?? null;
      const endRate = regimeDecisions[regimeDecisions.length - 1]?.repoRate ?? null;

      return {
        id: `regime-${index}-${r.startDate}`,
        label: r.label,
        type: r.type,
        startDate: r.startDate,
        endDate: r.endDate,
        periodLabel,
        total: regimeDecisions.length,
        holds: holds.length,
        cuts: cuts.length,
        hikes: hikes.length,
        cutBps,
        hikeBps,
        netBps,
        ratio,
        durationMonths,
        startRate,
        endRate,
        decisions: regimeDecisions,
      };
    })
    .filter(item => item.total > 0);
}

/**
 * Compute breakdown by calendar year.
 * @param {Array<Object>} decisions
 * @param {Object} [dateRange]
 */
export function getYearlyBreakdowns(decisions, dateRange = {}) {
  const startDate = dateRange.start ? new Date(dateRange.start) : null;
  const endDate = dateRange.end ? new Date(dateRange.end) : null;

  const filteredDecisions = decisions.filter(d => {
    if (startDate && d.dateObj < startDate) return false;
    if (endDate && d.dateObj > endDate) return false;
    return true;
  });

  const byYear = new Map();

  filteredDecisions.forEach(d => {
    const year = d.date.slice(0, 4);
    if (!byYear.has(year)) {
      byYear.set(year, []);
    }
    byYear.get(year).push(d);
  });

  return Array.from(byYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, yearDecisions]) => {
      const cuts = yearDecisions.filter(d => d.action === 'cut');
      const hikes = yearDecisions.filter(d => d.action === 'hike');
      const holds = yearDecisions.filter(d => d.action === 'hold' || d.action === 'initial');

      const cutBps = cuts.reduce((sum, d) => sum + Math.abs(d.changeBps), 0);
      const hikeBps = hikes.reduce((sum, d) => sum + d.changeBps, 0);
      const netBps = hikeBps - cutBps;
      const moves = cuts.length + hikes.length;
      const ratio = formatRatio(holds.length, moves);

      return {
        id: `year-${year}`,
        label: year,
        type: netBps < 0 ? 'easing' : netBps > 0 ? 'tightening' : 'pause',
        periodLabel: year,
        total: yearDecisions.length,
        holds: holds.length,
        cuts: cuts.length,
        hikes: hikes.length,
        cutBps,
        hikeBps,
        netBps,
        ratio,
        durationMonths: 12,
        startRate: yearDecisions[0]?.repoRate ?? null,
        endRate: yearDecisions[yearDecisions.length - 1]?.repoRate ?? null,
        decisions: yearDecisions,
      };
    });
}

/**
 * Compute overall aggregate summary stats for the current decision set.
 * @param {Array<Object>} decisions
 * @param {Object} [dateRange]
 */
export function getAggregateStats(decisions, dateRange = {}) {
  const startDate = dateRange.start ? new Date(dateRange.start) : null;
  const endDate = dateRange.end ? new Date(dateRange.end) : null;

  const filtered = decisions.filter(d => {
    if (startDate && d.dateObj < startDate) return false;
    if (endDate && d.dateObj > endDate) return false;
    return true;
  });

  const cuts = filtered.filter(d => d.action === 'cut');
  const hikes = filtered.filter(d => d.action === 'hike');
  const holds = filtered.filter(d => d.action === 'hold' || d.action === 'initial');

  const totalCutBps = cuts.reduce((sum, d) => sum + Math.abs(d.changeBps), 0);
  const totalHikeBps = hikes.reduce((sum, d) => sum + d.changeBps, 0);
  const netBps = totalHikeBps - totalCutBps;

  const moves = cuts.length + hikes.length;
  const holdRatio = formatRatio(holds.length, moves);
  const holdPct = filtered.length > 0 ? Math.round((holds.length / filtered.length) * 100) : 0;

  return {
    totalDecisions: filtered.length,
    holdsCount: holds.length,
    cutsCount: cuts.length,
    hikesCount: hikes.length,
    totalCutBps,
    totalHikeBps,
    netBps,
    holdRatio,
    holdPct,
    firstRate: filtered[0]?.repoRate ?? null,
    latestRate: filtered[filtered.length - 1]?.repoRate ?? null,
    minRate: filtered.length > 0 ? Math.min(...filtered.map(d => d.repoRate)) : null,
    maxRate: filtered.length > 0 ? Math.max(...filtered.map(d => d.repoRate)) : null,
  };
}
