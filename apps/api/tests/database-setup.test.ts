import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('setup.sql does not seed sample catalog data', () => {
  const setupSql = readFileSync(new URL('../db/setup.sql', import.meta.url), 'utf8');

  assert.doesNotMatch(setupSql, /Manner Ethiopia Single Origin/);
  assert.doesNotMatch(setupSql, /Seesaw Coffee/);
  assert.doesNotMatch(setupSql, /Metal Hands/);
  assert.doesNotMatch(setupSql, /Insert sample/i);
});
