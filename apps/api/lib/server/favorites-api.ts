import type { UserFavorite } from '@coffee-atlas/shared-types';

import { getCatalogBeansByIds, getRoastersByIds } from '@/lib/catalog';
import { buildAppUserUpsertRow } from './app-user-upsert.ts';
import { execute, queryRow, queryRows } from './database.ts';
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
  const row = buildAppUserUpsertRow(params);
  const user = await queryRow<AppUser>(
    `insert into public.app_users (
       wechat_openid,
       wechat_unionid,
       nickname,
       avatar_url,
       last_login_at
     )
     values ($1, $2, $3, $4, $5)
     on conflict (wechat_openid) do update set
       wechat_unionid = coalesce(excluded.wechat_unionid, public.app_users.wechat_unionid),
       nickname = coalesce(excluded.nickname, public.app_users.nickname),
       avatar_url = coalesce(excluded.avatar_url, public.app_users.avatar_url),
       last_login_at = excluded.last_login_at
     returning id, wechat_openid, wechat_unionid, nickname, avatar_url, last_login_at, created_at, updated_at`,
    [
      row.wechat_openid,
      row.wechat_unionid ?? null,
      row.nickname ?? null,
      row.avatar_url ?? null,
      row.last_login_at,
    ]
  );

  if (!user) {
    throw new Error('failed_to_upsert_app_user');
  }
  return user;
}

export async function getFavorites(userId: string): Promise<UserFavorite[]> {
  const rows = await queryRows<UserFavoriteRow>(
    `select id, user_id, target_type, target_id, created_at
     from public.user_favorites
     where user_id = $1
     order by created_at desc`,
    [userId]
  );
  return hydrateFavorites(rows);
}

export async function addFavorite(
  userId: string,
  targetType: 'bean' | 'roaster',
  targetId: string
): Promise<UserFavorite> {
  const favorite = await queryRow<UserFavoriteRow>(
    `insert into public.user_favorites (
       user_id,
       target_type,
       target_id
     )
     values ($1, $2, $3)
     on conflict (user_id, target_type, target_id) do update set
       updated_at = now()
     returning id, user_id, target_type, target_id, created_at`,
    [userId, targetType, targetId]
  );

  if (!favorite) throw new Error('failed_to_add_favorite');
  const [hydrated] = await hydrateFavorites([favorite]);
  return hydrated;
}

export async function removeFavorite(
  userId: string,
  targetType: 'bean' | 'roaster',
  targetId: string
): Promise<void> {
  await execute(
    `delete from public.user_favorites
     where user_id = $1 and target_type = $2 and target_id = $3`,
    [userId, targetType, targetId]
  );
}

export async function syncFavorites(
  userId: string,
  items: Array<{ targetType: 'bean' | 'roaster'; targetId: string }>
): Promise<UserFavorite[]> {
  if (items.length === 0) return getFavorites(userId);

  const values: unknown[] = [];
  const placeholders = items.map((item, index) => {
    const base = index * 3;
    values.push(userId, item.targetType, item.targetId);
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  });

  await execute(
    `insert into public.user_favorites (user_id, target_type, target_id)
     values ${placeholders.join(', ')}
     on conflict (user_id, target_type, target_id) do update set
       updated_at = now()`,
    values
  );
  return getFavorites(userId);
}
