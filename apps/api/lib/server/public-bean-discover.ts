import type {
  BeanDiscoverContinent,
  BeanDiscoverOption,
  BeanDiscoverPayload,
  ProcessBaseId,
  ProcessStyleId,
} from '@coffee-atlas/shared-types';
import {
  getAvailableProcessStyleDefinitions,
  getProcessBaseLabel,
  getProcessStyleLabel,
  isProcessBaseId,
  isProcessStyleId,
  normalizeProcess,
} from '@coffee-atlas/shared-types';
import type { CoffeeBean } from '../catalog';

import {
  ORIGIN_ATLAS_CONTINENTS,
  ORIGIN_ATLAS_CONTINENT_MAP,
  ORIGIN_ATLAS_COUNTRIES_BY_CONTINENT,
  matchAtlasCountry,
} from '../geo-data.ts';
import { hasSupabaseServerEnv, requireSupabaseServer } from '../supabase.ts';

import { normalizeString, sanitizeSearchTerm } from './api-primitives.ts';
import { BEAN_DISCOVER_EDITORIAL_CONFIGS, getBeanDiscoverEditorialConfigs } from './bean-discover-config.ts';
import { formatLightQuestionTemplate, readLightQuestionCopyConfig } from './light-question-copy.ts';
import type { BeanListFilters } from './public-beans.ts';
import {
  buildOriginConditions,
  buildSearchConditions,
  countBeanIdsFromView,
  getContinentFilterCandidates,
  loadLocalBeans,
  mapBeanCard,
  matchesBeanFilters,
  queryBeanIdsFromView,
} from './public-beans.ts';

interface CatalogViewDiscoverRow {
  roaster_bean_id: string;
  origin_country: string | null;
  variety: string | null;
  process_method: string | null;
  process_base?: string | null;
  process_style?: string | null;
}

type BeanDiscoverFilters = {
  q?: string;
  processBase?: ProcessBaseId;
  processStyle?: ProcessStyleId;
  continent?: BeanDiscoverContinent;
  country?: string;
};

type BeanDiscoverServiceDeps = {
  loadPrimaryPayload: (filters: BeanDiscoverFilters) => Promise<BeanDiscoverPayload>;
  loadFallbackPayload: (filters: BeanDiscoverFilters) => Promise<BeanDiscoverPayload>;
};

type BuildDiscoverPrimaryDeps = {
  hasSupabaseEnv?: boolean;
  queryDiscoverRowsFn?: typeof queryDiscoverRows;
  countBeanIdsFn?: typeof countBeanIdsFromView;
  loadLocalBeansFn?: typeof loadLocalBeans;
  buildEditorialPicksFn?: typeof buildEditorialPicks;
};

async function queryDiscoverRows({
  q,
  processBase,
  processStyle,
  continent,
}: {
  q?: string;
  processBase?: ProcessBaseId;
  processStyle?: ProcessStyleId;
  continent?: BeanDiscoverContinent;
}) {
  const supabaseServer = requireSupabaseServer();
  let query = supabaseServer
    .from('v_catalog_active')
    .select('roaster_bean_id, origin_country, variety, process_method, process_base, process_style')
    .order('updated_at', { ascending: false });

  if (q) query = query.or(buildSearchConditions(q));
  if (processBase) query = query.eq('process_base', processBase);
  if (processStyle) query = query.eq('process_style', processStyle);

  const continentConditions = buildOriginConditions(getContinentFilterCandidates(continent));
  if (continentConditions) query = query.or(continentConditions);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CatalogViewDiscoverRow[];
}

function mapDiscoverRowsFromBeans(beans: CoffeeBean[]): CatalogViewDiscoverRow[] {
  return beans.map((bean) => ({
    roaster_bean_id: bean.id,
    origin_country: bean.originCountry,
    variety: bean.variety,
    process_method: bean.processRaw ?? bean.process,
    process_base: bean.processBase,
    process_style: bean.processStyle,
  }));
}

export function buildProcessOptions(rows: CatalogViewDiscoverRow[]): BeanDiscoverOption[] {
  return buildProcessBaseOptions(rows);
}

function normalizeRowProcess(row: CatalogViewDiscoverRow) {
  return normalizeProcess(row.process_method, {
    base: isProcessBaseId(row.process_base) ? row.process_base : undefined,
    style: isProcessStyleId(row.process_style) ? row.process_style : undefined,
  });
}

function hasDiscoverProcess(row: CatalogViewDiscoverRow): boolean {
  return Boolean(normalizeString(row.process_method) || row.process_base || row.process_style);
}

function normalizeBeanProcess(bean: Pick<CoffeeBean, 'process' | 'processRaw' | 'processBase' | 'processStyle'>) {
  return normalizeProcess(bean.processRaw ?? bean.process, {
    base: bean.processBase,
    style: bean.processStyle,
  });
}

export function buildProcessBaseOptions(rows: CatalogViewDiscoverRow[]): BeanDiscoverOption[] {
  const counts = new Map<ProcessBaseId, number>();
  for (const row of rows) {
    if (!hasDiscoverProcess(row)) continue;
    const normalized = normalizeRowProcess(row);
    counts.set(normalized.base, (counts.get(normalized.base) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hans-CN'))
    .map(([id, count]) => ({
      id,
      label: getProcessBaseLabel(id),
      count,
    }));
}

export function buildProcessStyleOptions(
  rows: CatalogViewDiscoverRow[],
  selectedBase?: ProcessBaseId
): BeanDiscoverOption[] {
  const allowedStyles = new Set(getAvailableProcessStyleDefinitions(selectedBase).map((item) => item.id));
  const counts = new Map<ProcessStyleId, number>();

  for (const row of rows) {
    if (!hasDiscoverProcess(row)) continue;
    const normalized = normalizeRowProcess(row);
    if (selectedBase && normalized.base !== selectedBase) continue;
    if (!allowedStyles.has(normalized.style)) continue;
    counts.set(normalized.style, (counts.get(normalized.style) ?? 0) + 1);
  }

  return getAvailableProcessStyleDefinitions(selectedBase)
    .map((definition) => ({
      id: definition.id,
      label: definition.label,
      count: counts.get(definition.id) ?? 0,
    }))
    .filter((option) => option.count > 0);
}

export function buildContinentOptions(rows: CatalogViewDiscoverRow[]): BeanDiscoverOption[] {
  const counts = new Map<BeanDiscoverContinent, number>();
  for (const row of rows) {
    const country = matchAtlasCountry(row.origin_country);
    if (!country) continue;
    counts.set(country.continentId, (counts.get(country.continentId) ?? 0) + 1);
  }

  return ORIGIN_ATLAS_CONTINENTS.map((continent) => ({
    id: continent.id,
    label: continent.name,
    count: counts.get(continent.id) ?? 0,
    description: continent.editorialLabel,
  })).filter((option) => option.count > 0);
}

export function buildCountryOptions(rows: CatalogViewDiscoverRow[]): BeanDiscoverOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const country = matchAtlasCountry(row.origin_country);
    if (!country) continue;
    counts.set(country.name, (counts.get(country.name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hans-CN'))
    .map(([label, count]) => ({
      id: label,
      label,
      count,
    }));
}

export function buildVarietyOptions(rows: CatalogViewDiscoverRow[]): BeanDiscoverOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const variety = normalizeString(row.variety);
    if (!variety) continue;
    counts.set(variety, (counts.get(variety) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'zh-Hans-CN'))
    .map(([label, count]) => ({
      id: label,
      label,
      count,
    }));
}

async function getEditorialConfig(filters: Pick<BeanListFilters, 'processBase' | 'continent' | 'country'>) {
  const editorialConfigs = await getBeanDiscoverEditorialConfigs();
  const normalizedProcessBaseLabel = filters.processBase ? getProcessBaseLabel(filters.processBase) : undefined;
  const matchedConfigs = editorialConfigs.filter((config) => {
    if (config.match.process && normalizeString(config.match.process) !== normalizedProcessBaseLabel) return false;
    if (config.match.continent && config.match.continent !== filters.continent) return false;
    if (config.match.country && config.match.country !== filters.country) return false;
    return true;
  });

  return matchedConfigs.sort((left, right) => {
    const leftSpecificity = Object.values(left.match).filter(Boolean).length;
    const rightSpecificity = Object.values(right.match).filter(Boolean).length;
    return rightSpecificity - leftSpecificity;
  })[0] ?? editorialConfigs[0] ?? BEAN_DISCOVER_EDITORIAL_CONFIGS[0];
}

function scoreEditorialPick(
  bean: CoffeeBean,
  filters: Pick<BeanListFilters, 'processBase' | 'processStyle' | 'continent' | 'country'>
): number {
  const matchedCountry = matchAtlasCountry(bean.originCountry) ?? matchAtlasCountry(bean.name);
  const normalizedProcess = normalizeBeanProcess(bean);
  let score = bean.salesCount;
  if (bean.isInStock) score += 1200;
  if (bean.isNewArrival) score += 900;
  if (filters.processBase && normalizedProcess.base === filters.processBase) score += 300;
  if (filters.processStyle && normalizedProcess.style === filters.processStyle) score += 220;
  if (filters.country && matchedCountry?.name === filters.country) score += 600;
  if (filters.continent && matchedCountry?.continentId === filters.continent) score += 240;
  return score;
}

export function buildEditorialReason(
  bean: CoffeeBean,
  filters: Pick<BeanListFilters, 'processBase' | 'processStyle' | 'continent' | 'country'>,
  copyOverrides?: Awaited<ReturnType<typeof readLightQuestionCopyConfig>>['api']['editorialReasons']
): string {
  const matchedCountry = matchAtlasCountry(bean.originCountry) ?? matchAtlasCountry(bean.name);
  const normalizedProcess = normalizeBeanProcess(bean);
  if (filters.country && matchedCountry?.name === filters.country) {
    return copyOverrides
      ? formatLightQuestionTemplate(copyOverrides.country, { country: filters.country })
      : `代表 ${filters.country} 当前路径的典型杯型，适合先建立国家风味印象。`;
  }
  if (filters.processBase && normalizedProcess.base === filters.processBase) {
    const processLabel =
      filters.processStyle && normalizedProcess.style === filters.processStyle
        ? normalizedProcess.label
        : getProcessBaseLabel(filters.processBase);
    return copyOverrides
      ? formatLightQuestionTemplate(copyOverrides.processBase, { processLabel })
      : `${processLabel} 轮廓更清晰，适合拿来比较处理法差异。`;
  }
  if (filters.continent) {
    const continent = ORIGIN_ATLAS_CONTINENT_MAP.get(filters.continent);
    if (continent) {
      return copyOverrides
        ? formatLightQuestionTemplate(copyOverrides.continent, { continent: continent.name })
        : `更能体现 ${continent.name} 这条路径的风土和风味方向。`;
    }
  }
  if (bean.isNewArrival) {
    return copyOverrides?.newArrival ?? '最近更新，适合第一时间尝鲜，看看目录里最新的风味走向。';
  }
  if (bean.salesCount > 0) {
    return copyOverrides?.sales ?? '销量更稳定，是这条路径里更容易形成共识的一支代表样本。';
  }
  return copyOverrides?.fallback ?? '风味辨识度和稳定性都不错，适合作为当前探索路径的起点。';
}

async function buildEditorialPicks(filters: BeanListFilters): Promise<BeanDiscoverPayload['editorPicks']> {
  const { getCatalogBeansByIds } = await import('../catalog.ts');
  const [config, copyConfig] = await Promise.all([getEditorialConfig(filters), readLightQuestionCopyConfig()]);
  const limit = filters.country ? 3 : 4;
  const selectedBeans: CoffeeBean[] = [];

  if (config.beanIds && config.beanIds.length > 0) {
    const manualBeans = await getCatalogBeansByIds(config.beanIds);
    for (const bean of manualBeans) {
      if (!matchesBeanFilters(bean, filters)) continue;
      if (selectedBeans.some((candidate) => candidate.id === bean.id)) continue;
      selectedBeans.push(bean);
      if (selectedBeans.length >= limit) break;
    }
  }

  if (selectedBeans.length < limit) {
    const generatedCandidates = hasSupabaseServerEnv
      ? await getCatalogBeansByIds(
          await queryBeanIdsFromView({
            ...filters,
            sort: 'sales_desc',
            limit: 24,
            offset: 0,
          })
        )
      : await loadLocalBeans({
          ...filters,
          sort: 'sales_desc',
        });

    const rankedCandidates = generatedCandidates
      .filter((bean) => matchesBeanFilters(bean, filters))
      .sort((left, right) => scoreEditorialPick(right, filters) - scoreEditorialPick(left, filters));

    for (const bean of rankedCandidates) {
      if (selectedBeans.some((candidate) => candidate.id === bean.id)) continue;
      selectedBeans.push(bean);
      if (selectedBeans.length >= limit) break;
    }
  }

  return selectedBeans.slice(0, limit).map((bean) => ({
    bean: mapBeanCard(bean),
    reason: buildEditorialReason(bean, filters, copyConfig.api.editorialReasons),
  }));
}

async function buildEditorialPicksFallback(filters: BeanListFilters): Promise<BeanDiscoverPayload['editorPicks']> {
  const limit = filters.country ? 3 : 4;
  const [fallbackCandidates, copyConfig] = await Promise.all([
    loadLocalBeans({
      ...filters,
      sort: 'sales_desc',
    }),
    readLightQuestionCopyConfig(),
  ]);

  return fallbackCandidates
    .filter((bean) => matchesBeanFilters(bean, filters))
    .sort((left, right) => scoreEditorialPick(right, filters) - scoreEditorialPick(left, filters))
    .slice(0, limit)
    .map((bean) => ({
      bean: mapBeanCard(bean),
      reason: buildEditorialReason(bean, filters, copyConfig.api.editorialReasons),
    }));
}

async function buildDiscoverFallbackPayload({
  q,
  processBase,
  processStyle,
  continent,
  country,
}: BeanDiscoverFilters): Promise<BeanDiscoverPayload> {
  const currentFilters: BeanListFilters = {
    q,
    processBase,
    processStyle,
    continent,
    country,
  };

  const [baseBeans, styleBeans, continentBeans, countryBeans, totalBeans, editorPicks] = await Promise.all([
    loadLocalBeans({ q }),
    loadLocalBeans({ q, processBase }),
    loadLocalBeans({ q, processBase }),
    loadLocalBeans({ q, processBase, continent }),
    loadLocalBeans(currentFilters),
    buildEditorialPicksFallback(currentFilters),
  ]);

  const editorialConfig = await getEditorialConfig(currentFilters);

  return {
    processBaseOptions: buildProcessBaseOptions(mapDiscoverRowsFromBeans(baseBeans)),
    processStyleOptions: buildProcessStyleOptions(mapDiscoverRowsFromBeans(styleBeans), processBase),
    continentOptions: buildContinentOptions(mapDiscoverRowsFromBeans(continentBeans)),
    countryOptions: buildCountryOptions(mapDiscoverRowsFromBeans(countryBeans)),
    varietyOptions: buildVarietyOptions(mapDiscoverRowsFromBeans(totalBeans)),
    editorial: {
      title: editorialConfig.title,
      subtitle: editorialConfig.subtitle,
      mode: editorialConfig.id === 'default' ? 'fallback' : 'manual',
    },
    editorPicks,
    resultSummary: {
      total: totalBeans.length,
      processBase,
      processStyle,
      continent,
      country,
    },
  };
}

export async function buildDiscoverPrimaryPayload(
  { q, processBase, processStyle, continent, country }: BeanDiscoverFilters,
  {
    hasSupabaseEnv = hasSupabaseServerEnv,
    queryDiscoverRowsFn = queryDiscoverRows,
    countBeanIdsFn = countBeanIdsFromView,
    loadLocalBeansFn = loadLocalBeans,
    buildEditorialPicksFn = buildEditorialPicks,
  }: BuildDiscoverPrimaryDeps = {}
): Promise<BeanDiscoverPayload> {
  const currentFilters: BeanListFilters = {
    q,
    processBase,
    processStyle,
    continent,
    country,
  };

  let processBaseRows: CatalogViewDiscoverRow[];
  let processStyleRows: CatalogViewDiscoverRow[];
  let continentRows: CatalogViewDiscoverRow[];
  let countryRows: CatalogViewDiscoverRow[];
  let varietyRows: CatalogViewDiscoverRow[];
  let total: number;

  if (hasSupabaseEnv) {
    [processBaseRows, processStyleRows, continentRows, countryRows, varietyRows, total] = await Promise.all([
      queryDiscoverRowsFn({ q }),
      queryDiscoverRowsFn({ q, processBase }),
      queryDiscoverRowsFn({ q, processBase }),
      queryDiscoverRowsFn({ q, processBase, continent }),
      queryDiscoverRowsFn(currentFilters),
      countBeanIdsFn(currentFilters),
    ]);
  } else {
    const baseRows = mapDiscoverRowsFromBeans(await loadLocalBeansFn({ q }));
    processBaseRows = baseRows;
    processStyleRows = baseRows.filter((row) => {
      if (!processBase) return true;
      return normalizeRowProcess(row).base === processBase;
    });
    continentRows = processStyleRows;
    countryRows = processStyleRows.filter((row) => {
      if (!continent) return true;
      return matchAtlasCountry(row.origin_country)?.continentId === continent;
    });
    varietyRows = countryRows.filter((row) => {
      if (!country) return true;
      return matchAtlasCountry(row.origin_country)?.name === country;
    });
    total = (await loadLocalBeansFn(currentFilters)).length;
  }

  const editorialConfig = await getEditorialConfig(currentFilters);

  return {
    processBaseOptions: buildProcessBaseOptions(processBaseRows),
    processStyleOptions: buildProcessStyleOptions(processStyleRows, processBase),
    continentOptions: buildContinentOptions(continentRows),
    countryOptions: buildCountryOptions(countryRows),
    varietyOptions: buildVarietyOptions(varietyRows),
    editorial: {
      title: editorialConfig.title,
      subtitle: editorialConfig.subtitle,
      mode: editorialConfig.id === 'default' ? 'fallback' : 'manual',
    },
    editorPicks: await buildEditorialPicksFn(currentFilters),
    resultSummary: {
      total,
      processBase,
      processStyle,
      continent,
      country,
    },
  };
}

export function createBeanDiscoverService({
  loadPrimaryPayload,
  loadFallbackPayload,
}: BeanDiscoverServiceDeps = {
  loadPrimaryPayload: buildDiscoverPrimaryPayload,
  loadFallbackPayload: buildDiscoverFallbackPayload,
}) {
  return {
    async getBeanDiscoverPayload(filters: BeanDiscoverFilters): Promise<BeanDiscoverPayload> {
      return loadPrimaryPayload(filters);
    },
  };
}

const beanDiscoverService = createBeanDiscoverService();

export async function getBeanDiscoverV1({
  q,
  processBase,
  processStyle,
  continent,
  country,
}: BeanDiscoverFilters): Promise<BeanDiscoverPayload> {
  const currentFilters: BeanDiscoverFilters = {
    q: sanitizeSearchTerm(normalizeString(q)),
    processBase,
    processStyle,
    continent,
    country: normalizeString(country),
  };

  return beanDiscoverService.getBeanDiscoverPayload(currentFilters);
}
