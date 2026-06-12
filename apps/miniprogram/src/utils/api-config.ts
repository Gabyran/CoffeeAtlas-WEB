import {
  getApiBaseUrlHostname,
  getApiBaseUrlValidationError,
  isPrivateIpv4,
  normalizeApiBaseUrl,
} from './api-base-url.ts';
import { getCompiledEnv } from './compiled-env.ts';
import { getStorageSync, removeStorageSync, setStorageSync } from './miniprogram-api.ts';

const API_BASE_URL_OVERRIDE_KEY = 'api_base_url_override';

export interface ApiBaseUrlState {
  baseUrl: string;
  source: 'runtime' | 'build';
  mode: 'unset' | 'local' | 'cloud';
  warning: string | null;
}

export interface ResolveApiBaseUrlStateInput {
  runtimeBaseUrl?: string | null;
  buildBaseUrl?: string | null;
}

function getMode(baseUrl: string): ApiBaseUrlState['mode'] {
  if (!baseUrl) return 'unset';

  const hostname = getApiBaseUrlHostname(baseUrl);
  if (
    /^http:\/\//i.test(baseUrl) ||
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    isPrivateIpv4(hostname)
  ) {
    return 'local';
  }

  return 'cloud';
}

function getWarning(baseUrl: string): string | null {
  if (!baseUrl) {
    return '未配置 API 地址，可在这里填入云端 HTTPS 域名。';
  }

  const validationError = getApiBaseUrlValidationError(baseUrl);
  if (validationError) {
    return validationError;
  }

  const hostname = getApiBaseUrlHostname(baseUrl);
  if (hostname === 'localhost' || hostname.endsWith('.local') || isPrivateIpv4(hostname)) {
    return '当前仍是本地或局域网地址，切到云端联调时请改成 HTTPS 域名。';
  }

  if (/^http:\/\//i.test(baseUrl)) {
    return '微信云端联调建议使用 HTTPS 域名。';
  }

  return null;
}

export function resolveApiBaseUrlState({
  runtimeBaseUrl,
  buildBaseUrl,
}: ResolveApiBaseUrlStateInput): ApiBaseUrlState {
  const normalizedRuntimeBaseUrl = normalizeApiBaseUrl(runtimeBaseUrl);
  const normalizedBuildBaseUrl = normalizeApiBaseUrl(buildBaseUrl);
  const runtimeValidationError = normalizedRuntimeBaseUrl
    ? getApiBaseUrlValidationError(normalizedRuntimeBaseUrl)
    : null;
  const useRuntimeBaseUrl = Boolean(normalizedRuntimeBaseUrl) && !runtimeValidationError;
  const selectedBaseUrl = useRuntimeBaseUrl ? normalizedRuntimeBaseUrl : normalizedBuildBaseUrl;

  return {
    baseUrl: selectedBaseUrl,
    source: useRuntimeBaseUrl ? 'runtime' : 'build',
    mode: getMode(selectedBaseUrl),
    warning: runtimeValidationError
      ? `${runtimeValidationError} 已自动回退到编译配置。`
      : getWarning(selectedBaseUrl),
  };
}

export function getApiBaseUrlState(): ApiBaseUrlState {
  const runtimeBaseUrl = normalizeApiBaseUrl(getStorageSync<string>(API_BASE_URL_OVERRIDE_KEY));
  const buildBaseUrl = normalizeApiBaseUrl(getCompiledEnv('TARO_APP_API_URL'));
  return resolveApiBaseUrlState({
    runtimeBaseUrl,
    buildBaseUrl,
  });
}

export function setApiBaseUrlOverride(url: string): ApiBaseUrlState {
  const normalized = normalizeApiBaseUrl(url);
  const validationError = getApiBaseUrlValidationError(normalized);

  if (validationError) {
    throw new Error(validationError);
  }

  if (!normalized) {
    removeStorageSync(API_BASE_URL_OVERRIDE_KEY);
  } else {
    setStorageSync(API_BASE_URL_OVERRIDE_KEY, normalized);
  }

  return getApiBaseUrlState();
}

export function clearApiBaseUrlOverride(): ApiBaseUrlState {
  removeStorageSync(API_BASE_URL_OVERRIDE_KEY);
  return getApiBaseUrlState();
}
