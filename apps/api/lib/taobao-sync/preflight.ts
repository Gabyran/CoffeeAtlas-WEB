import { execFile as execFileCallback } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { detectTaobaoRiskSignals } from './parsers.ts';
import { sleep } from './config.ts';
import { TaobaoMcpClient } from './mcp-client.ts';

const execFile = promisify(execFileCallback);

const DEFAULT_TAOBAO_NATIVE_BIN = 'taobao-native';
const DEFAULT_TAOBAO_NATIVE_MAC_BIN = join(homedir(), 'Library', 'Application Support', 'taobao', 'cli', 'bin', 'taobao-native');
const DEFAULT_TAOBAO_MCP_URL = 'http://localhost:3655/mcp';
const DEFAULT_READY_RETRY_COUNT = 8;
const DEFAULT_READY_RETRY_DELAY_MS = 1500;

type TaobaoDesktopProbeClient = Pick<TaobaoMcpClient, 'getCurrentTab' | 'readPageContent'>;
type TaobaoDesktopLogger = Pick<Console, 'log'>;
type ExecFileRunner = (file: string, args: string[]) => Promise<{ stdout?: string; stderr?: string }>;

type TaobaoDesktopPreflightDependencies = {
  execFileRunner: ExecFileRunner;
  probeDesktop: () => Promise<TaobaoDesktopProbeResult>;
  sleepFn: (ms: number) => Promise<void>;
  logger: TaobaoDesktopLogger;
  readyRetryCount: number;
  readyRetryDelayMs: number;
};

export type TaobaoDesktopProbeResult = {
  currentUrl: string | null;
  currentTabTitle: string | null;
  pageTitle: string | null;
};

export type TaobaoDesktopPreflightResult = TaobaoDesktopProbeResult & {
  launchedApp: boolean;
};

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function isTaobaoDesktopNotRunningError(error: unknown) {
  const message = toError(error).message;
  return /应用未运行|先执行 taobao-native start|先执行 taobao-native launch/i.test(message);
}

function resolveTaobaoNativeBin() {
  const preferred = process.env.TAOBAO_NATIVE_BIN?.trim();
  if (preferred) return preferred;
  if (existsSync(DEFAULT_TAOBAO_NATIVE_MAC_BIN)) return DEFAULT_TAOBAO_NATIVE_MAC_BIN;
  return DEFAULT_TAOBAO_NATIVE_BIN;
}

async function defaultExecFileRunner(file: string, args: string[]) {
  return execFile(file, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
}

export async function probeTaobaoDesktop(client?: TaobaoDesktopProbeClient): Promise<TaobaoDesktopProbeResult> {
  const taobaoClient = client ?? new TaobaoMcpClient(process.env.TAOBAO_MCP_URL?.trim() || DEFAULT_TAOBAO_MCP_URL);

  let currentUrl: string | null = null;
  let currentTabTitle: string | null = null;
  let pageTitle: string | null = null;
  let pageContent: string | null = null;
  let lastNonRunningError: Error | null = null;

  try {
    const currentTab = await taobaoClient.getCurrentTab();
    currentUrl = currentTab.url?.trim() || null;
    currentTabTitle = currentTab.title?.trim() || null;
  } catch (error) {
    if (isTaobaoDesktopNotRunningError(error)) {
      throw toError(error);
    }
    lastNonRunningError = toError(error);
  }

  try {
    const page = await taobaoClient.readPageContent({ maxLength: 1200 });
    pageTitle = page.title?.trim() || null;
    pageContent = page.content?.trim() || null;
  } catch (error) {
    if (isTaobaoDesktopNotRunningError(error)) {
      throw toError(error);
    }
    lastNonRunningError = toError(error);
  }

  const signals = detectTaobaoRiskSignals([currentTabTitle, pageTitle, pageContent]);
  if (signals.length > 0) {
    throw new Error(
      `淘宝桌面版当前不可用于自动同步：${signals.map((signal) => `${signal.reason}(${signal.text})`).join(', ')}`
    );
  }

  if (currentUrl || currentTabTitle || pageTitle || pageContent) {
    return {
      currentUrl,
      currentTabTitle,
      pageTitle,
    };
  }

  if (lastNonRunningError) {
    throw lastNonRunningError;
  }

  return {
    currentUrl,
    currentTabTitle,
    pageTitle,
  };
}

async function launchTaobaoDesktop(execFileRunner: ExecFileRunner) {
  await execFileRunner(resolveTaobaoNativeBin(), ['launch']);
}

function resolveDependencies(
  deps?: Partial<TaobaoDesktopPreflightDependencies>
): TaobaoDesktopPreflightDependencies {
  return {
    execFileRunner: deps?.execFileRunner ?? defaultExecFileRunner,
    probeDesktop: deps?.probeDesktop ?? (() => probeTaobaoDesktop()),
    sleepFn: deps?.sleepFn ?? sleep,
    logger: deps?.logger ?? console,
    readyRetryCount: deps?.readyRetryCount ?? DEFAULT_READY_RETRY_COUNT,
    readyRetryDelayMs: deps?.readyRetryDelayMs ?? DEFAULT_READY_RETRY_DELAY_MS,
  };
}

export async function ensureTaobaoDesktopReady(
  deps?: Partial<TaobaoDesktopPreflightDependencies>
): Promise<TaobaoDesktopPreflightResult> {
  const resolved = resolveDependencies(deps);

  try {
    const probe = await resolved.probeDesktop();
    resolved.logger.log('淘宝桌面版状态正常，直接开始同步。');
    return {
      launchedApp: false,
      ...probe,
    };
  } catch (error) {
    if (!isTaobaoDesktopNotRunningError(error)) {
      throw error;
    }
  }

  resolved.logger.log('淘宝桌面版未运行，尝试自动启动。');
  await launchTaobaoDesktop(resolved.execFileRunner);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < resolved.readyRetryCount; attempt += 1) {
    try {
      const probe = await resolved.probeDesktop();
      resolved.logger.log('淘宝桌面版已启动并通过预检查。');
      return {
        launchedApp: true,
        ...probe,
      };
    } catch (error) {
      lastError = toError(error);
      if (!isTaobaoDesktopNotRunningError(error)) {
        throw error;
      }
      await resolved.sleepFn(resolved.readyRetryDelayMs);
    }
  }

  throw new Error(
    `已尝试启动淘宝桌面版，但在 ${Math.round((resolved.readyRetryCount * resolved.readyRetryDelayMs) / 1000)} 秒内仍未就绪${
      lastError ? `: ${lastError.message}` : ''
    }`
  );
}
