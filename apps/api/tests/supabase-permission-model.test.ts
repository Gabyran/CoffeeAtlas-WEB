import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const apiRoot = path.resolve(import.meta.dirname, '..');

function readApiFile(relativePath: string): string {
  return readFileSync(path.join(apiRoot, relativePath), 'utf8');
}

test('server database access is driven by DATABASE_URL and keeps the legacy alias thin', () => {
  const source = readApiFile('lib/supabase.ts');

  assert.match(source, /DATABASE_URL/);
  assert.match(source, /export function requireSupabaseServer\(\)/);
  assert.match(source, /export function requireSupabaseServiceRoleServer\(\)/);
  assert.match(source, /createSqlBuilder/);
  assert.doesNotMatch(source, /supabaseServiceRoleKey|hasSupabaseServiceRoleEnv|supabaseServiceRoleServer/);
});

test('favorites and me routes use the database helper layer instead of Supabase clients', () => {
  const favoritesApi = readApiFile('lib/server/favorites-api.ts');
  const meRoute = readApiFile('app/api/v1/me/route.ts');

  assert.match(favoritesApi, /queryRow/);
  assert.match(favoritesApi, /queryRows/);
  assert.match(favoritesApi, /execute/);
  assert.doesNotMatch(favoritesApi, /requireSupabaseServer\(/);
  assert.doesNotMatch(favoritesApi, /requireSupabaseServiceRoleServer/);

  assert.match(meRoute, /queryRow/);
  assert.doesNotMatch(meRoute, /requireSupabaseServer\(/);
  assert.doesNotMatch(meRoute, /requireSupabaseServiceRoleServer/);
});
