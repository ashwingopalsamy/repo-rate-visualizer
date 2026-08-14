const TREND_BY_ACTION = Object.freeze({
  cut: {
    key: 'easing',
    label: 'Easing',
    actionLabel: 'Cut',
    textClass: 'text-trend-easing',
    dotClass: 'bg-trend-easing',
    badgeVariant: 'cut',
  },
  hike: {
    key: 'tightening',
    label: 'Tightening',
    actionLabel: 'Hike',
    textClass: 'text-trend-tightening',
    dotClass: 'bg-trend-tightening',
    badgeVariant: 'hike',
  },
  hold: {
    key: 'steady',
    label: 'Steady',
    actionLabel: 'Hold',
    textClass: 'text-trend-steady',
    dotClass: 'bg-trend-steady',
    badgeVariant: 'hold',
  },
  initial: {
    key: 'initial',
    label: 'Initial',
    actionLabel: 'Initial',
    textClass: 'text-trend-steady',
    dotClass: 'bg-trend-steady',
    badgeVariant: 'hold',
  },
});

export function getTrend(action = 'hold') {
  return TREND_BY_ACTION[action] || TREND_BY_ACTION.hold;
}

export function formatBps(changeBps = 0) {
  return `${changeBps > 0 ? '+' : ''}${changeBps} bps`;
}
