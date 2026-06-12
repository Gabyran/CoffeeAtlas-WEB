import assert from 'node:assert/strict';
import test from 'node:test';

import { ApiClientError, extractApiErrorMessage, unwrapApiResponse } from '../dist/errors.js';

test('unwrapApiResponse returns data for success envelope', () => {
  const result = unwrapApiResponse({
    ok: true,
    data: { id: 'bean-1' },
    meta: { requestId: 'req-1' },
  });

  assert.deepEqual(result, { id: 'bean-1' });
});

test('unwrapApiResponse throws ApiClientError for error envelope', () => {
  assert.throws(
    () =>
      unwrapApiResponse({
        ok: false,
        error: {
          code: 'bad_request',
          message: '参数错误',
        },
        meta: {
          requestId: 'req-2',
        },
      }),
    (error: unknown) =>
      error instanceof ApiClientError &&
      error.message === '参数错误' &&
      error.code === 'bad_request' &&
      error.requestId === 'req-2'
  );
});

test('extractApiErrorMessage flattens mixed array and object payloads', () => {
  assert.equal(
    extractApiErrorMessage({
      error: [[], { message: '签名失效' }, { detail: '请重新登录' }],
    }),
    '[]；签名失效；请重新登录'
  );
});

test('extractApiErrorMessage serializes plain object errors instead of returning [object Object]', () => {
  assert.equal(
    extractApiErrorMessage({
      error: { status: 502, traceId: 'trace-1' },
    }),
    '{"status":502,"traceId":"trace-1"}'
  );
});
