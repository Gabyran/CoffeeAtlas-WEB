# 导入与数据运维脚本规范

> 这里记录的是 `apps/api/scripts/**` 的当前现实，以及新增/修改脚本时应遵守的约束。

---

## 当前脚本清单

| 文件 | 作用 | 当前状态 |
|------|------|----------|
| `import-roasters.ts` | 批量插入 roasters 基础数据 | 可运行，但有历史安全债 |
| `import-beans.ts` | 插入 beans 与 roaster_beans 关联 | 可运行，但有历史安全债 |
| `import-sales.ts` | 从 Excel 导入销量/价格/图片 | 强依赖本地文件路径 |
| `import-taobao-roaster-bindings.ts` | 导入 Taobao 店铺与 roaster 绑定关系 | 已有 package script |
| `sync-taobao-new-arrivals.ts` | 逐店抓取 Taobao 上新并写入同步结果 | 当前主采集入口 |
| `sync-taobao-single-shop.ts` | 单店 Taobao 手测 / 联调入口 | 适合回归和 live check |
| `cleanup-taobao-offshelf.ts` | 预览或执行 Taobao 下架清理 | 需要明确 token / confirm |
| `daily-taobao-sync.ts` | 每日编排：preflight -> arrivals -> cleanup | 已有 package script |
| `render-taobao-ocr-review.ts` | 渲染 OCR 冲突复核结果 | 只生成复核输出，不直接写库 |
| `smoke-v1.mjs` | 对 `/api/v1/*` 做基础 smoke | 已有 package script |
| `check-cloud-env.mjs` | 检查云端环境变量完整度 | 已有 package script |
| `test-surge-supabase.mjs` | 本地网络/代理联调脚本 | 偏诊断用途 |

---

## 目录与执行现实

脚本位于：
- `/Users/gabi/CoffeeAtlas-Web/apps/api/scripts/`

当前 package.json 里已经封装的命令：

```bash
cd apps/api
pnpm sync:taobao:new
pnpm sync:taobao:shop -- --roaster-name <name>
pnpm sync:taobao:daily
pnpm smoke:api
pnpm check:cloud-env
```

大部分关键脚本已经有 package script 包装；仍然不要在 Trellis 文档里假设仓库统一用了 `tsx`，当前实际入口是 `node --experimental-strip-types`。

---

## 当前导入脚本现实

### `import-roasters.ts`
- 直接创建 Supabase client
- 维护一大批静态 roaster seed 数据
- 当前脚本仍带有 fallback URL / key

### `import-beans.ts`
- 直接创建 Supabase client
- 同时写入 `beans` 与 `roaster_beans`
- 使用本地映射表、去重逻辑和手工产品配置
- 当前脚本仍带有 fallback URL / key

### `import-sales.ts`
- 读取本地 Excel
- 用商品名模糊匹配 `roaster_beans.display_name`
- 回写 `sales_count`、`price_amount`、`image_url`
- 当前脚本仍带有 fallback URL / key
- 还依赖绝对路径 Excel 文件，属于明显技术债

### `import-taobao-roaster-bindings.ts`
- 维护 Taobao 店铺与 roaster 的绑定关系
- 为上新同步、下架清理、单店回归提供基础输入
- 绑定字段一旦变动，要同步检查 `lib/taobao-sync/repository.ts` 和相关测试

---

## 新脚本与后续修改规则

### 必须遵守

1. 敏感配置只从环境变量读取
2. 不再新增 fallback service-role key
3. 输入文件路径改为参数或环境变量，不写死个人机器绝对路径
4. 出错时打印清晰上下文并非 0 退出
5. 运行前先说明会改哪些表/字段

### 推荐模式

```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}
```

不要继续复制当前历史脚本里“env 缺失就回退到硬编码值”的做法。

---

## Taobao 同步脚本现实

### Scenario: Taobao daily and arrivals sync

#### 1. Scope / Trigger
- Trigger: 这类改动同时涉及桌面端自动化、脚本入口、同步结果状态和下架清理，属于典型 infra / cross-layer 规则，必须写成 code-spec

#### 2. Signatures
- 单次上新同步：`pnpm --filter @coffeeatlas/api sync:taobao:new`
- 单店联调：`pnpm --filter @coffeeatlas/api sync:taobao:shop -- --roaster-name <name>`
- 每日编排：`pnpm --filter @coffeeatlas/api sync:taobao:daily`
- 核心入口：
  - `ensureTaobaoDesktopReady(): Promise<TaobaoDesktopPreflightResult>`
  - `runTaobaoDailySync(): Promise<{ summary: TaobaoDailySyncSummary; exitCode: number }>`

#### 3. Contracts
- 当前 transport 以 `taobao-native` CLI 为准，不再把旧 MCP wrapper 当成主实现
- `TAOBAO_MCP_URL` 可选，默认 `http://localhost:3655/mcp`
- `TAOBAO_NATIVE_BIN` 可选，未设置时优先尝试本机默认安装路径
- `TAOBAO_NATIVE_TIMEOUT_MS` 可选，用于限制单次 native tool 调用超时
- `TAOBAO_SYNC_MAX_ITEMS_PER_SHOP` 可选；`scripts/daily-taobao-sync.ts` 当前会主动设为 `200`
- `TAOBAO_SYNC_DELAY_MIN_MS` / `TAOBAO_SYNC_DELAY_MAX_MS`、`TAOBAO_SYNC_PAGE_READ_MAX_LENGTH`、`TAOBAO_SYNC_MAX_LOW_CONFIDENCE_DETAIL_READS_PER_SHOP` 为可选调优项
- OCR / 视觉补充能力通过 `VISION_BASE_URL`、`VISION_API_KEY`、`VISION_MODEL` 可选启用
- `sync:taobao:daily` 的 stdout 约定输出 JSON，包含 `preflight` 和每日 summary；最终退出码由 `exitCode` 决定
- arrivals 采集默认先尝试店铺 `上新` / `新品` 入口，仅在该入口缺失或无结果时才回退到 listing 流程

#### 4. Validation & Error Matrix
- 桌面端未运行 -> preflight 尝试 `taobao-native launch`，在重试窗口内等待就绪
- 页面出现登录失效、验证码、安全验证信号 -> preflight 直接失败，不进入同步
- arrivals sync 返回 `FAILED` -> daily sync 直接结束，不执行 cleanup，退出码为 `1`
- cleanup preview 存在阻断 warning -> 记录 warning，跳过自动下架，不视为脚本崩溃
- 某个 binding 的 cleanup 执行报错 -> 继续后续 binding，最终 summary 记为 `PARTIAL`，退出码为 `1`
- 从 `上新` 页抓到的商品 -> 不做 listing 模式那种 pre-detail duplicate skip，避免把真实新品提前丢掉

#### 5. Good / Base / Bad Cases
- Good: 店铺上新页可读、preflight 正常、daily summary 返回 `SUCCEEDED`
- Base: 上新页为空，自动回退 listing，同步仍可完成
- Bad: 桌面端未登录或出现验证码，脚本仍继续抓取；这是明确禁止的行为

#### 6. Tests Required
- `apps/api/tests/taobao-sync.test.ts`
  - 断言 `new_arrivals` 与 `listing` 的 duplicate skip 规则不同
  - 断言 `taobao-native` payload unwrap 和 tool error 传播正确
- `apps/api/tests/taobao-preflight.test.ts`
  - 断言桌面端已就绪、不运行自动拉起、始终未就绪、登录失效等分支
- `apps/api/tests/taobao-daily-sync.test.ts`
  - 断言 arrivals 失败时不会继续 cleanup
  - 断言 blocking warning 跳过自动下架
  - 断言 cleanup 单店失败时最终为 `PARTIAL`

#### 7. Wrong vs Correct

##### Wrong
- 把 daily sync 写成“直接跑 arrivals + 无条件 cleanup”
- 把 listing fallback 的去重规则直接套到 `上新` 页采集
- 看到验证码/登录失效还继续自动同步

##### Correct
- daily sync 先做 preflight，再跑 arrivals，再按 preview 结果决定 cleanup
- `上新` 页优先，listing 只做 fallback
- 登录/验证码风险属于 hard stop，要在同步前失败并暴露清晰错误

---

## 与数据层的关系

这些脚本写入的主要对象包括：
- `roasters`
- `beans`
- `roaster_beans`
- `app_users` / `user_favorites`（当前脚本未直接写，但相关 schema 已存在）

查询/字段契约变动后，记得同步：
- `/Users/gabi/CoffeeAtlas-Web/.trellis/spec/data-layer.md`
- `/Users/gabi/CoffeeAtlas-Web/.trellis/spec/api/backend/database-guidelines.md`
- `/Users/gabi/CoffeeAtlas-Web/.trellis/spec/database-schema.md`

---

## API 运维脚本

### `smoke-v1.mjs`
用途：
- 检查 `/api/v1/health`
- 检查 beans / roasters 列表
- 可选检查 `me` / `favorites`

环境变量：
- `API_BASE_URL`
- `AUTH_TOKEN`（可选）

### `check-cloud-env.mjs`
用途：
- 检查 cloud 环境变量是否齐全
- 输出 API smoke 提醒

关注的 key：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_JWT_SECRET`
- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `TARO_APP_API_URL`（可选）

### Taobao 同步脚本

#### `sync-taobao-new-arrivals.ts`
用途：
- 逐店抓取 Taobao 新品
- 允许上新页优先、listing 回退

#### `sync-taobao-single-shop.ts`
用途：
- 对单个 roaster 做联调或回归
- 适合人工复查“上新页优先”是否仍生效

#### `daily-taobao-sync.ts`
用途：
- 先执行 desktop preflight
- 再跑 arrivals sync
- 最后做下架 preview / apply 编排

#### `render-taobao-ocr-review.ts`
用途：
- 输出 OCR 冲突复核结果
- 不应在“只读复核”模式下直接写库或静默修改同步状态

---

## 当前技术债清单

1. 三个导入脚本都仍含硬编码 fallback 凭据
2. `import-sales.ts` 依赖个人下载目录里的 Excel 文件
3. 导入脚本还没有统一 package script 和参数规范
4. 模糊匹配更新销量有误命中风险，后续应逐步过渡到更稳定的 product identity

Trellis 应把这些视为“待修问题”，不是“推荐实践”。
