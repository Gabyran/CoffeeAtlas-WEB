# Task 5: Catalog Roaster Split

## Goal

在不改动现有调用方导入的前提下，把 `apps/api/lib/catalog.ts` 中的 roaster 聚合/查询逻辑抽出到 `catalog-roasters.ts`，让 `catalog.ts` 只保留类型和公开函数 re-export，保持现有行为、搜集 contract，方便后续拆 beans 逻辑。

## What I already know

* `catalog.ts` 目前同时承担 beans/roasters 查询、sample fallback、类型导出等职责，拆分 `catalog-beans.ts`/`catalog-roasters.ts` 让 `catalog.ts` 做门面是已有计划。文档: `docs/superpowers/specs/2026-03-19-p1-catalog-split-design.md` 和 `docs/superpowers/plans/2026-03-19-p1-catalog-split.md`。
* Task 5 只关注 roaster helpers + 公共函数的迁移，beans 逻辑已经在别的任务中拆分或后续处理。
* `catalog-roasters.ts` 只能依赖 `catalog-types.ts`、`catalog-core.ts`、`supabase.ts`，不能反向 import `catalog.ts`；`catalog.ts` 仍须 re-export roaster 公开方法并将类型出口留在 `catalog-types.ts`。

## Assumptions

* `catalog-beans.ts`/`catalog-core.ts` 还在拆分过程中，但这次只需确保 roaster 相关代码被迁走，并且依赖关系正确；如果 `catalog-roasters.ts` 依赖 `catalog-core.ts` 中的 mapper/normalize helpers，它们已经存在或会被迁移同时处理。
* 运行时逻辑不会发生行为改变，所有现有 Supabase 查询、sample fallback、feature filter 逻辑必须照搬到新模块。

## Requirements

* 创建设备 `apps/api/lib/catalog-roasters.ts`，把所有 roaster 私有 helper（`createEmptyRoasterAggregate`, `isTaobaoUrl`, `isXiaohongshuUrl`, `fetchRoasterAggregates`, `matchesRoasterFeature`, `queryRoasterRows`, `resolveRoasterCollection`）和 roaster 公开函数（`getRoasterPage`, `getRoasters`, `countRoasters`, `getRoasterById`, `getRoastersByIds`）迁入该模块。
* 让新模块只依赖 `catalog-types.ts`、`catalog-core.ts`、`supabase.ts`，不再引用 `catalog.ts`。
* `catalog.ts` 仅从 `catalog-types.ts` re-export 类型，从 `catalog-roasters.ts` re-export上述 roaster 函数，并且不再保留这些函数的实现。
* 保持调用方 import `apps/api/lib/catalog.ts` 不变，现有公共接口和返回结构全兼容。
* 迁移完成后执行项目要求的命令：`pnpm --filter @coffeeatlas/api test`, `pnpm --filter @coffeeatlas/api typecheck`, `pnpm -w typecheck`, `pnpm -w lint`，并确认成功。

## Acceptance Criteria

* [ ] `catalog-roasters.ts` 包含所有 roaster helper 和函数的完整迁移，内部逻辑与 `catalog.ts` 中完全一致并继续使用共享类型/map helper。
* [ ] `catalog.ts` 变成兼容门面：从 `catalog-types.ts` 导出类型，从 `catalog-roasters.ts` 和 `catalog-beans.ts`（如果有）导出函数，没有自己实现这些逻辑。
* [ ] 所有依赖 `catalog.ts` 的消费者（后端 API、页面）继续通过类型检查和 lint，不需要改路径。
* [ ] 四条 pnpm 命令通过（`pnpm --filter @coffeeatlas/api test`, `pnpm --filter @coffeeatlas/api typecheck`, `pnpm -w typecheck`, `pnpm -w lint`），并把结果记录在工作日志。

## Definition of Done

* 新文件和模块创建完成并导出所需 helpers/函数。
* `catalog.ts` 保持公开导出一致，且只做 re-export。
* pnpm test/typecheck/lint 命令按要求运行并通过。
* 当前 task 的 `prd.md`、`context`、运行日志都记录在 `.trellis/tasks/03-19-catalog-roaster-split/` 中。

## Technical Approach

1. 在 `catalog.ts` 中提取出 roaster helper/函数的实现，保持逻辑不变但保存原始代码位置以便对照。
2. 把这些 helper/函数剪切到新文件 `catalog-roasters.ts`，让它们依赖 `catalog-types.ts` 与 `catalog-core.ts`，并继续使用 `supabase.ts` 提供的 query 接口。
3. 让 `catalog.ts` 重新导出 `catalog-roasters.ts` 中的函数，并保持类型导出通过 `catalog-types.ts`。
4. 运行 pnpm test/typecheck/lint，确认没有 runtime behavior 回归。

## Decision (ADR-lite)

**Context**: `catalog.ts` 过大且同时包含 beans/roaster/sample fallback/类型输出，后续拆分需要先给 roaster 逻辑一个独立模块。
**Decision**: 把 roaster helper 和公开函数迁移到 `catalog-roasters.ts`，同时让 `catalog.ts` 成为兼容门面，继续 re-export 类型和函数。
**Consequences**: 引入新模块需要保持依赖链条明确（只依赖 types/core/supabase），避免循环；调用方暂不改 import，保留兼容性。

## Out of Scope

* beans 查询/搜索逻辑的拆分（交由 Task 4 处理）。
* 对消费者 import 或 API 结构做任何变更。
* 引入新的后端 API 或 UI 功能。

## Technical Notes

* 参考 spec：`docs/superpowers/specs/2026-03-19-p1-catalog-split-design.md` 以及计划 `docs/superpowers/plans/2026-03-19-p1-catalog-split.md` 中 Task 5 章节。
* 目前 `catalog.ts` 包含 beans + roasters 两套逻辑，拆分后需确保 `catalog-ts` 中仍然 re-export `getRoasters` 等函数。
* `catalog-roasters.ts` 没有现成文件，新建时要保留原始 helper 的实现顺序，便于对照。
