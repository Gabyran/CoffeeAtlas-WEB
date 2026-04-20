import type { MiniProgramSupabaseClient } from '../../utils/supabase.ts';
import { type ProcessBaseId, type ProcessStyleId } from '@coffee-atlas/shared-types';
import type { DiscoverContinentId } from '../../types/index.ts';
import { ORIGIN_ATLAS_COUNTRIES_BY_CONTINENT, matchAtlasCountry } from '../../utils/origin-atlas.ts';

export type CatalogClient = MiniProgramSupabaseClient;

export type ActiveCatalogRow = {
  roaster_bean_id: string;
  roaster_id: string | null;
  roaster_name: string | null;
  city: string | null;
  display_name: string | null;
  origin_country: string | null;
  origin_region: string | null;
  farm: string | null;
  variety: string | null;
  process_method: string | null;
  process_base?: string | null;
  process_style?: string | null;
  roast_level: string | null;
  price_amount: number | string | null;
  price_currency: string | null;
  sales_count: unknown;
  image_url: string | null;
  product_url: string | null;
  is_in_stock: boolean | null;
  updated_at?: string | null;
};

export type RoasterRow = {
  id: string;
  name: string;
  city: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  instagram_handle: string | null;
};

export type RoasterBeanAggregateRow = {
  roaster_id: string | null;
  image_url: string | null;
  product_url: string | null;
};

export type RoasterAggregate = {
  beanCount: number;
  coverImageUrl: string | null;
  taobaoUrl: string | null;
  xiaohongshuUrl: string | null;
};

export type NewArrivalBeanSeed = {
  roasterId: string;
  roasterName: string;
  process: string;
  processBase?: ProcessBaseId;
  processStyle?: ProcessStyleId;
  originCountry: string;
};

export type LatestNewArrivalIdRow = {
  roaster_bean_id: string | null;
};

export const DEFAULT_BEAN_PAGE_SIZE = 20;
export const DEFAULT_ROASTER_PAGE_SIZE = 12;
const NEW_ARRIVAL_WINDOW_DAYS = 30;
export const MAX_NEW_ARRIVAL_OPTIONS = 3;
export const CATALOG_VIEW_SELECT =
  'roaster_bean_id, roaster_id, roaster_name, city, display_name, origin_country, origin_region, farm, variety, process_method, process_base, process_style, roast_level, price_amount, price_currency, sales_count, image_url, product_url, is_in_stock, updated_at';
export const CATALOG_VIEW_LEGACY_SELECT =
  'roaster_bean_id, roaster_id, roaster_name, city, display_name, origin_country, origin_region, farm, variety, process_method, roast_level, price_amount, price_currency, sales_count, image_url, product_url, is_in_stock, updated_at';
export const NEW_ARRIVAL_SELECT =
  'roaster_id, roaster_name, process_method, process_base, process_style, origin_country, updated_at';
export const NEW_ARRIVAL_LEGACY_SELECT = 'roaster_id, roaster_name, process_method, origin_country, updated_at';

export function normalizeString(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function splitMultiValueSegments(value: string | null | undefined): string[] {
  const normalized = normalizeString(value);
  if (!normalized) return [];

  return normalized
    .replace(/[／、，；|+&]+/g, '/')
    .split('/')
    .map((segment) => normalizeString(segment))
    .filter((segment) => segment.length > 0);
}

export function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = normalizeString(value);
  return normalized.length > 0 ? normalized : null;
}

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function normalizeSalesCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === 'string') {
    const raw = value.trim().replace(/,/g, '').replace(/\+/g, '');
    if (!raw) return 0;
    const wanMatch = raw.match(/^(\d+(?:\.\d+)?)\s*万$/);
    if (wanMatch) {
      return Math.max(0, Math.round(Number(wanMatch[1]) * 10000));
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }

  return 0;
}

export function getNewArrivalCutoffIso() {
  return new Date(Date.now() - NEW_ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function isRecentUpdatedAt(value: string | null | undefined): boolean {
  const time = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(time)) return false;
  return time >= Date.now() - NEW_ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function normalizeLatestNewArrivalBeanIds(ids: string[]): string[] | null {
  return ids.length > 0 ? ids : null;
}

export async function getLatestNewArrivalBeanIds(client: CatalogClient): Promise<string[] | null> {
  try {
    const { data, error } = await client.rpc('latest_synced_new_arrival_ids');
    if (error) return null;

    return normalizeLatestNewArrivalBeanIds(
      Array.from(
        new Set(
          ((data ?? []) as LatestNewArrivalIdRow[])
            .map((row) => row.roaster_bean_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        )
      )
    );
  } catch {
    return null;
  }
}

export function sanitizeFilterToken(value: string): string {
  return value.replace(/[,%'()]/g, ' ').trim();
}

function buildSearchConditions(query: string): string {
  const wildcard = `%${sanitizeFilterToken(query)}%`;
  return [
    `roaster_name.ilike.${wildcard}`,
    `display_name.ilike.${wildcard}`,
    `origin_country.ilike.${wildcard}`,
    `origin_region.ilike.${wildcard}`,
    `process_method.ilike.${wildcard}`,
    `variety.ilike.${wildcard}`,
  ].join(',');
}

function buildOriginConditions(values: string[]): string | null {
  const uniqueValues = Array.from(new Set(values.map(sanitizeFilterToken).filter((value) => value.length > 0)));
  if (uniqueValues.length === 0) return null;
  return uniqueValues.map((value) => `origin_country.ilike.%${value}%`).join(',');
}

export function isMissingNormalizedProcessColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    message?: string | null;
    details?: string | null;
    hint?: string | null;
    code?: string | null;
  };
  const haystack = [candidate.message, candidate.details, candidate.hint, candidate.code]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();

  if (!haystack) return false;

  const mentionsProcessColumn = haystack.includes('process_base') || haystack.includes('process_style');
  const looksLikeMissingColumn =
    haystack.includes('column') ||
    haystack.includes('schema cache') ||
    haystack.includes('select') ||
    haystack.includes('order');

  return mentionsProcessColumn && looksLikeMissingColumn;
}

function getCountryFilterCandidates(country: string | undefined): string[] {
  if (!country) return [];
  const atlasCountry = matchAtlasCountry(country);
  if (!atlasCountry) return [country];
  return [atlasCountry.name, atlasCountry.id, ...atlasCountry.aliases];
}

function getContinentFilterCandidates(continent: DiscoverContinentId | undefined): string[] {
  if (!continent) return [];
  const countries = ORIGIN_ATLAS_COUNTRIES_BY_CONTINENT.get(continent) ?? [];
  return countries.flatMap((country) => [country.name, country.id, ...country.aliases]);
}

export function applyBeanFilters(
  query: any,
  params: {
    q?: string;
    roasterId?: string;
    originCountry?: string;
    variety?: string;
    process?: string;
    processBase?: ProcessBaseId;
    processStyle?: ProcessStyleId;
    roastLevel?: string;
    isNewArrival?: boolean;
    continent?: DiscoverContinentId;
    country?: string;
  },
  options?: {
    supportsNormalizedProcessColumns?: boolean;
    applyNormalizedProcessFilters?: boolean;
  }
): any {
  let nextQuery = query;
  const supportsNormalizedProcessColumns = options?.supportsNormalizedProcessColumns !== false;
  const applyNormalizedProcessFilters = options?.applyNormalizedProcessFilters !== false;

  if (params.q) {
    nextQuery = nextQuery.or(buildSearchConditions(params.q));
  }

  if (params.roasterId) {
    nextQuery = nextQuery.eq('roaster_id', params.roasterId);
  }

  if (params.originCountry) {
    const originConditions = buildOriginConditions(getCountryFilterCandidates(params.originCountry));
    if (originConditions) {
      nextQuery = nextQuery.or(originConditions);
    }
  }

  if (params.country) {
    const countryConditions = buildOriginConditions(getCountryFilterCandidates(params.country));
    if (countryConditions) {
      nextQuery = nextQuery.or(countryConditions);
    }
  }

  if (params.continent) {
    const continentConditions = buildOriginConditions(getContinentFilterCandidates(params.continent));
    if (continentConditions) {
      nextQuery = nextQuery.or(continentConditions);
    }
  }

  if (params.variety) {
    nextQuery = nextQuery.ilike('variety', `%${sanitizeFilterToken(params.variety)}%`);
  }

  if (params.process) {
    nextQuery = nextQuery.ilike('process_method', `%${sanitizeFilterToken(params.process)}%`);
  }

  if (supportsNormalizedProcessColumns && applyNormalizedProcessFilters && params.processBase) {
    nextQuery = nextQuery.eq('process_base', params.processBase);
  }

  if (supportsNormalizedProcessColumns && applyNormalizedProcessFilters && params.processStyle) {
    nextQuery = nextQuery.eq('process_style', params.processStyle);
  }

  if (params.roastLevel) {
    nextQuery = nextQuery.ilike('roast_level', `%${params.roastLevel}%`);
  }

  if (typeof params.isNewArrival === 'boolean') {
    const cutoff = getNewArrivalCutoffIso();
    nextQuery = params.isNewArrival ? nextQuery.gte('updated_at', cutoff) : nextQuery.lt('updated_at', cutoff);
  }

  return nextQuery;
}

export function resolveNewArrivalIdSet(rows: ActiveCatalogRow[], latestNewArrivalBeanIds?: string[] | null): Set<string> {
  if (Array.isArray(latestNewArrivalBeanIds)) {
    return new Set(latestNewArrivalBeanIds);
  }

  return new Set(rows.filter((row) => isRecentUpdatedAt(row.updated_at)).map((row) => row.roaster_bean_id));
}

export function applyBeanSort(
  query: any,
  sort: 'updated_desc' | 'sales_desc' | 'price_asc' | 'price_desc' | undefined
): any {
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
