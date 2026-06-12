import type { PublishStatus } from '@/lib/types';

import { requireSupabaseServiceRoleServer } from '@/lib/supabase';
import { queryRow, queryRows } from './database.ts';

import {
  badRequest,
  conflict,
  normalizeCountryCode,
  normalizeName,
  normalizeString,
  notFound,
  parseJsonNumber,
  parseStringArray,
  sanitizeSearchTerm,
} from './api-helpers';

type AdminRoasterRow = {
  id: string;
  name: string;
  city: string | null;
  country_code: string | null;
};

type AdminBeanRow = {
  id: string;
  canonical_name: string;
};

type AdminRoasterBeanRow = {
  id: string;
  roaster_id: string;
  bean_id: string;
  display_name: string;
};

type CreateAdminBeanInput = {
  roasterId?: unknown;
  roasterName?: unknown;
  city?: unknown;
  countryCode?: unknown;
  beanName?: unknown;
  originCountry?: unknown;
  originRegion?: unknown;
  processMethod?: unknown;
  variety?: unknown;
  displayName?: unknown;
  roastLevel?: unknown;
  priceAmount?: unknown;
  priceCurrency?: unknown;
  productUrl?: unknown;
  flavorTags?: unknown;
  isInStock?: unknown;
  status?: unknown;
};

const VALID_STATUSES: PublishStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

function hasOwnField(input: object, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function normalizeCurrency(value: unknown): string {
  const normalized = normalizeString(typeof value === 'string' ? value : undefined) ?? 'CNY';
  if (!/^[A-Za-z]{3}$/.test(normalized)) {
    badRequest('priceCurrency must be a 3-letter currency code', 'invalid_currency');
  }
  return normalized.toUpperCase();
}

function validateStatus(value: unknown): PublishStatus {
  if (typeof value !== 'string' || !VALID_STATUSES.includes(value as PublishStatus)) {
    badRequest('status must be one of DRAFT, ACTIVE, ARCHIVED', 'invalid_status');
  }
  return value as PublishStatus;
}

function validateBoolean(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') badRequest(`${field} must be a boolean`, 'invalid_payload');
  return value;
}

function wildcardQuery(value: string) {
  return `%${value}%`;
}

async function findRoasterById(id: string) {
  const supabaseServer = requireSupabaseServiceRoleServer();
  const { data, error } = await supabaseServer
    .from('roasters')
    .select('id, name, city, country_code')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as AdminRoasterRow | null;
}

async function findExistingRoasterByName(name: string) {
  const supabaseServer = requireSupabaseServiceRoleServer();
  const exactName = normalizeString(name);
  if (!exactName) return null;

  const exactMatch = await supabaseServer
    .from('roasters')
    .select('id, name, city, country_code')
    .ilike('name', exactName)
    .limit(10);
  if (exactMatch.error) throw exactMatch.error;

  const normalized = normalizeName(exactName);
  const byPrimaryName =
    ((exactMatch.data ?? []) as AdminRoasterRow[]).find((row) => normalizeName(row.name) === normalized) ?? null;
  if (byPrimaryName) return byPrimaryName;

  const englishMatch = await supabaseServer
    .from('roasters')
    .select('id, name, city, country_code')
    .ilike('name_en', exactName)
    .limit(10);
  if (englishMatch.error) throw englishMatch.error;

  return ((englishMatch.data ?? []) as AdminRoasterRow[]).find((row) => normalizeName(row.name) === normalized) ?? null;
}

async function findExistingBeanByName(name: string) {
  const supabaseServer = requireSupabaseServiceRoleServer();
  const exactName = normalizeString(name);
  if (!exactName) return null;

  const { data, error } = await supabaseServer
    .from('beans')
    .select('id, canonical_name')
    .ilike('canonical_name', exactName)
    .limit(10);

  if (error) throw error;

  const normalized = normalizeName(exactName);
  return ((data ?? []) as AdminBeanRow[]).find((row) => normalizeName(row.canonical_name) === normalized) ?? null;
}

async function findExistingRoasterBean(roasterId: string, beanId: string, displayName: string) {
  const supabaseServer = requireSupabaseServiceRoleServer();
  const { data, error } = await supabaseServer
    .from('roaster_beans')
    .select('id, roaster_id, bean_id, display_name')
    .eq('roaster_id', roasterId)
    .eq('bean_id', beanId)
    .ilike('display_name', displayName)
    .limit(10);

  if (error) throw error;

  const normalized = normalizeName(displayName);
  return ((data ?? []) as AdminRoasterBeanRow[]).find((row) => normalizeName(row.display_name) === normalized) ?? null;
}

export async function searchAdminRoasters({
  q,
  limit,
}: {
  q?: string;
  limit: number;
}) {
  const supabaseServer = requireSupabaseServiceRoleServer();
  const normalizedQ = sanitizeSearchTerm(normalizeString(q));

  let query = supabaseServer
    .from('roasters')
    .select('id, name, city, country_code')
    .order('name')
    .limit(limit);

  if (normalizedQ) {
    const wildcard = wildcardQuery(normalizedQ);
    query = query.or(`name.ilike.${wildcard},name_en.ilike.${wildcard},city.ilike.${wildcard}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as AdminRoasterRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    countryCode: row.country_code,
  }));
}

export async function createAdminBean(input: CreateAdminBeanInput) {
  const supabaseServer = requireSupabaseServiceRoleServer();

  const roasterId = normalizeString(typeof input.roasterId === 'string' ? input.roasterId : undefined);
  const roasterName = normalizeString(typeof input.roasterName === 'string' ? input.roasterName : undefined);
  const beanName = normalizeString(typeof input.beanName === 'string' ? input.beanName : undefined);
  const displayName = normalizeString(typeof input.displayName === 'string' ? input.displayName : undefined);

  if (!roasterId && !roasterName) {
    badRequest('roasterName is required when roasterId is missing', 'invalid_payload');
  }
  if (!beanName) badRequest('beanName is required', 'invalid_payload');
  if (!displayName) badRequest('displayName is required', 'invalid_payload');

  const city = normalizeString(typeof input.city === 'string' ? input.city : undefined);
  const countryCode = normalizeCountryCode(typeof input.countryCode === 'string' ? input.countryCode : undefined);
  const originCountry = normalizeString(typeof input.originCountry === 'string' ? input.originCountry : undefined);
  const originRegion = normalizeString(typeof input.originRegion === 'string' ? input.originRegion : undefined);
  const processMethod = normalizeString(typeof input.processMethod === 'string' ? input.processMethod : undefined);
  const variety = normalizeString(typeof input.variety === 'string' ? input.variety : undefined);
  const roastLevel = normalizeString(typeof input.roastLevel === 'string' ? input.roastLevel : undefined);
  const priceAmount = parseJsonNumber(input.priceAmount, 'priceAmount');
  const priceCurrency = normalizeCurrency(input.priceCurrency);
  const productUrl = normalizeString(typeof input.productUrl === 'string' ? input.productUrl : undefined);
  const flavorTags = parseStringArray(input.flavorTags, 'flavorTags');
  const isInStock = validateBoolean(input.isInStock, 'isInStock', true);
  const status = validateStatus(input.status ?? 'DRAFT');

  let roaster = roasterId ? await findRoasterById(roasterId) : null;
  if (!roaster && roasterId) {
    badRequest('roasterId does not exist', 'invalid_roaster');
  }
  if (!roaster && roasterName) {
    roaster = await findExistingRoasterByName(roasterName);
  }
  if (!roaster) {
    const { data, error } = await supabaseServer
      .from('roasters')
      .insert({
        name: roasterName!,
        city: city ?? null,
        country_code: countryCode ?? null,
        is_public: true,
      })
      .select('id, name, city, country_code')
      .single();

    if (error) throw error;
    roaster = data as AdminRoasterRow;
  }

  let bean = await findExistingBeanByName(beanName);
  if (!bean) {
    const { data, error } = await supabaseServer
      .from('beans')
      .insert({
        canonical_name: beanName,
        origin_country: originCountry ?? null,
        origin_region: originRegion ?? null,
        process_method: processMethod ?? null,
        variety: variety ?? null,
        flavor_tags: flavorTags ?? [],
        is_public: true,
      })
      .select('id, canonical_name')
      .single();

    if (error) throw error;
    bean = data as AdminBeanRow;
  }

  const existingRoasterBean = await findExistingRoasterBean(roaster.id, bean.id, displayName);
  if (existingRoasterBean) {
    conflict('A product with the same roaster, bean, and display name already exists', 'duplicate_roaster_bean');
  }

  const { data: roasterBeanData, error: roasterBeanError } = await supabaseServer
    .from('roaster_beans')
    .insert({
      roaster_id: roaster.id,
      bean_id: bean.id,
      display_name: displayName,
      roast_level: roastLevel ?? null,
      price_amount: priceAmount ?? null,
      price_currency: priceCurrency,
      product_url: productUrl ?? null,
      is_in_stock: isInStock,
      status,
    })
    .select('id, roaster_id, bean_id, display_name')
    .single();

  if (roasterBeanError) throw roasterBeanError;

  return {
    roaster: {
      id: roaster.id,
      name: roaster.name,
      city: roaster.city,
      countryCode: roaster.country_code,
    },
    bean: {
      id: bean.id,
      canonicalName: bean.canonical_name,
    },
    roasterBean: {
      id: (roasterBeanData as AdminRoasterBeanRow).id,
      displayName,
      status,
      isInStock,
    },
  };
}

// ───────────────────────────────────────────
// Admin RoasterBean List / Update / Delete
// ───────────────────────────────────────────

type AdminRoasterBeanListRow = {
  id: string;
  roaster_id: string;
  bean_id: string;
  source_id: string | null;
  display_name: string;
  roast_level: string | null;
  price_amount: number | null;
  price_currency: string;
  weight_grams: number | null;
  product_url: string | null;
  image_url: string | null;
  source_item_id: string | null;
  source_sku_id: string | null;
  status: PublishStatus;
  is_in_stock: boolean;
  created_at: string;
  updated_at: string;
  roaster_name: string | null;
  bean_name: string | null;
  bean_origin_country: string | null;
  bean_origin_region: string | null;
  bean_process_method: string | null;
  bean_variety: string | null;
};

export type AdminRoasterBeanListItem = {
  id: string;
  roasterId: string;
  roasterName: string;
  beanId: string;
  beanName: string;
  originCountry: string | null;
  originRegion: string | null;
  processMethod: string | null;
  variety: string | null;
  displayName: string;
  roastLevel: string | null;
  priceAmount: number | null;
  priceCurrency: string;
  weightGrams: number | null;
  productUrl: string | null;
  imageUrl: string | null;
  sourceItemId: string | null;
  sourceSkuId: string | null;
  status: PublishStatus;
  isInStock: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function listAdminRoasterBeans({
  status,
  roasterId,
  q,
  page,
  pageSize,
}: {
  status?: PublishStatus | null;
  roasterId?: string | null;
  q?: string | null;
  page: number;
  pageSize: number;
}) {
  const offset = (page - 1) * pageSize;

  const whereParts: string[] = [];
  const params: unknown[] = [];
  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (status) {
    whereParts.push(`rb.status = ${addParam(status)}`);
  }
  if (roasterId) {
    whereParts.push(`rb.roaster_id = ${addParam(roasterId)}`);
  }
  if (q) {
    const sanitized = sanitizeSearchTerm(normalizeString(q));
    if (sanitized) {
      const wildcard = wildcardQuery(sanitized);
      const placeholder = addParam(wildcard);
      whereParts.push(`(rb.display_name ilike ${placeholder} escape '\\' or rb.source_item_id ilike ${placeholder} escape '\\')`);
    }
  }

  const whereSql = whereParts.length > 0 ? ` where ${whereParts.join(' and ')}` : '';
  const countRow = await queryRow<{ count: number }>(
    `select count(*)::int as count
     from public.roaster_beans rb
     left join public.roasters r on r.id = rb.roaster_id
     left join public.beans b on b.id = rb.bean_id${whereSql}`,
    params
  );
  const rows = await queryRows<AdminRoasterBeanListRow>(
    `select
       rb.id,
       rb.roaster_id,
       rb.bean_id,
       rb.source_id,
       rb.display_name,
       rb.roast_level,
       rb.price_amount,
       rb.price_currency,
       rb.weight_grams,
       rb.product_url,
       rb.image_url,
       rb.source_item_id,
       rb.source_sku_id,
       rb.status,
       rb.is_in_stock,
       rb.created_at,
       rb.updated_at,
       r.name as roaster_name,
       b.canonical_name as bean_name,
       b.origin_country as bean_origin_country,
       b.origin_region as bean_origin_region,
       b.process_method as bean_process_method,
       b.variety as bean_variety
     from public.roaster_beans rb
     left join public.roasters r on r.id = rb.roaster_id
     left join public.beans b on b.id = rb.bean_id${whereSql}
     order by rb.updated_at desc
     limit $${params.length + 1}
     offset $${params.length + 2}`,
    [...params, pageSize, offset]
  );

  const items: AdminRoasterBeanListItem[] = rows.map((row) => ({
    id: row.id,
    roasterId: row.roaster_id,
    roasterName: row.roaster_name ?? '',
    beanId: row.bean_id,
    beanName: row.bean_name ?? '',
    originCountry: row.bean_origin_country ?? null,
    originRegion: row.bean_origin_region ?? null,
    processMethod: row.bean_process_method ?? null,
    variety: row.bean_variety ?? null,
    displayName: row.display_name,
    roastLevel: row.roast_level,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    weightGrams: row.weight_grams,
    productUrl: row.product_url,
    imageUrl: row.image_url,
    sourceItemId: row.source_item_id,
    sourceSkuId: row.source_sku_id,
    status: row.status,
    isInStock: row.is_in_stock,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    items,
    total: countRow?.count ?? 0,
    page,
    pageSize,
  };
}

type UpdateAdminRoasterBeanInput = {
  displayName?: unknown;
  roastLevel?: unknown;
  priceAmount?: unknown;
  weightGrams?: unknown;
  productUrl?: unknown;
  status?: unknown;
  isInStock?: unknown;
};

export async function updateAdminRoasterBean(id: string, input: UpdateAdminRoasterBeanInput) {
  const supabaseServer = requireSupabaseServiceRoleServer();

  const { data: existing, error: existingError } = await supabaseServer
    .from('roaster_beans')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) {
    notFound('Roaster bean not found', 'not_found');
  }

  const updates: Record<string, unknown> = {};

  if (hasOwnField(input, 'displayName')) {
    const displayName = normalizeString(typeof input.displayName === 'string' ? input.displayName : undefined);
    if (!displayName) badRequest('displayName is required', 'invalid_payload');
    updates.display_name = displayName;
  }

  if (hasOwnField(input, 'roastLevel')) {
    const roastLevel = normalizeString(typeof input.roastLevel === 'string' ? input.roastLevel : undefined);
    updates.roast_level = roastLevel ?? null;
  }

  if (hasOwnField(input, 'priceAmount')) {
    const priceAmount = parseJsonNumber(input.priceAmount, 'priceAmount');
    updates.price_amount = priceAmount ?? null;
  }

  if (hasOwnField(input, 'weightGrams')) {
    const weightGrams = parseJsonNumber(input.weightGrams, 'weightGrams');
    updates.weight_grams = weightGrams ?? null;
  }

  if (hasOwnField(input, 'productUrl')) {
    const productUrl = normalizeString(typeof input.productUrl === 'string' ? input.productUrl : undefined);
    updates.product_url = productUrl ?? null;
  }

  if (input.status !== undefined) {
    updates.status = validateStatus(input.status);
  }

  if (input.isInStock !== undefined) {
    updates.is_in_stock = validateBoolean(input.isInStock, 'isInStock', true);
  }

  if (Object.keys(updates).length === 0) {
    badRequest('No fields to update', 'invalid_payload');
  }

  const { data, error } = await supabaseServer
    .from('roaster_beans')
    .update(updates)
    .eq('id', id)
    .select('id, display_name, status, updated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAdminRoasterBean(id: string) {
  const supabaseServer = requireSupabaseServiceRoleServer();

  const { data: existing, error: existingError } = await supabaseServer
    .from('roaster_beans')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) {
    notFound('Roaster bean not found', 'not_found');
  }

  const { error } = await supabaseServer.from('roaster_beans').delete().eq('id', id);
  if (error) throw error;
}
