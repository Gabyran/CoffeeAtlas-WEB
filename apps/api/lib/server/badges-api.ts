import { badRequest } from './api-primitives.ts';
import { queryRows, withTransaction } from './database.ts';

interface UserBadgeProgressRow {
  badge_id: string;
}

export function normalizeBadgeIds(badgeIds: unknown): string[] {
  if (!Array.isArray(badgeIds)) {
    badRequest('badgeIds must be an array');
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const badgeId of badgeIds) {
    if (typeof badgeId !== 'string') {
      badRequest('badgeIds must contain only strings');
    }

    const trimmed = badgeId.trim();
    if (!trimmed) {
      badRequest('badgeIds must contain only non-empty strings');
    }

    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export async function getBadgeIds(userId: string): Promise<string[]> {
  const rows = await queryRows<UserBadgeProgressRow>(
    `select badge_id
     from public.user_badge_progress
     where user_id = $1
     order by unlocked_at asc, badge_id asc`,
    [userId]
  );

  return rows.map((row) => row.badge_id);
}

export async function syncBadgeIds(userId: string, badgeIds: string[]): Promise<number> {
  if (badgeIds.length === 0) return 0;

  const now = new Date().toISOString();
  const values: unknown[] = [];
  const placeholders = badgeIds.map((badgeId, index) => {
    const base = index * 3;
    values.push(userId, badgeId, now);
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  });

  await withTransaction(async (client) => {
    await client.query(
      `insert into public.user_badge_progress (user_id, badge_id, unlocked_at)
       values ${placeholders.join(', ')}
       on conflict (user_id, badge_id) do nothing`,
      values
    );
  });

  return badgeIds.length;
}
