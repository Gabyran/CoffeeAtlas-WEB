import type {
  BeanDiscoverContinent,
  BeanSort,
  CatalogBeanCard,
  CatalogBeanDetail,
  PaginatedResult,
  ProcessBaseId,
  ProcessStyleId,
} from '@coffee-atlas/shared-types';
import type { CoffeeBean } from '../catalog';

import { ORIGIN_ATLAS_COUNTRIES_BY_CONTINENT, matchAtlasCountry } from '../geo-data.ts';
import { hasSupabaseServerEnv, requireSupabaseServer } from '../supabase.ts';

import { normalizeString, sanitizeSearchTerm } from './api-primitives.ts';

const LOCAL_FALLBACK_LIMIT = 500;
const DEFAULT_BEAN_SORT: BeanSort = 'updated_desc';

export interface BeanListFilters {
  q?: string;
  roasterId?: string;
  originCountry?: string;
  process?: string;
  processBase?: ProcessBaseId;
  processStyle?: ProcessStyleId;
  roastLevel?: string;
  sort?: BeanSort;
  isNewArrival?: boolean;
  continent?: BeanDiscoverContinent;
  country?: string;
}

interface CatalogViewIdRow {
  roaster_bean_id: string;
}

export function mapBeanCard(bean: CoffeeBean): CatalogBeanCard {
  return {
    id: bean.id,
    name: bean.name,
    roasterId: bean.roasterId,
    roasterName: bean.roasterName,
    city: bean.city,
    originCountry: bean.originCountry,
    process: bean.process,
    processBase: bean.processBase,
    processStyle: bean.processStyle,
    processRaw: bean.processRaw,
    roastLevel: bean.roastLevel,
    price: bean.price,
    currency: bean.currency,
    salesCount: bean.salesCount,
    imageUrl: bean.imageUrl,
    isInStock: bean.isInStock,
    originRegion: bean.originRegion,
    farm: bean.farm,
    variety: bean.variety,
    discountedPrice: bean.discountedPrice,
    tastingNotes: bean.tastingNotes,
    isNewArrival: bean.isNewArrival,
  };
}

export function mapBeanDetail(bean: CoffeeBean): CatalogBeanDetail {
  return {
    ...mapBeanCard(bean),
    originRegion: bean.originRegion,
    farm: bean.farm,
    variety: bean.variety,
    discountedPrice: bean.discountedPrice,
    tastingNotes: bean.tastingNotes,
    isNewArrival: bean.isNewArrival,
  };
}

export function normalizeBeanSort(value: BeanSort | undefined): BeanSort {
  return value ?? DEFAULT_BEAN_SORT;
}

export function sanitizeFilterToken(value: string): string {
  return value.replace(/[,%'()]/g, ' ').trim();
}

export function buildSearchConditions(query: string): string {
  const wildcard = `%${sanitizeFilterToken(query)}%`;
  return [
    `roaster_name.ilike.${wildcard}`,
    `bean_name.ilike.${wildcard}`,
    `display_name.ilike.${wildcard}`,
    `origin_country.ilike.${wildcard}`,
    `origin_region.ilike.${wildcard}`,
    `process_method.ilike.${wildcard}`,
    `variety.ilike.${wildcard}`,
  ].join(',');
}

function matchesLegacyProcess(bean: CoffeeBean, process: string): boolean {
  const lowered = process.toLowerCase();
  return [bean.process, bean.processRaw ?? ''].some((value) => value.toLowerCase().includes(lowered));
}

export function buildOriginConditions(values: string[]): string | null {
  const uniqueValues = Array.from(new Set(values.map(sanitizeFilterToken).filter((value) => value.length > 0)));
  if (uniqueValues.length === 0) return null;
  return uniqueValues.map((value) => `origin_country.ilike.%${value}%`).join(',');
}

function getCountryFilterCandidates(country: string | undefined): string[] {
  if (!country) return [];
  const atlasCountry = matchAtlasCountry(country);
  if (!atlasCountry) return [country];
  return [atlasCountry.name, atlasCountry.id, ...atlasCountry.aliases];
}

export function getContinentFilterCandidates(continent: BeanDiscoverContinent | undefined): string[] {
  if (!continent) return [];
  const countries = ORIGIN_ATLAS_COUNTRIES_BY_CONTINENT.get(continent) ?? [];
  return countries.flatMap((country) => [country.name, country.id, ...country.aliases]);
}

function getNewArrivalCutoff(): string {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

function applySortPlan<T extends { order: (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => T }>(
  query: T,
  sort: BeanSort
): T {
  switch (sort) {
    case 'sales_desc':
      return query
        .order('sales_count', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false });
    case 'price_asc':
      return query
        .order('price_amount', { ascending: true, nullsFirst: false })
        .order('updated_at', { ascending: false });
    case 'price_desc':
      return query
        .order('price_amount', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false });
    case 'updated_desc':
    default:
      return query.order('updated_at', { ascending: false });
  }
}

export async function queryBeanIdsFromView({
  q,
  roasterId,
  originCountry,
  process,
  processBase,
  processStyle,
  roastLevel,
  sort,
  isNewArrival,
  continent,
  country,
  limit,
  offset,
  latestNewArrivalBeanIds,
}: BeanListFilters & {
  limit: number;
  offset: number;
  latestNewArrivalBeanIds?: string[] | null;
}) {
  const supabaseServer = requireSupabaseServer();
  let query = supabaseServer
    .from('v_catalog_active')
    .select('roaster_bean_id')
    .range(offset, offset + limit - 1);

  query = applySortPlan(query, normalizeBeanSort(sort));

  if (q) query = query.or(buildSearchConditions(q));
  if (roasterId) query = query.eq('roaster_id', roasterId);
  if (originCountry) query = query.ilike('origin_country', `%${originCountry}%`);
  if (process) query = query.ilike('process_method', `%${process}%`);
  if (processBase) query = query.eq('process_base', processBase);
  if (processStyle) query = query.eq('process_style', processStyle);
  if (roastLevel) query = query.ilike('roast_level', `%${roastLevel}%`);

  const countryConditions = buildOriginConditions(getCountryFilterCandidates(country));
  if (countryConditions) query = query.or(countryConditions);

  const continentConditions = buildOriginConditions(getContinentFilterCandidates(continent));
  if (continentConditions) query = query.or(continentConditions);

  if (typeof isNewArrival === 'boolean') {
    if (isNewArrival && latestNewArrivalBeanIds) {
      if (latestNewArrivalBeanIds.length === 0) return [];
      query = query.in('roaster_bean_id', latestNewArrivalBeanIds);
    } else {
      const cutoff = getNewArrivalCutoff();
      query = isNewArrival ? query.gte('updated_at', cutoff) : query.lt('updated_at', cutoff);
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as CatalogViewIdRow[])
    .map((row) => (row as CatalogViewIdRow).roaster_bean_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export async function countBeanIdsFromView({
  q,
  roasterId,
  originCountry,
  process,
  processBase,
  processStyle,
  roastLevel,
  isNewArrival,
  continent,
  country,
  latestNewArrivalBeanIds,
}: BeanListFilters & {
  latestNewArrivalBeanIds?: string[] | null;
}) {
  const supabaseServer = requireSupabaseServer();
  let query = supabaseServer.from('v_catalog_active').select('roaster_bean_id', { count: 'exact', head: true });

  if (q) query = query.or(buildSearchConditions(q));
  if (roasterId) query = query.eq('roaster_id', roasterId);
  if (originCountry) query = query.ilike('origin_country', `%${originCountry}%`);
  if (process) query = query.ilike('process_method', `%${process}%`);
  if (processBase) query = query.eq('process_base', processBase);
  if (processStyle) query = query.eq('process_style', processStyle);
  if (roastLevel) query = query.ilike('roast_level', `%${roastLevel}%`);

  const countryConditions = buildOriginConditions(getCountryFilterCandidates(country));
  if (countryConditions) query = query.or(countryConditions);

  const continentConditions = buildOriginConditions(getContinentFilterCandidates(continent));
  if (continentConditions) query = query.or(continentConditions);

  if (typeof isNewArrival === 'boolean') {
    if (isNewArrival && latestNewArrivalBeanIds) {
      if (latestNewArrivalBeanIds.length === 0) return 0;
      query = query.in('roaster_bean_id', latestNewArrivalBeanIds);
    } else {
      const cutoff = getNewArrivalCutoff();
      query = isNewArrival ? query.gte('updated_at', cutoff) : query.lt('updated_at', cutoff);
    }
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export function matchesBeanFilters(
  bean: CoffeeBean,
  {
    q,
    roasterId,
    originCountry,
    process,
    processBase,
    processStyle,
    roastLevel,
    country,
    continent,
    isNewArrival,
  }: BeanListFilters
): boolean {
  if (q) {
    const lowered = q.toLowerCase();
    const searchableValues = [
      bean.name,
      bean.roasterName,
      bean.originCountry,
      bean.originRegion,
      bean.process,
      bean.variety,
      ...(bean.tastingNotes ?? []),
    ].filter((value): value is string => Boolean(value));

    if (!searchableValues.some((value) => value.toLowerCase().includes(lowered))) {
      return false;
    }
  }

  if (originCountry && !bean.originCountry.toLowerCase().includes(originCountry.toLowerCase())) {
    return false;
  }

  if (roasterId && bean.roasterId !== roasterId) {
    return false;
  }

  if (process && !matchesLegacyProcess(bean, process)) {
    return false;
  }

  if (processBase && bean.processBase !== processBase) {
    return false;
  }

  if (processStyle && bean.processStyle !== processStyle) {
    return false;
  }

  if (roastLevel && !bean.roastLevel.toLowerCase().includes(roastLevel.toLowerCase())) {
    return false;
  }

  const matchedCountry = matchAtlasCountry(bean.originCountry) ?? matchAtlasCountry(bean.name);

  if (country) {
    const targetCountry = matchAtlasCountry(country);
    if (!targetCountry) {
      if (!bean.originCountry.toLowerCase().includes(country.toLowerCase())) return false;
    } else if (matchedCountry?.name !== targetCountry.name) {
      return false;
    }
  }

  if (continent && matchedCountry?.continentId !== continent) {
    return false;
  }

  if (typeof isNewArrival === 'boolean') {
    if (bean.isNewArrival !== isNewArrival) {
      return false;
    }
  }

  return true;
}

function sortBeans(beans: CoffeeBean[], sort: BeanSort): CoffeeBean[] {
  const result = [...beans];
  switch (sort) {
    case 'sales_desc':
      return result.sort((left, right) => right.salesCount - left.salesCount);
    case 'price_asc':
      return result.sort((left, right) => left.price - right.price);
    case 'price_desc':
      return result.sort((left, right) => right.price - left.price);
    case 'updated_desc':
    default:
      return result;
  }
}

export async function loadLocalBeans(filters: BeanListFilters): Promise<CoffeeBean[]> {
  const { getCatalogBeansPage } = await import('../catalog.ts');
  const seed = await getCatalogBeansPage({
    limit: LOCAL_FALLBACK_LIMIT,
    offset: 0,
    roasterId: filters.roasterId,
    origin: filters.originCountry,
    process: filters.process,
    roastLevel: filters.roastLevel,
    processBase: filters.processBase,
    processStyle: filters.processStyle,
  });

  return sortBeans(
    seed.filter((bean) => matchesBeanFilters(bean, filters)),
    normalizeBeanSort(filters.sort)
  );
}

export async function listBeansV1({
  page,
  pageSize,
  q,
  roasterId,
  originCountry,
  process,
  processBase,
  processStyle,
  roastLevel,
  sort,
  isNewArrival,
  continent,
  country,
}: {
  page: number;
  pageSize: number;
  q?: string;
  roasterId?: string;
  originCountry?: string;
  process?: string;
  processBase?: ProcessBaseId;
  processStyle?: ProcessStyleId;
  roastLevel?: string;
  sort?: BeanSort;
  isNewArrival?: boolean;
  continent?: BeanDiscoverContinent;
  country?: string;
}): Promise<PaginatedResult<CatalogBeanCard>> {
  const { getCatalogBeansByIds } = await import('../catalog.ts');
  const offset = (page - 1) * pageSize;
  const filters: BeanListFilters = {
    q: sanitizeSearchTerm(normalizeString(q)),
    roasterId: normalizeString(roasterId),
    originCountry: normalizeString(originCountry),
    process: normalizeString(process),
    processBase,
    processStyle,
    roastLevel: normalizeString(roastLevel),
    sort: normalizeBeanSort(sort),
    isNewArrival,
    continent,
    country: normalizeString(country),
  };

  let beans: CoffeeBean[];
  let total: number;

  if (hasSupabaseServerEnv) {
    const { getLatestSyncedNewArrivalBeanIds } = await import('../new-arrivals.ts');
    const latestNewArrivalBeanIds = filters.isNewArrival ? await getLatestSyncedNewArrivalBeanIds() : undefined;
    const [ids, count] = await Promise.all([
      queryBeanIdsFromView({
        ...filters,
        limit: pageSize,
        offset,
        latestNewArrivalBeanIds,
      }),
      countBeanIdsFromView({
        ...filters,
        latestNewArrivalBeanIds,
      }),
    ]);
    beans = await getCatalogBeansByIds(ids);
    total = count;
  } else {
    const localBeans = await loadLocalBeans(filters);
    beans = localBeans.slice(offset, offset + pageSize);
    total = localBeans.length;
  }

  return {
    items: beans.map(mapBeanCard),
    pageInfo: {
      page,
      pageSize,
      total,
      hasNextPage: offset + beans.length < total,
    },
  };
}

export async function getBeanDetailV1(id: string): Promise<CatalogBeanDetail | null> {
  const { getBeanById } = await import('../catalog.ts');
  const bean = await getBeanById(id);
  return bean ? mapBeanDetail(bean) : null;
}
