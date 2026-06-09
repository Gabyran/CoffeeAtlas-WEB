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

## Scenario: API-hosted Admin Pages

### 1. Scope / Trigger

- Trigger: 新增或修改 `apps/api/app/admin/**`、`apps/api/app/api/admin/**`、`apps/api/lib/server/admin-*.ts`。
- Admin 页面属于 API 应用的运维后台，不属于小程序前端。

### 2. Signatures

- Page route: `GET /admin/<tool>`
- Admin API route: `/api/admin/<resource>`
- Auth helper: `requireAdmin(request: NextRequest)`
- DB helper: admin 读写默认使用 `requireSupabaseServiceRoleServer()`

### 3. Contracts

- Env: `ADMIN_API_TOKEN` 必须配置，否则 admin API 返回 `admin_auth_disabled`。
- Request auth: `Authorization: Bearer <ADMIN_API_TOKEN>`。
- Response shape: 当前 admin API 沿用 legacy JSON，成功为 `{ ok: true, data? }`，失败走 `toLegacyError()`。
- DB: 管理端写操作必须是真实 Supabase 写入，不允许 sample fallback。

### 4. Validation & Error Matrix

- Missing `ADMIN_API_TOKEN` -> `403 admin_auth_disabled`
- Missing or wrong bearer token -> `403 admin_forbidden`
- Invalid JSON body -> `400 invalid_payload`
- Invalid status enum -> `400 invalid_status`
- Missing target row -> `404 not_found`
- Missing service role env -> `500 supabase_service_role_missing`

### 5. Good/Base/Bad Cases

- Good: `/admin/roaster-beans` 只负责交互，所有写操作调用 `/api/admin/roaster-beans/*`。
- Base: 管理页可在本地输入 token，token 不写入仓库。
- Bad: 在 route handler 里直接拼复杂 Supabase 查询，或用 anon key/sample data 假装管理写入成功。

### 6. Tests Required

- `pnpm --filter @coffeeatlas/api test` 至少覆盖 `requireAdmin()` 的 disabled/forbidden/success 分支。
- `pnpm --filter @coffeeatlas/api typecheck`
- `pnpm --filter @coffeeatlas/api lint`
- 改 admin 页面或 Next config 后，补 `pnpm --filter @coffee-atlas/shared-types build && pnpm --filter @coffeeatlas/api build`。

### 7. Wrong vs Correct

#### Wrong

```ts
return toLegacyError({ status: 400, code: 'invalid_payload', message: 'Bad body' });
```

#### Correct

```ts
badRequest('Request body must be a JSON object', 'invalid_payload');
```

## Scenario: Next 16 API Build With Workspace Shared Types

### 1. Scope / Trigger

- Trigger: `apps/api` imports `@coffee-atlas/shared-types` and runs `next build` with Turbopack.
- Next 16 uses Turbopack by default, and Turbopack follows `tsconfig` path aliases unless overridden.

### 2. Signatures

- Required prebuild: `pnpm --filter @coffee-atlas/shared-types build`
- API build: `pnpm --filter @coffeeatlas/api build`
- Config location: `apps/api/next.config.ts`

### 3. Contracts

- `@coffee-atlas/shared-types` package exports compiled `dist/index.js`.
- `apps/api/next.config.ts` must alias `@coffee-atlas/shared-types` to `../../packages/shared-types/dist/index.js` for Turbopack builds.
- Do not point the alias to an absolute filesystem path; Turbopack can misread it as a server-relative import.

### 4. Validation & Error Matrix

- Shared types not built -> module resolution may fail at build time.
- Alias points to `packages/shared-types/src/index.ts` -> Turbopack cannot resolve `.js` re-exports from TS source.
- Alias is absolute path -> `server relative imports are not implemented yet`.

### 5. Good/Base/Bad Cases

- Good: root `pnpm build` uses Turbo `^build`, so shared-types builds before API.
- Base: isolated API build should explicitly run shared-types build first.
- Bad: changing shared-types source exports just to satisfy Next while breaking package ESM output.

### 6. Tests Required

- `pnpm --filter @coffee-atlas/shared-types build`
- `pnpm --filter @coffeeatlas/api build`
- Keep `pnpm --filter @coffeeatlas/api typecheck` passing after config changes.

### 7. Wrong vs Correct

#### Wrong

```ts
turbopack: {
  resolveAlias: {
    '@coffee-atlas/shared-types': '/Users/gabi/CoffeeAtlas-Web/packages/shared-types/dist/index.js',
  },
}
```

#### Correct

```ts
turbopack: {
  resolveAlias: {
    '@coffee-atlas/shared-types': '../../packages/shared-types/dist/index.js',
  },
}
```
