# Backend Development Guidelines

> 适用于 `apps/api/app/api/**`、`apps/api/lib/server/**`、`apps/api/lib/catalog.ts`、`apps/api/lib/supabase.ts`、`apps/api/scripts/**` 和 `apps/api/db/**`。

---

## Backend Surface In This Repo

当前后端主要位于 `apps/api`，分成 4 类入口：

1. `app/api/v1/**` - 对小程序和未来客户端开放的主 API，统一使用 `{ ok, data|error, meta }` 信封。
2. `app/api/beans`、`app/api/roasters`、`app/api/health` - 兼容旧 Web 页面/旧调用方的 legacy 路由。
3. `lib/server/**` - 参数解析、鉴权、公开 API 组装、收藏、微信登录等服务端逻辑。
4. `scripts/**` 和 `db/**` - 数据导入、Taobao 同步、云环境检查、API smoke、SQL schema 与迁移。

---

## Guide Index

| Guide | When To Read | Current Focus |
|-------|--------------|---------------|
| [Database Guidelines](./database-guidelines.md) | 改 Supabase 查询、视图、迁移、导入脚本 | 查询模式、fallback、row -> DTO 映射 |
| [Error Handling](./error-handling.md) | 改 API 路由、参数校验、外部请求 | `HttpError`、`apiSuccess`、legacy 兼容 |
| [Logging Guidelines](./logging-guidelines.md) | 需要加日志、临时调试、脚本输出 | 当前仓库没有统一 logger，默认少日志 |
| [Type Safety](./type-safety.md) | 改 DTO、鉴权、服务端 helper、跨层类型 | `@coffee-atlas/shared-types` 为边界契约 |
| [Quality Guidelines](./quality-guidelines.md) | 任意 backend 变更都要看 | 命令、目录边界、手测和 smoke 要求 |

---

## Pre-Development Checklist

根据任务先读对应文档：

- 改 `app/api/v1/**`：先读 `error-handling.md`、`type-safety.md`、`quality-guidelines.md`
- 改 `lib/catalog.ts` / `lib/server/public-api.ts` / `favorites-api.ts`：先读 `database-guidelines.md`、`type-safety.md`
- 改 JWT / 微信登录 / 收藏接口：先读 `error-handling.md`、`type-safety.md`、`quality-guidelines.md`
- 改导入脚本 / SQL：先读 `database-guidelines.md`、`quality-guidelines.md`
- 改 `lib/taobao-sync/**`、`scripts/sync-taobao-*.ts`、`scripts/daily-taobao-sync.ts`：先读 `quality-guidelines.md` 和 `.trellis/spec/import-scripts.md`
- 需要临时日志：先读 `logging-guidelines.md`

---

## Repo Reality Notes

- `@coffee-atlas/shared-types` 已经是 v1 API 的主契约层。
- `packages/api-client` 和 `packages/domain` 仍是部分骨架，当前运行时主路径仍在 `apps/api` 与 `apps/miniprogram/src/services/api.ts`。
- 公开 catalog 读取支持无 Supabase 环境时 fallback 到 `apps/api/lib/sample-data.ts`；写操作、鉴权、收藏、微信登录不允许静默 fallback。
- `app/api/v1/**` 已经存在；不要再把它当作“待开发目录”。
- `apps/api/lib/server/admin-auth.ts` 仍是占位实现，新增管理端写接口时要显式标明风险，不要误写成已完成鉴权。
- Taobao 自动同步当前已经是后端的一块固定能力：核心逻辑在 `apps/api/lib/taobao-sync/**`，脚本入口在 `apps/api/scripts/**`。
- Taobao 每日同步不是“直接跑采集”这么简单：当前流程会先做桌面端 preflight，检测未启动、登录失效、验证码等风险，再决定是否进入 arrivals sync 和下架清理。
