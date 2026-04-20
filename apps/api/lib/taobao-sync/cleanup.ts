import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { getTaobaoSyncConfig, sleepWithJitter } from './config.ts';
import { TaobaoMcpClient } from './mcp-client.ts';
import {
  buildOffshelfCandidates,
  detectTaobaoRiskSignals,
  extractFirstElementIndex,
  extractShopProductsFromContent,
} from './parsers.ts';
import { TaobaoSyncRepository } from './repository.ts';
import type {
  ExistingRoasterBeanRecord,
  TaobaoBinding,
  TaobaoCleanupApplyResult,
  TaobaoCleanupPreview,
  TaobaoCleanupSnapshot,
  TaobaoRiskSignal,
  TaobaoStructuredProduct,
  TaobaoSyncConfig,
} from './types.ts';

const CLEANUP_SNAPSHOT_VERSION = 1 as const;
const CLEANUP_CONFIRM_TEXT = 'ARCHIVE_OFFSHELF';
const CLEANUP_SNAPSHOT_TTL_MS = 2 * 60 * 60 * 1000;
const CLEANUP_MAX_LISTING_ITEMS = 80;
const CLEANUP_MAX_SCROLL_ROUNDS = 6;
const CLEANUP_NO_GROWTH_LIMIT = 2;
const CLEANUP_SCROLL_AMOUNT = 720;
const CLEANUP_TAB_LABELS = ['全部宝贝', '所有宝贝', '在售', '宝贝'];
const LISTING_END_PATTERN = /没有更多|到底了|已经到底|已加载全部|没有啦/;
const NON_BLOCKING_WARNINGS = new Set([
  'listing_tab_not_found',
  'listing_scan_hit_safe_limit',
  'listing_growth_insufficient',
]);

type ListingStopReason = 'no_growth' | 'end_reached' | 'safe_limit';

type CleanupSnapshotCore = Omit<TaobaoCleanupSnapshot, 'hash'>;

type CleanupPreviewDependencies = {
  client: Pick<TaobaoMcpClient, 'navigateToUrl' | 'readPageContent' | 'scanPageElements' | 'clickElement' | 'scrollPage' | 'closePage'>;
  repository: Pick<
    TaobaoSyncRepository,
    'findBindingById' | 'findBindingByRoasterName' | 'listTrackedRoasterBeansForBinding'
  >;
  config: TaobaoSyncConfig;
  snapshotDir: string;
};

type CleanupApplyDependencies = {
  repository: Pick<
    TaobaoSyncRepository,
    'createImportJob' | 'finishImportJob' | 'recordEvent' | 'archiveRoasterBeans'
  >;
  snapshotDir: string;
};

export class TaobaoRiskAbortError extends Error {
  signals: TaobaoRiskSignal[];

  constructor(message: string, signals: TaobaoRiskSignal[]) {
    super(message);
    this.name = 'TaobaoRiskAbortError';
    this.signals = signals;
  }
}

function defaultSnapshotDir() {
  return path.join(tmpdir(), 'coffeeatlas-taobao-offshelf');
}

function ensureSafePage(inputs: Array<string | null | undefined>) {
  const signals = detectTaobaoRiskSignals(inputs);
  if (signals.length > 0) {
    throw new TaobaoRiskAbortError(
      `Taobao risk signal detected: ${signals.map((signal) => signal.reason).join(', ')}`,
      signals
    );
  }
}

async function safeClosePage(client: Pick<TaobaoMcpClient, 'closePage'>) {
  try {
    await client.closePage();
  } catch {
    // ignore cleanup failures
  }
}

function buildCleanupSnapshotHash(snapshot: CleanupSnapshotCore) {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

function snapshotFilePath(snapshotDir: string, token: string) {
  return path.join(snapshotDir, `${token}.json`);
}

async function writeCleanupSnapshot(snapshotDir: string, snapshot: CleanupSnapshotCore) {
  await fs.mkdir(snapshotDir, { recursive: true });
  const fullSnapshot: TaobaoCleanupSnapshot = {
    ...snapshot,
    hash: buildCleanupSnapshotHash(snapshot),
  };
  await fs.writeFile(snapshotFilePath(snapshotDir, snapshot.token), `${JSON.stringify(fullSnapshot, null, 2)}\n`, 'utf8');
  return fullSnapshot;
}

async function readCleanupSnapshot(snapshotDir: string, token: string) {
  const filePath = snapshotFilePath(snapshotDir, token);
  const raw = await fs.readFile(filePath, 'utf8');
  const snapshot = JSON.parse(raw) as TaobaoCleanupSnapshot;
  const { hash, ...rest } = snapshot;
  const expectedHash = buildCleanupSnapshotHash(rest);
  if (hash !== expectedHash) {
    throw new Error('Cleanup snapshot hash mismatch');
  }
  return snapshot;
}

function resolvePreviewWarnings(args: {
  currentDbCount: number;
  scannedTitleCount: number;
  scannedStructuredCount: number;
  candidateCount: number;
  stopReason: ListingStopReason;
  scanWarnings: string[];
}) {
  const warnings = [...args.scanWarnings];
  const comparableCount = Math.max(args.scannedTitleCount, args.scannedStructuredCount);

  if (comparableCount === 0) {
    warnings.push('no_shop_listing_detected');
  }
  if (args.stopReason === 'safe_limit' && args.currentDbCount > comparableCount) {
    warnings.push('listing_scan_hit_safe_limit');
  }
  if (args.currentDbCount >= 8 && comparableCount <= Math.floor(args.currentDbCount / 3)) {
    warnings.push('listing_scan_too_small_for_db_count');
  }
  if (args.currentDbCount >= 5 && args.scannedTitleCount < 3 && args.scannedStructuredCount < 3) {
    warnings.push('listing_growth_insufficient');
  }
  if (args.currentDbCount > 0 && args.candidateCount === args.currentDbCount) {
    warnings.push('all_items_marked_candidate');
  }

  return [...new Set(warnings)];
}

function canApplyPreview(warnings: string[]) {
  return warnings.every((warning) => NON_BLOCKING_WARNINGS.has(warning));
}

function findListingEnd(content: string) {
  return LISTING_END_PATTERN.test(content);
}

async function resolveBinding(
  repository: CleanupPreviewDependencies['repository'],
  args: { bindingId?: string; roasterName?: string }
) {
  if (args.bindingId) {
    return repository.findBindingById(args.bindingId);
  }
  if (args.roasterName) {
    return repository.findBindingByRoasterName(args.roasterName);
  }
  throw new Error('preview requires --binding-id or --roaster-name');
}

async function scanCurrentShopListing(args: {
  client: CleanupPreviewDependencies['client'];
  binding: TaobaoBinding;
  config: TaobaoSyncConfig;
}) {
  const { client, binding, config } = args;
  const scanWarnings: string[] = [];
  const productMap = new Map<string, TaobaoStructuredProduct>();
  let stopReason: ListingStopReason = 'safe_limit';
  let noGrowthRounds = 0;

  await client.navigateToUrl(binding.canonicalShopUrl);
  await sleepWithJitter(config);

  const initialRead = await client.readPageContent({ maxLength: config.pageReadMaxLength });
  const initialScan = await client.scanPageElements();
  ensureSafePage([initialRead.title, initialRead.content, initialScan.dom]);

  const tabIndex = extractFirstElementIndex(initialScan.dom, CLEANUP_TAB_LABELS);
  if (tabIndex !== null) {
    await client.clickElement({ index: tabIndex });
    await sleepWithJitter(config);
  } else {
    scanWarnings.push('listing_tab_not_found');
  }

  for (let round = 0; round <= CLEANUP_MAX_SCROLL_ROUNDS; round += 1) {
    if (round > 0) {
      await client.scrollPage({ direction: 'down', amount: CLEANUP_SCROLL_AMOUNT });
      await sleepWithJitter(config);
    }

    const read = await client.readPageContent({ maxLength: config.pageReadMaxLength });
    ensureSafePage([read.title, read.content]);

    const products = extractShopProductsFromContent(read.content, CLEANUP_MAX_LISTING_ITEMS, binding);
    let newTitleCount = 0;
    for (const product of products) {
      if (productMap.has(product.title)) continue;
      productMap.set(product.title, product);
      newTitleCount += 1;
      if (productMap.size >= CLEANUP_MAX_LISTING_ITEMS) {
        stopReason = 'safe_limit';
        break;
      }
    }

    if (findListingEnd(read.content)) {
      stopReason = 'end_reached';
      break;
    }

    if (productMap.size >= CLEANUP_MAX_LISTING_ITEMS) {
      break;
    }

    if (newTitleCount === 0) {
      noGrowthRounds += 1;
    } else {
      noGrowthRounds = 0;
    }

    if (noGrowthRounds >= CLEANUP_NO_GROWTH_LIMIT) {
      stopReason = 'no_growth';
      break;
    }
  }

  return {
    titles: [...productMap.values()].map((product) => product.title),
    products: [...productMap.values()],
    stopReason,
    scanWarnings,
  };
}

function buildPreviewSnapshot(args: {
  binding: TaobaoBinding;
  candidates: TaobaoCleanupPreview['candidates'];
  listingTitles: string[];
  structuredProducts: TaobaoStructuredProduct[];
  warnings: string[];
  currentDbCount: number;
  stopReason: ListingStopReason;
}) {
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CLEANUP_SNAPSHOT_TTL_MS).toISOString();
  const token = randomUUID().replace(/-/g, '');

  return {
    version: CLEANUP_SNAPSHOT_VERSION,
    token,
    binding: args.binding,
    createdAt,
    expiresAt,
    canApply: canApplyPreview(args.warnings),
    warnings: args.warnings,
    currentDbCount: args.currentDbCount,
    scannedTitleCount: args.listingTitles.length,
    scannedStructuredCount: args.structuredProducts.length,
    stopReason: args.stopReason,
    candidates: args.candidates,
    listingTitles: args.listingTitles,
    structuredProducts: args.structuredProducts,
  } satisfies CleanupSnapshotCore;
}

function toPreview(snapshot: TaobaoCleanupSnapshot): TaobaoCleanupPreview {
  return {
    token: snapshot.token,
    binding: snapshot.binding,
    createdAt: snapshot.createdAt,
    expiresAt: snapshot.expiresAt,
    canApply: snapshot.canApply,
    warnings: snapshot.warnings,
    currentDbCount: snapshot.currentDbCount,
    scannedTitleCount: snapshot.scannedTitleCount,
    scannedStructuredCount: snapshot.scannedStructuredCount,
    stopReason: snapshot.stopReason,
    candidates: snapshot.candidates,
  };
}

export async function previewTaobaoOffshelfCleanup(
  args: { bindingId?: string; roasterName?: string },
  deps?: Partial<CleanupPreviewDependencies>
) {
  const repository = deps?.repository ?? new TaobaoSyncRepository();
  const client = deps?.client ?? new TaobaoMcpClient((deps?.config ?? getTaobaoSyncConfig()).mcpUrl);
  const config = deps?.config ?? getTaobaoSyncConfig();
  const snapshotDir = deps?.snapshotDir ?? defaultSnapshotDir();

  const binding = await resolveBinding(repository, args);
  if (!binding) {
    throw new Error('Taobao binding not found');
  }

  const currentProducts = await repository.listTrackedRoasterBeansForBinding(binding);

  try {
    const listingResult = await scanCurrentShopListing({ client, binding, config });
    const structuredProducts = listingResult.products;
    const candidates = buildOffshelfCandidates({
      currentProducts,
      listingTitles: listingResult.titles,
      structuredProducts,
    });
    const warnings = resolvePreviewWarnings({
      currentDbCount: currentProducts.length,
      scannedTitleCount: listingResult.titles.length,
      scannedStructuredCount: structuredProducts.length,
      candidateCount: candidates.length,
      stopReason: listingResult.stopReason,
      scanWarnings: listingResult.scanWarnings,
    });

    const snapshot = await writeCleanupSnapshot(
      snapshotDir,
      buildPreviewSnapshot({
        binding,
        candidates,
        listingTitles: listingResult.titles,
        structuredProducts,
        warnings,
        currentDbCount: currentProducts.length,
        stopReason: listingResult.stopReason,
      })
    );

    return toPreview(snapshot);
  } finally {
    await safeClosePage(client);
  }
}

export async function applyTaobaoOffshelfCleanup(
  args: { token: string; confirmText: string },
  deps?: Partial<CleanupApplyDependencies>
): Promise<TaobaoCleanupApplyResult> {
  if (args.confirmText !== CLEANUP_CONFIRM_TEXT) {
    throw new Error(`apply requires --confirm ${CLEANUP_CONFIRM_TEXT}`);
  }

  const repository = deps?.repository ?? new TaobaoSyncRepository();
  const snapshotDir = deps?.snapshotDir ?? defaultSnapshotDir();
  const snapshot = await readCleanupSnapshot(snapshotDir, args.token);

  if (snapshot.version !== CLEANUP_SNAPSHOT_VERSION) {
    throw new Error('Unsupported cleanup snapshot version');
  }
  if (Date.parse(snapshot.expiresAt) < Date.now()) {
    throw new Error('Cleanup snapshot expired');
  }
  if (!snapshot.canApply) {
    throw new Error('Cleanup snapshot is not eligible for apply due to incomplete scan warnings');
  }

  const importJobId = await repository.createImportJob({
    sourceId: snapshot.binding.sourceId,
    fileName: `cleanup-taobao-offshelf:${snapshot.token}`,
    jobType: 'MANUAL_PATCH',
    summary: {
      bindingId: snapshot.binding.id,
      previewToken: snapshot.token,
      candidateCount: snapshot.candidates.length,
    },
  });

  const retiredAt = new Date().toISOString();
  const candidateIds = snapshot.candidates.map((candidate) => candidate.roasterBeanId);
  const archivedRows = await repository.archiveRoasterBeans({
    roasterBeanIds: candidateIds,
    retiredAt,
  });
  const archivedIdSet = new Set(archivedRows.map((row) => row.id));

  let archivedCount = 0;
  let skippedCount = 0;

  for (const candidate of snapshot.candidates) {
    const archived = archivedIdSet.has(candidate.roasterBeanId);
    if (archived) {
      archivedCount += 1;
      await repository.recordEvent({
        importJobId,
        sourceId: snapshot.binding.sourceId,
        entityType: 'ROASTER_BEAN',
        entityId: candidate.roasterBeanId,
        action: 'UPDATE',
        payload: {
          bindingId: snapshot.binding.id,
          roasterBeanId: candidate.roasterBeanId,
          sourceItemId: candidate.sourceItemId,
          sourceSkuId: candidate.sourceSkuId,
          displayName: candidate.displayName,
          reason: candidate.reason,
          previewToken: snapshot.token,
          retiredAt,
        },
      });
      continue;
    }

    skippedCount += 1;
    await repository.recordEvent({
      importJobId,
      sourceId: snapshot.binding.sourceId,
      entityType: 'ROASTER_BEAN',
      entityId: candidate.roasterBeanId,
      action: 'SKIP',
      payload: {
        bindingId: snapshot.binding.id,
        roasterBeanId: candidate.roasterBeanId,
        previewToken: snapshot.token,
        reason: 'archive_update_not_applied',
      },
    });
  }

  await repository.finishImportJob({
    importJobId,
    status: skippedCount > 0 ? 'PARTIAL' : 'SUCCEEDED',
    rowCount: snapshot.candidates.length,
    errorCount: 0,
    summary: {
      bindingId: snapshot.binding.id,
      previewToken: snapshot.token,
      archivedCount,
      skippedCount,
      warnings: snapshot.warnings,
    },
  });

  await fs.rm(snapshotFilePath(snapshotDir, snapshot.token), { force: true }).catch(() => undefined);

  return {
    token: snapshot.token,
    importJobId,
    binding: snapshot.binding,
    archivedCount,
    skippedCount,
    warnings: snapshot.warnings,
  };
}

export function getTaobaoCleanupSnapshotDir() {
  return defaultSnapshotDir();
}

export const taobaoCleanupConstants = {
  confirmText: CLEANUP_CONFIRM_TEXT,
  snapshotTtlMs: CLEANUP_SNAPSHOT_TTL_MS,
  maxListingItems: CLEANUP_MAX_LISTING_ITEMS,
  maxScrollRounds: CLEANUP_MAX_SCROLL_ROUNDS,
};

export const taobaoCleanupInternals = {
  buildCleanupSnapshotHash,
  readCleanupSnapshot,
  resolvePreviewWarnings,
};
