import { wechatLogin, syncFavorites } from '../services/api.ts';
import { login as miniProgramLogin } from './miniprogram-api.ts';
import {
  setToken,
  clearToken,
  getToken,
  getPendingFavorites,
  clearPendingFavorites,
  setStoredUser,
  clearStoredUser,
  getStoredUser,
} from './storage.ts';
import type { AuthUser } from '../types/index.ts';

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}

export class AuthError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export async function validateSession(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  try {
    const { getMe } = await import('../services/api.ts');
    await getMe();
    return true;
  } catch {
    logout();
    return false;
  }
}

async function withRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; delayMs?: number; operationName: string },
): Promise<T> {
  const { maxRetries = 2, delayMs = 1000, operationName } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (error instanceof AuthError) {
        throw error;
      }

      if (attempt < maxRetries) {
        const waitMs = delayMs * (attempt + 1) + Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  throw new AuthError(
    'network_error',
    `${operationName} 失败，已重试 ${maxRetries} 次: ${lastError?.message ?? '未知错误'}`,
  );
}

export async function login(userInfo?: { nickname?: string; avatarUrl?: string }): Promise<AuthUser> {
  const { token, user } = await withRetry(async () => {
    const { code } = await miniProgramLogin();

    if (!code || code.length < 10) {
      throw new AuthError('invalid_code', '微信登录凭证无效，请重新尝试');
    }

    return wechatLogin(code, userInfo);
  }, {
    operationName: '微信登录',
    maxRetries: 2,
    delayMs: 1000,
  });

  if (!token || !user) {
    throw new AuthError('server_error', '服务器响应异常，请稍后重试');
  }

  setToken(token);
  setStoredUser(user);

  const pending = getPendingFavorites();
  if (pending.length > 0) {
    try {
      await syncFavorites(pending);
      clearPendingFavorites();
    } catch {
      // 同步失败不阻断登录流程
    }
  }

  return user;
}

export function logout(): void {
  clearToken();
  clearStoredUser();
}

export async function silentLogin(): Promise<AuthUser | null> {
  if (isLoggedIn()) {
    const valid = await validateSession();
    if (valid) {
      return getStoredUser();
    }
  }

  try {
    return await login();
  } catch {
    return null;
  }
}
