import assert from 'node:assert/strict';
import test from 'node:test';

import { ensureTaobaoDesktopReady, probeTaobaoDesktop } from '../lib/taobao-sync/preflight.ts';

test('probeTaobaoDesktop returns current tab and page titles when desktop is healthy', async () => {
  const result = await probeTaobaoDesktop({
    async getCurrentTab() {
      return {
        url: 'https://www.taobao.com',
        title: '淘宝',
      };
    },
    async readPageContent() {
      return {
        url: 'https://www.taobao.com',
        title: '首页',
        content: '猜你喜欢',
        totalLength: 4,
        truncated: false,
      };
    },
  });

  assert.deepEqual(result, {
    currentUrl: 'https://www.taobao.com',
    currentTabTitle: '淘宝',
    pageTitle: '首页',
  });
});

test('probeTaobaoDesktop rejects login-required pages before sync starts', async () => {
  await assert.rejects(
    () =>
      probeTaobaoDesktop({
        async getCurrentTab() {
          return {
            url: 'https://www.taobao.com',
            title: '淘宝',
          };
        },
        async readPageContent() {
          return {
            url: 'https://www.taobao.com',
            title: '首页',
            content: '请先登录',
            totalLength: 4,
            truncated: false,
          };
        },
      }),
    /login_required/
  );
});

test('ensureTaobaoDesktopReady skips launch when probe is already healthy', async () => {
  let launchCalled = false;

  const result = await ensureTaobaoDesktopReady({
    probeDesktop: async () => ({
      currentUrl: 'https://www.taobao.com',
      currentTabTitle: '淘宝',
      pageTitle: '首页',
    }),
    execFileRunner: async () => {
      launchCalled = true;
      return {};
    },
    sleepFn: async () => {},
    logger: { log() {} },
  });

  assert.equal(result.launchedApp, false);
  assert.equal(launchCalled, false);
});

test('ensureTaobaoDesktopReady launches desktop when initial probe reports not running', async () => {
  let launchCalled = false;
  let probeCount = 0;

  const result = await ensureTaobaoDesktopReady({
    probeDesktop: async () => {
      probeCount += 1;
      if (probeCount === 1) {
        throw new Error('应用未运行，请先执行 taobao-native launch 启动淘宝桌面版');
      }

      return {
        currentUrl: 'https://www.taobao.com',
        currentTabTitle: '淘宝',
        pageTitle: '首页',
      };
    },
    execFileRunner: async () => {
      launchCalled = true;
      return {};
    },
    sleepFn: async () => {},
    logger: { log() {} },
  });

  assert.equal(launchCalled, true);
  assert.equal(result.launchedApp, true);
  assert.equal(result.currentTabTitle, '淘宝');
});

test('ensureTaobaoDesktopReady fails clearly when desktop never becomes ready after launch', async () => {
  let launchCalled = false;

  await assert.rejects(
    () =>
      ensureTaobaoDesktopReady({
        probeDesktop: async () => {
          throw new Error('应用未运行，请先执行 taobao-native start 启动淘宝桌面版');
        },
        execFileRunner: async () => {
          launchCalled = true;
          return {};
        },
        sleepFn: async () => {},
        logger: { log() {} },
        readyRetryCount: 2,
        readyRetryDelayMs: 10,
      }),
    /仍未就绪/
  );

  assert.equal(launchCalled, true);
});
