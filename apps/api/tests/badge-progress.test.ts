import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { HttpError } from '../lib/server/api-primitives.ts';
import { normalizeBadgeIds } from '../lib/server/badges-api.ts';

const apiRoot = path.resolve(import.meta.dirname, '..');
const BASELINE_SQL = 'db/sql/010_schema.sql';
const SETUP_SQL = 'db/setup.sql';
const MIGRATION_SQL = 'db/manual/2026-04-15-add-user-badge-progress.sql';

function readApiFile(relativePath: string): string {
  return readFileSync(path.join(apiRoot, relativePath), 'utf8');
}

function extractTableBlock(sql: string): string {
  const match = sql.match(
    /create table if not exists public\.user_badge_progress\s*\([\s\S]*?\n\);/i
  );

  assert.ok(match, 'Missing user_badge_progress table definition');
  return match[0];
}

function assertBadgeProgressShape(relativePath: string, requireRls = false): string {
  const sql = readApiFile(relativePath);
  const tableBlock = extractTableBlock(sql);

  assert.match(tableBlock, /unique \(user_id, badge_id\)/i);
  assert.match(sql, /drop trigger if exists trg_user_badge_progress_updated_at on public\.user_badge_progress;/i);
  assert.match(sql, /create trigger trg_user_badge_progress_updated_at/i);
  assert.match(sql, /create index if not exists idx_user_badge_progress_user_unlocked/i);
  assert.match(sql, /create index if not exists idx_user_badge_progress_badge_id/i);

  if (requireRls) {
    assert.match(sql, /alter table public\.user_badge_progress enable row level security;/i);
  }

  return tableBlock;
}

test('normalizeBadgeIds trims values, deduplicates them, and rejects invalid payloads', () => {
  assert.deepEqual(normalizeBadgeIds(['alpha', ' alpha ', 'beta', 'beta']), ['alpha', 'beta']);

  assert.throws(() => normalizeBadgeIds('alpha' as unknown), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 400);
    return true;
  });

  assert.throws(() => normalizeBadgeIds(['alpha', ''] as unknown), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 400);
    return true;
  });
});

test('badge routes use requireUser and service-role backed badge storage', () => {
  const badgeRoute = readApiFile('app/api/v1/me/badges/route.ts');
  const badgeSyncRoute = readApiFile('app/api/v1/me/badges/sync/route.ts');
  const badgesApi = readApiFile('lib/server/badges-api.ts');

  assert.match(badgeRoute, /requireUser/);
  assert.match(badgeRoute, /apiSuccess/);
  assert.match(badgeSyncRoute, /requireUser/);
  assert.match(badgeSyncRoute, /apiSuccess/);
  assert.match(badgesApi, /queryRows/);
  assert.match(badgesApi, /execute/);
  assert.doesNotMatch(badgesApi, /requireSupabaseServer\(/);
  assert.doesNotMatch(badgesApi, /requireSupabaseServiceRoleServer/);
});

test('database schema defines user_badge_progress as a server-only table', () => {
  const baselineBlock = assertBadgeProgressShape(BASELINE_SQL);
  const setupBlock = assertBadgeProgressShape(SETUP_SQL, true);
  const migrationBlock = assertBadgeProgressShape(MIGRATION_SQL, true);

  assert.equal(setupBlock.replace(/\s+/g, ' ').trim(), baselineBlock.replace(/\s+/g, ' ').trim());
  assert.equal(
    migrationBlock.replace(/\s+/g, ' ').trim(),
    baselineBlock.replace(/\s+/g, ' ').trim()
  );
});
