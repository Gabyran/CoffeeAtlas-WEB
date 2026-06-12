import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveApiBaseUrlState } from '../src/utils/api-config.ts';

test('resolveApiBaseUrlState falls back to build config when runtime override is localhost', () => {
  const state = resolveApiBaseUrlState({
    runtimeBaseUrl: 'http://localhost:3000',
    buildBaseUrl: 'http://100.96.3.111:3000',
  });

  assert.equal(state.baseUrl, 'http://100.96.3.111:3000');
  assert.equal(state.source, 'build');
  assert.match(state.warning ?? '', /localhost/);
});

test('resolveApiBaseUrlState keeps a valid runtime override', () => {
  const state = resolveApiBaseUrlState({
    runtimeBaseUrl: 'https://coffeeatlas-api.example.com',
    buildBaseUrl: 'http://100.96.3.111:3000',
  });

  assert.equal(state.baseUrl, 'https://coffeeatlas-api.example.com');
  assert.equal(state.source, 'runtime');
  assert.equal(state.warning, null);
});
