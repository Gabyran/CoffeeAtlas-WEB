import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  applyTaobaoOffshelfCleanup,
  previewTaobaoOffshelfCleanup,
  taobaoCleanupConstants,
  taobaoCleanupInternals,
} from '../lib/taobao-sync/cleanup.ts';
import { buildOffshelfCandidates } from '../lib/taobao-sync/parsers.ts';
import { selectBindingByRoasterName } from '../lib/taobao-sync/repository.ts';
import type {
  ExistingRoasterBeanRecord,
  TaobaoBinding,
  TaobaoCleanupSnapshot,
  TaobaoMcpReadPageResult,
  TaobaoStructuredProduct,
  TaobaoSyncConfig,
} from '../lib/taobao-sync/types.ts';

const binding: TaobaoBinding = {
  id: 'binding-1',
  roasterId: 'roaster-1',
  roasterName: '白鲸咖啡',
  sourceId: 'source-1',
  sourceName: '白鲸咖啡豆子店',
  canonicalShopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=abc123',
  canonicalShopName: '白鲸咖啡豆子店',
  searchKeyword: '白鲸咖啡豆子店 咖啡豆',
  isActive: true,
  lastSyncedAt: null,
};

const config: TaobaoSyncConfig = {
  mcpUrl: 'http://localhost:3655/mcp',
  maxItemsPerShop: 20,
  delayMinMs: 1,
  delayMaxMs: 1,
  pageReadMaxLength: 8000,
  maxLowConfidenceDetailReadsPerShop: 4,
  maxShopRetries: 1,
  visionBaseUrl: null,
  visionApiKey: null,
  visionModel: null,
};

function makeReadResult(content: string): TaobaoMcpReadPageResult {
  return {
    url: binding.canonicalShopUrl,
    title: binding.canonicalShopName,
    content,
    totalLength: content.length,
    truncated: false,
  };
}

test('buildOffshelfCandidates only returns rows missing from both identity and title sets', () => {
  const currentProducts: ExistingRoasterBeanRecord[] = [
    {
      id: 'rb-1',
      beanId: 'bean-1',
      displayName: '埃塞俄比亚 耶加雪菲 水洗 227g',
      priceAmount: 79,
      productUrl: 'https://item.taobao.com/item.htm?id=101&skuId=1',
      imageUrl: null,
      sourceItemId: '101',
      sourceSkuId: '1',
      status: 'ACTIVE',
    },
    {
      id: 'rb-2',
      beanId: 'bean-2',
      displayName: '哥伦比亚 慧兰 粉红波旁 100g',
      priceAmount: 88,
      productUrl: 'https://item.taobao.com/item.htm?id=102&skuId=2',
      imageUrl: null,
      sourceItemId: '102',
      sourceSkuId: '2',
      status: 'ACTIVE',
    },
  ];

  const structuredProducts: TaobaoStructuredProduct[] = [
    {
      title: '埃塞俄比亚 耶加雪菲 水洗 227g',
      shopName: binding.canonicalShopName,
      shopUrl: binding.canonicalShopUrl,
      productUrl: 'https://item.taobao.com/item.htm?id=101&skuId=1',
      imageUrl: null,
      priceAmount: 79,
      sourceItemId: '101',
      sourceSkuId: '1',
    },
  ];

  const candidates = buildOffshelfCandidates({
    currentProducts,
    listingTitles: ['埃塞俄比亚 耶加雪菲 水洗 227g'],
    structuredProducts,
  });

  assert.deepEqual(candidates, [
    {
      roasterBeanId: 'rb-2',
      displayName: '哥伦比亚 慧兰 粉红波旁 100g',
      sourceItemId: '102',
      sourceSkuId: '2',
      productUrl: 'https://item.taobao.com/item.htm?id=102&skuId=2',
      reason: 'missing_from_current_shop_listing',
    },
  ]);
});

test('selectBindingByRoasterName supports unique partial roaster name matches', () => {
  assert.equal(
    selectBindingByRoasterName(
      [
        binding,
        {
          ...binding,
          id: 'binding-2',
          roasterId: 'roaster-2',
          roasterName: '别家咖啡',
          sourceId: 'source-2',
          sourceName: '别家咖啡店',
          canonicalShopName: '别家咖啡店',
          canonicalShopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=other',
          searchKeyword: '别家咖啡店 咖啡豆',
        },
      ],
      '白鲸'
    )?.id,
    binding.id
  );
});

test('resolvePreviewWarnings blocks apply on incomplete scans', () => {
  const warnings = taobaoCleanupInternals.resolvePreviewWarnings({
    currentDbCount: 12,
    scannedTitleCount: 2,
    scannedStructuredCount: 1,
    candidateCount: 6,
    stopReason: 'safe_limit',
    scanWarnings: ['listing_tab_not_found'],
  });

  assert.deepEqual(warnings, [
    'listing_tab_not_found',
    'listing_scan_hit_safe_limit',
    'listing_scan_too_small_for_db_count',
    'listing_growth_insufficient',
  ]);
});

test('listing_scan_hit_safe_limit and listing_growth_insufficient are non-blocking', () => {
  const warnings = taobaoCleanupInternals.resolvePreviewWarnings({
    currentDbCount: 12,
    scannedTitleCount: 2,
    scannedStructuredCount: 1,
    candidateCount: 6,
    stopReason: 'safe_limit',
    scanWarnings: [],
  });

  assert.ok(warnings.includes('listing_scan_hit_safe_limit'));
  assert.ok(warnings.includes('listing_growth_insufficient'));
  // listing_scan_too_small_for_db_count 和 all_items_marked_candidate 仍为 blocking
  assert.ok(warnings.includes('listing_scan_too_small_for_db_count'));
});

test('preview writes snapshot and returns applyable preview when scan is complete', async () => {
  const snapshotDir = await mkdtemp(path.join(tmpdir(), 'coffeeatlas-cleanup-preview-'));
  const reads = [
    makeReadResult('首页内容'),
    makeReadResult(['全部宝贝', '埃塞俄比亚 耶加雪菲 水洗 227g', '¥', '10人付款', '哥伦比亚 慧兰 粉红波旁 100g', '¥', '8人付款'].join('\n')),
    makeReadResult(['全部宝贝', '埃塞俄比亚 耶加雪菲 水洗 227g', '¥', '10人付款', '哥伦比亚 慧兰 粉红波旁 100g', '¥', '8人付款'].join('\n')),
    makeReadResult(['全部宝贝', '埃塞俄比亚 耶加雪菲 水洗 227g', '¥', '10人付款', '哥伦比亚 慧兰 粉红波旁 100g', '¥', '8人付款', '没有更多'].join('\n')),
  ];
  let readIndex = 0;

  const client = {
    async navigateToUrl() {},
    async readPageContent() {
      return reads[readIndex++] ?? reads[reads.length - 1];
    },
    async scanPageElements() {
      return { dom: '[12] <span>全部宝贝</span>', totalElements: 1 };
    },
    async clickElement() {},
    async scrollPage() {},
    async searchProducts() {
      return {
        keyword: binding.searchKeyword ?? '',
        count: 2,
        products: [
          {
            title: '埃塞俄比亚 耶加雪菲 水洗 227g',
            productUrl: 'https://item.taobao.com/item.htm?id=101&skuId=1',
            shopName: binding.canonicalShopName,
            shopUrl: binding.canonicalShopUrl,
            price: '79',
          },
          {
            title: '哥伦比亚 慧兰 粉红波旁 100g',
            productUrl: 'https://item.taobao.com/item.htm?id=102&skuId=2',
            shopName: binding.canonicalShopName,
            shopUrl: binding.canonicalShopUrl,
            price: '88',
          },
        ],
      };
    },
    async closePage() {},
  };

  const repository = {
    async findBindingById(id: string) {
      return id === binding.id ? binding : null;
    },
    async findBindingByRoasterName() {
      return null;
    },
    async listTrackedRoasterBeansForBinding() {
      return [
        {
          id: 'rb-1',
          beanId: 'bean-1',
          displayName: '埃塞俄比亚 耶加雪菲 水洗 227g',
          priceAmount: 79,
          productUrl: 'https://item.taobao.com/item.htm?id=101&skuId=1',
          imageUrl: null,
          sourceItemId: '101',
          sourceSkuId: '1',
          status: 'ACTIVE' as const,
        },
      ];
    },
  };

  const preview = await previewTaobaoOffshelfCleanup(
    { bindingId: binding.id },
    { client, repository, config, snapshotDir }
  );

  assert.equal(preview.canApply, true);
  assert.equal(preview.candidates.length, 0);
  assert.equal(preview.scannedTitleCount, 2);

  const rawSnapshot = await fs.readFile(path.join(snapshotDir, `${preview.token}.json`), 'utf8');
  const snapshot = JSON.parse(rawSnapshot) as TaobaoCleanupSnapshot;
  const { hash, ...snapshotBody } = snapshot;
  assert.equal(hash, taobaoCleanupInternals.buildCleanupSnapshotHash(snapshotBody));
});

test('apply requires confirmation text and archives rows from a valid snapshot', async () => {
  const snapshotDir = await mkdtemp(path.join(tmpdir(), 'coffeeatlas-cleanup-apply-'));
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + taobaoCleanupConstants.snapshotTtlMs).toISOString();
  const snapshotBody = {
    version: 1 as const,
    token: 'token123',
    binding,
    createdAt,
    expiresAt,
    canApply: true,
    warnings: [],
    currentDbCount: 1,
    scannedTitleCount: 0,
    scannedStructuredCount: 0,
    stopReason: 'no_growth' as const,
    candidates: [
      {
        roasterBeanId: 'rb-1',
        displayName: '下架豆子',
        sourceItemId: '101',
        sourceSkuId: '1',
        productUrl: 'https://item.taobao.com/item.htm?id=101&skuId=1',
        reason: 'missing_from_current_shop_listing' as const,
      },
    ],
    listingTitles: [],
    structuredProducts: [],
  };

  const snapshot: TaobaoCleanupSnapshot = {
    ...snapshotBody,
    hash: taobaoCleanupInternals.buildCleanupSnapshotHash(snapshotBody),
  };
  await fs.writeFile(path.join(snapshotDir, 'token123.json'), `${JSON.stringify(snapshot)}\n`, 'utf8');

  await assert.rejects(
    () => applyTaobaoOffshelfCleanup({ token: 'token123', confirmText: 'WRONG' }, { snapshotDir, repository: {} as never }),
    /ARCHIVE_OFFSHELF/
  );

  const events: Array<{ action: string; payload: Record<string, unknown> }> = [];
  let finishedStatus = '';

  const repository = {
    async createImportJob() {
      return 'job-1';
    },
    async finishImportJob(args: { status: string }) {
      finishedStatus = args.status;
    },
    async recordEvent(args: { action: string; payload: Record<string, unknown> }) {
      events.push({ action: args.action, payload: args.payload });
    },
    async archiveRoasterBeans() {
      return [{ id: 'rb-1' }];
    },
  };

  const result = await applyTaobaoOffshelfCleanup(
    { token: 'token123', confirmText: taobaoCleanupConstants.confirmText },
    { snapshotDir, repository }
  );

  assert.equal(result.archivedCount, 1);
  assert.equal(result.skippedCount, 0);
  assert.equal(finishedStatus, 'SUCCEEDED');
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'UPDATE');
  assert.equal(events[0].payload.previewToken, 'token123');
  await assert.rejects(() => fs.readFile(path.join(snapshotDir, 'token123.json'), 'utf8'));
});

test('apply rejects expired or tampered snapshots', async () => {
  const snapshotDir = await mkdtemp(path.join(tmpdir(), 'coffeeatlas-cleanup-invalid-'));
  const expiredBody = {
    version: 1 as const,
    token: 'expired-ok',
    binding,
    createdAt: new Date(Date.now() - taobaoCleanupConstants.snapshotTtlMs * 2).toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    canApply: true,
    warnings: [],
    currentDbCount: 1,
    scannedTitleCount: 1,
    scannedStructuredCount: 1,
    stopReason: 'end_reached' as const,
    candidates: [],
    listingTitles: ['仍在售'],
    structuredProducts: [],
  };
  const expiredSnapshot: TaobaoCleanupSnapshot = {
    ...expiredBody,
    hash: taobaoCleanupInternals.buildCleanupSnapshotHash(expiredBody),
  };
  await fs.writeFile(path.join(snapshotDir, 'expired-ok.json'), `${JSON.stringify(expiredSnapshot)}\n`, 'utf8');

  await assert.rejects(
    () => applyTaobaoOffshelfCleanup({ token: 'expired-ok', confirmText: taobaoCleanupConstants.confirmText }, { snapshotDir, repository: {} as never }),
    /expired/
  );

  const snapshot: TaobaoCleanupSnapshot = {
    version: 1,
    token: 'expired',
    binding,
    createdAt: new Date(Date.now() - taobaoCleanupConstants.snapshotTtlMs * 2).toISOString(),
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    canApply: true,
    warnings: [],
    currentDbCount: 1,
    scannedTitleCount: 1,
    scannedStructuredCount: 1,
    stopReason: 'end_reached',
    candidates: [],
    listingTitles: ['仍在售'],
    structuredProducts: [],
    hash: 'broken',
  };
  await fs.writeFile(path.join(snapshotDir, 'expired.json'), `${JSON.stringify(snapshot)}\n`, 'utf8');

  await assert.rejects(
    () => applyTaobaoOffshelfCleanup({ token: 'expired', confirmText: taobaoCleanupConstants.confirmText }, { snapshotDir, repository: {} as never }),
    /hash mismatch/
  );
});
