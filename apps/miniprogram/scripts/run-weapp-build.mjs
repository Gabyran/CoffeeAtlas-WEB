import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { patchWeappPrebundleSource } from './weapp-prebundle-flags.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PREBUNDLE_SOURCE_DIR = path.join(ROOT, 'node_modules/.taro/weapp/prebundle');
const PREBUNDLE_OUTPUT_DIR = path.join(ROOT, 'dist/prebundle');
const PREBUNDLE_FILE_PATTERN = /(?:\.core\.js$|^chunk-.*\.js$)/;
const PREBUNDLE_SOURCE_PATCH_FILES = [
  'react.js',
  'react_jsx-runtime.js',
  '@tarojs_taro.js',
];
const DIST_PROJECT_CONFIG_FILES = [
  'project.config.json',
  'project.private.config.json',
];
const DIST_INTEROP_FILES = [
  'node_modules_taro_weapp_prebundle_react_js.js',
  'node_modules_taro_weapp_prebundle_react_jsx-runtime_js.js',
  'node_modules_taro_weapp_prebundle_tarojs_taro_js.js',
];
const DIST_INTEROP_REWRITES = [
  {
    fileName: 'node_modules_taro_weapp_prebundle_react_js.js',
    match: /(var m = require\('\.\/react\.core\.js'\);\s*(?:module\.exports = m\.default(?: \|\| m)?;\s*exports\.default = module\.exports;|__unused_webpack___webpack_module__\.exports = m\.default(?: \|\| m)?;\s*__unused_webpack___webpack_module__\.exports\.default = __unused_webpack___webpack_module__\.exports;)\s*)/g,
    replacement:
      "var m = require('./react.core.js');\n__unused_webpack___webpack_module__.exports = m.default || m;\n__unused_webpack___webpack_module__.exports.default = __unused_webpack___webpack_module__.exports;\n",
  },
  {
    fileName: 'node_modules_taro_weapp_prebundle_react_jsx-runtime_js.js',
    match: /(var m = require\('\.\/react_jsx-runtime\.core\.js'\);\s*(?:module\.exports = m\.default(?: \|\| m)?;\s*exports\.default = module\.exports;|__unused_webpack___webpack_module__\.exports = m\.default(?: \|\| m)?;\s*__unused_webpack___webpack_module__\.exports\.default = __unused_webpack___webpack_module__.exports;)\s*)/g,
    replacement:
      "var m = require('./react_jsx-runtime.core.js');\n__unused_webpack___webpack_module__.exports = m.default || m;\n__unused_webpack___webpack_module__.exports.default = __unused_webpack___webpack_module__.exports;\n",
  },
  {
    fileName: 'node_modules_taro_weapp_prebundle_tarojs_taro_js.js',
    match: /(var m = require\('\.\/@tarojs_taro\.core\.js'\);\s*(?:module\.exports = m\.default(?: \|\| m)?;\s*exports\.default = module\.exports;|__unused_webpack___webpack_module__\.exports = m\.default(?: \|\| m)?;\s*__unused_webpack___webpack_module__\.exports\.default = __unused_webpack___webpack_module__.exports;)\s*)/g,
    replacement:
      "var m = require('./@tarojs_taro.core.js');\n__unused_webpack___webpack_module__.exports = m.default || m;\n__unused_webpack___webpack_module__.exports.default = __unused_webpack___webpack_module__.exports;\n",
  },
];
const isWatchMode = process.argv.includes('--watch');

const NATIVE_SOURCE_DIRS = ['wxpages', 'wxcomponents'];
const DIST_APP_JSON = path.join(ROOT, 'dist', 'app.json');

function log(message) {
  console.log(`[weapp-build] ${message}`);
}

async function buildTargetContent(sourcePath) {
  const source = await fs.readFile(sourcePath, 'utf8');
  return patchWeappPrebundleSource(source);
}

async function resetPrebundleOutputDir() {
  await fs.rm(PREBUNDLE_OUTPUT_DIR, { recursive: true, force: true });
}

async function patchPrebundleSourceFiles() {
  let patchedCount = 0;

  for (const fileName of PREBUNDLE_SOURCE_PATCH_FILES) {
    const filePath = path.join(PREBUNDLE_SOURCE_DIR, fileName);

    try {
      const source = await fs.readFile(filePath, 'utf8');
      const patched = patchWeappPrebundleSource(source);

      if (patched === source) {
        continue;
      }

      await fs.writeFile(filePath, patched, 'utf8');
      patchedCount += 1;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  return patchedCount;
}

async function fileNeedsCopy(sourcePath, targetPath) {
  try {
    const [targetContent, sourceContent] = await Promise.all([
      fs.readFile(targetPath, 'utf8'),
      buildTargetContent(sourcePath),
    ]);
    return targetContent !== sourceContent;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return true;
    }
    throw error;
  }
}

async function syncPrebundleFiles() {
  let sourceEntries;
  try {
    sourceEntries = await fs.readdir(PREBUNDLE_SOURCE_DIR, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return 0;
    }
    throw error;
  }

  const candidateFiles = sourceEntries
    .filter((entry) => entry.isFile() && PREBUNDLE_FILE_PATTERN.test(entry.name))
    .map((entry) => entry.name);

  if (candidateFiles.length === 0) {
    return 0;
  }

  await fs.mkdir(PREBUNDLE_OUTPUT_DIR, { recursive: true });

  let copiedCount = 0;
  for (const fileName of candidateFiles) {
    const sourcePath = path.join(PREBUNDLE_SOURCE_DIR, fileName);
    const targetPath = path.join(PREBUNDLE_OUTPUT_DIR, fileName);

    if (!(await fileNeedsCopy(sourcePath, targetPath))) {
      continue;
    }

    await fs.writeFile(targetPath, await buildTargetContent(sourcePath), 'utf8');
    copiedCount += 1;
  }

  return copiedCount;
}

async function patchDistInteropFiles() {
  let patchedCount = 0;

  for (const fileName of DIST_INTEROP_FILES) {
    const filePath = path.join(PREBUNDLE_OUTPUT_DIR, fileName);

    try {
      const source = await fs.readFile(filePath, 'utf8');
      const rewriteRule = DIST_INTEROP_REWRITES.find((item) => item.fileName === fileName);
      const patched = rewriteRule ? source.replace(rewriteRule.match, rewriteRule.replacement) : source;

      if (patched === source) {
        continue;
      }

      await fs.writeFile(filePath, patched, 'utf8');
      patchedCount += 1;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  return patchedCount;
}

async function patchDistProjectConfigFiles() {
  let patchedCount = 0;

  for (const fileName of DIST_PROJECT_CONFIG_FILES) {
    const filePath = path.join(ROOT, 'dist', fileName);

    try {
      const source = await fs.readFile(filePath, 'utf8');
      const config = JSON.parse(source);
      const nextConfig = {
        ...config,
        setting:
          typeof config.setting === 'object' && config.setting !== null
            ? {
                ...config.setting,
                urlCheck: false,
              }
            : config.setting,
      };
      const patched = `${JSON.stringify(nextConfig, null, 2)}\n`;

      if (patched === source) {
        continue;
      }

      await fs.writeFile(filePath, patched, 'utf8');
      patchedCount += 1;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  return patchedCount;
}

async function copyDirRecursive(srcDir, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  let copiedCount = 0;
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copiedCount += await copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      try {
        const [srcContent, destContent] = await Promise.all([
          fs.readFile(srcPath, 'utf8'),
          fs.readFile(destPath, 'utf8').catch(() => null),
        ]);
        if (srcContent !== destContent) {
          await fs.writeFile(destPath, srcContent, 'utf8');
          copiedCount += 1;
        }
      } catch {
        await fs.writeFile(destPath, await fs.readFile(srcPath, 'utf8'), 'utf8');
        copiedCount += 1;
      }
    }
  }
  return copiedCount;
}

async function syncNativeFiles() {
  let copiedCount = 0;

  for (const dirName of NATIVE_SOURCE_DIRS) {
    const srcDir = path.join(ROOT, 'src', dirName);
    const destDir = path.join(ROOT, 'dist', dirName);

    try {
      copiedCount += await copyDirRecursive(srcDir, destDir);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  try {
    const appJsonContent = await fs.readFile(DIST_APP_JSON, 'utf8');
    const appJson = JSON.parse(appJsonContent);
    const pages = appJson.pages || [];
    let pagesChanged = false;

    for (const dirName of NATIVE_SOURCE_DIRS) {
      if (dirName !== 'wxpages') continue;
      const srcDir = path.join(ROOT, 'src', dirName);
      try {
        const entries = await fs.readdir(srcDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pagePath = `${dirName}/${entry.name}/index`;
            if (!pages.includes(pagePath)) {
              pages.push(pagePath);
              pagesChanged = true;
            }
          }
        }
      } catch {
        // skip
      }
    }

    if (pagesChanged) {
      appJson.pages = pages;
      await fs.writeFile(DIST_APP_JSON, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
      copiedCount += 1;
    }
  } catch {
    // dist/app.json 可能还没生成
  }

  return copiedCount;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: 'inherit',
      env: options.env ?? process.env,
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'null'}${signal ? ` (signal: ${signal})` : ''}`));
    });
  });
}

async function runWatchMode() {
  let syncing = false;
  const syncOnce = async () => {
    if (syncing) {
      return;
    }

    syncing = true;
    try {
      const [sourcePatchedCount, copiedCount, patchedCount, configPatchedCount, nativeSyncCount] = await Promise.all([
        patchPrebundleSourceFiles(),
        syncPrebundleFiles(),
        patchDistInteropFiles(),
        patchDistProjectConfigFiles(),
        syncNativeFiles(),
      ]);

      if (sourcePatchedCount > 0 || copiedCount > 0 || patchedCount > 0 || configPatchedCount > 0 || nativeSyncCount > 0) {
        log(
          `已修正 ${sourcePatchedCount} 个源包装文件，同步 ${copiedCount} 个 prebundle 文件，同步 ${nativeSyncCount} 个原生文件，并修正 ${patchedCount + configPatchedCount} 个构建包装/配置文件`
        );
      }
    } finally {
      syncing = false;
    }
  };

  await resetPrebundleOutputDir();
  await syncOnce();
  const timer = setInterval(() => {
    void syncOnce();
  }, 1000);

  const child = spawn('pnpm', ['exec', 'taro', 'build', '--type', 'weapp', '--watch'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      WATCHPACK_POLLING: process.env.WATCHPACK_POLLING ?? '1000',
    },
  });

  const stop = async () => {
    clearInterval(timer);
    await syncOnce();
  };

  process.once('SIGINT', () => {
    child.kill('SIGINT');
  });
  process.once('SIGTERM', () => {
    child.kill('SIGTERM');
  });

  child.once('error', async (error) => {
    await stop();
    throw error;
  });

  child.once('exit', async (code, signal) => {
    await stop();
    process.exit(code ?? (signal ? 1 : 0));
  });
}

async function main() {
  await runCommand('pnpm', ['build:deps']);
  await resetPrebundleOutputDir();
  await patchPrebundleSourceFiles();

  if (isWatchMode) {
    await runWatchMode();
    return;
  }

  await runCommand('pnpm', ['exec', 'taro', 'build', '--type', 'weapp']);
  const [sourcePatchedCount, copiedCount, patchedCount, configPatchedCount, nativeSyncCount] = await Promise.all([
    patchPrebundleSourceFiles(),
    syncPrebundleFiles(),
    patchDistInteropFiles(),
    patchDistProjectConfigFiles(),
    syncNativeFiles(),
  ]);
  log(
    `构建完成，已修正 ${sourcePatchedCount} 个源包装文件，同步 ${copiedCount} 个 prebundle 文件，同步 ${nativeSyncCount} 个原生文件，并修正 ${patchedCount + configPatchedCount} 个构建包装/配置文件`
  );
}

await main();
