import type {
  BeanFavoriteSnapshot as BeanSnapshot,
  RoasterFavoriteSnapshot as RoasterSnapshot,
} from '@coffee-atlas/domain';

import type { AuthUser } from '../types/index.ts';
import { getStorageSync, removeStorageSync, setStorageSync } from './miniprogram-api.ts';
const FAVORITES_KEY = 'coffee_favorites';
const ROASTER_FAVORITES_KEY = 'roaster_favorites';
const HISTORY_KEY = 'coffee_history';
const PURCHASE_CLICK_LOG_KEY = 'purchase_click_log';
const SHARE_EVENT_LOG_KEY = 'share_event_log';
const EXPLORATION_SET_KEY = 'exploration_set';
const TOKEN_KEY = 'app_token';
const USER_KEY = 'auth_user';
const PENDING_FAVORITES_KEY = 'pending_favorites';
const ONBOARDING_PROFILE_KEY = 'onboarding_profile';
const MAX_HISTORY = 20;
type FavoriteTargetType = 'bean' | 'roaster';

export type { BeanSnapshot, RoasterSnapshot };

export interface PurchaseClickLogEntry {
  roasterId: string;
  beanId: string;
  ts: number;
}

export interface PurchaseClickLogEntryInput {
  roasterId: string;
  beanId: string;
  ts?: number;
}

export interface ShareEventLogEntry {
  beanId: string;
  ts: number;
}

export interface ShareEventLogEntryInput {
  beanId: string;
  ts?: number;
}

export interface ExplorationSet {
  countries: string[];
  processes: string[];
  varieties: string[];
}

// Token
export function getToken(): string | null {
  return getStorageSync<string>(TOKEN_KEY) || null;
}

export function setToken(token: string): void {
  setStorageSync(TOKEN_KEY, token);
}

export function clearToken(): void {
  removeStorageSync(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  return getStorageSync<AuthUser>(USER_KEY) || null;
}

export function setStoredUser(user: AuthUser): void {
  setStorageSync(USER_KEY, user);
}

export function clearStoredUser(): void {
  removeStorageSync(USER_KEY);
}

function getStoredList<T>(key: string): T[] {
  return getStorageSync<T[]>(key) || [];
}

function setStoredList<T>(key: string, value: T[]): void {
  setStorageSync(key, value);
}

function normalizeStoredText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStoredStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value.map((item) => normalizeStoredText(item)).filter((item) => item.length > 0);
  return Array.from(new Set(normalized));
}

function mergeUniqueLists(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item)) {
        continue;
      }

      seen.add(item);
      result.push(item);
    }
  }

  return result;
}

function normalizeExplorationSet(value: unknown): ExplorationSet | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const countries = normalizeStoredStringList(record.countries);
  const processes = normalizeStoredStringList(record.processes);
  const varieties = normalizeStoredStringList(record.varieties);

  if (!countries || !processes || !varieties) {
    return null;
  }

  return {
    countries,
    processes,
    varieties,
  };
}

function deriveExplorationSetFromHistory(history: Array<Partial<HistoryItem>>): ExplorationSet {
  const countries: string[] = [];
  const processes: string[] = [];
  const varieties: string[] = [];
  const seenCountries = new Set<string>();
  const seenProcesses = new Set<string>();
  const seenVarieties = new Set<string>();

  for (const item of history) {
    const country = normalizeStoredText(item.originCountry);
    if (country && !seenCountries.has(country)) {
      seenCountries.add(country);
      countries.push(country);
    }

    const process = normalizeStoredText(item.process);
    if (process && !seenProcesses.has(process)) {
      seenProcesses.add(process);
      processes.push(process);
    }

    const variety = normalizeStoredText(item.variety);
    if (variety && !seenVarieties.has(variety)) {
      seenVarieties.add(variety);
      varieties.push(variety);
    }
  }

  return {
    countries,
    processes,
    varieties,
  };
}

function readExplorationSet(): ExplorationSet | null {
  return normalizeExplorationSet(getStorageSync(EXPLORATION_SET_KEY));
}

function persistExplorationSet(explorationSet: ExplorationSet): void {
  setStorageSync(EXPLORATION_SET_KEY, explorationSet);
}

function mergeExplorationSetWithHistory(
  explorationSet: ExplorationSet,
  history: Array<Partial<HistoryItem>>
): ExplorationSet {
  const derived = deriveExplorationSetFromHistory(history);
  return {
    countries: mergeUniqueLists(explorationSet.countries, derived.countries),
    processes: mergeUniqueLists(explorationSet.processes, derived.processes),
    varieties: mergeUniqueLists(explorationSet.varieties, derived.varieties),
  };
}

function updateExplorationSetFromBean(bean: Pick<BeanSnapshot, 'originCountry' | 'process' | 'variety'>): void {
  const current = getExplorationSet();
  const next = {
    countries: mergeUniqueLists(current.countries, normalizeStoredText(bean.originCountry) ? [bean.originCountry.trim()] : []),
    processes: mergeUniqueLists(current.processes, normalizeStoredText(bean.process) ? [bean.process.trim()] : []),
    varieties: mergeUniqueLists(current.varieties, normalizeStoredText(bean.variety) ? [bean.variety.trim()] : []),
  };
  persistExplorationSet(next);
}

function normalizePurchaseClickLogEntry(entry: PurchaseClickLogEntryInput): PurchaseClickLogEntry | null {
  const roasterId = normalizeStoredText(entry.roasterId);
  const beanId = normalizeStoredText(entry.beanId);
  if (!roasterId || !beanId) {
    return null;
  }

  return {
    roasterId,
    beanId,
    ts: Number.isFinite(entry.ts) ? Number(entry.ts) : Date.now(),
  };
}

function normalizeShareEventLogEntry(entry: ShareEventLogEntryInput): ShareEventLogEntry | null {
  const beanId = normalizeStoredText(entry.beanId);
  if (!beanId) {
    return null;
  }

  return {
    beanId,
    ts: Number.isFinite(entry.ts) ? Number(entry.ts) : Date.now(),
  };
}

function getStoredValidatedList<T>(key: string, isValid: (value: unknown) => value is T): T[] {
  const value = getStorageSync(key);
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isValid);
}

function isPurchaseClickLogEntry(value: unknown): value is PurchaseClickLogEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    normalizeStoredText(entry.roasterId).length > 0 &&
    normalizeStoredText(entry.beanId).length > 0 &&
    typeof entry.ts === 'number' &&
    Number.isFinite(entry.ts)
  );
}

function isShareEventLogEntry(value: unknown): value is ShareEventLogEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return normalizeStoredText(entry.beanId).length > 0 && typeof entry.ts === 'number' && Number.isFinite(entry.ts);
}

function addPendingFavorite(targetType: FavoriteTargetType, targetId: string): void {
  const pending = getPendingFavorites();
  if (!pending.some((item) => item.targetType === targetType && item.targetId === targetId)) {
    pending.push({ targetType, targetId });
    setStorageSync(PENDING_FAVORITES_KEY, pending);
  }
}

function removePendingFavorite(targetType: FavoriteTargetType, targetId: string): void {
  const pending = getPendingFavorites().filter(
    (item) => !(item.targetType === targetType && item.targetId === targetId)
  );
  setStorageSync(PENDING_FAVORITES_KEY, pending);
}

// 本地豆款收藏（未登录时使用）
export function getBeanFavorites(): BeanSnapshot[] {
  return getStorageSync<BeanSnapshot[]>(FAVORITES_KEY) || [];
}

export function isBeanFavorite(id: string): boolean {
  return getBeanFavorites().some((favorite) => favorite.id === id);
}

export function toggleBeanFavorite(bean: BeanSnapshot): boolean {
  const favorites = getBeanFavorites();
  const index = favorites.findIndex((favorite) => favorite.id === bean.id);

  if (index >= 0) {
    favorites.splice(index, 1);
    setStoredList(FAVORITES_KEY, favorites);
    removePendingFavorite('bean', bean.id);
    return false;
  }

  favorites.unshift(bean);
  setStoredList(FAVORITES_KEY, favorites);
  addPendingFavorite('bean', bean.id);
  return true;
}

export function getRoasterFavorites(): RoasterSnapshot[] {
  return getStoredList<RoasterSnapshot>(ROASTER_FAVORITES_KEY);
}

export function isRoasterFavorite(id: string): boolean {
  return getRoasterFavorites().some((favorite) => favorite.id === id);
}

export function toggleRoasterFavorite(roaster: RoasterSnapshot): boolean {
  const favorites = getRoasterFavorites();
  const index = favorites.findIndex((favorite) => favorite.id === roaster.id);

  if (index >= 0) {
    favorites.splice(index, 1);
    setStoredList(ROASTER_FAVORITES_KEY, favorites);
    removePendingFavorite('roaster', roaster.id);
    return false;
  }

  favorites.unshift(roaster);
  setStoredList(ROASTER_FAVORITES_KEY, favorites);
  addPendingFavorite('roaster', roaster.id);
  return true;
}

export function getFavorites(): BeanSnapshot[] {
  return getBeanFavorites();
}

export function isFavorite(id: string): boolean {
  return isBeanFavorite(id);
}

export function toggleFavorite(bean: BeanSnapshot): boolean {
  return toggleBeanFavorite(bean);
}

// 待同步收藏队列（登录后合并到云端）
export interface PendingFavorite {
  targetType: FavoriteTargetType;
  targetId: string;
}

export function getPendingFavorites(): PendingFavorite[] {
  return getStorageSync<PendingFavorite[]>(PENDING_FAVORITES_KEY) || [];
}

export function clearPendingFavorites(): void {
  removeStorageSync(PENDING_FAVORITES_KEY);
}

// 浏览历史
export interface HistoryItem extends BeanSnapshot {
  viewedAt: number;
}

export function getHistory(): HistoryItem[] {
  return getStorageSync<HistoryItem[]>(HISTORY_KEY) || [];
}

export function getExplorationSet(): ExplorationSet {
  const stored = readExplorationSet();
  const merged = mergeExplorationSetWithHistory(
    stored ?? {
      countries: [],
      processes: [],
      varieties: [],
    },
    getHistory()
  );

  if (!stored || JSON.stringify(stored) !== JSON.stringify(merged)) {
    persistExplorationSet(merged);
  }

  return merged;
}

export function setExplorationSet(explorationSet: ExplorationSet): void {
  persistExplorationSet({
    countries: Array.from(new Set(explorationSet.countries.map((item) => normalizeStoredText(item)).filter(Boolean))),
    processes: Array.from(new Set(explorationSet.processes.map((item) => normalizeStoredText(item)).filter(Boolean))),
    varieties: Array.from(new Set(explorationSet.varieties.map((item) => normalizeStoredText(item)).filter(Boolean))),
  });
}

export function clearExplorationSet(): void {
  removeStorageSync(EXPLORATION_SET_KEY);
}

export function addToHistory(bean: BeanSnapshot): void {
  const history = getHistory().filter((h) => h.id !== bean.id);
  history.unshift({ ...bean, viewedAt: Date.now() });
  setStorageSync(HISTORY_KEY, history.slice(0, MAX_HISTORY));
  updateExplorationSetFromBean(bean);
}

export function getPurchaseClickLog(): PurchaseClickLogEntry[] {
  return getStoredValidatedList(PURCHASE_CLICK_LOG_KEY, isPurchaseClickLogEntry);
}

export function recordPurchaseClick(entry: PurchaseClickLogEntryInput): void {
  const log = getPurchaseClickLog();
  const normalized = normalizePurchaseClickLogEntry(entry);
  if (!normalized) {
    return;
  }

  log.push(normalized);
  setStorageSync(PURCHASE_CLICK_LOG_KEY, log);
}

export function clearPurchaseClickLog(): void {
  removeStorageSync(PURCHASE_CLICK_LOG_KEY);
}

export function getShareEventLog(): ShareEventLogEntry[] {
  return getStoredValidatedList(SHARE_EVENT_LOG_KEY, isShareEventLogEntry);
}

export function recordShareEvent(entry: ShareEventLogEntryInput): void {
  const log = getShareEventLog();
  const normalized = normalizeShareEventLogEntry(entry);
  if (!normalized) {
    return;
  }

  log.push(normalized);
  setStorageSync(SHARE_EVENT_LOG_KEY, log);
}

export function clearShareEventLog(): void {
  removeStorageSync(SHARE_EVENT_LOG_KEY);
}

export type OnboardingExperienceLevel = 'beginner' | 'intermediate';

export interface OnboardingProfile {
  experienceLevel: OnboardingExperienceLevel;
  completedAt: number;
}

function isOnboardingExperienceLevel(value: unknown): value is OnboardingExperienceLevel {
  return value === 'beginner' || value === 'intermediate';
}

function isOnboardingProfile(value: unknown): value is OnboardingProfile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const profile = value as Record<string, unknown>;

  return (
    isOnboardingExperienceLevel(profile.experienceLevel) &&
    typeof profile.completedAt === 'number'
  );
}

export function getOnboardingProfile(): OnboardingProfile | null {
  const profile = getStorageSync<OnboardingProfile>(ONBOARDING_PROFILE_KEY);
  return isOnboardingProfile(profile) ? profile : null;
}

export function setOnboardingProfile(profile: OnboardingProfile): void {
  setStorageSync(ONBOARDING_PROFILE_KEY, profile);
}

export function clearOnboardingProfile(): void {
  removeStorageSync(ONBOARDING_PROFILE_KEY);
}

const BADGE_UNLOCK_DATES_KEY = 'badge_unlock_dates';

export interface BadgeUnlockDates {
  [badgeId: string]: string;
}

export function getBadgeUnlockDates(): BadgeUnlockDates {
  return getStorageSync<BadgeUnlockDates>(BADGE_UNLOCK_DATES_KEY) || {};
}

export function setBadgeUnlockDate(badgeId: string, date: string): void {
  const dates = getBadgeUnlockDates();
  dates[badgeId] = date;
  setStorageSync(BADGE_UNLOCK_DATES_KEY, dates);
}

export function getBadgeUnlockDate(badgeId: string): string | undefined {
  return getBadgeUnlockDates()[badgeId];
}

export function formatUnlockDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}/${month}/${day}`;
}
