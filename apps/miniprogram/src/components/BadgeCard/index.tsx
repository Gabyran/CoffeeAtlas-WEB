import { Text, View } from '@tarojs/components';
import BadgeIcon, { type BadgeIconName } from '../BadgeIcon';
import './index.scss';

export interface BadgeCardData {
  id: string;
  title: string;
  subtitle: string;
  unlocked: boolean;
  currentValue: number;
  targetValue: number;
  progressLabel: string;
  detail: string;
  index: number;
  unlockedAt?: string;
}

interface BadgeCardProps {
  badge: BadgeCardData;
  onOpen: (badge: BadgeCardData) => void;
  animationDelay?: number;
}

export default function BadgeCard({ badge, onOpen, animationDelay = 0 }: BadgeCardProps) {
  return (
    <View
      className={`badge-card ${badge.unlocked ? 'badge-card--unlocked' : ''}`}
      style={animationDelay > 0 ? { animationDelay: `${animationDelay}s` } : undefined}
      onClick={() => onOpen(badge)}
    >
      <View className={`badge-card__icon ${badge.unlocked ? '' : 'badge-card__icon--locked'}`}>
        {badge.unlocked ? (
          <BadgeIcon
            name={badge.id as BadgeIconName}
            size={64}
            unlocked
          />
        ) : null}
      </View>
      <Text className="badge-card__title">
        {badge.unlocked ? badge.title : '未解锁'}
      </Text>
      <Text className="badge-card__meta">
        {badge.unlocked
          ? (badge.unlockedAt ? `${badge.unlockedAt} 解锁` : '已解锁')
          : badge.detail}
      </Text>
    </View>
  );
}
