import type { UserFavorite } from '@coffee-atlas/shared-types';

import { getCatalogBeansByIds, getRoastersByIds } from '@/lib/catalog';
import { requireSupabaseServiceRoleServer } from '@/lib/supabase';
import { buildAppUserUpsertRow } from './app-user-upsert.ts';
import { mapBeanCard } from './public-beans.ts';
import { mapRoasterSummary } from './public-api.ts';

export interface AppUser {
  id: string;
  wechat_openid: string;
  wechat_unionid: string | null;
  nickname: string | null;
  avatar_url: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UserFavoriteRow {
  id: string;
  user_id: string;
  target_type: 'bean' | 'roaster';
  target_id: string;
  created_at: string;
}

async function hydrateFavorites(rows: UserFavoriteRow[]): Promise<UserFavorite[]> {
  const beanIds = rows
    .filter((row) => row.target_type === 'bean')
    .map((row) => row.target_id);
  const roasterIds = rows
    .filter((row) => row.target_type === 'roaster')
    .map((row) => row.target_id);

  const [beans, roasters] = await Promise.all([
    getCatalogBeansByIds(beanIds),
    getRoastersByIds(roasterIds),
  ]);

  const beanMap = new Map(beans.map((bean) => [bean.id, mapBeanCard(bean)]));
  const roasterMap = new Map(roasters.map((roaster) => [roaster.id, mapRoasterSummary(roaster)]));

  return rows.map((row) => {
    if (row.target_type === 'bean') {
      return {
        ...row,
        target_type: 'bean',
        bean: beanMap.get(row.target_id) ?? null,
      };
    }

    return {
      ...row,
      target_type: 'roaster',
      roaster: roasterMap.get(row.target_id) ?? null,
    };
  });
}

export async function upsertAppUser(params: {
  openid: string;
  unionid?: string;
  nickname?: string;
  avatarUrl?: string;
}): Promise<AppUser> {
  const db = requireSupabaseServiceRoleServer();
  const { data, error } = await db
    .from('app_users')
    .upsert(buildAppUserUpsertRow(params), { onConflict: 'wechat_openid' })
    .select()
    .single();

  if (error) throw error;
  return data as AppUser;
}

export async function getFavorites(userId: string): Promise<UserFavorite[]> {
  const db = requireSupabaseServiceRoleServer();
  const { data, error } = await db
    .from('user_favorites')
    .select('id, user_id, target_type, target_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return hydrateFavorites((data ?? []) as UserFavoriteRow[]);
}

export async function addFavorite(
  userId: string,
  targetType: 'bean' | 'roaster',
  targetId: string
): Promise<UserFavorite> {
  const db = requireSupabaseServiceRoleServer();
  const { data, error } = await db
    .from('user_favorites')
    .upsert(
      { user_id: userId, target_type: targetType, target_id: targetId },
      { onConflict: 'user_id,target_type,target_id' }
    )
    .select()
    .single();

  if (error) throw error;
  const [favorite] = await hydrateFavorites([data as UserFavoriteRow]);
  return favorite;
}

export async function removeFavorite(
  userId: string,
  targetType: 'bean' | 'roaster',
  targetId: string
): Promise<void> {
  const db = requireSupabaseServiceRoleServer();
  const { error } = await db
    .from('user_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId);

  if (error) throw error;
}

export async function syncFavorites(
  userId: string,
  items: Array<{ targetType: 'bean' | 'roaster'; targetId: string }>
): Promise<UserFavorite[]> {
  if (items.length === 0) return getFavorites(userId);

  const db = requireSupabaseServiceRoleServer();
  const rows = items.map((item) => ({
    user_id: userId,
    target_type: item.targetType,
    target_id: item.targetId,
  }));

  const { error } = await db
    .from('user_favorites')
    .upsert(rows, { onConflict: 'user_id,target_type,target_id' });

  if (error) throw error;
  return getFavorites(userId);
}
