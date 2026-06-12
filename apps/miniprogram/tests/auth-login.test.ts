import assert from 'node:assert/strict';
import test from 'node:test';

import { login, logout } from '../src/utils/auth.ts';

type WxRequestOptions = {
  data?: unknown;
  success: (result: { data: unknown; statusCode: number }) => void;
  fail: (error: unknown) => void;
};

type WxLoginOptions = {
  success: (result: { code: string }) => void;
  fail: (error: unknown) => void;
};

test('login fetches a fresh wx.login code for each server login retry', async () => {
  const storage = new Map<string, unknown>();
  const loginCodes = ['fresh-code-1', 'fresh-code-2'];
  const submittedCodes: string[] = [];

  (globalThis as { __TARO_APP_API_URL__?: string }).__TARO_APP_API_URL__ = 'https://coffeeatlas-api.example.com';
  (globalThis as { wx?: Record<string, unknown> }).wx = {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, data: unknown) => {
      storage.set(key, data);
    },
    removeStorageSync: (key: string) => {
      storage.delete(key);
    },
    login: (options: WxLoginOptions) => {
      const code = loginCodes.shift();
      if (!code) {
        options.fail(new Error('no more codes'));
        return;
      }

      options.success({ code });
    },
    request: (options: WxRequestOptions) => {
      const code = (options.data as { code?: string } | undefined)?.code;
      if (code) submittedCodes.push(code);

      if (submittedCodes.length === 1) {
        options.success({
          statusCode: 401,
          data: {
            ok: false,
            error: { code: 'wechat_login_failed', message: 'invalid code' },
            meta: { requestId: 'request-1' },
          },
        });
        return;
      }

      options.success({
        statusCode: 200,
        data: {
          ok: true,
          data: {
            token: 'token-1',
            user: {
              id: 'user-1',
              nickname: null,
              avatarUrl: null,
            },
          },
          meta: { requestId: 'request-2' },
        },
      });
    },
  };

  try {
    const user = await login();

    assert.equal(user.id, 'user-1');
    assert.deepEqual(submittedCodes, ['fresh-code-1', 'fresh-code-2']);
  } finally {
    logout();
    delete (globalThis as { wx?: unknown }).wx;
    delete (globalThis as { __TARO_APP_API_URL__?: unknown }).__TARO_APP_API_URL__;
  }
});
