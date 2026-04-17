import { execFile as execFileCallback } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type {
  TaobaoBrowseHistoryResult,
  TaobaoInspectPageResult,
  TaobaoMcpCurrentTabResult,
  TaobaoMcpReadPageResult,
  TaobaoSearchProductsResult,
} from './types.ts';

const execFile = promisify(execFileCallback);

const TAOBAO_SOURCE_APP = 'coffeeatlas-taobao-sync';
const DEFAULT_TAOBAO_NATIVE_BIN = 'taobao-native';
const DEFAULT_TAOBAO_MAC_RUNNER = join(homedir(), 'Library', 'Application Support', 'taobao', 'cli', 'taobao-runner');
const DEFAULT_TOOL_RUNNER_TIMEOUT_MS = 90_000;
const TOOL_RUNNER_MAX_BUFFER = 16 * 1024 * 1024;
const TOOL_RUNNER_TIMEOUT_MS = parsePositiveInt(process.env.TAOBAO_NATIVE_TIMEOUT_MS, DEFAULT_TOOL_RUNNER_TIMEOUT_MS);

type TaobaoToolRequest = {
  tool: string;
  arguments: Record<string, unknown>;
};

type TaobaoMcpClientOptions = {
  nativeBin?: string;
  toolRunner?: <T>(request: TaobaoToolRequest, context: { nativeBin: string }) => Promise<T>;
};

type ExecFileError = Error & {
  stdout?: string;
  stderr?: string;
  killed?: boolean;
  signal?: NodeJS.Signals | string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function extractErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed || null;
  }

  if (isRecord(error) && typeof error.message === 'string') {
    const trimmed = error.message.trim();
    return trimmed || null;
  }

  return null;
}

function parseJsonFromText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    // Ignore and try the last JSON-looking line.
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line || (!line.startsWith('{') && !line.startsWith('[') && !line.startsWith('"'))) {
      continue;
    }

    try {
      return JSON.parse(line) as unknown;
    } catch {
      // Keep looking.
    }
  }

  return null;
}

function extractReadableProcessMessage(text?: string | null) {
  if (!text) return null;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith('[')) {
      return line;
    }
  }

  return lines[lines.length - 1] ?? null;
}

function unwrapToolPayload<T>(payload: unknown): T {
  let current = payload;

  for (let depth = 0; depth < 8; depth += 1) {
    if (typeof current === 'string') {
      const parsed = parseJsonFromText(current);
      if (parsed === null) break;
      current = parsed;
      continue;
    }

    if (!isRecord(current)) {
      break;
    }

    const message = extractErrorMessage(current.error);
    if (message) {
      throw new Error(message);
    }

    if (Array.isArray(current.content)) {
      const nestedText = current.content.find(
        (item) => isRecord(item) && item.type === 'text' && typeof item.text === 'string'
      );
      if (nestedText && typeof nestedText.text === 'string') {
        current = nestedText.text;
        continue;
      }
    }

    if ('result' in current) {
      current = current.result;
      continue;
    }

    break;
  }

  return current as T;
}

async function loadCliPayload(stdout: string, outputFile: string) {
  if (existsSync(outputFile)) {
    return JSON.parse(await readFile(outputFile, 'utf8')) as unknown;
  }

  const summary = parseJsonFromText(stdout);
  if (isRecord(summary) && typeof summary.resultFile === 'string' && existsSync(summary.resultFile)) {
    return JSON.parse(await readFile(summary.resultFile, 'utf8')) as unknown;
  }

  if (summary !== null) {
    return summary;
  }

  throw new Error('Taobao native CLI returned no JSON payload');
}

function formatToolFailure(toolName: string, error: unknown): Error {
  if (error instanceof Error && !('stdout' in error) && !('stderr' in error)) {
    return error;
  }

  const execError = error as ExecFileError;
  const stderrPayload = parseJsonFromText(execError.stderr ?? '');
  const stdoutPayload = parseJsonFromText(execError.stdout ?? '');
  const timeoutMessage = execError.killed && /timed out/i.test(execError.message) ? `timed out after ${TOOL_RUNNER_TIMEOUT_MS}ms` : null;
  const message =
    timeoutMessage ||
    (stderrPayload && extractErrorMessage(isRecord(stderrPayload) ? stderrPayload.error : null)) ||
    (stdoutPayload && extractErrorMessage(isRecord(stdoutPayload) ? stdoutPayload.error : null)) ||
    extractReadableProcessMessage(execError.stderr) ||
    extractReadableProcessMessage(execError.stdout) ||
    execError.message ||
    'Unknown taobao-native error';

  return new Error(`Taobao native tool ${toolName} failed: ${message}`);
}

function resolveNativeBin(preferred?: string | null) {
  const envBin = process.env.TAOBAO_NATIVE_BIN?.trim();
  if (envBin) return envBin;

  const normalizedPreferred = preferred?.trim();
  if (normalizedPreferred && !/^https?:\/\//i.test(normalizedPreferred)) {
    return normalizedPreferred;
  }

  if (existsSync(DEFAULT_TAOBAO_MAC_RUNNER)) {
    return DEFAULT_TAOBAO_MAC_RUNNER;
  }

  return DEFAULT_TAOBAO_NATIVE_BIN;
}

async function defaultToolRunner<T>(request: TaobaoToolRequest, context: { nativeBin: string }) {
  const tempDir = await mkdtemp(join(tmpdir(), 'coffeeatlas-taobao-native-'));
  const requestFile = join(tempDir, `${request.tool}.request.json`);
  const outputFile = join(tempDir, `${request.tool}.result.json`);

  try {
    await writeFile(requestFile, JSON.stringify(request), 'utf8');
    const { stdout } = await execFile(context.nativeBin, ['--request', requestFile, '-o', outputFile], {
      encoding: 'utf8',
      maxBuffer: TOOL_RUNNER_MAX_BUFFER,
      timeout: TOOL_RUNNER_TIMEOUT_MS,
    });
    const payload = await loadCliPayload(stdout, outputFile);
    return unwrapToolPayload<T>(payload);
  } catch (error) {
    throw formatToolFailure(request.tool, error);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function normalizeReadPageResult(result: Partial<TaobaoMcpReadPageResult> | null | undefined): TaobaoMcpReadPageResult {
  return {
    url: typeof result?.url === 'string' ? result.url : '',
    title: typeof result?.title === 'string' ? result.title : '',
    content: typeof result?.content === 'string' ? result.content : '',
    totalLength: typeof result?.totalLength === 'number' ? result.totalLength : 0,
    truncated: Boolean(result?.truncated),
  };
}

function normalizeBrowseHistoryResult(result: Partial<TaobaoBrowseHistoryResult> | null | undefined): TaobaoBrowseHistoryResult {
  return {
    type: typeof result?.type === 'string' ? result.type : 'product',
    count: typeof result?.count === 'number' ? result.count : 0,
    items: Array.isArray(result?.items) ? result.items : [],
  };
}

function normalizeScanPageElementsResult(result: { dom?: string; totalElements?: number } | null | undefined) {
  return {
    dom: typeof result?.dom === 'string' ? result.dom : '',
    totalElements: typeof result?.totalElements === 'number' ? result.totalElements : 0,
  };
}

function normalizeSearchProductsResult(result: Partial<TaobaoSearchProductsResult> | null | undefined): TaobaoSearchProductsResult {
  return {
    keyword: typeof result?.keyword === 'string' ? result.keyword : '',
    count: typeof result?.count === 'number' ? result.count : 0,
    products: Array.isArray(result?.products) ? result.products : [],
  };
}

export class TaobaoMcpClient {
  private readonly nativeBin: string;
  private readonly toolRunner: NonNullable<TaobaoMcpClientOptions['toolRunner']>;

  constructor(baseUrl: string, options: TaobaoMcpClientOptions = {}) {
    this.nativeBin = resolveNativeBin(options.nativeBin ?? baseUrl);
    this.toolRunner = options.toolRunner ?? defaultToolRunner;
  }

  async initialize() {
    // Kept for backward compatibility with older call sites.
  }

  private async callTool<T>(name: string, args: Record<string, unknown>) {
    const result = await this.toolRunner<unknown>(
      {
        tool: name,
        arguments: {
          sourceApp: TAOBAO_SOURCE_APP,
          ...args,
        },
      },
      { nativeBin: this.nativeBin }
    );
    return unwrapToolPayload<T>(result);
  }

  async navigateToUrl(url: string) {
    await this.callTool<{ success: boolean; url: string }>('navigate_to_url', { url });
  }

  async readPageContent(args: { scope?: string; maxLength?: number; offset?: number } = {}) {
    const result = await this.callTool<Partial<TaobaoMcpReadPageResult>>('read_page_content', args);
    return normalizeReadPageResult(result);
  }

  async scanPageElements(args: { filter?: string; scope?: string } = {}) {
    const result = await this.callTool<{ dom?: string; totalElements?: number }>('scan_page_elements', args);
    return normalizeScanPageElementsResult(result);
  }

  async clickElement(args: { index?: number; text?: string }) {
    return this.callTool<{ success?: boolean }>('click_element', args);
  }

  async scrollPage(args: { direction?: 'up' | 'down' | 'top' | 'bottom'; amount?: number; selector?: string } = {}) {
    return this.callTool<{ success?: boolean }>('scroll_page', args);
  }

  async getCurrentTab() {
    return this.callTool<TaobaoMcpCurrentTabResult>('get_current_tab', {});
  }

  async getBrowseHistory(type: 'product' | 'search' | 'shop') {
    const result = await this.callTool<Partial<TaobaoBrowseHistoryResult>>('get_browse_history', { type });
    return normalizeBrowseHistoryResult(result);
  }

  async inspectPage() {
    return this.callTool<TaobaoInspectPageResult>('inspect_page', {});
  }

  async searchProducts(keyword: string) {
    const result = await this.callTool<Partial<TaobaoSearchProductsResult>>('search_products', { keyword });
    return normalizeSearchProductsResult(result);
  }

  async closePage() {
    return this.callTool<{ success: boolean; message?: string }>('close_page', {});
  }
}
