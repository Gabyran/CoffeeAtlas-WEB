import type { ReactNode } from 'react';
import { Image, Text, View } from '@tarojs/components';
import type { RoasterSummary } from '../../types';
import { openExternalLink } from '../../utils/external-links';
import { navigateTo } from '../../utils/miniprogram-api';
import { Avatar, Badge, Separator } from '../ui';
import './index.scss';

interface RoasterCardProps {
  roaster: RoasterSummary;
  index?: number;
  variant?: 'gallery' | 'saved';
  trailing?: ReactNode;
  hideArrow?: boolean;
  showQuickActions?: boolean;
}

export default function RoasterCard({
  roaster,
  index = 0,
  variant = 'gallery',
  trailing,
  hideArrow = false,
  showQuickActions,
}: RoasterCardProps) {
  const handleTap = () => {
    navigateTo({ url: `/pages/roaster-detail/index?id=${roaster.id}` });
  };

  const heroImageUrl = roaster.coverImageUrl ?? roaster.logoUrl ?? null;
  const usesLogoAsCover = Boolean(heroImageUrl && roaster.logoUrl && heroImageUrl === roaster.logoUrl);
  const delayStyle = index < 8 ? { animationDelay: `${index * 0.05}s` } : {};
  const description = roaster.description?.trim();
  const shouldShowQuickActions = showQuickActions ?? variant === 'gallery';
  const beanCountLabel =
    typeof roaster.beanCount === 'number' && roaster.beanCount > 0 ? `${roaster.beanCount} 款豆单` : '豆单待补充';
  const monogram = roaster.name.trim().charAt(0).toUpperCase() || 'R';
  const railLabel = variant === 'saved' ? 'Saved entry' : 'Atlas entry';
  const kickerLabel = variant === 'saved' ? 'Saved roaster' : 'Roaster dossier';
  const hintText =
    variant === 'saved' ? '点击回到品牌档案，继续查看豆单与外部入口。' : '点击查看品牌详情与在售豆单。';
  const descriptionText =
    description ||
    (variant === 'saved'
      ? '收藏这家烘焙商后，可以更快回看品牌故事、豆单与外部入口。'
      : '收录品牌介绍、代表豆单与外部入口，方便在 Atlas 内持续浏览与比较。');
  const quickActions = [
    roaster.taobaoUrl ? { key: 'taobao', label: '淘宝在售', url: roaster.taobaoUrl } : null,
    roaster.xiaohongshuUrl ? { key: 'xiaohongshu', label: '小红书', url: roaster.xiaohongshuUrl } : null,
  ].filter((item): item is { key: string; label: string; url: string } => Boolean(item));

  return (
    <View
      className={`roaster-card roaster-card--${variant}`}
      style={delayStyle}
      hoverClass="roaster-card--active"
      hoverStartTime={20}
      hoverStayTime={70}
      onClick={handleTap}
    >
      <View className="roaster-card__rail">
        <View className={`roaster-card__media-shell ${usesLogoAsCover ? 'roaster-card__media-shell--logo' : ''}`}>
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              mode={usesLogoAsCover ? 'aspectFit' : 'aspectFill'}
              lazyLoad
              className="roaster-card__media-image"
            />
          ) : (
            <View className="roaster-card__media-fallback">
              <Avatar fallback={<Text className="roaster-card__seal-text">{monogram}</Text>} size="lg" />
            </View>
          )}
        </View>

        <View className="roaster-card__rail-note">
          <Text className="roaster-card__rail-label">{railLabel}</Text>
          <Text className="roaster-card__rail-value">No. {String(index + 1).padStart(2, '0')}</Text>
        </View>
      </View>

      <View className="roaster-card__panel">
        <View className="roaster-card__panel-head">
          <Text className="roaster-card__eyebrow">{kickerLabel}</Text>
          {!hideArrow ? (
            <View className="roaster-card__nav-indicator">
              <Text className="roaster-card__nav-icon">↗</Text>
            </View>
          ) : null}
        </View>

        <Text className="roaster-card__name">{roaster.name}</Text>
        <Text className={`roaster-card__desc ${description ? '' : 'roaster-card__desc--muted'}`}>{descriptionText}</Text>

        <View className="roaster-card__meta">
          {roaster.city ? <Badge variant="default" size="sm">{roaster.city}</Badge> : null}
          <Badge variant="outline" size="sm">
            {beanCountLabel}
          </Badge>
        </View>

        <Separator className="roaster-card__separator" />

        <View className="roaster-card__footer">
          {shouldShowQuickActions && quickActions.length > 0 ? (
            <View className="roaster-card__actions">
              {quickActions.map((action) => (
                <View
                  key={action.key}
                  className={`roaster-card__action roaster-card__action--${action.key}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    openExternalLink(action.url, action.label);
                  }}
                >
                  <View className="roaster-card__action-mark" />
                  <Text className="roaster-card__action-text">{action.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="roaster-card__hint">{hintText}</Text>
          )}

          {trailing ? <View className="roaster-card__footer-side">{trailing}</View> : null}
        </View>
      </View>
    </View>
  );
}
