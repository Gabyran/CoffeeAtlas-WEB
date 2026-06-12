import type { RoasterFeature } from '@coffee-atlas/shared-types';

import {
  RoasterAggregate,
  RoasterAggregateRow,
  RoasterRow,
  getSampleRoasters,
  mapRoaster,
  normalizeOptionalString,
  createCatalogError,
} from './catalog-core.ts';
import {
  buildCatalogIlikePattern,
  sanitizeCatalogSearchTerm,
} from './catalog-query.ts';
import { resolveRoasterQueryPlan } from './catalog-roaster-query.ts';
import { hasSupabaseServerEnv, requireSupabaseServer } from '@/lib/supabase';
import type { Roaster, RoastersQuery } from '@/lib/catalog-types';

function createEmptyRoasterAggregate(): RoasterAggregate {
  return {
    beanCount: 0,
    coverImageUrl: null,
    taobaoUrl: null,
    xiaohongshuUrl: null,
  };
}

function isTaobaoUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  return normalized.includes('taobao.com') || normalized.includes('tmall.com');
}

function isXiaohongshuUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  return normalized.includes('xiaohongshu.com') || normalized.includes('xhslink.com');
}

async function fetchRoasterAggregates(roasterIds: string[]): Promise<Map<string, RoasterAggregate>> {
  const supabaseServer = requireSupabaseServer();
  if (roasterIds.length === 0) return new Map();

  const { data, error } = await supabaseServer
    .from('roaster_beans')
    .select('roaster_id, image_url, product_url')
    .eq('status', 'ACTIVE')
    .order('updated_at', { ascending: false })
    .in('roaster_id', roasterIds);

  if (error) throw createCatalogError(`failed_to_load_roaster_aggregates:${error.message}`);

  const counts = new Map<string, RoasterAggregate>();
  for (const row of (data ?? []) as RoasterAggregateRow[]) {
    if (typeof row.roaster_id !== 'string' || row.roaster_id.length === 0) continue;
    const aggregate = counts.get(row.roaster_id) ?? createEmptyRoasterAggregate();
    aggregate.beanCount += 1;

    const imageUrl = normalizeOptionalString((row as RoasterAggregateRow).image_url);
    if (imageUrl && !aggregate.coverImageUrl) {
      aggregate.coverImageUrl = imageUrl;
    }

    const productUrl = normalizeOptionalString((row as RoasterAggregateRow).product_url);
    if (productUrl && !aggregate.taobaoUrl && isTaobaoUrl(productUrl)) {
      aggregate.taobaoUrl = productUrl;
    }
    if (productUrl && !aggregate.xiaohongshuUrl && isXiaohongshuUrl(productUrl)) {
      aggregate.xiaohongshuUrl = productUrl;
    }

    counts.set(row.roaster_id, aggregate);
  }
  return counts;
}

function matchesRoasterFeature(
  row: RoasterRow,
  aggregate: RoasterAggregate,
  feature?: RoasterFeature
): boolean {
  switch (feature) {
    case 'has_image':
      return Boolean(aggregate.coverImageUrl || normalizeOptionalString(row.logo_url));
    case 'has_beans':
      return aggregate.beanCount > 0;
    case 'taobao':
      return Boolean(aggregate.taobaoUrl);
    case 'xiaohongshu':
      return Boolean(aggregate.xiaohongshuUrl);
    default:
      return true;
  }
}

async function queryRoasterRows(filters: Pick<RoastersQuery, 'q' | 'city'>): Promise<RoasterRow[]> {
  const supabaseServer = requireSupabaseServer();
  const searchPattern = buildCatalogIlikePattern(filters.q);
  const cityPattern = buildCatalogIlikePattern(filters.city);
  let query = supabaseServer
    .from('roasters')
    .select('id, name, city, description, logo_url, website_url, instagram_handle')
    .eq('is_public', true)
    .order('name');

  if (searchPattern) {
    query = query.or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`);
  }
  if (cityPattern) {
    query = query.ilike('city', cityPattern);
  }

  const { data, error } = await query;
  if (error) throw createCatalogError(`failed_to_load_roaster_list:${error.message}`);
  return (data ?? []) as RoasterRow[];
}

async function queryPagedRoasterRows(
  filters: Pick<RoastersQuery, 'q' | 'city'>,
  paging: Pick<RoastersQuery, 'offset' | 'limit'>
): Promise<RoasterRow[]> {
  const supabaseServer = requireSupabaseServer();
  const searchPattern = buildCatalogIlikePattern(filters.q);
  const cityPattern = buildCatalogIlikePattern(filters.city);
  let query = supabaseServer
    .from('roasters')
    .select('id, name, city, description, logo_url, website_url, instagram_handle')
    .eq('is_public', true)
    .order('name')
    .range(paging.offset ?? 0, (paging.offset ?? 0) + (paging.limit ?? 0) - 1);

  if (searchPattern) {
    query = query.or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`);
  }
  if (cityPattern) {
    query = query.ilike('city', cityPattern);
  }

  const { data, error } = await query;
  if (error) throw createCatalogError(`failed_to_load_paged_roaster_list:${error.message}`);
  return (data ?? []) as RoasterRow[];
}

async function countRoasterRows(filters: Pick<RoastersQuery, 'q' | 'city'>): Promise<number> {
  const supabaseServer = requireSupabaseServer();
  const searchPattern = buildCatalogIlikePattern(filters.q);
  const cityPattern = buildCatalogIlikePattern(filters.city);
  let query = supabaseServer
    .from('roasters')
    .select('id', { count: 'exact', head: true })
    .eq('is_public', true);

  if (searchPattern) {
    query = query.or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`);
  }
  if (cityPattern) {
    query = query.ilike('city', cityPattern);
  }

  const { count, error } = await query;
  if (error) throw createCatalogError(`failed_to_count_roaster_list:${error.message}`);
  return count ?? 0;
}

async function resolveRoasterCollection(
  filters: Pick<RoastersQuery, 'q' | 'city' | 'feature'>
): Promise<{ rows: RoasterRow[]; aggregates: Map<string, RoasterAggregate> }> {
  const rows = await queryRoasterRows(filters);
  if (rows.length === 0) {
    return {
      rows: [],
      aggregates: new Map(),
    };
  }

  const aggregates = await fetchRoasterAggregates(rows.map((row) => row.id));
  const filteredRows = rows.filter((row) => {
    const aggregate = aggregates.get(row.id) ?? createEmptyRoasterAggregate();
    return matchesRoasterFeature(row, aggregate, filters.feature);
  });

  return {
    rows: filteredRows,
    aggregates,
  };
}

function matchesSampleRoaster(
  roaster: Roaster,
  filters: Pick<RoastersQuery, 'q' | 'city' | 'feature'>
): boolean {
  const normalizedQuery = sanitizeCatalogSearchTerm(filters.q)?.toLowerCase();
  if (normalizedQuery) {
    const searchable = [roaster.name, roaster.description ?? ''];
    if (!searchable.some((value) => value.toLowerCase().includes(normalizedQuery))) {
      return false;
    }
  }

  const normalizedCity = sanitizeCatalogSearchTerm(filters.city)?.toLowerCase();
  if (normalizedCity && !roaster.city.toLowerCase().includes(normalizedCity)) {
    return false;
  }

  switch (filters.feature) {
    case 'has_image':
      return Boolean(roaster.coverImageUrl || roaster.logoUrl);
    case 'has_beans':
      return roaster.beanCount > 0;
    case 'taobao':
      return Boolean(roaster.taobaoUrl);
    case 'xiaohongshu':
      return Boolean(roaster.xiaohongshuUrl);
    default:
      return true;
  }
}

function resolveSampleRoasters(
  filters: Pick<RoastersQuery, 'q' | 'city' | 'feature'>
): Roaster[] {
  return getSampleRoasters().filter((roaster) => matchesSampleRoaster(roaster, filters));
}

export async function getRoasterPage(
  options: RoastersQuery = {}
): Promise<{ items: Roaster[]; total: number }> {
  if (!hasSupabaseServerEnv) {
    const sampleRoasters = resolveSampleRoasters(options);
    const offset = options.offset ?? 0;
    const limit = options.limit;

    return {
      items:
        typeof limit === 'number'
          ? sampleRoasters.slice(offset, offset + limit)
          : sampleRoasters.slice(offset),
      total: sampleRoasters.length,
    };
  }

  const plan = resolveRoasterQueryPlan(options);
  if (plan.mode === 'collection') {
    const { rows, aggregates } = await resolveRoasterCollection(options);
    const pagedRows =
      typeof plan.limit === 'number'
        ? rows.slice(plan.offset, plan.offset + plan.limit)
        : rows.slice(plan.offset);

    return {
      items: pagedRows.map((row) => mapRoaster(row, aggregates.get(row.id) ?? createEmptyRoasterAggregate())),
      total: rows.length,
    };
  }

  const [rows, total] = await Promise.all([
    queryPagedRoasterRows(options, plan),
    countRoasterRows(options),
  ]);
  const aggregates = await fetchRoasterAggregates(rows.map((row) => row.id));

  return {
    items: rows.map((row) => mapRoaster(row, aggregates.get(row.id) ?? createEmptyRoasterAggregate())),
    total,
  };
}

export async function getRoasters(limit?: number): Promise<Roaster[]>;
export async function getRoasters(options?: RoastersQuery): Promise<Roaster[]>;
export async function getRoasters(limitOrOptions?: number | RoastersQuery): Promise<Roaster[]> {
  const options = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : (limitOrOptions ?? {});
  return (await getRoasterPage(options)).items;
}

export async function countRoasters(filters: Pick<RoastersQuery, 'q' | 'city' | 'feature'> = {}): Promise<number> {
  if (hasSupabaseServerEnv && resolveRoasterQueryPlan(filters).mode === 'paged') {
    return countRoasterRows(filters);
  }
  return (await getRoasterPage(filters)).total;
}

export async function getRoasterById(id: string): Promise<Roaster | null> {
  if (!hasSupabaseServerEnv) {
    return getSampleRoasters().find((roaster) => roaster.id === id) ?? null;
  }

  const supabaseServer = requireSupabaseServer();
  const { data, error } = await supabaseServer
    .from('roasters')
    .select('id, name, city, description, logo_url, website_url, instagram_handle')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle();

  if (error) throw createCatalogError(`failed_to_load_roaster:${error.message}`);
  if (!data) return null;

  const row = data as RoasterRow;
  const counts = await fetchRoasterAggregates([row.id]);
  return mapRoaster(row, counts.get(row.id) ?? createEmptyRoasterAggregate());
}

export async function getRoastersByIds(ids: string[]): Promise<Roaster[]> {
  if (ids.length === 0) return [];

  if (!hasSupabaseServerEnv) {
    const roasterMap = new Map(getSampleRoasters().map((roaster) => [roaster.id, roaster]));
    return ids.map((id) => roasterMap.get(id)).filter((roaster): roaster is Roaster => Boolean(roaster));
  }

  const supabaseServer = requireSupabaseServer();
  const { data, error } = await supabaseServer
    .from('roasters')
    .select('id, name, city, description, logo_url, website_url, instagram_handle')
    .eq('is_public', true)
    .in('id', ids);

  if (error) throw createCatalogError(`failed_to_load_roasters_by_ids:${error.message}`);
  const rows = (data ?? []) as RoasterRow[];
  if (rows.length === 0) return [];

  const counts = await fetchRoasterAggregates(rows.map((row) => row.id));
  const roasterMap = new Map(
    rows.map((row) => [row.id, mapRoaster(row, counts.get(row.id) ?? createEmptyRoasterAggregate())])
  );

  return ids.map((id) => roasterMap.get(id)).filter((roaster): roaster is Roaster => Boolean(roaster));
}
