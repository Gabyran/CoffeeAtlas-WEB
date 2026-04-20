# 接入微信小程序 - Taro 多端方案

> 最后更新：2026-03-14

---

## 项目背景

CoffeeAtlas-Web 是一个精品咖啡豆目录平台。当前已完成 Turborepo Monorepo 迁移，目标是同时支持 API 后端（Next.js Route Handlers）和微信小程序（Taro）。

---

## 目标

1. 微信小程序可以浏览咖啡豆目录、烘焙商列表
2. 支持微信登录和收藏功能
3. API 后端和小程序共用同一套 API（`/api/v1/`）

---

## 架构

```
微信小程序 (Taro)  ──> apps/api API Routes (/api/v1/) ──> Supabase
```

共享包（`packages/*`）不引入平台特定依赖，供两端复用。

---

## 当前进度

### ✅ 已完成

**Monorepo 结构**
- Turborepo + pnpm workspaces
- `packages/shared-types`、`packages/domain`、`packages/api-client` 骨架

**小程序端（`apps/miniprogram`）**
- Taro 3.x 项目初始化（React + TypeScript + SCSS）
- 页面：首页、全部咖啡豆、豆款详情、烘焙商列表、烘焙商详情、个人中心
- 组件：BeanCard、RoasterCard、SearchBar、FilterBar、EmptyState、Icon
- API 客户端：`src/services/api.ts`（beans、roasters、auth、favorites）
- 类型定义：`src/types/index.ts`（CoffeeBean、RoasterSummary、RoasterDetail、LoginResponse、UserFavorite）
- 工具：storage（token 管理）、auth、formatters

### 🔲 待完成

**API Routes（`apps/api/app/api/v1/`）**

| 端点 | 方法 | 说明 | 状态 |
|------|------|------|------|
| `/api/v1/beans` | GET | 列表（分页、筛选：q/originCountry/process/roastLevel） | ❌ |
| `/api/v1/beans/[id]` | GET | 豆款详情 | ❌ |
| `/api/v1/roasters` | GET | 列表（分页、筛选：q/city） | ❌ |
| `/api/v1/roasters/[id]` | GET | 烘焙商详情（含旗下豆款） | ❌ |
| `/api/v1/auth/wechat/login` | POST | 微信 code 换 token | ❌ |
| `/api/v1/me/favorites` | GET/POST | 收藏列表 / 添加收藏 | ❌ |
| `/api/v1/me/favorites/[type]/[id]` | DELETE | 删除收藏 | ❌ |
| `/api/v1/me/favorites/sync` | POST | 批量同步收藏 | ❌ |

**小程序页面逻辑**（骨架已有，需接入真实 API）
- [ ] 首页：热门豆款列表
- [ ] 全部咖啡豆：分页 + 搜索 + 筛选
- [ ] 豆款详情：完整信息 + 收藏按钮
- [ ] 烘焙商列表：分页 + 搜索
- [ ] 烘焙商详情：信息 + 旗下豆款
- [ ] 个人中心：登录状态 + 收藏列表

**数据库（Supabase）**
- [ ] 用户表（微信登录）
- [ ] 收藏表

---

## API 设计规范

响应格式统一使用信封：
```json
{ "ok": true, "data": ..., "meta": { "requestId": "..." } }
{ "ok": false, "error": { "code": "...", "message": "..." }, "meta": { "requestId": "..." } }
```

实现参考 `apps/api/lib/server/api-helpers.ts`，数据访问复用 `apps/api/lib/catalog.ts`。

---

## 验收标准

- [ ] 所有 `/api/v1/` 端点返回正确数据
- [ ] 小程序可在微信开发者工具中正常运行
- [ ] 微信登录流程可用
- [ ] 收藏增删同步正常
- [ ] API 响应时间 < 500ms
- [ ] 小程序主包 < 2MB
- [ ] `pnpm typecheck` 和 `pnpm lint` 通过
