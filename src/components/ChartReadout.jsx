import { useLayoutEffect, useRef, useState } from 'react';
import { positionReadout } from '../lib/chartReadout.js';

const EMPTY_MARKS = [];

function formatDate(value) {
  if (!value) return 'Not reported';
  const date = value instanceof Date ? value : new Date(`${value}${String(value).length === 10 ? 'T00:00:00.000Z' : ''}`);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatChange(changeBps) {
  if (changeBps === null || changeBps === undefined) return null;
  return `${changeBps > 0 ? '+' : ''}${changeBps} bps`;
}

function actionLabel(action) {
  if (action === 'cut') return 'Cut';
  if (action === 'hike') return 'Hike';
  if (action === 'hold') return 'Hold';
  if (action === 'initial') return 'Initial';
  return null;
}

export default function ChartReadout({ visible, datum, anchor, bounds, nearbyPoints = EMPTY_MARKS, avoidRects = EMPTY_MARKS, persistent = false, onDismiss }) {
  const readoutRef = useRef(null);
  const [placement, setPlacement] = useState(null);

  useLayoutEffect(() => {
    if (!visible || !datum || !anchor || !bounds || !readoutRef.current) return;
    setPlacement(null);
    const place = () => {
      if (!readoutRef.current) return;
      const rect = readoutRef.current.getBoundingClientRect();
      const position = positionReadout({
        anchor,
        bounds,
        nearbyPoints,
        avoidRects,
        size: { width: rect.width || 180, height: rect.height || 48 },
      });
      setPlacement(position);
      const left = Number.isFinite(position.left) ? position.left : 8;
      const top = Number.isFinite(position.top) ? position.top : 8;
      readoutRef.current.style.setProperty('left', `${left}px`);
      readoutRef.current.style.setProperty('top', `${top}px`);
      readoutRef.current.dataset.placement = position.placement || 'right';
    };
    place();
    const frame = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(frame);
  }, [anchor, avoidRects, bounds, datum, nearbyPoints, visible]);

  if (!visible || !datum) return null;

  const change = formatChange(datum.changeBps);
  const action = actionLabel(datum.action);
  const label = action && change ? `${action} · ${change}` : change || action || datum.direction;
  const value = datum.rate ?? datum.value;
  const readoutLabel = `${formatDate(datum.date)}, ${value !== undefined ? `${Number(value).toFixed(2)} percent` : ''}${label ? `, ${label}` : ''}`;
  const isClear = placement?.clear !== false;

  return (
    <>
      <div
        ref={readoutRef}
        className={`chart-readout${persistent ? ' chart-readout--persistent' : ''}`}
        role="tooltip"
        aria-hidden={isClear ? undefined : 'true'}
        aria-live={persistent && isClear ? 'polite' : undefined}
        aria-label={readoutLabel}
        style={{ visibility: placement ? (isClear ? 'visible' : 'hidden') : 'hidden' }}
        onKeyDown={event => {
          if (event.key === 'Escape') onDismiss?.();
        }}
      >
        <time className="chart-readout__date" dateTime={datum.date}>{formatDate(datum.date)}</time>
        {value !== undefined ? <strong className="chart-readout__value">{Number(value).toFixed(2)}%</strong> : null}
        {label ? <span className={`chart-readout__change chart-readout__change--${datum.action || (datum.changeBps < 0 ? 'cut' : datum.changeBps > 0 ? 'hike' : 'hold')}`}>{label}</span> : null}
        {datum.annotation ? <span className="chart-readout__annotation">{datum.annotation}</span> : null}
      </div>
      {!isClear ? <span className="sr-only" role="status" aria-live="polite">{readoutLabel}</span> : null}
    </>
  );
}
