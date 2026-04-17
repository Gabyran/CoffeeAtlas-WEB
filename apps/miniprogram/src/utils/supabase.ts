import { PostgrestClient } from '@supabase/postgrest-js';
import { getCompiledEnv } from './compiled-env.ts';
import { request as miniProgramRequest } from './miniprogram-api.ts';

type RequestLike = typeof miniProgramRequest;
type HeaderRecord = Record<string, string>;
class MiniProgramHeaders {
  private readonly values = new Map<string, string>();

  constructor(init?: HeadersInit | MiniProgramHeaders | HeaderRecord) {
    if (!init) {
      return;
    }

    if (init instanceof MiniProgramHeaders) {
      init.forEach((value, key) => {
        this.set(key, value);
      });
      return;
    }

    if (typeof globalThis.Headers !== 'undefined' && init instanceof globalThis.Headers) {
      init.forEach((value, key) => {
        this.set(key, value);
      });
      return;
    }

    if (Array.isArray(init)) {
      init.forEach(([key, value]) => {
        this.set(key, value);
      });
      return;
    }

    Object.entries(init).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  append(key: string, value: string) {
    const normalizedKey = normalizeHeaderKey(key);
    const nextValue = this.values.get(normalizedKey);
    this.values.set(normalizedKey, nextValue ? `${nextValue}, ${value}` : value);
  }

  delete(key: string) {
    this.values.delete(normalizeHeaderKey(key));
  }

  get(key: string): string | null {
    return this.values.get(normalizeHeaderKey(key)) ?? null;
  }

  has(key: string): boolean {
    return this.values.has(normalizeHeaderKey(key));
  }

  set(key: string, value: string) {
    this.values.set(normalizeHeaderKey(key), String(value));
  }

  forEach(callback: (value: string, key: string) => void) {
    this.values.forEach((value, key) => {
      callback(value, key);
    });
  }

  entries(): IterableIterator<[string, string]> {
    return this.values.entries();
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }
}

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase();
}

const supabaseUrl = getCompiledEnv('TARO_APP_SUPABASE_URL');
const supabaseAnonKey = getCompiledEnv('TARO_APP_SUPABASE_ANON_KEY');

function ensureHeadersPolyfill() {
  if (typeof globalThis.Headers === 'undefined') {
    (globalThis as unknown as { Headers?: typeof Headers }).Headers =
      MiniProgramHeaders as unknown as typeof Headers;
  }
}

function toHeaderRecord(headers?: HeadersInit | MiniProgramHeaders): HeaderRecord {
  const normalizedHeaders = new MiniProgramHeaders(headers);
  const record: HeaderRecord = {};

  normalizedHeaders.forEach((value, key) => {
    record[key] = value;
  });

  return record;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string' || input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (typeof init?.method === 'string' && init.method.length > 0) {
    return init.method;
  }

  if (typeof input !== 'string' && !(input instanceof URL) && typeof input.method === 'string' && input.method.length > 0) {
    return input.method;
  }

  return 'GET';
}

function getRequestHeaders(input: RequestInfo | URL, init?: RequestInit): HeaderRecord {
  if (init?.headers) {
    return toHeaderRecord(init.headers);
  }

  if (typeof input === 'string' || input instanceof URL) {
    return {};
  }

  return toHeaderRecord(input.headers);
}

function getRequestBody(input: RequestInfo | URL, init?: RequestInit): BodyInit | null | undefined {
  if (typeof init?.body !== 'undefined') {
    return init.body;
  }

  if (typeof input === 'string' || input instanceof URL) {
    return undefined;
  }

  return input.body;
}

function getResponseText(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }

  if (typeof data === 'undefined') {
    return '';
  }

  return JSON.stringify(data);
}

function createFetchResponse({
  data,
  header,
  statusCode,
}: {
  data: unknown;
  header: unknown;
  statusCode: number;
}): Response {
  const headerRecord =
    typeof header === 'object' && header !== null ? toHeaderRecord(header as HeaderRecord) : {};

  if (typeof globalThis.Response !== 'undefined') {
    return new globalThis.Response(getResponseText(data), {
      status: statusCode,
      headers: headerRecord,
    });
  }

  const headers = new MiniProgramHeaders(headerRecord);

  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    statusText: String(statusCode),
    headers: headers as unknown as Headers,
    redirected: false,
    type: 'basic',
    url: '',
    clone() {
      return createFetchResponse({ data, header, statusCode });
    },
    async arrayBuffer() {
      const text = getResponseText(data);
      return new TextEncoder().encode(text).buffer;
    },
    async blob() {
      return new Blob([getResponseText(data)]);
    },
    async formData() {
      throw new Error('Supabase miniprogram fetch adapter does not support formData()');
    },
    async json() {
      return typeof data === 'string' ? JSON.parse(data) : data;
    },
    async text() {
      return getResponseText(data);
    },
    body: null,
    bodyUsed: false,
  } as unknown as Response;
}

export function getSupabaseConfig() {
  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  };
}

export const hasSupabaseEnv = Boolean(getSupabaseConfig().url && getSupabaseConfig().anonKey);

export function createSupabaseFetch(requestImpl: RequestLike = miniProgramRequest): typeof fetch {
  ensureHeadersPolyfill();

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await requestImpl({
      url: getRequestUrl(input),
      method: getRequestMethod(input, init),
      header: getRequestHeaders(input, init),
      data: getRequestBody(input, init),
    } as any);

    return createFetchResponse({
      data: response.data,
      header: response.header,
      statusCode: typeof response.statusCode === 'number' ? response.statusCode : 200,
    });
  }) as typeof fetch;
}

export type MiniProgramSupabaseClient = PostgrestClient;

let cachedSupabaseClient: MiniProgramSupabaseClient | null | undefined;

export function createMiniProgramSupabaseClient(): MiniProgramSupabaseClient {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error('未配置 Supabase 客户端环境变量：请提供 TARO_APP_SUPABASE_URL 和 TARO_APP_SUPABASE_ANON_KEY。');
  }

  ensureHeadersPolyfill();

  return new PostgrestClient(`${url}/rest/v1`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'X-Client-Info': 'coffeeatlas-miniprogram',
    },
    fetch: createSupabaseFetch(),
  });
}

export function getSupabaseClient(): MiniProgramSupabaseClient | null {
  if (!hasSupabaseEnv) {
    return null;
  }

  if (typeof cachedSupabaseClient === 'undefined') {
    cachedSupabaseClient = createMiniProgramSupabaseClient();
  }

  return cachedSupabaseClient;
}

export const supabaseClient = hasSupabaseEnv
  ? new Proxy({} as MiniProgramSupabaseClient, {
      get(_target, key, receiver) {
        const client = getSupabaseClient();
        return Reflect.get(client as MiniProgramSupabaseClient, key, receiver);
      },
    })
  : null;

export function requireSupabaseClient(): MiniProgramSupabaseClient {
  const client = getSupabaseClient();

  if (!client) {
    throw new Error('未配置 Supabase 客户端环境变量：请提供 TARO_APP_SUPABASE_URL 和 TARO_APP_SUPABASE_ANON_KEY。');
  }

  return client;
}
