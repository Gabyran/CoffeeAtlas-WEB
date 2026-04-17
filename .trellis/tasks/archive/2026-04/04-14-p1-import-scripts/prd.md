# P1 import scripts standardization

## Goal
把 `apps/api/scripts/import-roasters.ts`、`import-beans.ts`、`import-sales.ts` 统一成可通过 package script 调用、支持参数输入、并输出一致错误信息的脚本。

## Requirements
- 三个历史导入脚本都不再依赖硬编码命令入口方式。
- 至少提供统一的 package script 入口，便于直接运行。
- 脚本参数改为从 CLI 读取，避免把输入文件路径写死在代码里。
- 缺少必需参数或环境变量时，输出一致、可读的错误信息并以非 0 退出。
- 尽量做最小必要改动，不顺手重构大块导入逻辑。

## Acceptance Criteria
- [ ] `apps/api/package.json` 新增或更新对应 import scripts。
- [ ] `import-roasters.ts`、`import-beans.ts`、`import-sales.ts` 支持统一 CLI 启动方式。
- [ ] `import-sales.ts` 不再写死 Excel 文件路径。
- [ ] 三个脚本在参数或环境不合法时会稳定报错并退出。
- [ ] 至少补一组针对参数解析/错误处理的自动化测试。

## Out of Scope
- 不清理数据内容本身。
- 不处理管理鉴权或 shared-types 重构。
- 不把所有脚本都迁移成统一框架，只覆盖这轮 P1 的三支导入脚本。

## Technical Notes
- 当前 repo 在 `apps/api/scripts` 已有较新的脚本样式（如 taobao 相关脚本），可参考其 `dotenv/config`、`parseArgs`、`main().catch(...)` 结构。
- 需要避免继续扩散 `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` 的硬编码 fallback。
- 改动发生在 `apps/api`，需跑匹配的 lint / typecheck / API test。
