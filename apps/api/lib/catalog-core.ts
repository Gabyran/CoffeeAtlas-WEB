import { isProcessBaseId, isProcessStyleId, normalizeProcess } from '@coffee-atlas/shared-types';

import { isRecentUpdatedAt } from './new-arrivals-helpers.ts';
import { normalizeSalesCount } from './sales.ts';
import { sampleCatalog } from './sample-data.ts';
import type { CoffeeBean, Roaster } from './catalog-types.ts';

export type RoasterBeanRow = {
  id: string;
  display_name: string;
  roaster_id: string | null;
  bean_id: string | null;
  roast_level: string | null;
  price_amount: number | string | null;
  price_currency: string | null;
  sales_count: unknown;
  image_url: string | null;
  product_url?: string | null;
  updated_at?: string | null;
  is_in_stock: boolean | null;
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

export type BeanRow = {
  id: string;
  canonical_name: string | null;
  origin_country: string | null;
  origin_region: string | null;
  farm: string | null;
  variety: string | null;
  process_method: string | null;
  process_base?: string | null;
  process_style?: string | null;
  flavor_tags: string[] | null;
};

export type SearchCatalogRow = {
  roaster_bean_id: string;
  roaster_name: string | null;
  city: string | null;
  bean_name: string | null;
  display_name: string | null;
  process_method: string | null;
  roast_level: string | null;
  price_amount: number | string | null;
  price_currency: string | null;
  is_in_stock: boolean | null;
};

export type RoasterAggregateRow = {
  roaster_id: string | null;
  image_url: string | null;
  product_url: string | null;
};

export interface RoasterAggregate {
  beanCount: number;
  coverImageUrl: string | null;
  taobaoUrl: string | null;
  xiaohongshuUrl: string | null;
}

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function createCatalogError(message: string): Error {
  return new Error(`catalog:${message}`);
}

export function mapCoffeeBean(
  item: RoasterBeanRow,
  roaster?: RoasterRow,
  bean?: BeanRow,
  latestNewArrivalIds?: Set<string>
): CoffeeBean {
  const normalizedProcess = normalizeProcess(bean?.process_method, {
    base: isProcessBaseId(bean?.process_base) ? bean.process_base : undefined,
    style: isProcessStyleId(bean?.process_style) ? bean.process_style : undefined,
  });

  return {
    id: item.id,
    name: item.display_name,
    roasterId: item.roaster_id ?? '',
    roasterName: roaster?.name ?? '',
    city: roaster?.city ?? '',
    originCountry: bean?.origin_country ?? '',
    originRegion: bean?.origin_region ?? '',
    farm: bean?.farm ?? '',
    variety: bean?.variety ?? '',
    process: normalizedProcess.label,
    processBase: normalizedProcess.base,
    processStyle: normalizedProcess.style,
    processRaw: normalizedProcess.raw,
    roastLevel: item.roast_level ?? '',
    price: toNumber(item.price_amount),
    discountedPrice: toNumber(item.price_amount),
    currency: item.price_currency ?? 'CNY',
    salesCount: normalizeSalesCount(item.sales_count) ?? 0,
    tastingNotes: Array.isArray(bean?.flavor_tags) ? bean.flavor_tags : [],
    imageUrl: item.image_url,
    isNewArrival: latestNewArrivalIds?.has(item.id) ?? isRecentUpdatedAt(item.updated_at),
    isInStock: item.is_in_stock ?? true,
  };
}

export function mapRoaster(row: RoasterRow, aggregate: RoasterAggregate): Roaster {
  return {
    id: row.id,
    name: row.name,
    city: row.city ?? '',
    description: row.description,
    logoUrl: row.logo_url,
    coverImageUrl: aggregate.coverImageUrl ?? normalizeOptionalString(row.logo_url),
    websiteUrl: row.website_url,
    instagramHandle: row.instagram_handle,
    taobaoUrl: aggregate.taobaoUrl,
    xiaohongshuUrl: aggregate.xiaohongshuUrl,
    beanCount: aggregate.beanCount,
  };
}

export function mapSampleCatalogRow(row: (typeof sampleCatalog)[number]): CoffeeBean {
  const normalizedProcess = normalizeProcess(row.processMethod ?? '');

  return {
    id: row.roasterBeanId,
    name: row.displayName,
    roasterId: row.roasterName,
    roasterName: row.roasterName,
    city: row.city ?? '',
    originCountry: '',
    originRegion: '',
    farm: '',
    variety: row.beanName,
    process: normalizedProcess.label,
    processBase: normalizedProcess.base,
    processStyle: normalizedProcess.style,
    processRaw: normalizedProcess.raw,
    roastLevel: row.roastLevel ?? '',
    price: row.priceAmount ?? 0,
    discountedPrice: row.priceAmount ?? 0,
    currency: row.priceCurrency,
    salesCount: row.salesCount ?? 0,
    tastingNotes: [],
    imageUrl: null,
    isNewArrival: false,
    isInStock: row.isInStock,
  };
}

export function getSampleBeans(): CoffeeBean[] {
  return sampleCatalog
    .filter((row) => row.status === 'ACTIVE')
    .map(mapSampleCatalogRow);
}

export function getSampleRoasters(): Roaster[] {
  const roasterMap = new Map<string, Roaster>();

  for (const row of sampleCatalog) {
    if (row.status !== 'ACTIVE') continue;

    const roasterName = normalizeOptionalString(row.roasterName);
    if (!roasterName) continue;

    const existing = roasterMap.get(roasterName);
    if (existing) {
      existing.beanCount += 1;
      if (!existing.city && row.city) {
        existing.city = row.city;
      }
      continue;
    }

    roasterMap.set(roasterName, {
      id: roasterName,
      name: roasterName,
      city: row.city ?? '',
      description: null,
      logoUrl: null,
      coverImageUrl: null,
      websiteUrl: null,
      instagramHandle: null,
      taobaoUrl: null,
      xiaohongshuUrl: null,
      beanCount: 1,
    });
  }

  return Array.from(roasterMap.values()).sort((left, right) => left.name.localeCompare(right.name));
}
