import { createClient } from '@supabase/supabase-js';

import { HttpError } from './server/api-primitives.ts';
import {
  createSqlBuilder,
  hasDatabaseEnv,
  likePattern,
  queryRow,
  queryRows,
} from './server/database.ts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseBrowserEnv = Boolean(supabaseUrl && supabaseAnonKey);
export const hasSupabaseServerEnv = true;

export const supabaseBrowser = hasSupabaseBrowserEnv
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export const supabaseServer = null;

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function splitTopLevelComma(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const char of input) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = '';
      continue;
    }
    current += char;
  }

  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

function normalizeSelectColumns(columns: string | undefined): string {
  const raw = (columns ?? '*').trim();
  if (!raw || raw === '*') return '*';

  const topLevelColumns = splitTopLevelComma(raw).filter((column) => !column.includes('(') && !column.includes(')'));
  return topLevelColumns.length > 0 ? topLevelColumns.map((column) => quoteIdentifier(column)).join(', ') : '*';
}

function parseOrExpression(expression: string): string {
  const clauses = splitTopLevelComma(expression).map((part) => {
    const segments = part.split('.');
    const operatorIndex = segments.findIndex((segment) => ['eq', 'ilike', 'gt', 'gte', 'lt', 'lte'].includes(segment));
    if (operatorIndex <= 0) {
      throw new HttpError(500, 'database_query_error', `Unsupported OR expression segment: ${part}`);
    }

    const column = segments.slice(0, operatorIndex).join('.');
    const operator = segments[operatorIndex];
    const value = segments.slice(operatorIndex + 1).join('.');

    switch (operator) {
      case 'eq':
        if (value === 'null') return `${quoteIdentifier(column)} is null`;
        return `${quoteIdentifier(column)}::text = ${value === 'true' || value === 'false' ? value : `'${value.replace(/'/g, "''")}'`}`;
      case 'ilike':
        return `${quoteIdentifier(column)}::text ilike '${value.replace(/'/g, "''")}' escape '\\'`;
      case 'gte':
        return `${quoteIdentifier(column)} >= '${value.replace(/'/g, "''")}'`;
      case 'gt':
        return `${quoteIdentifier(column)} > '${value.replace(/'/g, "''")}'`;
      case 'lt':
        return `${quoteIdentifier(column)} < '${value.replace(/'/g, "''")}'`;
      case 'lte':
        return `${quoteIdentifier(column)} <= '${value.replace(/'/g, "''")}'`;
      default:
        throw new HttpError(500, 'database_query_error', `Unsupported OR operator: ${operator}`);
    }
  });

  return `(${clauses.join(' or ')})`;
}

type QueryResult<T> = {
  data: T | T[] | null;
  error: Error | null;
  count?: number;
};

class RpcQuery {
  private readonly fnName: string;
  private readonly args: Record<string, unknown>;

  constructor(
    fnName: string,
    args: Record<string, unknown>
  ) {
    this.fnName = fnName;
    this.args = args;
  }

  async execute(): Promise<QueryResult<unknown>> {
    const entries = Object.entries(this.args);
    const placeholders = entries.map((_, index) => `$${index + 1}`);
    const params = entries.map(([, value]) => value);

    if (entries.length === 0) {
      const rows = await queryRows<Record<string, unknown>>(`select * from public.${this.fnName}()`);
      return {
        data: rows,
        error: null,
      };
    }

    const rows = await queryRows<Record<string, unknown>>(
      `select * from public.${this.fnName}(${placeholders.join(', ')})`,
      params
    );

    if (this.fnName === 'search_catalog_count') {
      const firstRow = rows[0] ?? null;
      const value = firstRow ? Number(firstRow[Object.keys(firstRow)[0] ?? ''] ?? 0) : 0;
      return {
        data: Number.isFinite(value) ? value : 0,
        error: null,
      };
    }

    return {
      data: rows,
      error: null,
    };
  }

  then<TResult1 = QueryResult<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class TableQuery {
  private action: 'select' | 'insert' | 'upsert' | 'update' | 'delete' | null = null;
  private selectColumns = '*';
  private head = false;
  private singleResult = false;
  private maybeSingleResult = false;
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private orderClauses: Array<{ column: string; ascending: boolean; nullsFirst?: boolean }> = [];
  private insertRows: Record<string, unknown>[] = [];
  private updateRow: Record<string, unknown> | null = null;
  private onConflict: string | null = null;
  private ignoreDuplicates = false;
  private readonly builder = createSqlBuilder();
  private readonly table: string;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }) {
    this.action = this.action ?? 'select';
    this.selectColumns = columns;
    this.head = Boolean(options?.head);
    return this;
  }

  eq(column: string, value: unknown) {
    this.builder.whereEq(column, value);
    return this;
  }

  ilike(column: string, value: string) {
    this.builder.where(`${quoteIdentifier(column)}::text ilike ${this.builder.param(likePattern(value))} escape '\\'`);
    return this;
  }

  or(expression: string) {
    this.builder.where(parseOrExpression(expression));
    return this;
  }

  in(column: string, values: readonly unknown[]) {
    this.builder.whereIn(column, values);
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === 'is' && value === null) {
      this.builder.where(`${quoteIdentifier(column)} is not null`);
      return this;
    }
    throw new HttpError(500, 'database_query_error', `Unsupported NOT expression: ${column}.${operator}.${String(value)}`);
  }

  gte(column: string, value: unknown) {
    this.builder.whereGte(column, value);
    return this;
  }

  lt(column: string, value: unknown) {
    this.builder.whereLt(column, value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderClauses.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  range(from: number, to: number) {
    this.offsetValue = from;
    this.limitValue = Math.max(0, to - from + 1);
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.action = 'insert';
    this.insertRows = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean }
  ) {
    this.action = 'upsert';
    this.insertRows = Array.isArray(values) ? values : [values];
    this.onConflict = options?.onConflict ?? null;
    this.ignoreDuplicates = Boolean(options?.ignoreDuplicates);
    return this;
  }

  update(values: Record<string, unknown>) {
    this.action = 'update';
    this.updateRow = values;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  maybeSingle() {
    this.maybeSingleResult = true;
    return this;
  }

  single() {
    this.singleResult = true;
    return this;
  }

  private buildWhere(): string {
    return this.builder.buildWhere();
  }

  private buildOrderBy(): string {
    if (this.orderClauses.length === 0) return '';

    const clauses = this.orderClauses.map((order) => {
      const direction = order.ascending ? 'asc' : 'desc';
      const nulls = typeof order.nullsFirst === 'boolean' ? ` nulls ${order.nullsFirst ? 'first' : 'last'}` : '';
      return `${quoteIdentifier(order.column)} ${direction}${nulls}`;
    });

    return ` order by ${clauses.join(', ')}`;
  }

  private buildSelectColumns(): string {
    return normalizeSelectColumns(this.selectColumns);
  }

  private buildSingleResult<T>(rows: T[]): QueryResult<T> {
    if (rows.length === 0) {
      if (this.maybeSingleResult) return { data: null, error: null };
      return { data: null, error: new Error('single result expected') };
    }

    if (rows.length > 1 && this.singleResult) {
      return { data: rows[0] ?? null, error: null };
    }

    return { data: rows[0] ?? null, error: null };
  }

  private buildMutationColumns(): string {
    return normalizeSelectColumns(this.selectColumns);
  }

  private buildInsertColumns(rows: Record<string, unknown>[]): string[] {
    const columns = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((key) => columns.add(key));
    }
    return [...columns];
  }

  async execute(): Promise<QueryResult<unknown>> {
    try {
      if (this.action === 'insert' || this.action === 'upsert') {
        return await this.executeInsertLike();
      }

      if (this.action === 'update') {
        return await this.executeUpdate();
      }

      if (this.action === 'delete') {
        return await this.executeDelete();
      }

      return await this.executeSelect();
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private async executeSelect(): Promise<QueryResult<unknown>> {
    const where = this.buildWhere();
    const orderBy = this.buildOrderBy();

    if (this.head) {
      const row = await queryRow<{ count: string | number }>(
        `select count(*)::int as count from public.${quoteIdentifier(this.table)}${where}`,
        this.builder.params
      );
      return {
        data: null,
        error: null,
        count: Number(row?.count ?? 0),
      };
    }

    let sql = `select ${this.buildSelectColumns()} from public.${quoteIdentifier(this.table)}${where}${orderBy}`;
    if (this.limitValue !== null) {
      sql += ` limit ${this.builder.param(this.limitValue)}`;
    }
    if (this.offsetValue !== null) {
      sql += ` offset ${this.builder.param(this.offsetValue)}`;
    }

    const rows = await queryRows<Record<string, unknown>>(sql, this.builder.params);
    const singleResult = this.singleResult || this.maybeSingleResult ? this.buildSingleResult(rows) : null;
    if (singleResult?.error) {
      return singleResult;
    }

    const data = singleResult ? singleResult.data : rows;

    return {
      data,
      error: null,
    };
  }

  private async executeInsertLike(): Promise<QueryResult<unknown>> {
    if (this.insertRows.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    const columns = this.buildInsertColumns(this.insertRows);
    const columnSql = columns.map(quoteIdentifier).join(', ');
    const valueSql = this.insertRows
      .map((row) => `(${columns.map((column) => this.builder.param(row[column] ?? null)).join(', ')})`)
      .join(', ');
    const returningSql = ` returning ${this.buildMutationColumns()}`;

    let sql = `insert into public.${quoteIdentifier(this.table)} (${columnSql}) values ${valueSql}`;

    if (this.action === 'upsert') {
      if (!this.onConflict) {
        throw new HttpError(500, 'database_query_error', 'upsert requires onConflict');
      }

      sql += ` on conflict (${this.onConflict})`;
      if (this.ignoreDuplicates) {
        sql += ' do nothing';
      } else {
        const conflictColumns = new Set(this.onConflict.split(',').map((column) => column.trim()));
        const updateColumns = columns.filter((column) => !conflictColumns.has(column));
        if (updateColumns.length === 0) {
          sql += ' do nothing';
        } else {
          sql +=
            ' do update set ' +
            updateColumns.map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`).join(', ');
        }
      }
    } else {
      sql += returningSql;
    }

    if (this.action === 'upsert') {
      sql += returningSql;
    }

    const rows = await queryRows<Record<string, unknown>>(sql, this.builder.params);
    const singleResult = this.singleResult || this.maybeSingleResult ? this.buildSingleResult(rows) : null;
    if (singleResult?.error) {
      return singleResult;
    }

    const data = singleResult ? singleResult.data : rows;
    return {
      data,
      error: null,
    };
  }

  private async executeUpdate(): Promise<QueryResult<unknown>> {
    if (!this.updateRow) {
      throw new HttpError(500, 'database_query_error', 'update requires values');
    }

    const assignments = Object.entries(this.updateRow).map(([column, value]) => {
      const placeholder = this.builder.param(value);
      return `${quoteIdentifier(column)} = ${placeholder}`;
    });

    const sql = `update public.${quoteIdentifier(this.table)} set ${assignments.join(', ')}${this.buildWhere()} returning ${this.buildMutationColumns()}`;
    const rows = await queryRows<Record<string, unknown>>(sql, this.builder.params);
    const singleResult = this.singleResult || this.maybeSingleResult ? this.buildSingleResult(rows) : null;
    if (singleResult?.error) {
      return singleResult;
    }

    const data = singleResult ? singleResult.data : rows;
    return {
      data,
      error: null,
    };
  }

  private async executeDelete(): Promise<QueryResult<unknown>> {
    const sql = `delete from public.${quoteIdentifier(this.table)}${this.buildWhere()} returning ${this.buildMutationColumns()}`;
    const rows = await queryRows<Record<string, unknown>>(sql, this.builder.params);
    return {
      data: rows,
      error: null,
    };
  }

  then<TResult1 = QueryResult<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

class DatabaseSupabaseClient {
  from(table: string) {
    return new TableQuery(table);
  }

  rpc(name: string, args: Record<string, unknown> = {}) {
    return new RpcQuery(name, args);
  }
}

let cachedServerClient: DatabaseSupabaseClient | null = null;

export function requireSupabaseServer() {
  if (!hasDatabaseEnv()) {
    throw new HttpError(
      500,
      'database_config_missing',
      'DATABASE_URL is required for server database access'
    );
  }

  if (!cachedServerClient) {
    cachedServerClient = new DatabaseSupabaseClient();
  }

  return cachedServerClient;
}

export function requireSupabaseServiceRoleServer() {
  return requireSupabaseServer();
}

export function requireSupabaseBrowser() {
  if (!supabaseBrowser) {
    throw new HttpError(
      500,
      'supabase_browser_config_missing',
      'Missing browser-side Supabase configuration'
    );
  }

  return supabaseBrowser;
}
