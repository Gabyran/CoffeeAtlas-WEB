import { Text, View } from '@tarojs/components';
import BadgeIcon, { type BadgeIconName } from '../BadgeIcon';
import { Badge, Progress, Separator } from '../ui';
import './index.scss';

export interface BadgeDetailData {
  id: string;
  title: string;
  subtitle: string;
  unlocked: boolean;
  currentValue: number;
  targetValue: number;
  detail: string;
}

interface BadgeDetailModalProps {
  badge: BadgeDetailData | null;
  isCelebration: boolean;
  onClose: () => void;
}

export default function BadgeDetailModal({ badge, isCelebration, onClose }: BadgeDetailModalProps) {
  if (!badge) return null;

  const progress =
    badge.targetValue > 0 ? Math.min(Math.round((badge.currentValue / badge.targetValue) * 100), 100) : 0;

  return (
    <View className="badge-modal-mask" onClick={onClose}>
      <View
        className={`badge-modal ${isCelebration ? 'badge-modal--celebration' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <View className="badge-modal__handle" />

        {isCelebration ? (
          <View className="badge-modal__particles">
            <View className="badge-modal__particle badge-modal__particle--1" />
            <View className="badge-modal__particle badge-modal__particle--2" />
            <View className="badge-modal__particle badge-modal__particle--3" />
            <View className="badge-modal__particle badge-modal__particle--4" />
            <View className="badge-modal__particle badge-modal__particle--5" />
            <View className="badge-modal__particle badge-modal__particle--6" />
          </View>
        ) : null}

        <View className="badge-modal__meta">
          <Text className="badge-modal__eyebrow">{isCelebration ? 'NEW ACHIEVEMENT' : 'ACHIEVEMENT DETAIL'}</Text>
          <Text className="badge-modal__code">{badge.id.toUpperCase()}</Text>
        </View>

        <View className={`badge-modal__hero ${isCelebration ? 'badge-modal__hero--celebration' : ''}`}>
          <View className="badge-modal__progress-ring">
            <View className="badge-modal__icon-wrap">
              <BadgeIcon
                name={badge.id as BadgeIconName}
                size={52}
                color={badge.unlocked ? '#c85c3d' : 'rgba(107,83,68,0.72)'}
                unlocked={badge.unlocked}
                showRing
                progress={badge.unlocked ? 100 : progress}
              />
            </View>
          </View>

          <Badge variant={badge.unlocked ? 'primary' : 'default'} size="md">
            {badge.unlocked ? '已解锁' : '解锁中'}
          </Badge>
        </View>

        {isCelebration ? <Text className="badge-modal__celebration-title">恭喜解锁新成就！</Text> : null}

        <Text className="badge-modal__title">{badge.title}</Text>
        <Text className="badge-modal__subtitle">{badge.subtitle}</Text>

        <View className="badge-modal__description">
          <Text className="badge-modal__description-text">{badge.detail}</Text>
        </View>

        {!badge.unlocked ? (
          <View className="badge-modal__progress-detail">
            <View className="badge-modal__progress-item">
              <Text className="badge-modal__progress-label">当前进度</Text>
              <Text className="badge-modal__progress-value">
                {Math.min(badge.currentValue, badge.targetValue)} / {badge.targetValue}
              </Text>
            </View>
            <Progress value={progress} className="badge-modal__progress-bar" />
            <View className="badge-modal__progress-item">
              <Text className="badge-modal__progress-label">完成度</Text>
              <Text className="badge-modal__progress-value">{progress}%</Text>
            </View>
          </View>
        ) : (
          <View className="badge-modal__completed">
            <View className="badge-modal__completed-ring">
              <Text className="badge-modal__completed-check">✓</Text>
            </View>
            <Text className="badge-modal__completed-text">已完成</Text>
          </View>
        )}

        <Separator className="badge-modal__separator" />

        <View className="badge-modal__actions">
          <View className="badge-modal__close-btn" onClick={onClose}>
            <Text className="badge-modal__close-text">知道了</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
