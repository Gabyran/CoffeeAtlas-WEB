# Type Safety

---

## Canonical Contract Layer

`@coffee-atlas/shared-types` 是当前 v1 API 的主契约层。

这里维护：

- `ApiResponse<T>` / `ApiError`
- `PaginatedResult<T>` / `PageInfo`
- `CatalogBeanCard` / `CatalogBeanDetail`
- `RoasterSummary` / `RoasterDetail`
- favorites DTO
- `BeanSort`、`BeanDiscoverContinent`、`RoasterFeature` 等 query enum

如果 `/api/v1/*` 改了字段，先改 shared-types，再改实现和 consumer。

---

## Read-Only Upstream Context

### 1. API server internal models (`apps/api/lib/catalog.ts`)

`CoffeeBean`、`Roaster` 等模型属于 API 侧内部读取模型：

- 来源：Supabase 等服务端数据源
- 用途：页面渲染、v1 DTO 组装、favorites hydration
- 对小程序来说，它们是“理解服务端来源”的参考，不是直接复用的契约层

### 2. API DTO (`packages/shared-types/src/**`)

v1 route 出口必须尽量对齐 shared-types，而不是直接返回 `lib/catalog.ts` 原型。

### 3. Local app types (`apps/miniprogram/src/types/index.ts`)

当前小程序会从这里统一导出 shared-types 别名和少量本地专用类型，页面与 service 仍从这里拿类型入口。

### 4. Domain snapshots and mappers (`packages/domain/src/**`)

当前小程序已经直接复用：

- `BeanFavoriteSnapshot` / `RoasterFavoriteSnapshot`
- `toBeanFavoriteSnapshot` / `toRoasterFavoriteSnapshot`

这类类型和 mapper 属于平台无关领域层，优先放在 `packages/domain`，不要继续散落到页面里重复定义。

### 5. Local helper/input types

比如：

- Taro 组件 props
- route params / entry intent 相关本地类型
- onboarding 本地流程类型
- `GuidedSeedState`、`AllBeansEntryIntent`
- `ExplorationSet`、`PurchaseClickLogEntry`、`ShareEventLogEntry`

这类类型可以留在本地文件，不必全部提升到 shared-types。

---

## Miniprogram Types

当前小程序保留 `apps/miniprogram/src/types/index.ts` 作为类型出口，主要原因：

- 小程序页面和 service 需要一个稳定的本地导出入口
- `packages/shared-types` 负责 API 契约
- `packages/domain` 负责平台无关 snapshot / mapper
- 小程序本地仍有 `AuthUser`、`LoginResponse`、`CurrentUserProfile` 等 app-specific 类型

规则：

- 改 v1 契约时，先改 `packages/shared-types`，再检查 `apps/miniprogram/src/types/index.ts` 的别名是否仍准确
- 如果 `src/services/api.ts` 的返回值、入参或错误分支变化，要同步检查页面 consumer
- 如果字段只在小程序本地 storage/UI 中使用，可以保留在小程序本地类型或 `packages/domain`
- 不要让 shared-types、domain snapshot、miniprogram 本地别名三者长期悄悄分叉

---

## Local Storage And UI Shapes

storage snapshot、页面 props、组件 props 都使用 camelCase，并保持面向 UI 的结构。

当前已知本地 shape 例子：

- `BeanSnapshot` / `RoasterSnapshot`
- `PendingFavorite`
- `HistoryItem`
- `OnboardingProfile`
- `ExplorationSet`
- `PurchaseClickLogEntry` / `ShareEventLogEntry`

规则：

- `BeanSnapshot` / `RoasterSnapshot` 优先复用 `@coffee-atlas/domain`
- 页面和组件不要直接依赖服务端 row shape
- storage shape 改动时要同步更新 helper 与调用方
- `all_beans_entry_intent`、`all_beans_guided_seed` 这类一次性跨页状态保持本地类型即可，不要为了方便塞进 shared-types
- `ExplorationSet` 要保持 camelCase + string array 结构，兼容从 `coffee_history` 回填的逻辑

---

## Row Shape Never Leaks Into UI

数据库 row 在 API server 侧保持 snake_case，本地模型 / props / DTO 用 camelCase。

### Good

```ts
type RoasterBeanRow = {
  price_amount: number | string | null;
  image_url: string | null;
};

function mapCoffeeBean(row: RoasterBeanRow): CoffeeBean {
  return {
    price: toNumber(row.price_amount),
    imageUrl: row.image_url,
  };
}
```

### Bad

```ts
return {
  price_amount: row.price_amount,
  image_url: row.image_url,
};
```

---

## Preferred Narrowing Patterns

- 优先 `typeof` / `Array.isArray` / type predicate
- 尽量避免 `as any`
- 服务端 query 返回值需要 cast 时，在边界立即收敛，不要让松散类型往下游传

### Good

```ts
const ids = rows
  .map((row) => row.roaster_bean_id)
  .filter((id): id is string => typeof id === 'string' && id.length > 0);
```

### Bad

```ts
const ids = rows.map((row) => row.roaster_bean_id as string);
```

---

## Platform Type Boundaries

- Next.js 类型只留在 `apps/api/**`
- Taro 类型只留在 `apps/miniprogram/**`
- `packages/*` 保持平台无关
- `packages/domain` 可以承载平台无关 snapshot、mapper 和轻领域 helper，但不要把 Taro 页面状态直接塞进去
