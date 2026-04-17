import {
  extractApiErrorMessage,
  unwrapApiResponse,
} from '@coffee-atlas/api-client';
import type {
  ApiHealthStatus,
  BeanDetail,
  BeanDiscoverPayload,
  BeanDiscoverQueryParams,
  BeansQueryParams,
  CoffeeBean,
  CurrentUserProfile,
  LoginResponse,
  NewArrivalFiltersPayload,
  NewArrivalFiltersRequest,
  PaginatedResult,
  RoasterDetail,
  RoasterSummary,
  RoastersQueryParams,
  UserFavorite,
  V1Response,
} from '../types/index.ts';
import { getToken } from '../utils/storage.ts';
import { getApiBaseUrlState } from '../utils/api-config.ts';
import { getApiBaseUrlValidationError } from '../utils/api-base-url.ts';
import { buildApiRequestOptions } from '../utils/api-request.ts';
import { formatApiRequestErrorMessage } from '../utils/api-error.ts';
import { request as miniProgramRequest } from '../utils/miniprogram-api.ts';
import { hasSupabaseEnv, requireSupabaseClient } from '../utils/supabase.ts';
import { requireSupabaseCatalogRead } from './catalog-read-mode.ts';
import {
  getBeanDetailWithSupabase,
  getBeanDiscoverWithSupabase,
  getNewArrivalFiltersWithSupabase,
  getRoasterDetailWithSupabase,
  listBeansWithSupabase,
  listRoastersWithSupabase,
} from './catalog-supabase.ts';

function getErrorMessage(error: unknown): string {
  return formatApiRequestErrorMessage(error, {
    baseUrl: getApiBaseUrlState().baseUrl,
  });
}

export { getApiBaseUrlState } from '../utils/api-config.ts';

async function request<T>(
  endpoint: string,
  options?: Record<string, unknown>
): Promise<T> {
  const apiState = getApiBaseUrlState();
  const baseUrl = apiState.baseUrl;

  if (!baseUrl) {
    throw new Error('未配置 API 地址。可在“我的 > API 联调”里填写云端 HTTPS 域名。');
  }

  const validationError = getApiBaseUrlValidationError(baseUrl);
  if (validationError) {
    throw new Error(validationError);
  }

  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const requestOptions = buildApiRequestOptions({
      url: `${baseUrl}${endpoint}`,
      header: headers,
      options,
    });

    const res = await miniProgramRequest<V1Response<T> | { error?: string | { message?: string } }>({
      ...requestOptions,
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      return unwrapApiResponse<T>(res.data);
    }

    const message = extractApiErrorMessage(res.data);
    throw new Error(message || `请求失败: ${res.statusCode}`);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

// 咖啡豆
export async function getBeans(params?: BeansQueryParams): Promise<PaginatedResult<CoffeeBean>> {
  return listBeansWithSupabase(requireSupabaseCatalogRead(hasSupabaseEnv, requireSupabaseClient), params);
}

export async function getBeanDiscover(params?: BeanDiscoverQueryParams): Promise<BeanDiscoverPayload> {
  return getBeanDiscoverWithSupabase(requireSupabaseCatalogRead(hasSupabaseEnv, requireSupabaseClient), params);
}

export async function getNewArrivalFilters(payload: NewArrivalFiltersRequest): Promise<NewArrivalFiltersPayload> {
  return getNewArrivalFiltersWithSupabase(requireSupabaseCatalogRead(hasSupabaseEnv, requireSupabaseClient), payload);
}

export async function getBeanById(id: string): Promise<BeanDetail> {
  return getBeanDetailWithSupabase(requireSupabaseCatalogRead(hasSupabaseEnv, requireSupabaseClient), id);
}

// 烘焙商
export async function getRoasters(params?: RoastersQueryParams): Promise<PaginatedResult<RoasterSummary>> {
  return listRoastersWithSupabase(requireSupabaseCatalogRead(hasSupabaseEnv, requireSupabaseClient), params);
}

export async function getRoasterById(id: string): Promise<RoasterDetail> {
  return getRoasterDetailWithSupabase(requireSupabaseCatalogRead(hasSupabaseEnv, requireSupabaseClient), id);
}

export async function getBadgeProgress(): Promise<{ badgeIds: string[] }> {
  return request<{ badgeIds: string[] }>('/api/v1/me/badges');
}

export async function syncBadgeProgress(badgeIds: string[]): Promise<{ synced: number }> {
  return request<{ synced: number }>('/api/v1/me/badges/sync', {
    method: 'POST',
    data: { badgeIds },
  });
}

export async function getApiHealth(): Promise<ApiHealthStatus> {
  return request<ApiHealthStatus>('/api/v1/health');
}

export async function getMe(): Promise<CurrentUserProfile> {
  return request<CurrentUserProfile>('/api/v1/me');
}

// 认证
export async function wechatLogin(code: string, userInfo?: { nickname?: string; avatarUrl?: string }): Promise<LoginResponse> {
  return request<LoginResponse>('/api/v1/auth/wechat/login', {
    method: 'POST',
    data: { code, ...userInfo },
  });
}

// 收藏
export async function getFavorites(): Promise<UserFavorite[]> {
  return request<UserFavorite[]>('/api/v1/me/favorites');
}

export async function addFavorite(targetType: 'bean' | 'roaster', targetId: string): Promise<UserFavorite> {
  return request<UserFavorite>('/api/v1/me/favorites', {
    method: 'POST',
    data: { targetType, targetId },
  });
}

export async function removeFavorite(targetType: 'bean' | 'roaster', targetId: string): Promise<void> {
  await request<{ deleted: boolean }>(`/api/v1/me/favorites/${targetType}/${targetId}`, {
    method: 'DELETE',
  });
}

export async function syncFavorites(
  items: Array<{ targetType: 'bean' | 'roaster'; targetId: string }>
): Promise<UserFavorite[]> {
  return request<UserFavorite[]>('/api/v1/me/favorites/sync', {
    method: 'POST',
    data: { items },
  });
}
