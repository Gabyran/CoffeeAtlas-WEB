import { config } from 'dotenv';
// 按优先级加载：.env.local > .env.production > .env
config({ path: new URL('../../../.env.local', import.meta.url).pathname, quiet: true });
config({ path: new URL('../../../.env.production', import.meta.url).pathname, quiet: true });
config({ path: new URL('../../../.env', import.meta.url).pathname, quiet: true });

import { ensureTaobaoDesktopReady } from '../lib/taobao-sync/preflight.ts';
import { runTaobaoDailySync } from '../lib/taobao-sync/daily.ts';

async function main() {
  // 每店最多扫描 200 条，确保全量覆盖
  process.env.TAOBAO_SYNC_MAX_ITEMS_PER_SHOP = '200';

  const preflight = await ensureTaobaoDesktopReady();
  const { summary, exitCode } = await runTaobaoDailySync();
  console.log(
    JSON.stringify(
      {
        preflight,
        ...summary,
      },
      null,
      2
    )
  );

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

main().catch((error) => {
  console.error('淘宝每日同步失败:', error instanceof Error ? error.message : error);
  process.exit(1);
});
