# CoffeeAtlas

A pnpm monorepo for the CoffeeAtlas miniprogram, API backend, and shared contracts.

## Workspace Layout
- `apps/api`: Next.js API-only backend, serving `/api/*`
- `apps/miniprogram`: Taro-based WeChat miniprogram
- `packages/shared-types`: shared API contracts
- `packages/api-client`: shared client helpers used by the miniprogram
- `packages/domain`: shared domain helpers

## Quick Start
1. Install dependencies
```bash
pnpm install
```
2. Copy env
```bash
cp .env.example .env.local
```
3. Start miniprogram local preview helper
```bash
pnpm dev
```

API local development:

```bash
pnpm dev:api
```

Useful workspace commands:

```bash
pnpm lint
pnpm typecheck
pnpm --filter @coffeeatlas/miniprogram test
pnpm dev:miniprogram:auto
```

Miniprogram local preview helper:

- `pnpm dev:miniprogram:auto` 会监听 `apps/miniprogram` 和相关共享包改动
- 检测到改动后会自动重启 `pnpm --filter @coffeeatlas/miniprogram dev:weapp`
- 适合微信开发者工具经常需要重新推一次 Taro 才能看到最新预览的场景

## Notes
- Root package manager is `pnpm`. Do not use `npm install` in this repo.
- `packages/api-client` and `packages/domain` are still partial abstractions. Do not move logic there unless it is truly cross-package.
- 小程序的登录、收藏、健康检查等 `/api/v1/*` 现在由 `apps/api` 提供。
