import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

let importId = 0;

async function loadSupabaseModule({
  supabaseUrl,
  supabaseAnonKey,
}: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}) {
  const runtimeEnv = globalThis as Record<string, unknown>;
  const previousUrl = runtimeEnv.__TARO_APP_SUPABASE_URL__;
  const previousAnonKey = runtimeEnv.__TARO_APP_SUPABASE_ANON_KEY__;

  if (typeof supabaseUrl === 'string') {
    runtimeEnv.__TARO_APP_SUPABASE_URL__ = supabaseUrl;
  } else {
    delete runtimeEnv.__TARO_APP_SUPABASE_URL__;
  }

  if (typeof supabaseAnonKey === 'string') {
    runtimeEnv.__TARO_APP_SUPABASE_ANON_KEY__ = supabaseAnonKey;
  } else {
    delete runtimeEnv.__TARO_APP_SUPABASE_ANON_KEY__;
  }

  const require = createRequire(import.meta.url);
  const taroPath = require.resolve('@tarojs/taro');
  const storageState: Record<string, unknown> = {};
  const taroMock = {
    request: async () => ({ statusCode: 200, data: {} }),
    getStorageSync: (key: string) => storageState[key],
    setStorageSync: (key: string, value: unknown) => {
      storageState[key] = value;
    },
    removeStorageSync: (key: string) => {
      delete storageState[key];
    },
  };

  require.cache[taroPath] = {
    id: taroPath,
    filename: taroPath,
    loaded: true,
    exports: taroMock,
    children: [],
    path: taroPath,
    paths: [],
  };

  importId += 1;

  try {
    return await import(`../src/utils/supabase.ts?case=${importId}`);
  } finally {
    if (typeof previousUrl === 'string') {
      runtimeEnv.__TARO_APP_SUPABASE_URL__ = previousUrl;
    } else {
      delete runtimeEnv.__TARO_APP_SUPABASE_URL__;
    }

    if (typeof previousAnonKey === 'string') {
      runtimeEnv.__TARO_APP_SUPABASE_ANON_KEY__ = previousAnonKey;
    } else {
      delete runtimeEnv.__TARO_APP_SUPABASE_ANON_KEY__;
    }
  }
}

test('getSupabaseConfig trims build env and reports configured state', async () => {
  const supabase = await loadSupabaseModule({
    supabaseUrl: ' https://demo.supabase.co ',
    supabaseAnonKey: ' demo-anon-key ',
  });

  assert.deepEqual(supabase.getSupabaseConfig(), {
    url: 'https://demo.supabase.co',
    anonKey: 'demo-anon-key',
  });
  assert.equal(supabase.hasSupabaseEnv, true);
  assert.equal(typeof supabase.supabaseClient.from, 'function');
  assert.equal(typeof supabase.requireSupabaseClient().from, 'function');
  assert.equal(supabase.getSupabaseClient(), supabase.requireSupabaseClient());
});

test('requireSupabaseClient gives a clear error when env is missing', async () => {
  const supabase = await loadSupabaseModule({});

  assert.deepEqual(supabase.getSupabaseConfig(), {
    url: '',
    anonKey: '',
  });
  assert.equal(supabase.hasSupabaseEnv, false);
  assert.equal(supabase.supabaseClient, null);
  assert.throws(
    () => supabase.requireSupabaseClient(),
    /未配置 Supabase 客户端环境变量/
  );
});

test('createSupabaseFetch adapts Taro.request to a fetch-like response', async () => {
  let capturedRequest: Record<string, unknown> | null = null;
  const supabase = await loadSupabaseModule({});

  const fetch = supabase.createSupabaseFetch(async (options: Record<string, unknown>) => {
    capturedRequest = options;

    return {
      statusCode: 201,
      data: {
        id: 'bean-1',
      },
      header: {
        'content-range': '0-0/1',
        'content-type': 'application/json',
      },
    };
  });
  const response = await fetch('https://demo.supabase.co/rest/v1/beans', {
    method: 'POST',
    headers: {
      apikey: 'demo-anon-key',
      Authorization: 'Bearer demo-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Test Bean' }),
  });

  assert.deepEqual(capturedRequest, {
    url: 'https://demo.supabase.co/rest/v1/beans',
    method: 'POST',
    header: {
      apikey: 'demo-anon-key',
      authorization: 'Bearer demo-token',
      'content-type': 'application/json',
    },
    data: JSON.stringify({ name: 'Test Bean' }),
  });
  assert.equal(response.ok, true);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('content-range'), '0-0/1');
  assert.deepEqual(await response.json(), {
    id: 'bean-1',
  });
});

test('createMiniProgramSupabaseClient uses postgrest client without realtime setup', async () => {
  await loadSupabaseModule({});
  const client = await loadSupabaseModule({
    supabaseUrl: 'https://demo.supabase.co',
    supabaseAnonKey: 'demo-anon-key',
  });

  assert.equal(typeof client.requireSupabaseClient().from, 'function');
  assert.equal(typeof client.requireSupabaseClient().channel, 'undefined');
});

test('configured supabase module does not touch Taro.request until client access time', async () => {
  const runtimeEnv = globalThis as Record<string, unknown>;
  const previousUrl = runtimeEnv.__TARO_APP_SUPABASE_URL__;
  const previousAnonKey = runtimeEnv.__TARO_APP_SUPABASE_ANON_KEY__;

  runtimeEnv.__TARO_APP_SUPABASE_URL__ = 'https://demo.supabase.co';
  runtimeEnv.__TARO_APP_SUPABASE_ANON_KEY__ = 'demo-anon-key';

  const require = createRequire(import.meta.url);
  const taroPath = require.resolve('@tarojs/taro');

  require.cache[taroPath] = {
    id: taroPath,
    filename: taroPath,
    loaded: true,
    exports: {},
    children: [],
    path: taroPath,
    paths: [],
  };

  importId += 1;

  try {
    const supabase = await import(`../src/utils/supabase.ts?case=${importId}`);
    assert.equal(supabase.hasSupabaseEnv, true);
    assert.equal(typeof supabase.getSupabaseClient, 'function');
    assert.equal(typeof supabase.requireSupabaseClient().from, 'function');
  } finally {
    if (typeof previousUrl === 'string') {
      runtimeEnv.__TARO_APP_SUPABASE_URL__ = previousUrl;
    } else {
      delete runtimeEnv.__TARO_APP_SUPABASE_URL__;
    }

    if (typeof previousAnonKey === 'string') {
      runtimeEnv.__TARO_APP_SUPABASE_ANON_KEY__ = previousAnonKey;
    } else {
      delete runtimeEnv.__TARO_APP_SUPABASE_ANON_KEY__;
    }
  }
});
