import { useCallback, useRef, useState } from 'react';
import { View, Text } from '@tarojs/components';

import BadgeIcon, { type BadgeIconName } from '../BadgeIcon';
import './index.scss';

export interface BadgeDetailData {
  id: string;
  title: string;
  subtitle: string;
  unlocked: boolean;
  currentValue: number;
  targetValue: number;
  detail: string;
  unlockedAt?: string;
}

interface BadgeDetailModalProps {
  badge: BadgeDetailData | null;
  isCelebration: boolean;
  onClose: () => void;
}

export default function BadgeDetailModal({ badge, isCelebration, onClose }: BadgeDetailModalProps) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef({ y: 0, dragY: 0 });

  const handleClose = useCallback(() => {
    setDragY(0);
    setIsDragging(false);
    onClose();
  }, [onClose]);

  const handleTouchStart = useCallback(
    (e: any) => {
      const touch = e.touches?.[0] ?? e.detail?.touches?.[0];
      if (!touch) return;
      dragStartRef.current = { y: touch.clientY, dragY: 0 };
      setIsDragging(true);
    },
    [],
  );

  const handleTouchMove = useCallback(
    (e: any) => {
      if (!isDragging) return;
      const touch = e.touches?.[0] ?? e.detail?.touches?.[0];
      if (!touch) return;
      const dy = Math.max(0, touch.clientY - dragStartRef.current.y);
      setDragY(dy);
    },
    [isDragging],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (dragY > 100) {
      handleClose();
    } else {
      setDragY(0);
    }
  }, [dragY, handleClose]);

  if (!badge) return null;

  const scale = Math.max(0.85, 1 - dragY / 600);
  const opacity = Math.max(0.3, 1 - dragY / 400);

  return (
    <View className="badge-modal-mask" onClick={handleClose}>
      <View
        className="badge-modal"
        style={{
          transform: `translateY(${dragY}px) scale(${scale})`,
          opacity,
        }}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <View className="badge-modal__close" onClick={handleClose}>
          <View className="badge-modal__close-icon">×</View>
        </View>

        <View className={`badge-modal__hero ${isCelebration ? 'badge-modal__hero--celebration' : ''}`}>
          <BadgeIcon
            name={badge.id as BadgeIconName}
            size={140}
            color="#c85c3d"
            unlocked={badge.unlocked}
          />
        </View>

        <View className="badge-modal__info">
          <Text className="badge-modal__title">{badge.title}</Text>
          {badge.unlocked && badge.unlockedAt ? (
            <Text className="badge-modal__unlocked-date">{badge.unlockedAt} 解锁</Text>
          ) : null}
          {!badge.unlocked ? (
            <Text className="badge-modal__status-text">解锁中</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
