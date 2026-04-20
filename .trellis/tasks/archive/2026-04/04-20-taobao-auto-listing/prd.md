# 彻底完整的实现淘宝自动化上下架

## Goal

实现 CoffeeAtlas 淘宝商品的完整自动化生命周期管理：自动抓取新品上架、自动检测已下架商品归档、自动恢复重新上架商品。确保每日同步流程无需人工介入即可完成上下架闭环。

## What I already know

- 现有 `apps/api/lib/taobao-sync/` 模块包含上新同步 (`sync.ts`) 和下架清理 (`cleanup.ts`)
- `daily.ts` 编排每日流程：preflight → arrivals sync → cleanup preview → cleanup apply
- `roaster_beans.status` 有 `DRAFT | ACTIVE | ARCHIVED` 三种状态
- 上新同步通过 `toPublishStatus()` 根据 confidence 决定 status（高 confidence → ACTIVE，低 → DRAFT）
- 下架清理扫描店铺 listing，将 DB 中 ACTIVE/DRAFT 但不在 listing 中的商品标记为 ARCHIVED
- `persistRoasterBean` update 逻辑可能覆盖 ARCHIVED 状态，但 `shouldSkipExistingProduct` 可能导致已下架商品重新出现时被跳过
- 每日同步脚本 `daily-taobao-sync.ts` 已封装为 `pnpm sync:taobao:daily`

## Assumptions (temporary)

- "自动化上下架"包含：上新抓取（已有）、下架归档（已有但需完善）、重新上架恢复（缺失）
- DRAFT → ACTIVE 的转换可能需要自动化规则或仍保留人工审核
- 当前 cleanup 在 daily sync 中是自动执行的，但 preview 有 blocking warning 时会跳过

## Open Questions

- DRAFT 商品是否需要自动上架机制？还是通过其他方式（如 confidence 阈值）自动决定？
- 已下架(ARCHIVED)商品重新出现在店铺中时，是否需要自动恢复为 ACTIVE？
- 现有 cleanup 的 blocking warning 策略是否需要调整以减少人工介入？

## Requirements (evolving)

- 自动上新抓取（已有，维持）
- 自动下架归档（已有，可能需要完善）
- 自动重新上架（缺失，需实现）

## Acceptance Criteria (evolving)

- [ ] 每日同步流程无需人工介入即可完成上下架闭环
- [ ] ARCHIVED 商品重新出现在店铺 listing 中时自动恢复为 ACTIVE
- [ ] 测试覆盖上下架全生命周期

## Definition of Done

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes

## Out of Scope (explicit)

- (待确认)

## Technical Notes

- `apps/api/lib/taobao-sync/sync.ts:481-503` — `shouldSkipExistingProduct` 在重新上架场景下可能误 skip
- `apps/api/lib/taobao-sync/cleanup.ts` — 下架清理逻辑
- `apps/api/lib/taobao-sync/daily.ts` — 每日编排
- `apps/api/lib/taobao-sync/repository.ts:670-685` — `archiveRoasterBeans` 实现
- `apps/api/db/sql/010_schema.sql` — `roaster_beans` 表 schema
