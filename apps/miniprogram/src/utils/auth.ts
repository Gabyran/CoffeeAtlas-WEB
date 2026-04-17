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
} from './storage.ts';
import type { AuthUser } from '../types/index.ts';

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}

export async function login(userInfo?: { nickname?: string; avatarUrl?: string }): Promise<AuthUser> {
  const { code } = await miniProgramLogin();
  const { token, user } = await wechatLogin(code, userInfo);
  setToken(token);
  setStoredUser(user);

  // 首次登录后同步本地收藏队列
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
