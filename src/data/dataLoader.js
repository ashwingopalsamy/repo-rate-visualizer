import snapshotData from './snapshot.json';

// The snapshot is bundled at build time via Vite JSON import
// To update: replace snapshot.json or fetch from public/data/snapshots/

export const snapshot = snapshotData;

// Parsed rate data with Date objects and computed bps changes
export const repoRateData = snapshotData.rates.map((d, i, arr) => {
  const changeBps = i === 0 ? 0 : Math.round((d.rate - arr[i - 1].rate) * 100);
  return {
    ...d,
    dateObj: new Date(d.date),
    changeBps,
  };
});

export const currentRate = repoRateData[repoRateData.length - 1];

export const previousRate = repoRateData.length > 1
  ? repoRateData[repoRateData.length - 2]
  : null;

// Events with parsed dates
export const macroEvents = snapshotData.events.map(e => ({
  ...e,
  dateObj: new Date(e.date),
}));

// Regimes with parsed dates
export const regimes = snapshotData.regimes.map(r => ({
  ...r,
  startObj: new Date(r.startDate),
  endObj: new Date(r.endDate),
}));

// Current regime (last in the array)
export const currentRegime = regimes[regimes.length - 1];

// Rate changes for bar chart (re-export with parsed dates already included)
export const rateChanges = repoRateData.filter(d => d.changeBps !== 0);

// Metadata
export const snapshotMeta = {
  id: snapshotData.snapshot_id,
  fetchedAt: snapshotData.fetched_at,
  sourceUrl: snapshotData.source_url,
  checksum: snapshotData.checksum,
};
