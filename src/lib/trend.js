const TREND_BY_ACTION = Object.freeze({
  cut: {
    key: 'cut',
    label: 'Easing',
    actionLabel: 'Cut',
    textClass: 'text-cut',
    dotClass: 'bg-cut',
    badgeVariant: 'cut',
  },
  hike: {
    key: 'hike',
    label: 'Tightening',
    actionLabel: 'Hike',
    textClass: 'text-hike',
    dotClass: 'bg-hike',
    badgeVariant: 'hike',
  },
  hold: {
    key: 'hold',
    label: 'Steady',
    actionLabel: 'Hold',
    textClass: 'text-hold',
    dotClass: 'bg-hold',
    badgeVariant: 'hold',
  },
  initial: {
    key: 'initial',
    label: 'Initial',
    actionLabel: 'Initial',
    textClass: 'text-hold',
    dotClass: 'bg-hold',
    badgeVariant: 'hold',
  },
});

export function getTrend(action = 'hold') {
  return TREND_BY_ACTION[action] || TREND_BY_ACTION.hold;
}

export function formatBps(changeBps = 0) {
  return `${changeBps > 0 ? '+' : ''}${changeBps} bps`;
}
