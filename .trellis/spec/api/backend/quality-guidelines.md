# Backend Quality Guidelines

---

## Required Commands

按改动范围执行真实命令：

```bash
pnpm lint
pnpm typecheck
pnpm --filter @coffeeatlas/api test
```

如果只改了小程序，不需要跑 API test；如果改了 `apps/api/lib/server/**`、`apps/api/app/api/**`、`apps/api/lib/catalog.ts`，至少跑 API test。

如果改了 `apps/api/lib/taobao-sync/**` 或 `apps/api/scripts/*taobao*`，默认也按 backend 变更处理，至少跑：

```bash
pnpm --filter @coffeeatlas/api test
pnpm --filter @coffeeatlas/api typecheck
pnpm --filter @coffeeatlas/api lint
```

API 改动后，若本地或预览环境可访问，再补：

```bash
cd apps/api
API_BASE_URL=http://127.0.0.1:3000 pnpm smoke:api
```

---

## Route Placement Rules

- 对外 API：放在 `apps/api/app/api/v1/**`
- 旧兼容接口：只在已有 `apps/api/app/api/beans` / `roasters` / `health` 中维护
- route handler 只做参数解析、鉴权、调用 service、包装响应
- 复杂查询和业务组装放到 `apps/api/lib/server/**` 或 `apps/api/lib/catalog.ts`

不要把大段 SQL 拼装、鉴权、DTO 映射全部堆进 `route.ts`。

---

## Security Rules

- `SUPABASE_SERVICE_ROLE_KEY` 只能在服务端使用
- Bearer 鉴权统一走 `requireUser()`，不要手写多套 token 解析
- 微信 secret 只在 `wechat-auth.ts` 等服务端模块读取
- 管理员能力在真实鉴权接入前都必须标成 placeholder / restricted，不能伪装成正式安全能力

---

## Compatibility Rules

- 小程序和新客户端默认使用 `/api/v1/*`
- 旧 `/api/beans`、`/api/roasters` 是兼容层，除非明确迁移，不要直接删
- 改 shared response contract 时，要同步检查：
  - `packages/shared-types/**`
  - `apps/miniprogram/src/services/api.ts`
  - `apps/miniprogram/src/types/index.ts`
  - `packages/api-client/**`（如果相关）

---

## Manual Verification

- beans / roasters 列表：确认分页字段、筛选字段和旧参数兼容（`limit` -> `pageSize`）
- auth / favorites：确认未登录为 401、已登录可读写、sync 去重正常
- health：确认 `supabaseConfigured` / `wechatConfigured` / `jwtConfigured` 状态与环境一致
- admin helper：至少验证参数归一化和重复检测逻辑，不要只看 happy path
- Taobao arrivals sync：确认“店铺上新页优先，listing 只做 fallback”没有被回退；对应行为至少要有 `apps/api/tests/taobao-sync.test.ts` 覆盖
- Taobao daily sync：确认 arrivals 失败时不会继续 cleanup；cleanup warning 会跳过自动下架；单店 cleanup 失败时最终状态应为 `PARTIAL`
- Taobao desktop preflight：确认“未启动自动拉起”和“登录/验证码风险提前失败”两条分支都有测试覆盖；参考 `apps/api/tests/taobao-preflight.test.ts`

如果本机桌面环境可用、且这次改动涉及真实 Taobao 自动化，再补一条人工验证：

```bash
pnpm --filter @coffeeatlas/api sync:taobao:shop -- --roaster-name <roaster-name>
```

只在确认桌面端已登录且适合手测时再跑，不要把 live run 当成每次都必须的默认步骤。
