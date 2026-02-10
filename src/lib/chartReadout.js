const DEFAULT_GAP = 12;
const DEFAULT_INSET = 8;
const DEFAULT_POINT_PADDING = 5;

function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

function toRect(left, top, width, height) {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

function normalizeRect(value, padding = 0) {
  if (!value) return null;

  if (Number.isFinite(value.left) && Number.isFinite(value.top)) {
    const width = Number.isFinite(value.width) ? value.width : Math.max(0, (value.right || value.left) - value.left);
    const height = Number.isFinite(value.height) ? value.height : Math.max(0, (value.bottom || value.top) - value.top);
    return toRect(value.left - padding, value.top - padding, width + padding * 2, height + padding * 2);
  }

  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  const width = Number.isFinite(value.width) ? value.width : (value.radius || 4) * 2;
  const height = Number.isFinite(value.height) ? value.height : (value.radius || 4) * 2;
  return toRect(value.x - width / 2 - padding, value.y - height / 2 - padding, width + padding * 2, height + padding * 2);
}

function outsideDistance(rect, bounds, inset) {
  return Math.max(0, inset - rect.left)
    + Math.max(0, rect.right - bounds.width + inset)
    + Math.max(0, inset - rect.top)
    + Math.max(0, rect.bottom - bounds.height + inset);
}

function clampRect(rect, bounds, inset) {
  const maxLeft = Math.max(inset, bounds.width - rect.width - inset);
  const maxTop = Math.max(inset, bounds.height - rect.height - inset);
  const left = Math.min(Math.max(rect.left, inset), maxLeft);
  const top = Math.min(Math.max(rect.top, inset), maxTop);
  return toRect(left, top, rect.width, rect.height);
}

function rectGap(a, b) {
  if (overlapArea(a, b) > 0) return 0;
  const horizontal = a.right < b.left ? b.left - a.right : a.left - b.right;
  const vertical = a.bottom < b.top ? b.top - a.bottom : a.top - b.bottom;
  return Math.hypot(Math.max(0, horizontal), Math.max(0, vertical));
}

function candidateKey(candidate) {
  return `${Math.round(candidate.left)}:${Math.round(candidate.top)}`;
}

function addCandidate(candidates, seen, placement, left, top) {
  const candidate = { placement, left, top };
  const key = candidateKey(candidate);
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push(candidate);
}

function buildCandidates(anchor, size, bounds, gap, inset) {
  const candidates = [];
  const seen = new Set();
  const distances = [gap, gap + 12, gap + 24, gap + 40, gap + 64, gap + 96];
  const horizontalAlignments = [0.5, 0.25, 0.75, 0.1, 0.9];
  const verticalAlignments = [0.5, 0.25, 0.75, 0.1, 0.9];

  distances.forEach(distance => {
    verticalAlignments.forEach(alignment => {
      addCandidate(candidates, seen, 'right', anchor.x + distance, anchor.y - size.height * alignment);
      addCandidate(candidates, seen, 'left', anchor.x - distance - size.width, anchor.y - size.height * alignment);
    });
    horizontalAlignments.forEach(alignment => {
      addCandidate(candidates, seen, 'above', anchor.x - size.width * alignment, anchor.y - distance - size.height);
      addCandidate(candidates, seen, 'below', anchor.x - size.width * alignment, anchor.y + distance);
    });
  });

  // When a chart is dense, search the available canvas in a light grid. This
  // preserves the no-point-overlap invariant even when every immediate side
  // of a point is occupied by another mark.
  const maxLeft = Math.max(inset, bounds.width - size.width - inset);
  const maxTop = Math.max(inset, bounds.height - size.height - inset);
  const step = 16;
  for (let top = inset; top <= maxTop; top += step) {
    for (let left = inset; left <= maxLeft; left += step) {
      addCandidate(candidates, seen, 'canvas', left, top);
    }
  }
  addCandidate(candidates, seen, 'canvas', maxLeft, maxTop);
  return candidates;
}

/**
 * Pick a compact chart readout placement without covering visible marks.
 * Coordinates are relative to the chart container, so the same utility can
 * serve D3 line, marker, and bar visualizations.
 */
export function positionReadout({
  anchor,
  size,
  bounds,
  nearbyPoints = [],
  avoidRects = [],
  gap = DEFAULT_GAP,
  inset = DEFAULT_INSET,
  pointPadding = DEFAULT_POINT_PADDING,
}) {
  if (!anchor || !size || !bounds) return { placement: 'right', left: inset, top: inset, clear: false };

  const pointRects = nearbyPoints.map(point => normalizeRect(point, pointPadding)).filter(Boolean);
  const annotationRects = avoidRects.map(rect => normalizeRect(rect)).filter(Boolean);
  const candidates = buildCandidates(anchor, size, bounds, gap, inset);

  const scored = candidates.map(candidate => {
    const rawRect = toRect(candidate.left, candidate.top, size.width, size.height);
    const rect = clampRect(rawRect, bounds, inset);
    const outside = outsideDistance(rawRect, bounds, inset);
    const pointOverlap = pointRects.reduce((sum, pointRect) => sum + overlapArea(rect, pointRect), 0);
    const annotationOverlap = annotationRects.reduce((sum, annotationRect) => sum + overlapArea(rect, annotationRect), 0);
    const pointClearance = pointRects.length
      ? Math.min(...pointRects.map(pointRect => rectGap(rect, pointRect)))
      : Number.POSITIVE_INFINITY;
    const annotationClearance = annotationRects.length
      ? Math.min(...annotationRects.map(annotationRect => rectGap(rect, annotationRect)))
      : Number.POSITIVE_INFINITY;

    return {
      ...candidate,
      rect,
      outside,
      pointOverlap,
      annotationOverlap,
      pointClearance,
      annotationClearance,
      clear: outside === 0 && pointOverlap === 0,
    };
  });

  const valid = scored.filter(candidate => candidate.clear);
  const pool = valid.length > 0 ? valid : scored;
  const selected = pool.slice().sort((a, b) => {
    if (a.pointClearance !== b.pointClearance) return b.pointClearance - a.pointClearance;
    if (a.annotationOverlap !== b.annotationOverlap) return a.annotationOverlap - b.annotationOverlap;
    if (a.outside !== b.outside) return a.outside - b.outside;
    if (a.annotationClearance !== b.annotationClearance) return b.annotationClearance - a.annotationClearance;
    return a.left + a.top - (b.left + b.top);
  })[0];

  return {
    placement: selected.placement,
    left: selected.rect.left,
    top: selected.rect.top,
    clear: selected.clear,
    pointOverlap: selected.pointOverlap,
  };
}

export function nearestPoint(points, target) {
  return points.reduce((nearest, point) => {
    if (!nearest) return point;
    const nearestDistance = Math.hypot(nearest.x - target.x, nearest.y - target.y);
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    return distance < nearestDistance ? point : nearest;
  }, null);
}

export { overlapArea, normalizeRect };
