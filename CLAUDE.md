# CoffeeAtlas

## 项目定位

当前仓库以微信小程序开发为主，运行面分成 `apps/miniprogram` 和 `apps/api`。
`packages/shared-types`、`packages/api-client`、`packages/domain` 作为共享契约和辅助层保留。

---

## 当前结构

| 模块 | 路径 | 职责 |
|------|------|------|
| api | `apps/api` | `/api/*` 路由、服务端逻辑、SQL、导入脚本 |
| miniprogram | `apps/miniprogram` | Taro 小程序页面、组件、services、utils |
| shared-types | `packages/shared-types` | API DTO、响应信封、查询参数类型 |
| api-client | `packages/api-client` | 共享 path builder、unwrap、错误处理 helper |
| domain | `packages/domain` | 平台无关领域逻辑 |

---

## 常用命令

```bash
pnpm install
pnpm dev
pnpm dev:api
pnpm lint
pnpm typecheck
pnpm --filter @coffeeatlas/miniprogram test
```

### 淘宝同步相关（apps/api）

```bash
pnpm sync:taobao:daily          # 每日同步（preflight + 上新 + 下架清理）
pnpm sync:taobao:new            # 单店上新抓取
pnpm sync:taobao:shop           # 单店全量同步
pnpm cleanup:taobao:offshelf    # 下架商品清理归档
pnpm import:taobao:bindings     # 导入淘宝-烘焙商绑定关系
```

`pnpm dev` 当前等同于 `pnpm dev:miniprogram:auto`，会监听小程序和共享包改动，并自动重启 `dev:weapp`。
需要本地联调用户、收藏或其他 `/api/v1/*` 时，再单独运行 `pnpm dev:api`。

---

## 协作原则

- 默认先看 `apps/miniprogram`、`apps/api` 和相关 `packages/*`，不要再把仓库当成带页面的 web 主仓库。
- `packages/*` 保持平台无关，禁止引入 `next/*`、`next/server`、`@tarojs/*`。
- 改接口字段时，先看 `packages/shared-types`，再检查 `apps/miniprogram/src/types/index.ts` 和调用页面。
- 运行时 API 地址和联调提示仍以 `apps/miniprogram/src/utils/api-config.ts` 为准。
- 说明当前仓库状态时，优先描述“小程序 + API + 共享层”，不要再描述为 web / miniprogram 双主端。
