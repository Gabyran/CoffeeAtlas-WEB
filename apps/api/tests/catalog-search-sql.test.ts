import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const BASELINE_SQL = '../db/sql/040_views_and_functions.sql';
const SETUP_SQL = '../db/setup.sql';
const MIGRATION_SQL = '../db/migrations/005_search_catalog_matches_helper.sql';
const CATALOG_ACTIVE_RUNTIME_FIELDS_MIGRATION_SQL = '../db/migrations/007_catalog_active_runtime_fields.sql';
const SQL_PATHS = [BASELINE_SQL, SETUP_SQL, MIGRATION_SQL] as const;

function loadSql(relativePath: string): string {
  const fullPath = new URL(relativePath, import.meta.url);
  assert.ok(existsSync(fullPath), `SQL file not found: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

function extractFunctionBlock(sql: string, functionName: string): string {
  const escaped = functionName.replace('.', '\\.');
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+${escaped}\\s*\\([\\s\\S]*?\\)\\s*returns[\\s\\S]*?(\\$[a-zA-Z0-9_]*\\$)[\\s\\S]*?\\1\\s*;`,
    'i'
  );
  const match = sql.match(pattern);
  assert.ok(match, `Missing function definition: ${functionName}`);
  return match[0];
}

function extractFunctionParts(sql: string, functionName: string): {
  args: string;
  returnsClause: string;
  body: string;
} {
  const block = extractFunctionBlock(sql, functionName);
  const escaped = functionName.replace('.', '\\.');
  const argsAndReturnsPattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+${escaped}\\s*\\((?<args>[\\s\\S]*?)\\)\\s*returns\\s+(?<returnsClause>[\\s\\S]*?)(?=\\s+language\\b|\\s+as\\s+\\$[a-zA-Z0-9_]*\\$)`,
    'i'
  );
  const argsAndReturnsMatch = block.match(argsAndReturnsPattern);
  assert.ok(argsAndReturnsMatch?.groups, `Missing function signature details: ${functionName}`);

  const bodyPattern = /as\s+(\$[a-zA-Z0-9_]*\$)([\s\S]*?)\1/i;
  const bodyMatch = block.match(bodyPattern);
  assert.ok(bodyMatch, `Missing dollar-quoted body: ${functionName}`);

  return {
    args: argsAndReturnsMatch.groups.args,
    returnsClause: argsAndReturnsMatch.groups.returnsClause,
    body: bodyMatch[2],
  };
}

function normalizeSqlFragment(input: string): string {
  return input
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractViewBlock(sql: string, viewName: string): string {
  const escaped = viewName.replace('.', '\\.');
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+view\\s+${escaped}\\s+as\\s+select[\\s\\S]*?;`,
    'i'
  );
  const match = sql.match(pattern);
  assert.ok(match, `Missing view definition: ${viewName}`);
  return match[0];
}

function assertCatalogActiveRuntimeFields(relativePath: string): void {
  const viewBlock = extractViewBlock(loadSql(relativePath), 'public.v_catalog_active');
  const normalizedView = normalizeSqlFragment(viewBlock);

  assert.match(normalizedView, /\bb\.farm\b/, `${relativePath} must expose v_catalog_active.farm`);
  assert.match(normalizedView, /\bb\.producer\b/, `${relativePath} must expose v_catalog_active.producer`);
  assert.match(normalizedView, /\brb\.sales_count\b/, `${relativePath} must expose v_catalog_active.sales_count`);
}

function assertCatalogActiveRuntimeFieldsMigration(relativePath: string): void {
  const normalizedSql = normalizeSqlFragment(loadSql(relativePath));

  assert.match(normalizedSql, /\('farm',\s*'b\.farm'\)/, `${relativePath} must map v_catalog_active.farm`);
  assert.match(normalizedSql, /\('producer',\s*'b\.producer'\)/, `${relativePath} must map v_catalog_active.producer`);
  assert.match(normalizedSql, /\('sales_count',\s*'rb\.sales_count'\)/, `${relativePath} must map v_catalog_active.sales_count`);
  assert.match(
    normalizedSql,
    /column_expr\.column_name\s+in\s+\('farm',\s*'producer',\s*'sales_count'\)/,
    `${relativePath} must append missing runtime fields to existing views`
  );
}

function assertDelegatesToMatchesHelper(block: string, functionName: string): void {
  const normalizedBlock = normalizeSqlFragment(block);

  assert.match(
    normalizedBlock,
    /from\s+public\.search_catalog_matches\s*\(/i,
    `${functionName} must delegate to public.search_catalog_matches(...)`
  );

  const publicSourceMatches =
    normalizedBlock.match(
      /\b(?:from|join|left\s+join|right\s+join|inner\s+join|cross\s+join)\s+public\.[a-z_][a-z0-9_]*\b|,\s*public\.[a-z_][a-z0-9_]*\b/gi
    ) ??
    [];
  assert.equal(
    publicSourceMatches.length,
    1,
    `${functionName} must read from exactly one public source (the shared helper only)`
  );
  assert.match(
    publicSourceMatches[0] ?? '',
    /(?:\b(?:from|join|left\s+join|right\s+join|inner\s+join|cross\s+join)\s+|,\s*)public\.search_catalog_matches\b/i,
    `${functionName} must not read from other public tables/views/functions`
  );

  assert.doesNotMatch(
    normalizedBlock,
    /\bif\s+q\s*=\s*''\s+then\b/i,
    `${functionName} must not keep an empty-query branch outside helper`
  );
  assert.doesNotMatch(
    normalizedBlock,
    /\bunion(\s+all)?\b/i,
    `${functionName} must not branch via UNION/UNION ALL`
  );
}

function assertSearchSqlStructure(relativePath: string): void {
  const sql = loadSql(relativePath);

  assert.match(
    sql,
    /create\s+or\s+replace\s+function\s+public\.search_catalog_matches\s*\(/i,
    `${relativePath} must define public.search_catalog_matches(...)`
  );

  const searchCatalog = extractFunctionBlock(sql, 'public.search_catalog');
  assertDelegatesToMatchesHelper(searchCatalog, 'public.search_catalog');

  const searchCatalogCount = extractFunctionBlock(sql, 'public.search_catalog_count');
  assertDelegatesToMatchesHelper(searchCatalogCount, 'public.search_catalog_count');
}

function assertHelperDefinitionConsistent(): void {
  const helperPartsByPath = SQL_PATHS.map((path) => {
    const sql = loadSql(path);
    const parts = extractFunctionParts(sql, 'public.search_catalog_matches');
    return { path, parts };
  });

  const baseline = helperPartsByPath[0];

  for (const candidate of helperPartsByPath.slice(1)) {
    assert.equal(
      normalizeSqlFragment(candidate.parts.args),
      normalizeSqlFragment(baseline.parts.args),
      `search_catalog_matches args drifted: ${candidate.path} vs ${baseline.path}`
    );
    assert.equal(
      normalizeSqlFragment(candidate.parts.returnsClause),
      normalizeSqlFragment(baseline.parts.returnsClause),
      `search_catalog_matches returns clause drifted: ${candidate.path} vs ${baseline.path}`
    );
    assert.equal(
      normalizeSqlFragment(candidate.parts.body),
      normalizeSqlFragment(baseline.parts.body),
      `search_catalog_matches function body drifted: ${candidate.path} vs ${baseline.path}`
    );
  }
}

test('search SQL structure guard: baseline SQL delegates to shared helper', () => {
  assertSearchSqlStructure(BASELINE_SQL);
});

test('search SQL structure guard: setup SQL delegates to shared helper', () => {
  assertSearchSqlStructure(SETUP_SQL);
});

test('search SQL structure guard: migration SQL defines shared helper and delegation', () => {
  assertSearchSqlStructure(MIGRATION_SQL);
});

test('search SQL structure guard: helper definition stays aligned across baseline/setup/migration', () => {
  assertHelperDefinitionConsistent();
});

test('catalog active view exposes fields used by API runtime sort and hydration', () => {
  assertCatalogActiveRuntimeFields(BASELINE_SQL);
  assertCatalogActiveRuntimeFields(SETUP_SQL);
  assertCatalogActiveRuntimeFieldsMigration(CATALOG_ACTIVE_RUNTIME_FIELDS_MIGRATION_SQL);
});
