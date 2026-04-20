import { applyTaobaoOffshelfCleanup, previewTaobaoOffshelfCleanup, taobaoCleanupConstants } from './cleanup.ts';
import { TaobaoSyncRepository } from './repository.ts';
import { runTaobaoNewArrivalsSync, runTaobaoSingleBindingSync } from './sync.ts';
import type {
  TaobaoBinding,
  TaobaoCleanupApplyResult,
  TaobaoCleanupPreview,
  TaobaoSyncResult,
  TaobaoSyncStatus,
} from './types.ts';

type DailySyncLogger = Pick<Console, 'log' | 'error'>;

type DailySyncDependencies = {
  logger: DailySyncLogger;
  now: () => number;
  runArrivalsSync: () => Promise<TaobaoSyncResult>;
  listActiveBindings: () => Promise<TaobaoBinding[]>;
  previewCleanup: (bindingId: string) => Promise<TaobaoCleanupPreview>;
  applyCleanup: (token: string) => Promise<TaobaoCleanupApplyResult>;
  targetBinding?: TaobaoBinding;
};

export type TaobaoDailyCleanupResult = {
  roaster: string;
  archived: number;
  skipped: number;
  warnings: string[];
  error: string | null;
};

export type TaobaoDailySyncSummary = {
  status: TaobaoSyncStatus;
  phase?: 'arrivals';
  elapsedSeconds: number;
  arrivals: {
    processedRows: number;
    insertedBeans: number;
    updatedRoasterBeans: number;
    draftRows: number;
    errorRows: number;
    failedShops: number;
  };
  cleanup: TaobaoDailyCleanupResult[];
  totalNew: number;
  totalUpdated: number;
  totalArchived: number;
  cleanupErrors: number;
};

export type TaobaoDailySyncRunResult = {
  summary: TaobaoDailySyncSummary;
  exitCode: number;
};

function resolveDependencies(deps?: Partial<DailySyncDependencies>): DailySyncDependencies {
  const logger = deps?.logger ?? console;
  const now = deps?.now ?? (() => Date.now());

  if (deps?.runArrivalsSync && deps.listActiveBindings && deps.previewCleanup && deps.applyCleanup) {
    return {
      logger,
      now,
      runArrivalsSync: deps.runArrivalsSync,
      listActiveBindings: deps.listActiveBindings,
      previewCleanup: deps.previewCleanup,
      applyCleanup: deps.applyCleanup,
      targetBinding: deps.targetBinding,
    };
  }

  const repository = new TaobaoSyncRepository();
  const targetBinding = deps?.targetBinding;

  return {
    logger,
    now,
    runArrivalsSync:
      deps?.runArrivalsSync ??
      (targetBinding
        ? () => runTaobaoSingleBindingSync({ binding: targetBinding })
        : runTaobaoNewArrivalsSync),
    listActiveBindings:
      deps?.listActiveBindings ??
      (targetBinding ? () => Promise.resolve([targetBinding]) : () => repository.listActiveBindings()),
    previewCleanup:
      deps?.previewCleanup ??
      ((bindingId: string) =>
        previewTaobaoOffshelfCleanup(
          { bindingId },
          { repository }
        )),
    applyCleanup:
      deps?.applyCleanup ??
      ((token: string) =>
        applyTaobaoOffshelfCleanup(
          { token, confirmText: taobaoCleanupConstants.confirmText },
          { repository }
        )),
    targetBinding,
  };
}

function buildArrivalsSummary(arrivalsResult: TaobaoSyncResult) {
  return {
    processedRows: arrivalsResult.processedRows,
    insertedBeans: arrivalsResult.insertedBeans,
    updatedRoasterBeans: arrivalsResult.updatedRoasterBeans,
    draftRows: arrivalsResult.draftRows,
    errorRows: arrivalsResult.errorRows,
    failedShops: arrivalsResult.failedShops,
  };
}

export async function runTaobaoDailySync(deps?: Partial<DailySyncDependencies>): Promise<TaobaoDailySyncRunResult> {
  const resolved = resolveDependencies(deps);
  const startTime = resolved.now();

  const shopLabel = resolved.targetBinding
    ? `【${resolved.targetBinding.roasterName}】`
    : '全部店铺';
  resolved.logger.log(`=== 淘宝每日同步开始 (${shopLabel}) ===`);
  resolved.logger.log('[1/2] 上新同步...');

  const arrivalsResult = await resolved.runArrivalsSync();

  resolved.logger.log(
    `  上新结果: status=${arrivalsResult.status}, ` +
      `processed=${arrivalsResult.processedRows}, ` +
      `inserted=${arrivalsResult.insertedBeans}, ` +
      `updated=${arrivalsResult.updatedRoasterBeans}`
  );

  if (arrivalsResult.status === 'FAILED') {
    const elapsed = Math.round((resolved.now() - startTime) / 1000);
    return {
      summary: {
        status: 'FAILED',
        phase: 'arrivals',
        elapsedSeconds: elapsed,
        arrivals: buildArrivalsSummary(arrivalsResult),
        cleanup: [],
        totalNew: arrivalsResult.insertedBeans,
        totalUpdated: arrivalsResult.updatedRoasterBeans,
        totalArchived: 0,
        cleanupErrors: 0,
      },
      exitCode: 1,
    };
  }

  resolved.logger.log('[2/2] 下架检测...');

  const bindings = await resolved.listActiveBindings();
  const cleanup: TaobaoDailyCleanupResult[] = [];
  let cleanupErrors = 0;

  for (const binding of bindings) {
    try {
      const preview = await resolved.previewCleanup(binding.id);

      if (preview.candidates.length === 0) {
        resolved.logger.log(`  ${binding.roasterName}: 无下架商品`);
        cleanup.push({
          roaster: binding.roasterName,
          archived: 0,
          skipped: 0,
          warnings: preview.warnings,
          error: null,
        });
        continue;
      }

      if (!preview.canApply) {
        resolved.logger.log(
          `  ${binding.roasterName}: 发现 ${preview.candidates.length} 个疑似下架，但存在阻断 warning，跳过自动下架`
        );
        cleanup.push({
          roaster: binding.roasterName,
          archived: 0,
          skipped: preview.candidates.length,
          warnings: preview.warnings,
          error: null,
        });
        continue;
      }

      const applyResult = await resolved.applyCleanup(preview.token);
      resolved.logger.log(
        `  ${binding.roasterName}: 下架 ${applyResult.archivedCount} 个，跳过 ${applyResult.skippedCount} 个`
      );
      cleanup.push({
        roaster: binding.roasterName,
        archived: applyResult.archivedCount,
        skipped: applyResult.skippedCount,
        warnings: preview.warnings,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      cleanupErrors += 1;
      resolved.logger.error(`  ${binding.roasterName}: 下架检测失败 - ${errorMessage}`);
      cleanup.push({
        roaster: binding.roasterName,
        archived: 0,
        skipped: 0,
        warnings: [],
        error: errorMessage,
      });
    }
  }

  const elapsed = Math.round((resolved.now() - startTime) / 1000);
  const totalArchived = cleanup.reduce((sum, item) => sum + item.archived, 0);
  const status: TaobaoSyncStatus =
    arrivalsResult.status === 'PARTIAL' || cleanupErrors > 0 ? 'PARTIAL' : arrivalsResult.status;

  resolved.logger.log(`=== 淘宝每日同步完成 (${elapsed}s) ===`);

  return {
    summary: {
      status,
      elapsedSeconds: elapsed,
      arrivals: buildArrivalsSummary(arrivalsResult),
      cleanup,
      totalNew: arrivalsResult.insertedBeans,
      totalUpdated: arrivalsResult.updatedRoasterBeans,
      totalArchived,
      cleanupErrors,
    },
    exitCode: status === 'SUCCEEDED' ? 0 : 1,
  };
}
