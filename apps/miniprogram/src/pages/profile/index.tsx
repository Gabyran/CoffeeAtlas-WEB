import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Button } from '@tarojs/components';
import { useDidShow } from '@tarojs/taro';
import { toBeanFavoriteSnapshot, toRoasterFavoriteSnapshot } from '@coffee-atlas/domain';

import Icon from '../../components/Icon';
import {
  getBadgeProgress,
  getFavorites as getCloudFavorites,
  removeFavorite as removeCloudFavorite,
  syncBadgeProgress,
} from '../../services/api';
import type {
  AuthUser,
  BeanFavorite,
  RoasterFavorite,
  UserFavorite,
} from '../../types';
import { isLoggedIn, login, logout } from '../../utils/auth';
import { matchAtlasCountry } from '../../utils/origin-atlas';
import {
  getExplorationSet,
  getBeanFavorites,
  getHistory,
  getPurchaseClickLog,
  getRoasterFavorites,
  getShareEventLog,
  getStoredUser,
  toggleBeanFavorite,
} from '../../utils/storage';
import type {
  BeanSnapshot,
  ExplorationSet,
  HistoryItem,
  PurchaseClickLogEntry,
  RoasterSnapshot,
  ShareEventLogEntry,
} from '../../utils/storage';
import { getStorageSync, navigateTo, setStorageSync, showToast } from '../../utils/miniprogram-api.ts';
import { getBadgeRecordCopy } from './badge-record';
import { getProfileBadges, type ProfileBadgeProgress } from './profile-badges';
import './index.scss';

type TabKey = 'beans' | 'history';

interface BeanRowProps {
  bean: BeanSnapshot;
  note?: string;
  onFavoriteToggle?: () => void;
}

interface BeanFavoriteEntry {
  bean: BeanSnapshot;
  favorite?: BeanFavorite;
}

interface RoasterFavoriteEntry {
  roaster: RoasterSnapshot;
  favorite?: RoasterFavorite;
}

type BadgeGroupId = 'basics' | 'exploration' | 'knowledge' | 'purchase' | 'social';

interface BadgeGroupDefinition {
  id: BadgeGroupId;
  title: string;
  badgeIds: string[];
}

const BADGE_GROUPS: BadgeGroupDefinition[] = [
  {
    id: 'basics',
    title: '入馆基础',
    badgeIds: ['visitor', 'bean-starter', 'bean-collector'],
  },
  {
    id: 'exploration',
    title: '探索足迹',
    badgeIds: ['roaster-radar', 'history-explorer', 'history-regular'],
  },
  {
    id: 'knowledge',
    title: '咖啡知识',
    badgeIds: ['origin-scout', 'origin-atlas', 'process-nerd', 'variety-hunter'],
  },
  {
    id: 'purchase',
    title: '购买行为',
    badgeIds: ['first-click', 'multi-roaster'],
  },
  {
    id: 'social',
    title: '社交分享',
    badgeIds: ['first-share', 'serial-sharer'],
  },
];

const BADGE_UNLOCK_SEEN_KEY = 'badge_unlock_seen';

function normalizeBadgeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0)
    )
  );
}

function getSeenBadgeIds(): string[] {
  return normalizeBadgeIdList(getStorageSync(BADGE_UNLOCK_SEEN_KEY));
}

function setSeenBadgeIds(badgeIds: string[]): void {
  setStorageSync(BADGE_UNLOCK_SEEN_KEY, normalizeBadgeIdList(badgeIds));
}

function formatHistoryTime(viewedAt: number): string {
  const diffMs = Date.now() - viewedAt;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '昨天浏览';
  if (diffDays < 7) return `${diffDays} 天前`;

  const date = new Date(viewedAt);
  return `${date.getMonth() + 1}/${date.getDate()} 浏览`;
}

function BeanRow({ bean, note, onFavoriteToggle }: BeanRowProps) {
  const handleTap = () => {
    navigateTo({ url: `/pages/bean-detail/index?id=${bean.id}` });
  };

  return (
    <View className="profile-bean-row" onClick={handleTap}>
      <View className="profile-bean-row__image">
        {bean.imageUrl ? (
          <Image src={bean.imageUrl} mode="aspectFill" className="profile-bean-row__img" lazyLoad />
        ) : (
          <View className="profile-bean-row__placeholder">
            <Icon name="coffee" size={28} color="rgba(139,90,43,0.2)" />
          </View>
        )}
      </View>

      <View className="profile-bean-row__info">
        <Text className="profile-bean-row__name">{bean.name}</Text>
        <Text className="profile-bean-row__meta">
          {[bean.roasterName, bean.originCountry, bean.process].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <View className="profile-bean-row__side">
        <Text className="profile-bean-row__price">¥{bean.price}</Text>
        {onFavoriteToggle ? (
          <View
            className="profile-bean-row__action"
            onClick={(event) => {
              event.stopPropagation();
              onFavoriteToggle();
            }}
          >
            <Icon name="heart-filled" size={15} color="#c85c3d" />
          </View>
        ) : note ? (
          <Text className="profile-bean-row__note">{note}</Text>
        ) : null}
      </View>
    </View>
  );
}

function EmptyPane({ icon, message }: { icon: 'heart' | 'coffee'; message: string }) {
  return (
    <View className="profile__empty">
      <Icon name={icon} size={48} color="rgba(139,90,43,0.2)" />
      <Text className="profile__empty-text">{message}</Text>
    </View>
  );
}

function FavoriteEmptyPane({ message }: { message: string }) {
  return (
    <View className="profile__empty profile__empty--favorite">
      <View className="profile__favorite-empty-illustration" />
      <Text className="profile__empty-text">{message}</Text>
    </View>
  );
}

export default function Profile() {
  const [activeTab, setActiveTab] = useState<TabKey>('beans');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const [localBeanFavorites, setLocalBeanFavorites] = useState<BeanSnapshot[]>([]);
  const [localRoasterFavorites, setLocalRoasterFavorites] = useState<RoasterSnapshot[]>([]);
  const [cloudFavorites, setCloudFavorites] = useState<UserFavorite[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [explorationSet, setExplorationSet] = useState<ExplorationSet>({
    countries: [],
    processes: [],
    varieties: [],
  });
  const [purchaseClickLog, setPurchaseClickLog] = useState<PurchaseClickLogEntry[]>([]);
  const [shareEventLog, setShareEventLog] = useState<ShareEventLogEntry[]>([]);
  const [serverBadgeIds, setServerBadgeIds] = useState<string[]>([]);
  const [unlockQueue, setUnlockQueue] = useState<string[]>([]);
  const [loginLoading, setLoginLoading] = useState(false);

  useDidShow(() => {
    const authed = isLoggedIn();
    setLoggedIn(authed);
    setUser(authed ? getStoredUser() : null);
    setLocalBeanFavorites(getBeanFavorites());
    setLocalRoasterFavorites(getRoasterFavorites());
    setHistory(getHistory());
    setExplorationSet(getExplorationSet());
    setPurchaseClickLog(getPurchaseClickLog());
    setShareEventLog(getShareEventLog());

    if (authed) {
      void loadCloudFavorites();
      void loadServerBadges();
    } else {
      setCloudFavorites([]);
      setServerBadgeIds([]);
    }
  });

  const loadCloudFavorites = async () => {
    try {
      const favorites = await getCloudFavorites();
      setCloudFavorites(favorites);
    } catch {
      // 静默失败，保留页面可读性
    }
  };

  const loadServerBadges = async () => {
    try {
      const payload = await getBadgeProgress();
      setServerBadgeIds(payload.badgeIds);
    } catch {
      setServerBadgeIds([]);
    }
  };

  const beanFavorites = useMemo<BeanFavoriteEntry[]>(() => {
    if (!loggedIn) {
      return localBeanFavorites.map((bean) => ({ bean }));
    }

    return cloudFavorites.flatMap((favorite) => {
      if (favorite.target_type !== 'bean' || !favorite.bean) return [];
      return [{ favorite: favorite as BeanFavorite, bean: toBeanFavoriteSnapshot(favorite.bean) }];
    });
  }, [cloudFavorites, localBeanFavorites, loggedIn]);

  const roasterFavorites = useMemo<RoasterFavoriteEntry[]>(() => {
    if (!loggedIn) {
      return localRoasterFavorites.map((roaster) => ({ roaster }));
    }

    return cloudFavorites.flatMap((favorite) => {
      if (favorite.target_type !== 'roaster' || !favorite.roaster) return [];
      return [{ favorite: favorite as RoasterFavorite, roaster: toRoasterFavoriteSnapshot(favorite.roaster) }];
    });
  }, [cloudFavorites, localRoasterFavorites, loggedIn]);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const authUser = await login();
      setUser(authUser);
      setLoggedIn(true);
      await Promise.all([loadCloudFavorites(), loadServerBadges()]);
      showToast({ title: '登录成功', icon: 'success' });
    } catch (error) {
      showToast({ title: error instanceof Error ? error.message : '登录失败', icon: 'none' });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
    setUser(null);
    setCloudFavorites([]);
    setServerBadgeIds([]);
    setUnlockQueue([]);
    setLocalBeanFavorites(getBeanFavorites());
    setLocalRoasterFavorites(getRoasterFavorites());
  };

  const handleUnfavoriteLocalBean = (bean: BeanSnapshot) => {
    toggleBeanFavorite(bean);
    setLocalBeanFavorites(getBeanFavorites());
  };

  const handleUnfavoriteCloud = async (favorite: UserFavorite) => {
    try {
      await removeCloudFavorite(favorite.target_type, favorite.target_id);
      setCloudFavorites((prev) => prev.filter((item) => item.id !== favorite.id));
    } catch {
      showToast({ title: '操作失败', icon: 'none' });
    }
  };

  const totalSaved = beanFavorites.length + roasterFavorites.length;
  const summaryLabel = loggedIn ? '已同步至云端' : '本地收藏，登录后自动同步';
  const heroName = user?.nickname || (loggedIn ? '咖啡爱好者' : '你的咖啡私藏');
  const heroInitial = heroName.charAt(0).toUpperCase();
  const continentsCovered = useMemo(() => {
    const continentIds = new Set<string>();
    explorationSet.countries.forEach((country) => {
      const atlasCountry = matchAtlasCountry(country);
      if (atlasCountry?.continentId) {
        continentIds.add(atlasCountry.continentId);
      }
    });
    return continentIds.size;
  }, [explorationSet.countries]);
  const badges = useMemo(
    () =>
      getProfileBadges({
        loggedIn,
        beanFavorites: beanFavorites.length,
        roasterFavorites: roasterFavorites.length,
        historyCount: history.length,
        uniqueCountries: explorationSet.countries.length,
        continentsCovered,
        uniqueProcesses: explorationSet.processes.length,
        uniqueVarieties: explorationSet.varieties.length,
        purchaseClicks: purchaseClickLog.length,
        uniqueRoasterPurchaseClicks: new Set(purchaseClickLog.map((entry) => entry.roasterId)).size,
        shareCount: shareEventLog.length,
        externallyUnlockedBadgeIds: serverBadgeIds,
      }),
    [
      beanFavorites.length,
      continentsCovered,
      explorationSet.countries.length,
      explorationSet.processes.length,
      explorationSet.varieties.length,
      history.length,
      loggedIn,
      purchaseClickLog,
      roasterFavorites.length,
      serverBadgeIds,
      shareEventLog.length,
    ],
  );
  const unlockedBadgeCount = badges.filter((badge) => badge.unlocked).length;
  const unlockedBadgeIds = badges.filter((badge) => badge.unlocked).map((badge) => badge.id);
  const unlockedBadgeSignature = unlockedBadgeIds.join('|');
  const serverBadgeSignature = serverBadgeIds.join('|');
  const nextBadge = badges.find((badge) => !badge.unlocked);
  const activeBadgeId = selectedBadgeId ?? unlockQueue[0] ?? null;
  const selectedBadge = badges.find((badge) => badge.id === activeBadgeId) ?? null;
  const isUnlockCelebration = Boolean(!selectedBadgeId && unlockQueue[0] && selectedBadge?.id === unlockQueue[0]);
  const badgeRecordCopy = getBadgeRecordCopy({
    loggedIn,
    unlockedCount: unlockedBadgeCount,
    totalCount: badges.length,
    nextBadge: nextBadge ? { title: nextBadge.title, detail: nextBadge.detail } : undefined,
  });
  const groupedBadges = BADGE_GROUPS.map((group) => {
    const items = group.badgeIds
      .map((badgeId) => badges.find((badge) => badge.id === badgeId) ?? null)
      .filter((badge): badge is ProfileBadgeProgress => Boolean(badge));

    return {
      ...group,
      badges: items,
      unlockedCount: items.filter((badge) => badge.unlocked).length,
    };
  }).filter((group) => group.badges.length > 0);

  useEffect(() => {
    if (unlockedBadgeIds.length === 0) {
      return;
    }

    const seenBadgeIds = getSeenBadgeIds();
    const newBadgeIds = unlockedBadgeIds.filter((badgeId) => !seenBadgeIds.includes(badgeId));

    if (newBadgeIds.length === 0) {
      return;
    }

    setSeenBadgeIds([...seenBadgeIds, ...newBadgeIds]);
    setUnlockQueue((current) => Array.from(new Set([...current, ...newBadgeIds])));
  }, [unlockedBadgeSignature]);

  useEffect(() => {
    if (!loggedIn || unlockedBadgeIds.length === 0) {
      return;
    }

    const missingBadgeIds = unlockedBadgeIds.filter((badgeId) => !serverBadgeIds.includes(badgeId));
    if (missingBadgeIds.length === 0) {
      return;
    }

    let cancelled = false;

    syncBadgeProgress(missingBadgeIds)
      .then(() => {
        if (!cancelled) {
          setServerBadgeIds((current) => Array.from(new Set([...current, ...missingBadgeIds])));
        }
      })
      .catch(() => {
        // 静默失败，避免影响 Profile 主流程
      });

    return () => {
      cancelled = true;
    };
  }, [loggedIn, serverBadgeSignature, unlockedBadgeSignature]);

  const handleOpenBadge = (badge: ProfileBadgeProgress) => {
    setSelectedBadgeId(badge.id);
  };

  const handleCloseBadge = () => {
    if (selectedBadgeId) {
      setSelectedBadgeId(null);
      return;
    }

    if (unlockQueue.length > 0) {
      setUnlockQueue((current) => current.slice(1));
    }
  };

  return (
    <View className="profile">
      <View className="profile__hero">
        <View className="profile__avatar-shell">
          <View className="profile__avatar">
            <Text className="profile__avatar-text">{heroInitial}</Text>
          </View>
        </View>

        <View className="profile__identity">
          <Text className="profile__eyebrow">Private Shelf</Text>
          <Text className="profile__name">{heroName}</Text>
          <Text className="profile__status">{summaryLabel}</Text>
        </View>

        <View className="profile__hero-actions">
          <View className="profile__summary-pill">
            <Text className="profile__summary-pill-text">{`已收藏 ${totalSaved} 项`}</Text>
          </View>

          {loggedIn ? (
            <Text className="profile__logout" onClick={handleLogout}>退出登录</Text>
          ) : (
            <Button className="profile__login-btn" loading={loginLoading} onClick={handleLogin}>
              微信一键登录
            </Button>
          )}
        </View>

        <View className="profile__stats">
          <View className="profile__stat">
            <Text className="profile__stat-num">{beanFavorites.length}</Text>
            <Text className="profile__stat-label">豆款收藏</Text>
          </View>
          <View className="profile__stat">
            <Text className="profile__stat-num">{roasterFavorites.length}</Text>
            <Text className="profile__stat-label">烘焙商</Text>
          </View>
          <View className="profile__stat">
            <Text className="profile__stat-num">{history.length}</Text>
            <Text className="profile__stat-label">最近浏览</Text>
          </View>
        </View>
      </View>

      <View className="profile__badge-record">
        <View className="profile__badge-record-head">
          <View className="profile__badge-record-heading">
            <Text className="profile__badge-record-eyebrow">{badgeRecordCopy.eyebrow}</Text>
            <Text className="profile__badge-record-title">{badgeRecordCopy.title}</Text>
            <Text className="profile__badge-record-summary">{`已解锁 ${unlockedBadgeCount}/${badges.length}`}</Text>
          </View>

          <View className="profile__badge-record-icon">
            <Icon name="heart" size={18} color="rgba(78, 52, 46, 0.8)" />
          </View>
        </View>

        <Text className="profile__badge-record-description">{badgeRecordCopy.description}</Text>

        <View className="profile__badge-record-ledger">
          <Text className="profile__badge-record-ledger-label">Collection Cabinet</Text>
          <Text className="profile__badge-record-ledger-value">
            {nextBadge ? `下一枚展签：${nextBadge.title}` : '当前馆藏已完整点亮'}
          </Text>
        </View>

        <View className="profile__badge-groups">
          {groupedBadges.map((group) => (
            <View key={group.id} className="profile__badge-group">
              <View className="profile__badge-group-head">
                <Text className="profile__badge-group-title">{group.title}</Text>
                <Text className="profile__badge-group-summary">{`${group.unlockedCount}/${group.badges.length}`}</Text>
              </View>

              <View className="profile__badge-record-grid">
                {group.badges.map((badge) => {
                  const badgeIndex = badges.findIndex((item) => item.id === badge.id);

                  return (
                    <View
                      key={badge.id}
                      className={`profile__badge-card ${badge.unlocked ? 'profile__badge-card--unlocked' : 'profile__badge-card--locked'}`}
                      onClick={() => handleOpenBadge(badge)}
                    >
                      <View className="profile__badge-card-top">
                        <Text className="profile__badge-card-index">{String(badgeIndex + 1).padStart(2, '0')}</Text>
                        <Text className={`profile__badge-card-status ${badge.unlocked ? 'profile__badge-card-status--unlocked' : ''}`}>
                          {badge.unlocked ? '已入藏' : badge.progressLabel}
                        </Text>
                      </View>

                      <View className="profile__badge-card-frame">
                        <View className="profile__badge-card-ring">
                          <Icon
                            name={badge.icon}
                            size={20}
                            color={badge.unlocked ? '#ffffff' : 'rgba(107, 83, 68, 0.62)'}
                          />
                        </View>
                        <Text className="profile__badge-card-plate">{badge.unlocked ? 'ARCHIVED' : 'PENDING'}</Text>
                      </View>

                      <View className="profile__badge-card-copy">
                        <Text className="profile__badge-card-title">{badge.title}</Text>
                        <Text className="profile__badge-card-subtitle">{badge.subtitle}</Text>
                      </View>

                      <View className="profile__badge-card-footer">
                        <Text className="profile__badge-card-rule">{badge.unlocked ? '馆藏说明' : '解锁条件'}</Text>
                        <Text className="profile__badge-card-detail">{badge.unlocked ? '点击查看徽章说明' : badge.detail}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <Text className="profile__badge-record-hint">{badgeRecordCopy.hint}</Text>
      </View>

      {selectedBadge ? (
        <View className="profile__badge-modal-mask" onClick={handleCloseBadge}>
          <View
            className="profile__badge-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <View className="profile__badge-modal-handle" />

            <View className="profile__badge-modal-meta">
              <Text className="profile__badge-modal-eyebrow">
                {isUnlockCelebration ? 'NEW BADGE UNLOCKED' : 'BADGE ARCHIVE'}
              </Text>
              <Text className="profile__badge-modal-code">{selectedBadge.id.toUpperCase()}</Text>
            </View>

            <View className="profile__badge-modal-header">
              <View className={`profile__badge-modal-icon ${selectedBadge.unlocked ? 'profile__badge-modal-icon--unlocked' : ''}`}>
                <Icon
                  name={selectedBadge.icon}
                  size={24}
                  color={selectedBadge.unlocked ? '#ffffff' : 'rgba(78, 52, 46, 0.78)'}
                />
              </View>
              <Text className={`profile__badge-modal-status ${selectedBadge.unlocked ? 'profile__badge-modal-status--unlocked' : ''}`}>
                {selectedBadge.unlocked ? '已解锁' : '未解锁'}
              </Text>
            </View>

            {isUnlockCelebration ? (
              <Text className="profile__badge-modal-unlock-title">恭喜解锁新徽章！</Text>
            ) : null}
            <Text className="profile__badge-modal-title">{selectedBadge.title}</Text>
            <Text className="profile__badge-modal-subtitle">{selectedBadge.subtitle}</Text>
            <Text className="profile__badge-modal-description">{selectedBadge.detail}</Text>

            <View className="profile__badge-modal-progress">
              <View className="profile__badge-modal-progress-block">
                <Text className="profile__badge-modal-progress-label">当前进度</Text>
                <Text className="profile__badge-modal-progress-value">
                  {selectedBadge.unlocked
                    ? '已完成'
                    : `${Math.min(selectedBadge.currentValue, selectedBadge.targetValue)}/${selectedBadge.targetValue}`}
                </Text>
              </View>
              <View className="profile__badge-modal-progress-block">
                <Text className="profile__badge-modal-progress-label">解锁门槛</Text>
                <Text className="profile__badge-modal-progress-value">{selectedBadge.targetValue}</Text>
              </View>
            </View>

            <View className="profile__badge-modal-actions">
              <View className="profile__badge-modal-close" onClick={handleCloseBadge}>
                <Text className="profile__badge-modal-close-text">知道了</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <View className="profile__tabs">
        {([
          { key: 'beans', label: '豆款收藏' },
          { key: 'history', label: '最近浏览' },
        ] as Array<{ key: TabKey; label: string }>).map((tab) => (
          <View
            key={tab.key}
            className={`profile__tab ${activeTab === tab.key ? 'profile__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text className="profile__tab-text">{tab.label}</Text>
          </View>
        ))}
      </View>

      <View className="profile__list">
        {activeTab === 'beans' ? (
          beanFavorites.length === 0 ? (
            <FavoriteEmptyPane message="先挑几款喜欢的豆子，私藏夹会慢慢成形。" />
          ) : (
            beanFavorites.map((item) => (
              <BeanRow
                key={item.bean.id}
                bean={item.bean}
                onFavoriteToggle={() => {
                  if (loggedIn && item.favorite) {
                    void handleUnfavoriteCloud(item.favorite);
                  } else {
                    handleUnfavoriteLocalBean(item.bean);
                  }
                }}
              />
            ))
          )
        ) : null}

        {activeTab === 'history' ? (
          history.length === 0 ? (
            <EmptyPane icon="coffee" message="最近还没有浏览记录，去翻翻新的豆单吧。" />
          ) : (
            history.map((item) => (
              <BeanRow
                key={item.id}
                bean={item}
                note={formatHistoryTime(item.viewedAt)}
              />
            ))
          )
        ) : null}
      </View>
    </View>
  );
}
