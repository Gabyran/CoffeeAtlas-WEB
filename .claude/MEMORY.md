# CoffeeAtlas — 记忆索引

按主题组织的跨会话记忆条目。

---

## 用户偏好

- 语言：中文交流，代码注释中文
- 不主动添加注释，不创建文档文件
- 避免过于主动的行动，用户明确要求才执行
- 完成任务后运行 lint 和 typecheck

## 项目架构

- 主端：微信小程序（Taro），API（Next.js `/api/*`）
- 共享层：`packages/shared-types`, `packages/api-client`, `packages/domain`
- `packages/*` 禁止引入 `next/*` 或 `@tarojs/*`
- 改接口字段先看 `packages/shared-types`

## 淘宝同步上下文

- 核心逻辑：`apps/api/lib/taobao-sync/`
- 脚本入口：`apps/api/scripts/daily-taobao-sync.ts`
- 每日同步流程：桌面端 preflight → arrivals sync → 下架清理
- 当前问题：同步跑不起来，有新商品未入库
