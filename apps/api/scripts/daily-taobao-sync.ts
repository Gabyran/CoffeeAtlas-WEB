import { config } from 'dotenv';
// 按优先级加载：.env.local > .env.production > .env
config({ path: new URL('../../../.env', import.meta.url).pathname });
config({ path: new URL('../../../.env.production', import.meta.url).pathname });
config({ path: new URL('../../../.env.local', import.meta.url).pathname });

import { applyTaobaoOffshelfCleanup, previewTaobaoOffshelfCleanup } from '../lib/taobao-sync/cleanup.ts';
import { TaobaoSyncRepository } from '../lib/taobao-sync/repository.ts';
import { runTaobaoNewArrivalsSync } from '../lib/taobao-sync/sync.ts';

type DailySyncBindingResult = {
  roasterName: string;
  newBeans: number;
  updatedBeans: number;
  offshelfArchived: number;
  offshelfSkipped: number;
  offshelfWarnings: string[];
};

async function main() {
  const startTime = Date.now();
  console.log('=== 淘宝每日同步开始 ===');

  // 每店最多扫描 200 条，确保全量覆盖
  process.env.TAOBAO_SYNC_MAX_ITEMS_PER_SHOP = '200';

  // 1. 上新同步
  console.log('[1/2] 上新同步...');
  const arrivalsResult = await runTaobaoNewArrivalsSync();

  console.log(
    `  上新结果: status=${arrivalsResult.status}, ` +
      `processed=${arrivalsResult.processedRows}, ` +
      `inserted=${arrivalsResult.insertedBeans}, ` +
      `updated=${arrivalsResult.updatedRoasterBeans}`
  );

  if (arrivalsResult.status === 'FAILED') {
    console.error('上新同步失败，跳过下架检测');
    console.log(
      JSON.stringify(
        {
          status: 'FAILED',
          phase: 'arrivals',
          arrivalsResult,
          cleanupResults: [],
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  // 2. 下架检测 — 对每个 active binding 跑一遍
  console.log('[2/2] 下架检测...');
  const repository = new TaobaoSyncRepository();
  const bindings = await repository.listActiveBindings();
  const cleanupResults: DailySyncBindingResult[] = [];

  for (const binding of bindings) {
    const preview = await previewTaobaoOffshelfCleanup(
      { bindingId: binding.id },
      { repository }
    );

    const hasBlockingWarnings = preview.warnings.some(
      (w) => w !== 'listing_tab_not_found'
    );

    if (preview.candidates.length === 0) {
      console.log(`  ${binding.roasterName}: 无下架商品`);
      cleanupResults.push({
        roasterName: binding.roasterName,
        newBeans: 0,
        updatedBeans: 0,
        offshelfArchived: 0,
        offshelfSkipped: 0,
        offshelfWarnings: preview.warnings,
      });
      continue;
    }

    if (hasBlockingWarnings) {
      console.log(
        `  ${binding.roasterName}: 发现 ${preview.candidates.length} 个疑似下架，但有 blocking warnings，跳过自动 apply`
      );
      cleanupResults.push({
        roasterName: binding.roasterName,
        newBeans: 0,
        updatedBeans: 0,
        offshelfArchived: 0,
        offshelfSkipped: preview.candidates.length,
        offshelfWarnings: preview.warnings,
      });
      continue;
    }

    // 无 blocking warnings → 自动 apply
    const applyResult = await applyTaobaoOffshelfCleanup({
      token: preview.token,
      confirmText: 'ARCHIVE_OFFSHELF',
    });

    console.log(
      `  ${binding.roasterName}: 下架 ${applyResult.archivedCount} 个，跳过 ${applyResult.skippedCount} 个`
    );
    cleanupResults.push({
      roasterName: binding.roasterName,
      newBeans: 0,
      updatedBeans: 0,
      offshelfArchived: applyResult.archivedCount,
      offshelfSkipped: applyResult.skippedCount,
      offshelfWarnings: preview.warnings,
    });
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const totalNew = arrivalsResult.insertedBeans;
  const totalUpdated = arrivalsResult.updatedRoasterBeans;
  const totalArchived = cleanupResults.reduce((s, r) => s + r.offshelfArchived, 0);

  console.log(`=== 淘宝每日同步完成 (${elapsed}s) ===`);

  const summary = {
    status: arrivalsResult.status,
    elapsedSeconds: elapsed,
    arrivals: {
      processedRows: arrivalsResult.processedRows,
      insertedBeans: totalNew,
      updatedRoasterBeans: totalUpdated,
      draftRows: arrivalsResult.draftRows,
      errorRows: arrivalsResult.errorRows,
      failedShops: arrivalsResult.failedShops,
    },
    cleanup: cleanupResults.map((r) => ({
      roaster: r.roasterName,
      archived: r.offshelfArchived,
      skipped: r.offshelfSkipped,
      warnings: r.offshelfWarnings,
    })),
    totalNew,
    totalUpdated,
    totalArchived,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (arrivalsResult.status !== 'SUCCEEDED') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('淘宝每日同步失败:', error instanceof Error ? error.message : error);
  process.exit(1);
});
