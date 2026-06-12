import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import { HttpError } from './api-primitives.ts';

type DatabasePool = Pool;

const globalForDatabase = globalThis as unknown as {
  coffeeatlasDatabasePool?: DatabasePool;
};

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new HttpError(500, 'database_config_missing', 'DATABASE_URL is required');
  }
  return url;
}

function getPoolOptions(): ConstructorParameters<typeof Pool>[0] {
  const ssl = process.env.DATABASE_SSL?.trim();
  return {
    connectionString: getDatabaseUrl(),
    max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '5', 10) || 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl:
      ssl === 'true'
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
  };
}

export function hasDatabaseEnv(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getDatabasePool(): DatabasePool {
  if (!globalForDatabase.coffeeatlasDatabasePool) {
    globalForDatabase.coffeeatlasDatabasePool = new Pool(getPoolOptions());
  }

  return globalForDatabase.coffeeatlasDatabasePool;
}

export async function queryRows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = []
): Promise<T[]> {
  const { rows } = await getDatabasePool().query<T>(text, [...params]);
  return rows;
}

export async function queryRow<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = []
): Promise<T | null> {
  const rows = await queryRows<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params: readonly unknown[] = []): Promise<number> {
  const result = await getDatabasePool().query(text, [...params]);
  return result.rowCount ?? 0;
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function likePattern(value: string): string {
  return `%${escapeLike(value)}%`;
}

export function createSqlBuilder() {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const param = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  return {
    clauses,
    params,
    param,
    where(clause: string | null | undefined) {
      if (clause) clauses.push(clause);
    },
    whereEq(column: string, value: unknown) {
      if (value === undefined || value === null) return;
      clauses.push(`${column} = ${param(value)}`);
    },
    whereIlike(column: string, value: string | null | undefined) {
      if (!value) return;
      clauses.push(`${column} ILIKE ${param(likePattern(value))} ESCAPE '\\'`);
    },
    whereContains(column: string, value: string | null | undefined) {
      if (!value) return;
      clauses.push(`${column} ILIKE ${param(likePattern(value))} ESCAPE '\\'`);
    },
    whereIn(column: string, values: readonly unknown[] | null | undefined) {
      if (!values || values.length === 0) return;
      clauses.push(`${column}::text = ANY(${param(values)}::text[])`);
    },
    whereGte(column: string, value: unknown) {
      if (value === undefined || value === null) return;
      clauses.push(`${column} >= ${param(value)}`);
    },
    whereLt(column: string, value: unknown) {
      if (value === undefined || value === null) return;
      clauses.push(`${column} < ${param(value)}`);
    },
    buildWhere(): string {
      return clauses.length > 0 ? ` where ${clauses.join(' and ')}` : '';
    },
  };
}
