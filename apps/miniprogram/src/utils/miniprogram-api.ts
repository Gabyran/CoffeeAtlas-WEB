type RequestOptions<TData = unknown> = {
  [key: string]: unknown;
  data?: TData;
};

type MiniProgramApi = {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, data: unknown): void;
  removeStorageSync(key: string): void;
  reLaunch(options: { url: string }): void;
  navigateTo(options: { url: string }): void;
  showToast(options: { title: string; icon?: string; duration?: number }): void;
  setNavigationBarTitle(options: { title: string }): void;
  setClipboardData(options: Record<string, unknown>): void;
  getSystemInfoSync(): { statusBarHeight?: number };
  getWindowInfo?: () => { statusBarHeight?: number };
  login(options: {
    success: (result: { code: string }) => void;
    fail: (error: unknown) => void;
  }): void;
  request(options: Record<string, unknown>): void;
};

type CurrentPage = {
  options?: Record<string, string>;
};

function getMiniProgramApi(): MiniProgramApi {
  const runtimeApi = (globalThis as { wx?: MiniProgramApi }).wx;
  if (!runtimeApi) {
    throw new Error('wx is not available in the current runtime');
  }

  return runtimeApi;
}

function getCurrentPagesApi(): CurrentPage[] {
  const runtimeGetCurrentPages = (globalThis as {
    getCurrentPages?: () => CurrentPage[];
  }).getCurrentPages;

  if (typeof runtimeGetCurrentPages !== 'function') {
    return [];
  }

  return runtimeGetCurrentPages();
}

export function getStorageSync<T = unknown>(key: string): T | undefined {
  return getMiniProgramApi().getStorageSync(key) as T | undefined;
}

export function setStorageSync(key: string, data: unknown): void {
  getMiniProgramApi().setStorageSync(key, data);
}

export function removeStorageSync(key: string): void {
  getMiniProgramApi().removeStorageSync(key);
}

export function reLaunch(options: { url: string }): void {
  getMiniProgramApi().reLaunch(options);
}

export function navigateTo(options: { url: string }): void {
  getMiniProgramApi().navigateTo(options);
}

export function showToast(options: { title: string; icon?: string; duration?: number }): void {
  getMiniProgramApi().showToast(options);
}

export function setNavigationBarTitle(options: { title: string }): void {
  getMiniProgramApi().setNavigationBarTitle(options);
}

export function setClipboardData(options: Record<string, unknown>): void {
  getMiniProgramApi().setClipboardData(options);
}

export function getSystemInfoSync(): { statusBarHeight?: number } {
  return getMiniProgramApi().getSystemInfoSync();
}

export function getWindowInfo(): { statusBarHeight?: number } {
  const runtimeApi = getMiniProgramApi();
  if (typeof runtimeApi.getWindowInfo === 'function') {
    return runtimeApi.getWindowInfo();
  }

  return getSystemInfoSync();
}

export function getCurrentPageParams(): Record<string, string> {
  const pages = getCurrentPagesApi();
  const currentPage = pages[pages.length - 1];
  return currentPage?.options ?? {};
}

export function login(): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    getMiniProgramApi().login({
      success: resolve,
      fail: reject,
    });
  });
}

export function request<T = unknown, TData = unknown>(
  options: RequestOptions<TData>
): Promise<{ data: T; statusCode: number; [key: string]: unknown }> {
  return new Promise((resolve, reject) => {
    getMiniProgramApi().request({
      ...options,
      success: resolve,
      fail: reject,
    });
  });
}
