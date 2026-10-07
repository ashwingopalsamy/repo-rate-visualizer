import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the app entry is the v2 React root', () => {
  assert.match(readFileSync(new URL('../../src/main.tsx', import.meta.url), 'utf8'), /hydrateRoot/);
});
