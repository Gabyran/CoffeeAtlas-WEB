import { config } from 'dotenv';
// 按优先级加载：.env.local > .env.production > .env
config({ path: new URL('../../../.env.local', import.meta.url).pathname, quiet: true });
config({ path: new URL('../../../.env.production', import.meta.url).pathname, quiet: true });
config({ path: new URL('../../../.env', import.meta.url).pathname, quiet: true });

import { ensureTaobaoDesktopReady } from '../lib/taobao-sync/preflight.ts';
import { runTaobaoDailySync } from '../lib/taobao-sync/daily.ts';
import { TaobaoSyncRepository } from '../lib/taobao-sync/repository.ts';

type ParsedArgs = {
  bindingId?: string;
  roasterName?: string;
};

function readArg(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function parseArgs(argv: string[]): ParsedArgs {
  const normalizedArgs = argv.filter((arg) => arg !== '--');
  const bindingId = readArg(normalizedArgs, '--binding-id');
  const roasterName = readArg(normalizedArgs, '--roaster-name');

  if (bindingId && roasterName) {
    throw new Error('Usage: daily-taobao-sync.ts [--binding-id <id> | --roaster-name <name>]');
  }

  if (
    bindingId &&
    !/^[0-9a-f]{8}-[0-9a-f]{3}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bindingId)
  ) {
    throw new Error(`Invalid binding id: ${bindingId}`);
  }

  return { bindingId, roasterName };
}

async function resolveBinding(args: ParsedArgs) {
  if (!args.bindingId && !args.roasterName) {
    return null;
  }

  const repository = new TaobaoSyncRepository();
  const binding = args.bindingId
    ? await repository.findBindingById(args.bindingId)
    : await repository.findBindingByRoasterName(args.roasterName!);

  if (!binding) {
    throw new Error(
      args.bindingId
        ? `Taobao binding not found: ${args.bindingId}`
        : `Taobao binding not found for roaster: ${args.roasterName}`
    );
  }

  if (!binding.isActive) {
    throw new Error(`Taobao binding is inactive: ${binding.id}`);
  }

  return binding;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const binding = await resolveBinding(parsed);

  // 每店最多扫描 200 条，确保全量覆盖
  process.env.TAOBAO_SYNC_MAX_ITEMS_PER_SHOP = '200';

  const preflight = await ensureTaobaoDesktopReady();
  const { summary, exitCode } = await runTaobaoDailySync(
    binding ? { targetBinding: binding } : undefined
  );

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

  if (binding) {
    console.log(
      `\n单店同步完成（${binding.roasterName}），建议间隔 30–60 分钟后再运行下一家，避免触发风控。`
    );
  }

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

main().catch((error) => {
  console.error('淘宝每日同步失败:', error instanceof Error ? error.message : error);
  process.exit(1);
});
