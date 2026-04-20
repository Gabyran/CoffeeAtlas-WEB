import { getLatestSyncedNewArrivalBeanIdSet } from '@/lib/new-arrivals';
import { hasSupabaseServerEnv, requireSupabaseServer } from '@/lib/supabase';
import {
  BeanRow,
  RoasterRow,
  SearchCatalogRow,
  mapCoffeeBean,
  getSampleBeans,
  createCatalogError,
} from './catalog-core.ts';
import {
  sanitizeCatalogSearchTerm,
} from './catalog-query.ts';
import type {
  CoffeeBean,
  CatalogBeanFilters,
  CatalogBeansQuery,
} from './catalog-types.ts';

type ActiveCatalogRow = {
  roaster_bean_id: string;
  roaster_id: string | null;
  roaster_name: string | null;
  city: string | null;
  bean_id: string | null;
  bean_name: string | null;
  origin_country: string | null;
  origin_region: string | null;
  farm: string | null;
  process_method: string | null;
  process_base: string | null;
  process_style: string | null;
  variety: string | null;
  display_name: string;
  roast_level: string | null;
  price_amount: number | string | null;
  price_currency: string | null;
  sales_count: unknown;
  image_url: string | null;
  updated_at: string | null;
  is_in_stock: boolean | null;
};

export async function getCatalogBeans(limit?: number): Promise<CoffeeBean[]> {
  return getCatalogBeansPage(typeof limit === 'number' ? { limit } : {});
}

function mapActiveCatalogBean(row: ActiveCatalogRow, latestNewArrivalIds?: Set<string>): CoffeeBean {
  const roaster: RoasterRow = {
    id: row.roaster_id ?? '',
    name: row.roaster_name ?? '',
    city: row.city,
    description: null,
    logo_url: null,
    website_url: null,
    instagram_handle: null,
  };
  const bean: BeanRow = {
    id: row.bean_id ?? '',
    canonical_name: row.bean_name,
    origin_country: row.origin_country,
    origin_region: row.origin_region,
    farm: row.farm,
    variety: row.variety,
    process_method: row.process_method,
    process_base: row.process_base,
    process_style: row.process_style,
    flavor_tags: null,
  };

  return mapCoffeeBean(
    {
      id: row.roaster_bean_id,
      display_name: row.display_name,
      roaster_id: row.roaster_id,
      bean_id: row.bean_id,
      roast_level: row.roast_level,
      price_amount: row.price_amount,
      price_currency: row.price_currency,
      sales_count: row.sales_count,
      image_url: row.image_url,
      updated_at: row.updated_at,
      is_in_stock: row.is_in_stock,
    },
    roaster,
    bean,
    latestNewArrivalIds,
  );
}

export async function getCatalogBeansPage({
  limit = 50,
  offset = 0,
  origin,
  process,
  processBase,
  processStyle,
  roastLevel,
  roasterId,
}: CatalogBeansQuery = {}): Promise<CoffeeBean[]> {
  if (!hasSupabaseServerEnv) {
    return getSampleBeans()
      .filter((bean) => {
        if (roasterId && bean.roasterId !== roasterId) return false;
        if (origin && bean.originCountry !== origin) return false;
        if (process && bean.process !== process) return false;
        if (processBase && bean.processBase !== processBase) return false;
        if (processStyle && bean.processStyle !== processStyle) return false;
        if (roastLevel && bean.roastLevel !== roastLevel) return false;
        return true;
      })
      .slice(offset, offset + limit);
  }

  const supabaseServer = requireSupabaseServer();
  let query = supabaseServer
    .from('v_catalog_active')
    .select('*')
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (origin) query = query.ilike('origin_country', origin);
  if (process) query = query.ilike('process_method', process);
  if (processBase) query = query.eq('process_base', processBase);
  if (processStyle) query = query.eq('process_style', processStyle);
  if (roastLevel) query = query.ilike('roast_level', roastLevel);
  if (roasterId) query = query.eq('roaster_id', roasterId);

  const { data, error } = await query;
  if (error) throw createCatalogError(`failed_to_load_catalog_beans:${error.message}`);
  if (!data || data.length === 0) return [];

  const rows = data as ActiveCatalogRow[];
  const latestNewArrivalIds = await getLatestSyncedNewArrivalBeanIdSet();

  return rows.map((row) => mapActiveCatalogBean(row, latestNewArrivalIds ?? undefined));
}

export async function countCatalogBeans(filters: CatalogBeanFilters = {}): Promise<number> {
  if (!hasSupabaseServerEnv) {
    return getSampleBeans()
      .filter((bean) => {
        if (filters.roasterId && bean.roasterId !== filters.roasterId) return false;
        if (filters.origin && bean.originCountry !== filters.origin) return false;
        if (filters.process && bean.process !== filters.process) return false;
        if (filters.processBase && bean.processBase !== filters.processBase) return false;
        if (filters.processStyle && bean.processStyle !== filters.processStyle) return false;
        if (filters.roastLevel && bean.roastLevel !== filters.roastLevel) return false;
        return true;
      })
      .length;
  }

  const supabaseServer = requireSupabaseServer();
  let query = supabaseServer
    .from('v_catalog_active')
    .select('roaster_bean_id', { count: 'exact', head: true });

  if (filters.origin) query = query.ilike('origin_country', filters.origin);
  if (filters.process) query = query.ilike('process_method', filters.process);
  if (filters.processBase) query = query.eq('process_base', filters.processBase);
  if (filters.processStyle) query = query.eq('process_style', filters.processStyle);
  if (filters.roastLevel) query = query.ilike('roast_level', filters.roastLevel);
  if (filters.roasterId) query = query.eq('roaster_id', filters.roasterId);

  const { count, error } = await query;
  if (error) throw createCatalogError(`failed_to_count_catalog_beans:${error.message}`);
  return count ?? 0;
}

export async function getBeanById(id: string): Promise<CoffeeBean | null> {
  if (!hasSupabaseServerEnv) {
    return getSampleBeans().find((bean) => bean.id === id) ?? null;
  }

  const supabaseServer = requireSupabaseServer();
  const { data, error } = await supabaseServer
    .from('v_catalog_active')
    .select('*')
    .eq('roaster_bean_id', id)
    .maybeSingle();

  if (error) throw createCatalogError(`failed_to_load_catalog_bean:${error.message}`);
  if (!data) return null;

  const row = data as ActiveCatalogRow;
  const latestNewArrivalIds = await getLatestSyncedNewArrivalBeanIdSet();

  return mapActiveCatalogBean(row, latestNewArrivalIds ?? undefined);
}

export async function getCatalogBeansByIds(ids: string[]): Promise<CoffeeBean[]> {
  if (ids.length === 0) return [];

  if (!hasSupabaseServerEnv) {
    const sampleMap = new Map(getSampleBeans().map((bean) => [bean.id, bean]));
    return ids.map((id) => sampleMap.get(id)).filter((bean): bean is CoffeeBean => Boolean(bean));
  }

  const supabaseServer = requireSupabaseServer();
  const { data, error } = await supabaseServer
    .from('v_catalog_active')
    .select('*')
    .in('roaster_bean_id', ids);

  if (error) throw createCatalogError(`failed_to_load_catalog_beans_by_ids:${error.message}`);
  if (!data || data.length === 0) return [];

  const rows = data as ActiveCatalogRow[];
  const latestNewArrivalIds = await getLatestSyncedNewArrivalBeanIdSet();
  const beanMap = new Map(
    rows.map((row) => [
      row.roaster_bean_id,
      mapActiveCatalogBean(row, latestNewArrivalIds ?? undefined),
    ])
  );

  return ids.map((id) => beanMap.get(id)).filter((bean): bean is CoffeeBean => Boolean(bean));
}

export async function searchCatalogBeans({
  query,
  limit = 50,
  offset = 0,
}: {
  query: string;
  limit?: number;
  offset?: number;
}): Promise<CoffeeBean[]> {
  const q = sanitizeCatalogSearchTerm(query);
  if (!q) return getCatalogBeansPage({ limit, offset });

  if (!hasSupabaseServerEnv) {
    const lowered = q.toLowerCase();
    return getSampleBeans()
      .filter((bean) => {
        return [
          bean.name,
          bean.roasterName,
          bean.variety,
          bean.process,
          bean.originCountry,
        ].some((value) => value.toLowerCase().includes(lowered));
      })
      .slice(offset, offset + limit);
  }

  const supabaseServer = requireSupabaseServer();
  const { data, error } = await supabaseServer.rpc('search_catalog', {
    p_query: q,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw createCatalogError(`failed_to_search_catalog:${error.message}`);

  const rows = (data ?? []) as SearchCatalogRow[];
  const ids = rows
    .map((row) => row.roaster_bean_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  return getCatalogBeansByIds(ids);
}

export async function countSearchCatalogBeans(query: string): Promise<number> {
  const q = sanitizeCatalogSearchTerm(query);
  if (!q) return countCatalogBeans();

  if (!hasSupabaseServerEnv) {
    const lowered = q.toLowerCase();
    return getSampleBeans().filter((bean) => {
      return [
        bean.name,
        bean.roasterName,
        bean.variety,
        bean.process,
        bean.originCountry,
      ].some((value) => value.toLowerCase().includes(lowered));
    }).length;
  }

  const supabaseServer = requireSupabaseServer();
  const { data, error } = await supabaseServer.rpc('search_catalog_count', {
    p_query: q,
  });

  if (error) throw createCatalogError(`failed_to_count_catalog_search:${error.message}`);
  const count = typeof data === 'number' ? data : Number(data ?? 0);
  return Number.isFinite(count) ? count : 0;
}
