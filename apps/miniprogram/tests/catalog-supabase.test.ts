import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeLatestNewArrivalBeanIds } from '../src/services/catalog-supabase/shared-core.ts';
import { mapCatalogBeanRow, mapRoasterDetail, mapRoasterSummary } from '../src/services/catalog-supabase/shared-mappers.ts';

test('normalizeLatestNewArrivalBeanIds falls back when synced ids are empty', () => {
  assert.equal(normalizeLatestNewArrivalBeanIds([]), null);
  assert.deepEqual(normalizeLatestNewArrivalBeanIds(['bean-1', 'bean-2']), ['bean-1', 'bean-2']);
});

test('mapCatalogBeanRow maps supabase row fields into miniprogram bean dto', () => {
  const bean = mapCatalogBeanRow(
    {
      roaster_bean_id: 'bean-1',
      roaster_id: 'roaster-1',
      roaster_name: 'Roaster One',
      city: 'Shanghai',
      display_name: 'Ethiopia Guji',
      origin_country: 'Ethiopia',
      origin_region: 'Guji',
      farm: 'Halo',
      variety: '74110',
      process_method: 'Washed',
      roast_level: 'Light',
      price_amount: '88',
      price_currency: 'CNY',
      sales_count: 120,
      image_url: 'https://img.example/bean.jpg',
      product_url: 'https://shop.example/bean-1',
      is_in_stock: true,
    },
    new Set(['bean-1'])
  );

  assert.deepEqual(bean, {
    id: 'bean-1',
    name: 'Ethiopia Guji',
    roasterId: 'roaster-1',
    roasterName: 'Roaster One',
    city: 'Shanghai',
    originCountry: 'Ethiopia',
    originRegion: 'Guji',
    farm: 'Halo',
    variety: '74110',
    process: '水洗',
    processBase: 'washed',
    processStyle: 'traditional',
    processRaw: 'Washed',
    roastLevel: 'Light',
    price: 88,
    discountedPrice: 88,
    currency: 'CNY',
    salesCount: 120,
    tastingNotes: [],
    imageUrl: 'https://img.example/bean.jpg',
    productUrl: 'https://shop.example/bean-1',
    isInStock: true,
    isNewArrival: true,
  });
});

test('mapRoasterSummary exposes the aggregated bean count and external links', () => {
  const roaster = mapRoasterSummary(
    {
      id: 'roaster-1',
      name: 'Roaster One',
      city: 'Shanghai',
      description: 'Warm profile',
      logo_url: 'https://img.example/logo.jpg',
      website_url: null,
      instagram_handle: null,
    },
    {
      beanCount: 3,
      coverImageUrl: 'https://img.example/cover.jpg',
      taobaoUrl: 'https://shop.example/taobao',
      xiaohongshuUrl: 'https://shop.example/xhs',
    }
  );

  assert.deepEqual(roaster, {
    id: 'roaster-1',
    name: 'Roaster One',
    city: 'Shanghai',
    beanCount: 3,
    description: 'Warm profile',
    logoUrl: 'https://img.example/logo.jpg',
    coverImageUrl: 'https://img.example/cover.jpg',
    taobaoUrl: 'https://shop.example/taobao',
    xiaohongshuUrl: 'https://shop.example/xhs',
  });
});

test('mapRoasterDetail merges summary data with detail-only fields', () => {
  const roaster = mapRoasterDetail(
    {
      id: 'roaster-1',
      name: 'Roaster One',
      city: 'Shanghai',
      description: 'Warm profile',
      logo_url: 'https://img.example/logo.jpg',
      website_url: 'https://roaster.example',
      instagram_handle: 'roaster.one',
    },
    {
      beanCount: 3,
      coverImageUrl: 'https://img.example/cover.jpg',
      taobaoUrl: null,
      xiaohongshuUrl: null,
    },
    []
  );

  assert.deepEqual(roaster, {
    id: 'roaster-1',
    name: 'Roaster One',
    city: 'Shanghai',
    beanCount: 3,
    description: 'Warm profile',
    logoUrl: 'https://img.example/logo.jpg',
    coverImageUrl: 'https://img.example/cover.jpg',
    taobaoUrl: null,
    xiaohongshuUrl: null,
    websiteUrl: 'https://roaster.example',
    instagramHandle: 'roaster.one',
    beans: [],
  });
});
