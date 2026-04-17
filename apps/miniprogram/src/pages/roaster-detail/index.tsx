import { useEffect, useMemo, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import { toRoasterFavoriteSnapshot } from '@coffee-atlas/domain';

import BeanCard from '../../components/BeanCard';
import EmptyState from '../../components/EmptyState';
import Icon from '../../components/Icon';
import {
  addFavorite,
  getFavorites as getCloudFavorites,
  getRoasterById,
  removeFavorite,
} from '../../services/api';
import type { RoasterDetail } from '../../types';
import { isLoggedIn } from '../../utils/auth';
import { openExternalLink } from '../../utils/external-links';
import { getCurrentPageParams, setClipboardData, setNavigationBarTitle, showToast } from '../../utils/miniprogram-api.ts';
import { isRoasterFavorite, toggleRoasterFavorite } from '../../utils/storage';
import './index.scss';

function formatLinkLabel(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export default function RoasterDetailPage() {
  const id = getCurrentPageParams().id ?? '';
  const [roaster, setRoaster] = useState<RoasterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    if (!id) return;

    getRoasterById(id)
      .then(async (data) => {
        setRoaster(data);
        setNavigationBarTitle({ title: data.name });

        if (isLoggedIn()) {
          const favorites = await getCloudFavorites().catch(() => []);
          setFavorited(
            favorites.some((favorite) => favorite.target_type === 'roaster' && favorite.target_id === data.id)
          );
        } else {
          setFavorited(isRoasterFavorite(data.id));
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleFavorite = async () => {
    if (!roaster) return;

    if (isLoggedIn()) {
      try {
        if (favorited) {
          await removeFavorite('roaster', roaster.id);
          setFavorited(false);
          showToast({ title: '已取消收藏', icon: 'none', duration: 1500 });
        } else {
          await addFavorite('roaster', roaster.id);
          setFavorited(true);
          showToast({ title: '已收藏烘焙商', icon: 'none', duration: 1500 });
        }
      } catch {
        showToast({ title: '操作失败', icon: 'none' });
      }
      return;
    }

    const added = toggleRoasterFavorite(toRoasterFavoriteSnapshot(roaster));
    setFavorited(added);
    showToast({ title: added ? '已收藏烘焙商' : '已取消收藏', icon: 'none', duration: 1500 });
  };

  const handleCopy = (label: string, value: string) => {
    setClipboardData({
      data: value,
      success: () => {
        showToast({ title: `${label}已复制`, icon: 'none' });
      },
    });
  };

  const actionLinks = useMemo(() => {
    if (!roaster) return [];

    return [
      roaster.taobaoUrl
        ? {
            key: 'taobao',
            label: '淘宝在售',
            note: '优先打开，受限时自动复制链接',
            url: roaster.taobaoUrl,
          }
        : null,
      roaster.xiaohongshuUrl
        ? {
            key: 'xiaohongshu',
            label: '小红书',
            note: '查看内容页或品牌动态',
            url: roaster.xiaohongshuUrl,
          }
        : null,
      roaster.websiteUrl
        ? {
            key: 'website',
            label: '官网',
            note: formatLinkLabel(roaster.websiteUrl),
            url: roaster.websiteUrl,
          }
        : null,
    ].filter((item): item is { key: string; label: string; note: string; url: string } => Boolean(item));
  }, [roaster]);

  if (loading) {
    return (
      <View className="roaster-detail">
        <EmptyState message="正在展开品牌页..." />
      </View>
    );
  }

  if (error || !roaster) {
    return (
      <View className="roaster-detail">
        <EmptyState message={error || '烘焙商不存在'} />
      </View>
    );
  }

  const heroImageUrl = roaster.coverImageUrl ?? roaster.logoUrl ?? null;
  const usesLogoAsCover = Boolean(heroImageUrl && roaster.logoUrl && heroImageUrl === roaster.logoUrl);

  return (
    <View className="roaster-detail">
      <View className="roaster-detail__hero">
        <View className="roaster-detail__cover-shell">
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              mode={usesLogoAsCover ? 'aspectFit' : 'aspectFill'}
              className="roaster-detail__cover-image"
            />
          ) : (
            <View className="roaster-detail__cover-fallback">
              <Text className="roaster-detail__cover-initial">{roaster.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View className="roaster-detail__cover-overlay">
            <Text className="roaster-detail__eyebrow">Roaster Spotlight</Text>
            <View className="roaster-detail__cover-meta">
              {roaster.city ? <Text className="roaster-detail__meta-chip">{roaster.city}</Text> : null}
              <Text className="roaster-detail__meta-chip">
                {roaster.beanCount ? `${roaster.beanCount} 款豆单` : '品牌页已建档'}
              </Text>
            </View>
          </View>
        </View>

        <View className="roaster-detail__hero-card">
          <View className="roaster-detail__hero-main">
            {roaster.logoUrl ? (
              <Image src={roaster.logoUrl} mode="aspectFit" className="roaster-detail__logo" />
            ) : (
              <View className="roaster-detail__seal">
                <Text className="roaster-detail__initial">{roaster.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}

            <View className="roaster-detail__title-wrap">
              <Text className="roaster-detail__name">{roaster.name}</Text>
              <Text className="roaster-detail__subtitle">精品烘焙品牌档案</Text>
            </View>

            <View className="roaster-detail__favorite" onClick={handleFavorite}>
              <Icon
                name={favorited ? 'heart-filled' : 'heart'}
                size={20}
                color={favorited ? '#c85c3d' : '#8b5a2b'}
              />
            </View>
          </View>

          <Text className="roaster-detail__intro">
            {roaster.description?.trim() || '一份简洁的品牌索引，呈现这家烘焙商当前收录的风味线索。'}
          </Text>

          {actionLinks.length > 0 ? (
            <View className="roaster-detail__actions">
              {actionLinks.map((item) => (
                <View
                  key={item.key}
                  className="roaster-detail__action-card"
                  onClick={() => openExternalLink(item.url, item.label)}
                >
                  <Text className="roaster-detail__action-label">{item.label}</Text>
                  <Text className="roaster-detail__action-note">{item.note}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {roaster.instagramHandle ? (
            <View
              className="roaster-detail__social-chip"
              onClick={() => handleCopy('Instagram 账号', `@${roaster.instagramHandle}`)}
            >
              <Text className="roaster-detail__social-prefix">@</Text>
              <Text className="roaster-detail__social-text">{roaster.instagramHandle}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="roaster-detail__section-head">
        <Text className="roaster-detail__section-title">在售目录</Text>
        <Text className="roaster-detail__section-sub">Seasonal Selection</Text>
      </View>

      <View className="roaster-detail__beans">
        {roaster.beans && roaster.beans.length > 0 ? (
          roaster.beans.map((bean, index) => (
            <BeanCard key={bean.id} bean={bean} index={index} />
          ))
        ) : (
          <EmptyState message="这家烘焙商暂未上架豆款" />
        )}
      </View>
    </View>
  );
}
