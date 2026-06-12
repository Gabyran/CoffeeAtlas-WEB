# CoffeeAtlas — 会话交接

记录跨会话需要保留的上下文，避免重复解释。

---

## 当前活跃任务

| 任务 | 状态 | 负责人 | 最后更新 |
|------|------|--------|----------|
| 03-12-wechat-miniprogram | in_progress | @Gabi | 2026-04 |
| 04-20-taobao-auto-listing | planning | codex-agent | 2026-04-20 |

## 近期关键决策

- 2026-04-20: Taobao 自动化上下架任务进入规划阶段
- 2026-04-20: health 审计修复了 agent 工具引用、settings.local.json 清理、包名一致性

## 已知问题 / 技术债务

- `packages/domain` 仍为骨架状态，实际逻辑在 `apps/api/lib/catalog.ts`
- `@coffee-atlas` 包名在部分旧文档中仍可能残留（已修复 3 个嵌套文件）

## 常用入口

- 项目根: `/Users/gabi/CoffeeAtlas-Web`
- 小程序: `apps/miniprogram`
- API: `apps/api`
- 共享类型: `packages/shared-types`
- 淘宝同步: `apps/api/lib/taobao-sync/`
