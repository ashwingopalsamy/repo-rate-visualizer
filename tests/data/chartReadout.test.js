import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRect, overlapArea, positionReadout } from '../../src/lib/chartReadout.js';

test('chart readout rejects placements that overlap visible points', () => {
  const position = positionReadout({
    anchor: { x: 100, y: 100 },
    size: { width: 120, height: 48 },
    bounds: { width: 360, height: 220 },
    nearbyPoints: [
      { x: 100, y: 100 },
      { x: 238, y: 100 },
      { x: 100, y: 178 },
    ],
  });

  const readout = normalizeRect({ left: position.left, top: position.top, width: 120, height: 48 });
  const points = [
    normalizeRect({ x: 100, y: 100 }, 5),
    normalizeRect({ x: 238, y: 100 }, 5),
    normalizeRect({ x: 100, y: 178 }, 5),
  ];

  assert.equal(position.clear, true);
  assert.equal(points.some(point => overlapArea(readout, point) > 0), false);
});

test('chart readout treats a bar as a visible rectangle', () => {
  const position = positionReadout({
    anchor: { x: 100, y: 40 },
    size: { width: 100, height: 44 },
    bounds: { width: 260, height: 180 },
    nearbyPoints: [{ left: 74, top: 32, width: 52, height: 90 }],
  });

  const readout = normalizeRect({ left: position.left, top: position.top, width: 100, height: 44 });
  const bar = normalizeRect({ left: 74, top: 32, width: 52, height: 90 }, 5);

  assert.equal(position.clear, true);
  assert.equal(overlapArea(readout, bar), 0);
});
