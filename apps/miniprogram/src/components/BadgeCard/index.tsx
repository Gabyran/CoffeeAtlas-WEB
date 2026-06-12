import { Text, View } from '@tarojs/components';
import BadgeIcon, { type BadgeIconName } from '../BadgeIcon';
import { Badge, Progress, Separator } from '../ui';
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
}

interface BadgeCardProps {
  badge: BadgeCardData;
  onOpen: (badge: BadgeCardData) => void;
  animationDelay?: number;
}

export default function BadgeCard({ badge, onOpen, animationDelay = 0 }: BadgeCardProps) {
  const progress =
    badge.targetValue > 0 ? Math.min(Math.round((badge.currentValue / badge.targetValue) * 100), 100) : 0;

  return (
    <View
      className={`badge-card ${badge.unlocked ? 'badge-card--unlocked' : 'badge-card--locked'}`}
      style={animationDelay > 0 ? { animationDelay: `${animationDelay}s` } : undefined}
      onClick={() => onOpen(badge)}
    >
      <View className="badge-card__top">
        <Text className="badge-card__index">{String(badge.index + 1).padStart(2, '0')}</Text>
        <Badge variant={badge.unlocked ? 'primary' : 'default'} size="sm">
          {badge.unlocked ? '已入藏' : badge.progressLabel}
        </Badge>
      </View>

      <View className="badge-card__icon-shell">
        <BadgeIcon
          name={badge.id as BadgeIconName}
          size={badge.unlocked ? 44 : 40}
          color={badge.unlocked ? '#ffffff' : 'rgba(107,83,68,0.62)'}
          unlocked={badge.unlocked}
          showRing
          progress={badge.unlocked ? 100 : progress}
        />
        {badge.unlocked ? <View className="badge-card__sparkle" /> : null}
      </View>

      <View className="badge-card__copy">
        <Text className="badge-card__title">{badge.title}</Text>
        <Text className="badge-card__subtitle">{badge.subtitle}</Text>
      </View>

      {!badge.unlocked && progress > 0 ? <Progress value={progress} className="badge-card__progress" /> : null}

      <Separator className="badge-card__separator" />

      <View className="badge-card__footer">
        <Text className="badge-card__rule-label">{badge.unlocked ? '馆藏说明' : '解锁条件'}</Text>
        <Text className="badge-card__rule-detail" numberOfLines={2}>
          {badge.detail}
        </Text>
      </View>
    </View>
  );
}
