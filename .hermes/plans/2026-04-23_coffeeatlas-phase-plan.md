# CoffeeAtlas 四阶段实施计划

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 完善新品页数据库对接、下架人工审核流程、徽章文案趣味化改造，并持续接入优质社区烘焙商。

**Architecture:** 分四个独立阶段推进，阶段间低耦合可并行。Phase 1（纯前端文案）可独立上线；Phase 2/3 涉及前后端接口与数据库；Phase 4 为持续性运营+技术接入任务。

**Tech Stack:** Taro 3.6 + React 18 + TypeScript（小程序），Next.js 16 Route Handlers（API），Supabase（PostgreSQL + RLS），pnpm + Turborepo。

---

## 当前现状

- **新品页（`pages/index`）**：前端已具备搜索、筛选（烘焙商/处理法/产地）、分页加载。调用 `getBeans()` + `getNewArrivalFilters()`，但后端新品查询逻辑与通用豆子查询混用，新品判定规则（`release_at` 时间窗口）未显式定义。
- **下架清理**：`lib/taobao-sync/cleanup.ts` 实现自动扫描淘宝店铺 listing → 生成 candidates → 无阻断 warning 时自动 archive。`change_requests` 表已存在但未被 cleanup 流程使用。人工审核仅靠 CLI 脚本（`cleanup-taobao-offshelf.ts`）。
- **徽章系统**：`profile-badges.ts` 定义 14 枚徽章 + `badge-record.ts` 定义记录区文案。`BadgeDetailModal` 有英文硬编码。文案风格不统一，部分有趣（"不忠实消费者"），部分偏平（"入馆访客"）。
- **烘焙商接入**：`roasters` 表 + `roaster_source_bindings` 表管理。已有 George Captain 等种子数据。淘宝同步通过 binding 的 `canonical_shop_url` 自动抓取。

---

## 阶段总览

| 阶段 | 主题 | 预估工期 | 侵入性 | 可并行 |
|------|------|---------|--------|--------|
| Phase 1 | 徽章文案趣味化改造 | 1-2h | 纯前端 | ✅ 独立 |
| Phase 2 | 新品页数据库对接完善 | 4-6h | 前后端 + DB | 可与 P1 并行 |
| Phase 3 | 下架人工审核流程 | 6-8h | 后端 + DB + CLI | 可与 P1 并行 |
| Phase 4 | 社区烘焙商调研与接入 | 持续性 | 运营 + 技术 | 需用户确认 list |

---

## Phase 1: 徽章文案趣味化改造

**目标**：统一徽章文案调性，简洁有趣，像一个懂咖啡的朋友在说话。

**调性指南**：
- 人话优先，不用敬语和说明书语气
- 适当自嘲/玩梗，但不恶俗
- 解锁文案比未解锁文案更"嘚瑟"
- 英文标签保持简短有力

---

### Task 1.1: 重写 `profile-badges.ts` 全部徽章定义

**Files:**
- Modify: `apps/miniprogram/src/pages/profile/profile-badges.ts`

**Step 1: 更新文案**

将 `PROFILE_BADGE_DEFINITIONS` 中 14 枚徽章按以下风格重写：

| id | 新 title | 新 subtitle | 新 unlockedDescription |
|----|---------|-------------|------------------------|
| visitor | 入馆了 | 先混个脸熟 | 馆藏大门已为你敞开。 |
| bean-starter | 第一颗豆 | 收藏从这里开始 | 第一颗豆子总是最香的。 |
| bean-collector | 豆单成型 | 攒够 5 款了 | 你的豆单已经不是随便喝喝了。 |
| roaster-radar | 盯上烘焙师了 | 开始追风格 | 从豆子上升到人，格局打开。 |
| history-explorer | 四处乱逛 | 逛了 3 款 | 足迹不多，但方向对了。 |
| history-regular | 老游客了 | 10 款打卡 | 这地方你比导航还熟。 |
| origin-scout | 护照盖章 | 踏足 3 国产地 | 咖啡护照上终于不是空白了。 |
| origin-atlas | 环球味蕾 | 横跨 3 大洲 | 亚非拉都在你杯子里开会了。 |
| process-nerd | 处理法控 | 尝遍 4 种处理 | 水洗日晒蜜处理厌氧，你全试过。 |
| variety-hunter | 猎豆人 | 解锁 3 个品种 | 咖啡基因库被你翻了个底朝天。 |
| first-click | 钱包动了 | 首次点击购买 | 手指比脑子快，这是好兆头。 |
| multi-roaster | 海王买家 | 货比三家 | 没有忠诚，只有比较。 |
| first-share | 开始安利 | 首次分享 | 好东西藏不住，对吧？ |
| serial-sharer | 种草机 | 分享 5 次 | 你朋友圈的咖啡浓度超标了。 |

**Step 2: 同步修改 `getLockedDetail` 中的文案**

保持与 subtitle 风格一致，例如：
- `beanFavorites`: `还差 ${remainingValue} 颗豆，豆单就能成型。`
- `historyCount`: `再逛 ${remainingValue} 款，就能升级老游客。`

**验证：**
- 小程序编译通过：`pnpm --filter @coffeeatlas/miniprogram build:weapp`
- 徽章列表页无 TS 报错

---

### Task 1.2: 重写 `badge-record.ts` 记录区文案

**Files:**
- Modify: `apps/miniprogram/src/pages/profile/badge-record.ts`

**Step 1: 更新各状态文案**

```ts
if (!loggedIn) {
  return {
    eyebrow: 'BADGES',
    title: '徽章墙',
    description: '登录后开始收集你的咖啡足迹。',
    hint: '先拿下「入馆了」，后面的自然会来。',
  };
}

if (unlockedCount >= totalCount) {
  return {
    eyebrow: 'BADGES',
    title: '徽章墙',
    description: `${unlockedCount}/${totalCount} 枚全收集。这面墙被你承包了。`,
    hint: '首批徽章毕业，等新徽章上线再来刷。',
  };
}

return {
  eyebrow: 'BADGES',
  title: '徽章墙',
  description: `${unlockedCount}/${totalCount} 枚已点亮，继续探索。`,
  hint: nextBadge ? `下一枚：「${nextBadge.title}」—— ${nextBadge.detail}` : '多逛、多藏、多分享，徽章自己会来。',
};
```

**验证：**
- TS 编译通过

---

### Task 1.3: 本地化 `BadgeDetailModal` 英文硬编码

**Files:**
- Modify: `apps/miniprogram/src/components/BadgeDetailModal/index.tsx`

**Step 1: 替换两处硬编码**

```tsx
// Line ~48
<Text className="badge-modal__eyebrow">
  {isCelebration ? '新徽章解锁' : '徽章档案'}
</Text>
```

**验证：**
- 编译通过，弹窗正常显示中文

---

### Task 1.4: Phase 1 集成验证

**Step 1: 运行类型检查**
```bash
pnpm typecheck
```

**Step 2: 运行小程序测试**
```bash
pnpm --filter @coffeeatlas/miniprogram test
```

**Step 3: Commit**
```bash
git add -A
git commit -m "feat(miniprogram): 重写徽章文案，统一趣味简洁风格"
```

---

## Phase 2: 新品页数据库对接完善

**目标**：明确"新品"判定规则，后端提供专门的新品查询接口，筛选数据源动态化。

---

### Task 2.1: 明确新品判定规则并补充 DB 字段

**当前问题**：`roaster_beans` 有 `release_at` 和 `status`，但没有"新品窗口期"定义，前端和后端对"新品"理解可能不一致。

**方案**：新品 = `status = 'ACTIVE'` AND `is_in_stock = true` AND `release_at` 在 N 天内（建议 30 天）。

**Files:**
- Create: `apps/api/db/migrations/20260423_new_arrival_rule.sql`
- Modify: `apps/api/db/sql/010_schema.sql`（如需要，但优先用 migration）

**Step 1: 新增配置表（轻量）**

```sql
-- 系统配置表，用于存储可运营调整的阈值
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

-- 插入新品窗口期（默认 30 天）
insert into public.app_settings (key, value, description)
values ('new_arrival_window_days', '30', '新品展示窗口期（天）')
on conflict (key) do nothing;
```

**Step 2: 应用 migration**
```bash
cd apps/api && npx supabase db push
-- 或手动在 Supabase SQL Editor 执行
```

**验证：**
- 查询 `select * from public.app_settings where key = 'new_arrival_window_days';` 返回 30

---

### Task 2.2: 后端新增专用新品查询服务

**Files:**
- Create: `apps/api/lib/server/new-arrival-service.ts`
- Modify: `apps/api/app/api/v1/beans/new-arrivals/route.ts`（如不存在则创建）
- Modify: `apps/api/app/api/v1/beans/route.ts`（如当前 `getBeans` 在此）

**Step 1: 创建新品服务**

```ts
// lib/server/new-arrival-service.ts
import { requireSupabaseServer } from '@/lib/supabase';
import type { CoffeeBean } from '@coffee-atlas/shared-types';

const DEFAULT_NEW_ARRIVAL_WINDOW_DAYS = 30;

export async function getNewArrivals(args: {
  page: number;
  pageSize: number;
  searchQuery?: string;
  roasterId?: string;
  processBase?: string;
  originCountry?: string;
}) {
  const supabase = requireSupabaseServer();

  // 读取窗口期配置
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'new_arrival_window_days')
    .single();

  const windowDays = parseInt(setting?.value ?? String(DEFAULT_NEW_ARRIVAL_WINDOW_DAYS), 10);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('roaster_beans')
    .select(
      `id, display_name, roast_level, price_amount, price_currency, image_url, product_url, release_at, is_in_stock,
       roasters!inner(id, name, city, country_code),
       beans!inner(id, canonical_name, origin_country, origin_region, process_method, process_base, variety, flavor_tags)`,
      { count: 'exact' }
    )
    .eq('status', 'ACTIVE')
    .eq('is_in_stock', true)
    .gte('release_at', since)
    .order('release_at', { ascending: false });

  if (args.roasterId) {
    query = query.eq('roaster_id', args.roasterId);
  }
  if (args.processBase) {
    query = query.eq('beans.process_base', args.processBase);
  }
  if (args.originCountry) {
    query = query.eq('beans.origin_country', args.originCountry);
  }
  if (args.searchQuery?.trim()) {
    query = query.textSearch('search_tsv', args.searchQuery.trim());
  }

  const from = (args.page - 1) * args.pageSize;
  const to = from + args.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw new Error(`failed_to_load_new_arrivals:${error.message}`);

  // 组装 DTO（具体字段映射参考 shared-types）
  const items = (data ?? []).map(mapRoasterBeanToCoffeeBean);

  return {
    items,
    pageInfo: {
      page: args.page,
      pageSize: args.pageSize,
      total: count ?? 0,
      hasNextPage: (count ?? 0) > to + 1,
    },
  };
}
```

**Step 2: 创建/更新 API Route**

```ts
// app/api/v1/beans/new-arrivals/route.ts
import { NextRequest } from 'next/server';
import { getNewArrivals } from '@/lib/server/new-arrival-service';
import { buildEnvelope } from '@/lib/server/response';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20', 10);
  const searchQuery = searchParams.get('q') ?? undefined;
  const roasterId = searchParams.get('roasterId') ?? undefined;
  const processBase = searchParams.get('process') ?? undefined;
  const originCountry = searchParams.get('origin') ?? undefined;

  const result = await getNewArrivals({ page, pageSize, searchQuery, roasterId, processBase, originCountry });
  return buildEnvelope(result);
}
```

**验证：**
- API smoke test：`API_BASE_URL=http://127.0.0.1:3000 pnpm smoke:api`
- 或手动 curl：`curl 'http://localhost:3000/api/v1/beans/new-arrivals?page=1&pageSize=5'`

---

### Task 2.3: 更新前端新品页调用新接口

**Files:**
- Modify: `apps/miniprogram/src/services/api.ts`
- Modify: `apps/miniprogram/src/pages/index/index.tsx`
- Modify: `apps/miniprogram/src/pages/index/new-arrivals-page.ts`

**Step 1: 前端新增 `getNewArrivals` API 封装**

```ts
// services/api.ts
export async function getNewArrivals(params: {
  page: number;
  pageSize: number;
  q?: string;
  roasterId?: string;
  process?: string;
  origin?: string;
}) {
  const query = new URLSearchParams();
  query.set('page', String(params.page));
  query.set('pageSize', String(params.pageSize));
  if (params.q) query.set('q', params.q);
  if (params.roasterId) query.set('roasterId', params.roasterId);
  if (params.process) query.set('process', params.process);
  if (params.origin) query.set('origin', params.origin);

  return request<{ items: CoffeeBean[]; pageInfo: PageInfo }>(`/api/v1/beans/new-arrivals?${query.toString()}`);
}
```

**Step 2: 新品页改用新接口**

将 `index.tsx` 中的 `getBeans(...)` 调用替换为 `getNewArrivals(...)`，参数构建逻辑保留。

**Step 3: 更新 `new-arrivals-page.ts` 中的空状态文案**

```ts
export function getHomeNewArrivalEmptyStateMessage(hasActiveFilters: boolean): string {
  if (hasActiveFilters) {
    return '没有匹配到符合条件的新品，换个条件试试';
  }
  return '最近 30 天内没有新品上架，去「选豆」页看看全量豆单';
}
```

**验证：**
- 小程序编译通过
- 新品页正常加载，筛选/分页/搜索工作正常

---

### Task 2.4: 更新新品筛选数据源

**Files:**
- Modify: `apps/api/lib/server/new-arrival-filters-service.ts`
- Modify: `apps/miniprogram/src/pages/all-beans/new-arrival-filters.ts`（如需要）

**Step 1: 后端筛选服务只返回"有新品"的选项**

当前 `getNewArrivalFiltersV1` 可能返回全量烘焙商/产地/处理法。改为只返回在最近 30 天窗口期内有 active 新品的数据。

```ts
// 在 new-arrival-filters-service.ts 中
const since = getNewArrivalSinceDate(); // 读取 app_settings

// 烘焙商选项：只列出最近有新品上架的
const { data: roasterRows } = await supabase
  .from('roaster_beans')
  .select('roaster_id, roasters(id, name)')
  .eq('status', 'ACTIVE')
  .eq('is_in_stock', true)
  .gte('release_at', since)
  .order('release_at', { ascending: false });

// 去重后返回
```

**验证：**
- 筛选栏只显示有新品相关的选项，避免空选项

---

### Task 2.5: Phase 2 集成验证

**Step 1: 类型检查**
```bash
pnpm typecheck
```

**Step 2: API 测试**
```bash
pnpm --filter @coffeeatlas/api test
```

**Step 3: Commit**
```bash
git add -A
git commit -m "feat(api+miniprogram): 专用新品查询接口，30天窗口期，筛选动态化"
```

---

## Phase 3: 下架人工审核流程

**目标**：自动下架前增加人工确认环节，增强 audit trail，提供 admin 查询接口。

---

### Task 3.1: 扩展 `change_requests` 表支持下架审核

**当前问题**：`change_requests` 表设计为通用 patch 审核，没有关联 import job 或 cleanup snapshot。

**Files:**
- Create: `apps/api/db/migrations/20260423_cleanup_audit.sql`

**Step 1: 新增 cleanup 专用审核字段（或新表）**

方案 A（扩展现有表，推荐）：
```sql
-- 扩展 change_requests 支持更多 entity_type 和关联字段
alter table public.change_requests drop constraint if exists change_requests_entity_type_check;
alter table public.change_requests add constraint change_requests_entity_type_check
  check (entity_type in ('ROASTER', 'BEAN', 'ROASTER_BEAN', 'ALIAS', 'OFFSHELF_BATCH'));

-- 新增字段：关联 import_job 和 cleanup snapshot
alter table public.change_requests
  add column if not exists import_job_id uuid references public.import_jobs(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 新增索引
create index if not exists idx_change_requests_status_entity on public.change_requests (status, entity_type);
create index if not exists idx_change_requests_import_job on public.change_requests (import_job_id);
```

方案 B（新表，更干净）：
```sql
create table if not exists public.offshelf_reviews (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid references public.import_jobs(id) on delete set null,
  binding_id uuid not null references public.roaster_source_bindings(id) on delete cascade,
  candidate_count int not null default 0,
  candidate_snapshot jsonb not null default '[]'::jsonb, -- 存储 candidates 数组
  preview_token text not null,
  status change_request_status not null default 'PENDING',
  warnings text[] not null default '{}',
  requested_by uuid,
  reviewer_id uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_offshelf_reviews_status on public.offshelf_reviews (status);
create index if not exists idx_offshelf_reviews_binding on public.offshelf_reviews (binding_id);
```

**建议**：用方案 B（`offshelf_reviews`），语义更清晰，不与通用 change request 混淆。

**验证：**
- 迁移执行成功，表结构正确

---

### Task 3.2: 修改 cleanup preview 流程，生成待审核记录

**Files:**
- Modify: `apps/api/lib/taobao-sync/cleanup.ts`
- Modify: `apps/api/lib/taobao-sync/repository.ts`

**Step 1: Repository 新增方法**

```ts
// repository.ts
async createOffshelfReview(args: {
  importJobId?: string;
  bindingId: string;
  candidateCount: number;
  candidateSnapshot: unknown[];
  previewToken: string;
  warnings: string[];
  requestedBy?: string;
}): Promise<string> {
  const { data, error } = await this.client
    .from('offshelf_reviews')
    .insert({
      import_job_id: args.importJobId,
      binding_id: args.bindingId,
      candidate_count: args.candidateCount,
      candidate_snapshot: args.candidateSnapshot,
      preview_token: args.previewToken,
      warnings: args.warnings,
      requested_by: args.requestedBy,
      status: 'PENDING',
    })
    .select('id')
    .single();

  if (error) throw new Error(`failed_to_create_offshelf_review:${error.message}`);
  return data.id;
}

async listPendingOffshelfReviews(): Promise<OffshelfReview[]> {
  const { data, error } = await this.client
    .from('offshelf_reviews')
    .select('*, bindings:roaster_source_bindings(roaster_id, roasters(name))')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`failed_to_list_offshelf_reviews:${error.message}`);
  return data ?? [];
}

async approveOffshelfReview(reviewId: string, reviewerId: string): Promise<void> {
  const { error } = await this.client
    .from('offshelf_reviews')
    .update({ status: 'APPROVED', reviewer_id: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', reviewId);

  if (error) throw new Error(`failed_to_approve_offshelf_review:${error.message}`);
}

async rejectOffshelfReview(reviewId: string, reviewerId: string): Promise<void> {
  const { error } = await this.client
    .from('offshelf_reviews')
    .update({ status: 'REJECTED', reviewer_id: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', reviewId);

  if (error) throw new Error(`failed_to_reject_offshelf_review:${error.message}`);
}
```

**Step 2: 修改 `previewTaobaoOffshelfCleanup`**

当 `canApply = false`（有阻断性 warning）时，不再直接跳过，而是生成 `offshelf_reviews` 记录：

```ts
// cleanup.ts 中 preview 函数末尾
const preview = toPreview(snapshot);

// 如果有 candidates 且不能自动执行，生成审核记录
if (preview.candidates.length > 0 && !preview.canApply) {
  const reviewId = await repository.createOffshelfReview({
    importJobId,
    bindingId: binding.id,
    candidateCount: preview.candidates.length,
    candidateSnapshot: preview.candidates,
    previewToken: preview.token,
    warnings: preview.warnings,
  });
  // 在 preview 返回值中附带 reviewId
  return { ...preview, reviewId, needsReview: true };
}

return { ...preview, needsReview: false };
```

**验证：**
- 运行 preview 测试，阻断场景下数据库出现 PENDING 记录

---

### Task 3.3: 创建 Admin API 查看待审核列表

**Files:**
- Create: `apps/api/app/api/admin/offshelf-reviews/route.ts`
- Create: `apps/api/app/api/admin/offshelf-reviews/[id]/approve/route.ts`
- Create: `apps/api/app/api/admin/offshelf-reviews/[id]/reject/route.ts`

**Step 1: 列表接口**

```ts
// app/api/admin/offshelf-reviews/route.ts
import { NextRequest } from 'next/server';
import { requireSupabaseServer } from '@/lib/supabase';
import { buildEnvelope } from '@/lib/server/response';

export async function GET() {
  const supabase = requireSupabaseServer();
  const { data, error } = await supabase
    .from('offshelf_reviews')
    .select('*, binding:roaster_source_bindings(roaster_id, roasters(name, city))')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error) return buildEnvelope({ error: error.message }, { status: 500 });
  return buildEnvelope({ items: data ?? [] });
}
```

**Step 2: 审核接口**

```ts
// app/api/admin/offshelf-reviews/[id]/approve/route.ts
import { NextRequest, RouteContext } from 'next/server';
import { applyTaobaoOffshelfCleanup } from '@/lib/taobao-sync/cleanup';

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = context.params;
  const supabase = requireSupabaseServer();

  // 1. 读取 review 记录获取 previewToken
  const { data: review } = await supabase
    .from('offshelf_reviews')
    .select('*')
    .eq('id', id)
    .single();

  if (!review) return buildEnvelope({ error: 'review_not_found' }, { status: 404 });
  if (review.status !== 'PENDING') return buildEnvelope({ error: 'review_already_processed' }, { status: 409 });

  // 2. 执行 apply（使用 review 中的 previewToken）
  const result = await applyTaobaoOffshelfCleanup({
    token: review.preview_token,
    confirmText: taobaoCleanupConstants.confirmText,
  });

  // 3. 更新 review 状态
  await supabase
    .from('offshelf_reviews')
    .update({ status: 'APPROVED', reviewed_at: new Date().toISOString() })
    .eq('id', id);

  return buildEnvelope(result);
}
```

**验证：**
- Admin API smoke test 通过
- 列表返回待审核项
- Approve 后执行 archive 并更新状态

---

### Task 3.4: 增强 CLI 下架审核体验

**Files:**
- Modify: `apps/api/scripts/cleanup-taobao-offshelf.ts`
- Create: `apps/api/scripts/review-offshelf.ts`

**Step 1: 新增 `review-offshelf.ts` 脚本**

```ts
// scripts/review-offshelf.ts
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: reviews } = await supabase
    .from('offshelf_reviews')
    .select('*, binding:roaster_source_bindings(roaster_id, roasters(name))')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (!reviews || reviews.length === 0) {
    console.log('没有待审核的下架请求。');
    return;
  }

  console.log(`待审核下架请求 (${reviews.length} 条):\n`);
  for (const r of reviews) {
    console.log(`[${r.id}] ${r.binding.roasters.name}`);
    console.log(`  候选下架: ${r.candidate_count} 个`);
    console.log(`  Warnings: ${r.warnings.join(', ') || '无'}`);
    console.log(`  创建时间: ${r.created_at}`);
    console.log(`  审核命令: pnpm review:offshelf approve --id ${r.id}`);
    console.log('');
  }
}

main();
```

**Step 2: package.json 添加脚本**

```json
{
  "scripts": {
    "review:offshelf": "node --experimental-strip-types scripts/review-offshelf.ts",
    "review:offshelf:approve": "node --experimental-strip-types scripts/review-offshelf.ts approve"
  }
}
```

**验证：**
- `pnpm review:offshelf` 正确列出待审核项

---

### Task 3.5: Phase 3 集成验证

**Step 1: 类型检查 + 测试**
```bash
pnpm typecheck
pnpm --filter @coffeeatlas/api test
```

**Step 2: Commit**
```bash
git add -A
git commit -m "feat(api): 下架人工审核流程，offshelf_reviews + admin API + CLI"
```

---

## Phase 4: 社区优质烘焙商调研与接入

**目标**：持续发现并接入国内精品咖啡社区认可的优质烘焙商。

---

### Task 4.1: 建立烘焙商调研清单

**Files:**
- Create: `docs/roaster-research/候选烘焙商.md`

**调研维度**：
| 维度 | 说明 |
|------|------|
| 品牌名 | 中文 + 英文 |
| 城市 | 国内城市 |
| 主要销售渠道 | 淘宝 / 天猫 / 微信小程序 / 独立站 |
| 店铺链接 | 淘宝店铺首页 URL（用于 binding） |
| 社区口碑 | 小红书 / 咖啡论坛 / 微信群反馈 |
| 产品特点 | 烘焙风格（浅烘/中烘/北欧/日式）、招牌产地 |
| 预估 SKU 数 | 淘宝店在售单品数量 |
| 接入优先级 | P0（立刻接）/ P1（本月）/ P2（观望） |

**待调研名单（用户确认/补充）**：
- [ ] 八平方咖啡（北京）
- [ ] 启程拓殖 Terraform（上海）
- [ ] 有容乃大（上海）
- [ ] 白鲸咖啡（上海）
- [ ] 柯林咖啡（杭州）
- [ ] 明谦咖啡（上海）
- [ ] 澳帝焙 AOKKA（上海）
- [ ] 分子咖啡（...）
- [ ] 少数派 FEW（合肥）
- [ ] 诚品咖啡（...）

> **⚠️ 用户确认点**：以上 list 是否有你明确不想接的？有没有遗漏的你特别想接的？

---

### Task 4.2: 逐个烘焙商技术接入（单店流程）

**每个烘焙商的接入任务（可复用）**：

**Task 4.2.X: 接入 [烘焙商名]**

**Files:**
- Modify: `apps/api/db/manual/xxx_add_roaster.sql`

**Step 1: 确认淘宝店铺 URL 和搜索关键词**
- 访问淘宝店铺，确认 `canonical_shop_url`
- 确认店铺内咖啡单品分类页或搜索关键词

**Step 2: 写入数据库**

```sql
-- 1. 插入 source（如不存在）
insert into public.sources (source_type, source_name, source_url, is_active)
values ('ECOMMERCE', '淘宝', 'https://taobao.com', true)
on conflict (source_type, source_name) do nothing;

-- 2. 插入 roaster
insert into public.roasters (name, name_en, city, country_code, is_public)
values ('烘焙商中文名', 'Roaster English Name', '城市', 'CN', true)
on conflict do nothing;

-- 3. 插入 binding
insert into public.roaster_source_bindings (roaster_id, source_id, canonical_shop_url, canonical_shop_name, search_keyword, is_active)
select
  (select id from public.roasters where name = '烘焙商中文名'),
  (select id from public.sources where source_type = 'ECOMMERCE' and source_name = '淘宝'),
  'https://shopxxxx.taobao.com',
  '店铺名',
  '咖啡',
  true
on conflict (roaster_id, source_id) do update set
  canonical_shop_url = excluded.canonical_shop_url,
  canonical_shop_name = excluded.canonical_shop_name,
  is_active = true;
```

**Step 3: 测试同步**
```bash
pnpm sync:taobao:single --roaster-name "烘焙商中文名"
```

**Step 4: 检查抓取结果**
- 查看 import_jobs 记录
- 检查 roaster_beans 数据质量（display_name, price, image_url）
- 如有 OCR 识别问题，走 `audit-taobao-ocr.ts` 审核

**Step 5: Commit SQL**
```bash
git add db/manual/
git commit -m "data: 接入烘焙商 [烘焙商名]"
```

---

### Task 4.3: 接入质量检查清单

每个烘焙商接入后必须检查：

- [ ] 淘宝店铺首页可正常访问
- [ ] 单品抓取数量与实际在售数量差距 < 20%
- [ ] 价格识别准确率 > 90%
- [ ] 图片 URL 有效
- [ ] 无重复豆子（同一 bean 被多个 roaster_bean 关联）
- [ ] 新品页可见（release_at 在最近 30 天内）

---

## 风险与依赖

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 淘宝页面结构变化导致同步失败 | 高 | cleanup 的 risk signal 检测 + 人工审核兜底 |
| Supabase 免费 tier 性能瓶颈 | 中 | 监控慢查询，必要时加索引或升级 |
| 烘焙商店铺无标准分类页 | 中 | 调研阶段先确认 URL 可抓取 |
| 徽章文案用户不满意 | 低 | Phase 1 纯文本，随时可改 |

## Open Questions

1. **新品窗口期**：默认 30 天是否合适？是否需要在小程序端显示"还有 X 天下架新品页"？
2. **下架审核权限**：Admin API 是否需要鉴权（当前 API 只有 RLS，没有 admin role 检查）？
3. **烘焙商 list**：Phase 4 的候选 list 是否准确？哪些是你已经确定要接的？
4. **徽章英文**：小程序是否有英文版需求？当前 `BadgeDetailModal` 有英文硬编码，是否还需要保留英文？

---

*Plan written: 2026-04-23*
*Next step: 用户确认阶段优先级和 Open Questions 后，按 subagent-driven-development 执行。*
