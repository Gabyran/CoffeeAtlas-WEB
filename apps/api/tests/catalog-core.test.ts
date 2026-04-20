import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSampleBeans,
  getSampleRoasters,
  mapCoffeeBean,
  mapRoaster,
} from '../lib/catalog-core.ts';
import { sampleCatalog } from '../lib/sample-data.ts';
import type {
  BeanRow,
  RoasterAggregate,
  RoasterBeanRow,
  RoasterRow,
} from '../lib/catalog-core.ts';

function collectActiveSampleIds(): Set<string> {
  return new Set(
    sampleCatalog.filter((row) => row.status === 'ACTIVE').map((row) => row.roasterBeanId)
  );
}

const activeSampleIds = collectActiveSampleIds();
const activeSampleRows = sampleCatalog.filter((row) => row.status === 'ACTIVE');

test('mapCoffeeBean builds a CoffeeBean from row data without touching the database', () => {
  const beanRow: RoasterBeanRow = {
    id: 'bean-1',
    display_name: 'Sunrise Blend',
    roaster_id: 'roaster-1',
    bean_id: 'origin-1',
    roast_level: 'Medium',
    price_amount: '198',
    price_currency: 'USD',
    sales_count: '1,200+',
    image_url: 'https://example.com/bean.png',
    is_in_stock: null,
  };

  const roasterRow: RoasterRow = {
    id: 'roaster-1',
    name: 'Elevated Roastery',
    city: 'Shanghai',
    description: 'Test roaster',
    logo_url: 'https://example.com/logo.png',
    website_url: 'https://example.com',
    instagram_handle: '@elevated',
  };

  const beanDetail: BeanRow = {
    id: 'origin-1',
    canonical_name: 'Sunrise Blend',
    origin_country: 'Ethiopia',
    origin_region: 'Yirgacheffe',
    farm: 'Bright Farm',
    variety: 'Heirloom',
    process_method: 'Washed',
    flavor_tags: ['chocolate', 'citrus'],
  };

  const result = mapCoffeeBean(beanRow, roasterRow, beanDetail, new Set(['bean-1']));

  assert.equal(result.id, beanRow.id);
  assert.equal(result.name, beanRow.display_name);
  assert.equal(result.roasterId, 'roaster-1');
  assert.equal(result.roasterName, 'Elevated Roastery');
  assert.equal(result.city, 'Shanghai');
  assert.equal(result.originCountry, 'Ethiopia');
  assert.equal(result.originRegion, 'Yirgacheffe');
  assert.equal(result.farm, 'Bright Farm');
  assert.equal(result.variety, 'Heirloom');
  assert.equal(result.process, '水洗');
  assert.equal(result.processBase, 'washed');
  assert.equal(result.processStyle, 'traditional');
  assert.equal(result.processRaw, 'Washed');
  assert.equal(result.roastLevel, 'Medium');
  assert.equal(result.price, 198);
  assert.equal(result.discountedPrice, 198);
  assert.equal(result.currency, 'USD');
  assert.equal(result.salesCount, 1200);
  assert.deepEqual(result.tastingNotes, ['chocolate', 'citrus']);
  assert.equal(result.imageUrl, 'https://example.com/bean.png');
  assert.equal(result.isNewArrival, true);
  assert.equal(result.isInStock, true);
});

test('mapCoffeeBean falls back to recent updated_at when synced ids are unavailable', () => {
  const beanRow: RoasterBeanRow = {
    id: 'bean-2',
    display_name: 'Fresh Crop',
    roaster_id: 'roaster-1',
    bean_id: 'origin-2',
    roast_level: 'Light',
    price_amount: '128',
    price_currency: 'CNY',
    sales_count: 12,
    image_url: null,
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    is_in_stock: true,
  };

  const roasterRow: RoasterRow = {
    id: 'roaster-1',
    name: 'Elevated Roastery',
    city: 'Shanghai',
    description: 'Test roaster',
    logo_url: null,
    website_url: null,
    instagram_handle: null,
  };

  const beanDetail: BeanRow = {
    id: 'origin-2',
    canonical_name: 'Fresh Crop',
    origin_country: 'Kenya',
    origin_region: 'Nyeri',
    farm: 'Hill Farm',
    variety: 'SL28',
    process_method: 'Washed',
    flavor_tags: [],
  };

  const result = mapCoffeeBean(beanRow, roasterRow, beanDetail);

  assert.equal(result.isNewArrival, true);
});

test('mapRoaster prefers explicit aggregate data but trims fallback logos', () => {
  const row: RoasterRow = {
    id: 'roaster-2',
    name: 'Cloud Roasters',
    city: 'Guangzhou',
    description: 'A craft roaster',
    logo_url: '  https://logo.example ',
    website_url: null,
    instagram_handle: null,
  };

  const aggregate: RoasterAggregate = {
    beanCount: 42,
    coverImageUrl: null,
    taobaoUrl: 'https://taobao.example',
    xiaohongshuUrl: 'https://xiaohongshu.example',
  };

  const result = mapRoaster(row, aggregate);

  assert.equal(result.id, row.id);
  assert.equal(result.name, row.name);
  assert.equal(result.city, 'Guangzhou');
  assert.equal(result.coverImageUrl, 'https://logo.example');
  assert.equal(result.beanCount, 42);
  assert.equal(result.taobaoUrl, 'https://taobao.example');
  assert.equal(result.xiaohongshuUrl, 'https://xiaohongshu.example');
});

test('getSampleBeans only returns ACTIVE sample beans', () => {
  const sampleBeanIds = getSampleBeans().map((bean) => bean.id);

  assert.ok(activeSampleIds.size > 0, 'there should be ACTIVE sample entries');
  const expectedIds = activeSampleRows.map((row) => row.roasterBeanId).sort();
  const actualIds = [...sampleBeanIds].sort();
  assert.deepEqual(actualIds, expectedIds, 'sample ids should match ACTIVE sample data');
});

test('getSampleRoasters derives roaster data from ACTIVE sample rows', () => {
  const expectedRoasterIds = Array.from(new Set(activeSampleRows.map((row) => row.roasterName))).sort();
  assert.ok(expectedRoasterIds.length > 0, 'there should be ACTIVE sample roasters');

  const roasters = getSampleRoasters();
  const roasterIds = roasters.map((roaster) => roaster.id).sort();
  assert.deepEqual(roasterIds, expectedRoasterIds);

  for (const roaster of roasters) {
    const sourceRows = activeSampleRows.filter((row) => row.roasterName === roaster.id);
    assert.ok(sourceRows.length > 0, `missing sample roaster data for ${roaster.id}`);
    assert.equal(roaster.name, roaster.id);
    assert.equal(roaster.beanCount, sourceRows.length);
    assert.ok(
      sourceRows.some((row) => (row.city ?? '') === roaster.city),
      `sample roaster city should come from ACTIVE rows for ${roaster.id}`
    );
  }
});
