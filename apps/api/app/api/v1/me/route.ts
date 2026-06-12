import { type NextRequest } from 'next/server';

import { apiError, apiSuccess, notFound } from '@/lib/server/api-helpers';
import { requireUser } from '@/lib/server/auth-user';
import { queryRow } from '@/lib/server/database';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const data = await queryRow<{
      id: string;
      nickname: string | null;
      avatar_url: string | null;
      created_at: string;
    }>(
      `select id, nickname, avatar_url, created_at
       from public.app_users
       where id = $1`,
      [user.id]
    );

    if (!data) {
      notFound('User not found', 'user_not_found');
    }

    return apiSuccess({
      id: data.id,
      nickname: data.nickname,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at,
    });
  } catch (err) {
    return apiError(err);
  }
}
