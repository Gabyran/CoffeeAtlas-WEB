import { getBadgeUnlockDate, setBadgeUnlockDate, formatUnlockDate } from '../../utils/storage';

type ProfileBadgeIconName = 'coffee' | 'user' | 'globe' | 'map-pin' | 'heart' | 'heart-filled' | 'share';
type BadgeMetricKey =
  | 'loggedIn'
  | 'beanFavorites'
  | 'roasterFavorites'
  | 'historyCount'
  | 'uniqueCountries'
  | 'continentsCovered'
  | 'uniqueProcesses'
  | 'uniqueVarieties'
  | 'purchaseClicks'
  | 'uniqueRoasterPurchaseClicks'
  | 'shareCount';

export interface BadgeMetricSnapshot {
  loggedIn: boolean;
  beanFavorites: number;
  roasterFavorites: number;
  historyCount: number;
  uniqueCountries?: number;
  continentsCovered?: number;
  uniqueProcesses?: number;
  uniqueVarieties?: number;
  purchaseClicks?: number;
  uniqueRoasterPurchaseClicks?: number;
  shareCount?: number;
  externallyUnlockedBadgeIds?: string[];
}

export interface ProfileBadgeDefinition {
  id: string;
  title: string;
  subtitle: string;
  icon: ProfileBadgeIconName;
  metricKey: BadgeMetricKey;
  threshold: number;
  unlockedDescription: string;
}

export interface ProfileBadgeProgress extends ProfileBadgeDefinition {
  unlocked: boolean;
  currentValue: number;
  targetValue: number;
  remainingValue: number;
  progressLabel: string;
  detail: string;
  unlockedAt?: string;
}

const PROFILE_BADGE_DEFINITIONS: ProfileBadgeDefinition[] = [
  {
    id: 'visitor',
    title: '入馆访客',
    subtitle: '开始建立你的个人咖啡档案',
    icon: 'user',
    metricKey: 'loggedIn',
    threshold: 1,
    unlockedDescription: '你已经进入个人馆藏，后续探索都会记在这里。',
  },
  {
    id: 'bean-starter',
    title: '豆单初藏',
    subtitle: '收藏第一款豆子，开始积累偏好',
    icon: 'heart',
    metricKey: 'beanFavorites',
    threshold: 1,
    unlockedDescription: '你已经收藏了第一款豆子，个人口味开始成形。',
  },
  {
    id: 'bean-collector',
    title: '豆单收藏家',
    subtitle: '收藏 5 款豆子，形成更完整的豆单',
    icon: 'heart-filled',
    metricKey: 'beanFavorites',
    threshold: 5,
    unlockedDescription: '你的豆单已经有了明显轮廓，收藏正在变得更有体系。',
  },
  {
    id: 'roaster-radar',
    title: '烘焙雷达',
    subtitle: '收藏第一个烘焙商，开始追踪风格',
    icon: 'map-pin',
    metricKey: 'roasterFavorites',
    threshold: 1,
    unlockedDescription: '你已经开始关注烘焙商，探索不再只停留在单款豆子。',
  },
  {
    id: 'history-explorer',
    title: '风味漫游者',
    subtitle: '浏览 3 条记录，留下最初的探索足迹',
    icon: 'coffee',
    metricKey: 'historyCount',
    threshold: 3,
    unlockedDescription: '你的浏览足迹已经留下第一段轨迹，探索正在展开。',
  },
  {
    id: 'history-regular',
    title: '探索常客',
    subtitle: '浏览 10 条记录，让足迹变得稳定',
    icon: 'globe',
    metricKey: 'historyCount',
    threshold: 10,
    unlockedDescription: '你的探索已经形成连续记录，属于这张地图上的常客。',
  },
  {
    id: 'origin-scout',
    title: '产地侦察兵',
    subtitle: '探索 3 个不同产地',
    icon: 'map-pin',
    metricKey: 'uniqueCountries',
    threshold: 3,
    unlockedDescription: '你的咖啡护照已盖了 3 个章。',
  },
  {
    id: 'origin-atlas',
    title: '风味地图师',
    subtitle: '足迹覆盖 3 个大洲',
    icon: 'globe',
    metricKey: 'continentsCovered',
    threshold: 3,
    unlockedDescription: '亚非拉美洲，你的味蕾比联合国还忙。',
  },
  {
    id: 'process-nerd',
    title: '处理法极客',
    subtitle: '尝试 4 种不同处理法',
    icon: 'coffee',
    metricKey: 'uniqueProcesses',
    threshold: 4,
    unlockedDescription: '水洗日晒蜜处理厌氧，四大天王已集齐。',
  },
  {
    id: 'variety-hunter',
    title: '品种猎人',
    subtitle: '接触 3 种不同品种',
    icon: 'heart-filled',
    metricKey: 'uniqueVarieties',
    threshold: 3,
    unlockedDescription: '在咖啡基因库里翻箱倒柜的人。',
  },
  {
    id: 'first-click',
    title: '剁手初体验',
    subtitle: '首次点击购买链接',
    icon: 'share',
    metricKey: 'purchaseClicks',
    threshold: 1,
    unlockedDescription: '钱包已就位，就差付款了。',
  },
  {
    id: 'multi-roaster',
    title: '不忠实消费者',
    subtitle: '查看 3 家不同烘焙师的购买链接',
    icon: 'heart',
    metricKey: 'uniqueRoasterPurchaseClicks',
    threshold: 3,
    unlockedDescription: '货比三家的精明买手，烘焙师们都慌了。',
  },
  {
    id: 'first-share',
    title: '安利达人',
    subtitle: '首次把豆子分享给好友',
    icon: 'share',
    metricKey: 'shareCount',
    threshold: 1,
    unlockedDescription: '你朋友圈终于有了咖啡味。',
  },
  {
    id: 'serial-sharer',
    title: '种草机器',
    subtitle: '累计分享 5 次',
    icon: 'share',
    metricKey: 'shareCount',
    threshold: 5,
    unlockedDescription: '非官方咖啡推广大使，请领工牌。',
  },
];

function getMetricValue(metrics: BadgeMetricSnapshot, key: BadgeMetricKey): number {
  switch (key) {
    case 'loggedIn':
      return metrics.loggedIn ? 1 : 0;
    case 'beanFavorites':
      return metrics.beanFavorites;
    case 'roasterFavorites':
      return metrics.roasterFavorites;
    case 'historyCount':
      return metrics.historyCount;
    case 'uniqueCountries':
      return metrics.uniqueCountries ?? 0;
    case 'continentsCovered':
      return metrics.continentsCovered ?? 0;
    case 'uniqueProcesses':
      return metrics.uniqueProcesses ?? 0;
    case 'uniqueVarieties':
      return metrics.uniqueVarieties ?? 0;
    case 'purchaseClicks':
      return metrics.purchaseClicks ?? 0;
    case 'uniqueRoasterPurchaseClicks':
      return metrics.uniqueRoasterPurchaseClicks ?? 0;
    case 'shareCount':
      return metrics.shareCount ?? 0;
    default:
      return 0;
  }
}

function getLockedDetail(definition: ProfileBadgeDefinition, remainingValue: number): string {
  switch (definition.metricKey) {
    case 'loggedIn':
      return '登录后即可解锁这个成就。';
    case 'beanFavorites':
      return `再收藏 ${remainingValue} 款豆子可解锁。`;
    case 'roasterFavorites':
      return `再收藏 ${remainingValue} 个烘焙商可解锁。`;
    case 'historyCount':
      return `再浏览 ${remainingValue} 条记录可解锁。`;
    case 'uniqueCountries':
      return `再探索 ${remainingValue} 个不同产地可解锁。`;
    case 'continentsCovered':
      return `再覆盖 ${remainingValue} 个大洲可解锁。`;
    case 'uniqueProcesses':
      return `再尝试 ${remainingValue} 种不同处理法可解锁。`;
    case 'uniqueVarieties':
      return `再接触 ${remainingValue} 种不同品种可解锁。`;
    case 'purchaseClicks':
      return `再点击 ${remainingValue} 次购买链接可解锁。`;
    case 'uniqueRoasterPurchaseClicks':
      return `再查看 ${remainingValue} 家不同烘焙商的购买链接可解锁。`;
    case 'shareCount':
      return `再分享 ${remainingValue} 次可解锁。`;
    default:
      return '继续探索可解锁。';
  }
}

function getProgressLabel(unlocked: boolean, currentValue: number, targetValue: number): string {
  if (unlocked) {
    return '已完成';
  }

  return `${Math.min(currentValue, targetValue)}/${targetValue}`;
}

export function getProfileBadges(metrics: BadgeMetricSnapshot): ProfileBadgeProgress[] {
  const externallyUnlockedBadgeIds = new Set(metrics.externallyUnlockedBadgeIds ?? []);

  return PROFILE_BADGE_DEFINITIONS.map((definition) => {
    const currentValue = getMetricValue(metrics, definition.metricKey);
    const targetValue = definition.threshold;
    const unlocked = currentValue >= targetValue || externallyUnlockedBadgeIds.has(definition.id);
    const remainingValue = unlocked ? 0 : targetValue - currentValue;

    let unlockedAt: string | undefined;
    if (unlocked) {
      unlockedAt = getBadgeUnlockDate(definition.id);
      if (!unlockedAt) {
        unlockedAt = formatUnlockDate(Date.now());
        setBadgeUnlockDate(definition.id, unlockedAt);
      }
    }

    return {
      ...definition,
      unlocked,
      currentValue,
      targetValue,
      remainingValue,
      progressLabel: getProgressLabel(unlocked, currentValue, targetValue),
      detail: unlocked ? definition.unlockedDescription : getLockedDetail(definition, remainingValue),
      unlockedAt,
    };
  });
}
