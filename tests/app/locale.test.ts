import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessCountry } from '../../src/lib/locale.ts';

test('the time zone decides when it maps to a tracked central bank', () => {
  assert.equal(guessCountry('Europe/London', ['en-US']), 'GB');
  assert.equal(guessCountry('Asia/Kolkata', ['en-GB']), 'IN');
  assert.equal(guessCountry('Asia/Calcutta', []), 'IN');
  assert.equal(guessCountry('America/Sao_Paulo', []), 'BR');
  assert.equal(guessCountry('Australia/Sydney', []), 'AU');
  assert.equal(guessCountry('America/Toronto', []), 'CA');
  assert.equal(guessCountry('America/New_York', []), 'US');
  assert.equal(guessCountry('America/Indiana/Indianapolis', []), 'US');
  assert.equal(guessCountry('Pacific/Honolulu', []), 'US');
  assert.equal(guessCountry('Europe/Berlin', []), 'EA');
  assert.equal(guessCountry('Europe/Sofia', []), 'EA');
  assert.equal(guessCountry('Atlantic/Canary', []), 'EA');
});

test('outside tracked zones, the first language with a tracked region decides', () => {
  assert.equal(guessCountry('Asia/Dubai', ['ar', 'en-GB']), 'GB');
  assert.equal(guessCountry('Asia/Singapore', ['pt-BR']), 'BR');
  assert.equal(guessCountry('UTC', ['fr-FR']), 'EA');
  assert.equal(guessCountry('UTC', ['hi']), 'IN');
});

test('no guess for places outside the tracked set, or for euro users who are not in the euro area', () => {
  assert.equal(guessCountry('Asia/Tokyo', ['ja-JP']), null);
  assert.equal(guessCountry('Europe/Zurich', ['de-CH']), null);
  assert.equal(guessCountry('Europe/Monaco', ['fr-MC']), null);
  assert.equal(guessCountry(undefined, []), null);
});
