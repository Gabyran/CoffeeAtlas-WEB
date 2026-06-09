import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpError } from '../lib/server/api-primitives.ts';
import { code2Session } from '../lib/server/wechat-auth.ts';

function withWechatEnv(appId: string | undefined, appSecret: string | undefined) {
  const previousAppId = process.env.WECHAT_APP_ID;
  const previousAppSecret = process.env.WECHAT_APP_SECRET;

  if (typeof appId === 'string') {
    process.env.WECHAT_APP_ID = appId;
  } else {
    delete process.env.WECHAT_APP_ID;
  }

  if (typeof appSecret === 'string') {
    process.env.WECHAT_APP_SECRET = appSecret;
  } else {
    delete process.env.WECHAT_APP_SECRET;
  }

  return () => {
    if (typeof previousAppId === 'string') {
      process.env.WECHAT_APP_ID = previousAppId;
    } else {
      delete process.env.WECHAT_APP_ID;
    }

    if (typeof previousAppSecret === 'string') {
      process.env.WECHAT_APP_SECRET = previousAppSecret;
    } else {
      delete process.env.WECHAT_APP_SECRET;
    }
  };
}

test('code2Session requires WeChat server credentials', async () => {
  const restoreEnv = withWechatEnv(undefined, undefined);

  try {
    await assert.rejects(() => code2Session('code'), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 500);
      assert.equal(error.code, 'wechat_config_missing');
      return true;
    });
  } finally {
    restoreEnv();
  }
});

test('code2Session exchanges code and normalizes identifiers', async (t) => {
  const restoreEnv = withWechatEnv('app-id', 'app-secret');
  let requestedUrl = '';

  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        openid: ' open-id ',
        unionid: ' union-id ',
        session_key: 'session-key',
      }),
      { status: 200 }
    );
  });

  try {
    const result = await code2Session('code with spaces');
    const url = new URL(requestedUrl);

    assert.equal(url.searchParams.get('appid'), 'app-id');
    assert.equal(url.searchParams.get('secret'), 'app-secret');
    assert.equal(url.searchParams.get('js_code'), 'code with spaces');
    assert.equal(result.openid, 'open-id');
    assert.equal(result.unionid, 'union-id');
  } finally {
    restoreEnv();
  }
});

test('code2Session maps WeChat error responses to login failure', async (t) => {
  const restoreEnv = withWechatEnv('app-id', 'app-secret');

  t.mock.method(globalThis, 'fetch', async () => {
    return new Response(
      JSON.stringify({
        errcode: 40029,
        errmsg: 'invalid code',
      }),
      { status: 200 }
    );
  });

  try {
    await assert.rejects(() => code2Session('bad-code'), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 401);
      assert.equal(error.code, 'wechat_login_failed');
      return true;
    });
  } finally {
    restoreEnv();
  }
});

test('code2Session rejects malformed successful responses', async (t) => {
  const restoreEnv = withWechatEnv('app-id', 'app-secret');

  t.mock.method(globalThis, 'fetch', async () => {
    return new Response(
      JSON.stringify({
        session_key: 'session-key',
      }),
      { status: 200 }
    );
  });

  try {
    await assert.rejects(() => code2Session('code'), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 502);
      assert.equal(error.code, 'wechat_api_error');
      return true;
    });
  } finally {
    restoreEnv();
  }
});
