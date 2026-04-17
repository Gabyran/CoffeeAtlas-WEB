import assert from 'node:assert/strict';
import test from 'node:test';

import { runTaobaoDailySync } from '../lib/taobao-sync/daily.ts';
import type { TaobaoBinding, TaobaoCleanupApplyResult, TaobaoCleanupPreview, TaobaoSyncResult } from '../lib/taobao-sync/types.ts';

const bindingA: TaobaoBinding = {
  id: 'binding-a',
  roasterId: 'roaster-a',
  roasterName: '白鲸咖啡',
  sourceId: 'source-a',
  sourceName: '白鲸咖啡店',
  canonicalShopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=a',
  canonicalShopName: '白鲸咖啡店',
  searchKeyword: '白鲸咖啡 咖啡豆',
  isActive: true,
  lastSyncedAt: null,
};

const bindingB: TaobaoBinding = {
  ...bindingA,
  id: 'binding-b',
  roasterId: 'roaster-b',
  roasterName: '别家咖啡',
  sourceId: 'source-b',
  sourceName: '别家咖啡店',
  canonicalShopUrl: 'https://store.taobao.com/shop/view_shop.htm?appUid=b',
  canonicalShopName: '别家咖啡店',
  searchKeyword: '别家咖啡 咖啡豆',
};

function createArrivalsResult(status: TaobaoSyncResult['status']): TaobaoSyncResult {
  return {
    importJobId: 'job-1',
    status,
    processedShops: 1,
    failedShops: status === 'FAILED' ? 1 : 0,
    processedRows: 5,
    skippedRows: 1,
    errorRows: status === 'FAILED' ? 1 : 0,
    insertedBeans: 2,
    insertedRoasterBeans: 2,
    updatedRoasterBeans: 1,
    draftRows: 0,
  };
}

function createPreview(overrides: Partial<TaobaoCleanupPreview> = {}): TaobaoCleanupPreview {
  return {
    token: 'preview-token',
    binding: bindingA,
    createdAt: '2026-04-17T04:00:00.000Z',
    expiresAt: '2026-04-17T06:00:00.000Z',
    canApply: true,
    warnings: [],
    currentDbCount: 3,
    scannedTitleCount: 3,
    scannedStructuredCount: 3,
    stopReason: 'end_reached',
    candidates: [],
    ...overrides,
  };
}

function createApplyResult(overrides: Partial<TaobaoCleanupApplyResult> = {}): TaobaoCleanupApplyResult {
  return {
    token: 'preview-token',
    importJobId: 'cleanup-job-1',
    binding: bindingA,
    archivedCount: 1,
    skippedCount: 0,
    warnings: [],
    ...overrides,
  };
}

function createNow(values: number[]) {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };
}

function createLogger() {
  const state = {
    logs: [] as string[],
    errors: [] as string[],
    logger: {
      log(message: string) {
        state.logs.push(message);
      },
      error(message: string) {
        state.errors.push(message);
      },
    },
  };
  return state;
}

test('runTaobaoDailySync returns failed summary when arrivals sync fails', async () => {
  let listBindingsCalled = false;
  const { logger } = createLogger();

  const result = await runTaobaoDailySync({
    logger,
    now: createNow([0, 1000]),
    runArrivalsSync: async () => createArrivalsResult('FAILED'),
    listActiveBindings: async () => {
      listBindingsCalled = true;
      return [bindingA];
    },
    previewCleanup: async () => createPreview(),
    applyCleanup: async () => createApplyResult(),
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.status, 'FAILED');
  assert.equal(result.summary.phase, 'arrivals');
  assert.equal(result.summary.cleanup.length, 0);
  assert.equal(listBindingsCalled, false);
});

test('runTaobaoDailySync leaves cleanup untouched when no offshelf candidates are found', async () => {
  let applyCalled = false;

  const result = await runTaobaoDailySync({
    logger: createLogger().logger,
    now: createNow([0, 1500]),
    runArrivalsSync: async () => createArrivalsResult('SUCCEEDED'),
    listActiveBindings: async () => [bindingA],
    previewCleanup: async () => createPreview(),
    applyCleanup: async () => {
      applyCalled = true;
      return createApplyResult();
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.summary.status, 'SUCCEEDED');
  assert.equal(result.summary.cleanup[0]?.roaster, bindingA.roasterName);
  assert.equal(result.summary.cleanup[0]?.archived, 0);
  assert.equal(result.summary.cleanup[0]?.skipped, 0);
  assert.equal(result.summary.totalArchived, 0);
  assert.equal(applyCalled, false);
});

test('runTaobaoDailySync skips auto archive when preview has blocking warnings', async () => {
  let applyCalled = false;

  const result = await runTaobaoDailySync({
    logger: createLogger().logger,
    now: createNow([0, 1500]),
    runArrivalsSync: async () => createArrivalsResult('SUCCEEDED'),
    listActiveBindings: async () => [bindingA],
    previewCleanup: async () =>
      createPreview({
        canApply: false,
        warnings: ['listing_scan_hit_safe_limit'],
        candidates: [
          {
            roasterBeanId: 'rb-1',
            displayName: '疑似下架豆子',
            sourceItemId: '101',
            sourceSkuId: '1',
            productUrl: 'https://item.taobao.com/item.htm?id=101&skuId=1',
            reason: 'missing_from_current_shop_listing',
          },
        ],
      }),
    applyCleanup: async () => {
      applyCalled = true;
      return createApplyResult();
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.summary.cleanup[0]?.archived, 0);
  assert.equal(result.summary.cleanup[0]?.skipped, 1);
  assert.deepEqual(result.summary.cleanup[0]?.warnings, ['listing_scan_hit_safe_limit']);
  assert.equal(applyCalled, false);
});

test('runTaobaoDailySync auto archives candidates when preview can apply', async () => {
  const appliedTokens: string[] = [];

  const result = await runTaobaoDailySync({
    logger: createLogger().logger,
    now: createNow([0, 2100]),
    runArrivalsSync: async () => createArrivalsResult('SUCCEEDED'),
    listActiveBindings: async () => [bindingA],
    previewCleanup: async () =>
      createPreview({
        token: 'apply-me',
        candidates: [
          {
            roasterBeanId: 'rb-1',
            displayName: '下架豆子',
            sourceItemId: '101',
            sourceSkuId: '1',
            productUrl: 'https://item.taobao.com/item.htm?id=101&skuId=1',
            reason: 'missing_from_current_shop_listing',
          },
        ],
      }),
    applyCleanup: async (token: string) => {
      appliedTokens.push(token);
      return createApplyResult({ token, archivedCount: 1, skippedCount: 0 });
    },
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(appliedTokens, ['apply-me']);
  assert.equal(result.summary.cleanup[0]?.archived, 1);
  assert.equal(result.summary.totalArchived, 1);
});

test('runTaobaoDailySync continues remaining bindings after a cleanup error and reports partial', async () => {
  const result = await runTaobaoDailySync({
    logger: createLogger().logger,
    now: createNow([0, 2400]),
    runArrivalsSync: async () => createArrivalsResult('SUCCEEDED'),
    listActiveBindings: async () => [bindingA, bindingB],
    previewCleanup: async (bindingId: string) => {
      if (bindingId === bindingA.id) {
        throw new Error('MCP unavailable');
      }
      return createPreview({ binding: bindingB });
    },
    applyCleanup: async () => createApplyResult(),
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.status, 'PARTIAL');
  assert.equal(result.summary.cleanupErrors, 1);
  assert.equal(result.summary.cleanup.length, 2);
  assert.equal(result.summary.cleanup[0]?.error, 'MCP unavailable');
  assert.equal(result.summary.cleanup[1]?.roaster, bindingB.roasterName);
});
