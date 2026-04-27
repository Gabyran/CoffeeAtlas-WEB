import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import type { TaobaoOcrResult } from './types.ts';
import { cleanOcrText } from './parsers.ts';

const execFileAsync = promisify(execFile);

function inferExtensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return ext || '.jpg';
  } catch {
    return '.jpg';
  }
}

const IMAGE_DOWNLOAD_TIMEOUT_MS = 10_000;
const IMAGE_DOWNLOAD_MAX_RETRIES = 3;

async function downloadImageToTemp(url: string, attempt = 1): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const filePath = path.join(tmpdir(), `coffeeatlas-taobao-ocr-${randomUUID()}${inferExtensionFromUrl(url)}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    return filePath;
  } catch (error) {
    if (attempt < IMAGE_DOWNLOAD_MAX_RETRIES) {
      const delay = attempt * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return downloadImageToTemp(url, attempt + 1);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to download image for OCR after ${IMAGE_DOWNLOAD_MAX_RETRIES} attempts: ${message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

function classifyOcrConfidence(text: string) {
  const cleaned = cleanOcrText(text);
  if (cleaned.length >= 48) return 'high' as const;
  if (cleaned.length >= 18) return 'medium' as const;
  return 'low' as const;
}

export async function runOcrFromImageUrl(imageUrl: string): Promise<TaobaoOcrResult> {
  let filePath: string | null = null;

  try {
    filePath = await downloadImageToTemp(imageUrl);
    const languages = ['chi_sim+eng', 'eng'];

    for (const language of languages) {
      try {
        const { stdout } = await execFileAsync('tesseract', [filePath, 'stdout', '-l', language, '--psm', '6']);
        const text = cleanOcrText(stdout);
        const confidence = classifyOcrConfidence(text);
        const warnings = language === 'eng' ? ['ocr_language_fallback'] : [];
        if (!text) {
          warnings.push('ocr_text_empty');
        }
        return { text, confidence, warnings };
      } catch (error) {
        if (language === languages[languages.length - 1]) {
          throw error;
        }
      }
    }

    return {
      text: '',
      confidence: 'low',
      warnings: ['ocr_unreachable'],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      text: '',
      confidence: 'low',
      warnings: [`ocr_failed:${message}`],
    };
  } finally {
    if (filePath) {
      await fs.rm(filePath, { force: true }).catch(() => undefined);
    }
  }
}
