import { useEffect, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import { useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { toBeanFavoriteSnapshot } from '@coffee-atlas/domain';

import Icon from '../../components/Icon';
import { Avatar, Badge, Separator } from '../../components/ui';
import { addFavorite, getBeanById, getFavorites, getRoasterById, removeFavorite } from '../../services/api';
import type { BeanDetail, RoasterDetail } from '../../types';
import { isLoggedIn } from '../../utils/auth';
import { formatSalesCount } from '../../utils/formatters';
import { openExternalLink } from '../../utils/external-links';
import { getCurrentPageParams, navigateTo, setNavigationBarTitle, showToast } from '../../utils/miniprogram-api.ts';
import {
  addToHistory,
  isBeanFavorite,
  recordPurchaseClick,
  recordShareEvent,
  toggleBeanFavorite,
} from '../../utils/storage';
import './index.scss';

type BeanShareSource = Pick<BeanDetail, 'id' | 'name' | 'roasterName' | 'imageUrl' | 'price' | 'discountedPrice'>;

export function getBeanDisplayPrice(bean: Pick<BeanDetail, 'price' | 'discountedPrice'> | null): number {
  if (!bean) return 0;
  return bean.discountedPrice ?? bean.price;
}

export function getBeanPurchaseUrl(productUrl?: string | null): string {
  return typeof productUrl === 'string' ? productUrl.trim() : '';
}

export function buildBeanSharePayload(bean: BeanShareSource | null) {
  if (!bean) {
    return {
      title: '咖啡豆详情',
      path: '/pages/bean-detail/index',
      query: '',
      imageUrl: undefined as string | undefined,
    };
  }

  const title = [bean.roasterName, bean.name].filter(Boolean).join(' · ');
  const query = `id=${encodeURIComponent(bean.id)}`;

  return {
    title,
    path: `/pages/bean-detail/index?${query}`,
    query,
    imageUrl: bean.imageUrl ?? undefined,
  };
}

export default function BeanDetailPage() {
  const id = getCurrentPageParams().id ?? '';
  const [bean, setBean] = useState<BeanDetail | null>(null);
  const [roaster, setRoaster] = useState<RoasterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);

  useShareAppMessage(() => {
    if (bean) {
      recordShareEvent({ beanId: bean.id });
    }
    const sharePayload = buildBeanSharePayload(bean);

    return {
      title: sharePayload.title,
      path: sharePayload.path,
      imageUrl: sharePayload.imageUrl,
    };
  });

  useShareTimeline(() => {
    if (bean) {
      recordShareEvent({ beanId: bean.id });
    }
    const sharePayload = buildBeanSharePayload(bean);

    return {
      title: sharePayload.title,
      query: sharePayload.query,
      imageUrl: sharePayload.imageUrl,
    };
  });

  useEffect(() => {
    let active = true;

    if (!id) {
      setBean(null);
      setRoaster(null);
      setFavorited(false);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setBean(null);
    setRoaster(null);
    setFavorited(false);

    getBeanById(id)
      .then(async (data) => {
        if (!active) return;

        setBean(data);
        setNavigationBarTitle({ title: data.name });

        if (isLoggedIn()) {
          const favorites = await getFavorites().catch(() => []);
          if (!active) return;
          setFavorited(favorites.some((favorite) => favorite.target_type === 'bean' && favorite.target_id === data.id));
        } else {
          setFavorited(isBeanFavorite(data.id));
        }

        addToHistory(toBeanFavoriteSnapshot(data));

        if (data.roasterId) {
          getRoasterById(data.roasterId)
            .then((detail) => {
              if (active) {
                setRoaster(detail);
              }
            })
            .catch(() => {
              if (active) {
                setRoaster(null);
              }
            });
        }
      })
      .catch(() => showToast({ title: '加载失败', icon: 'none' }))
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  const displayPrice = getBeanDisplayPrice(bean);
  const purchaseUrl = getBeanPurchaseUrl(bean?.productUrl);
  const salesLabel = bean ? formatSalesCount(bean.salesCount) : '';
  const roasterName = roaster?.name?.trim() || bean?.roasterName || '';
  const roasterDescription = roaster?.description?.trim() || '点击进入品牌页，查看完整的烘焙师档案。';
  const roasterCity = roaster?.city?.trim() || bean?.city || '';
  const roasterBeanCount = typeof roaster?.beanCount === 'number' && roaster.beanCount > 0 ? `${roaster.beanCount} 款豆单` : '';
  const roasterInitial = roasterName.trim().charAt(0).toUpperCase() || 'R';
  const hasDiscount = bean?.discountedPrice != null && bean.discountedPrice < bean.price;

  const handleFavorite = async () => {
    if (!bean) return;

    if (isLoggedIn()) {
      try {
        if (favorited) {
          await removeFavorite('bean', bean.id);
          setFavorited(false);
          showToast({ title: '已取消收藏', icon: 'none', duration: 1500 });
        } else {
          await addFavorite('bean', bean.id);
          setFavorited(true);
          showToast({ title: '已收藏', icon: 'none', duration: 1500 });
        }
      } catch {
        showToast({ title: '操作失败', icon: 'none' });
      }
      return;
    }

    const added = toggleBeanFavorite(toBeanFavoriteSnapshot(bean));
    setFavorited(added);
    showToast({ title: added ? '已收藏' : '已取消收藏', icon: 'none', duration: 1500 });
  };

  const handlePurchase = () => {
    if (!bean) return;

    if (!purchaseUrl) {
      showToast({ title: '暂无购买链接', icon: 'none' });
      return;
    }

    recordPurchaseClick({
      roasterId: bean.roasterId,
      beanId: bean.id,
    });
    openExternalLink(purchaseUrl, '购买');
  };

  const handleRoasterTap = () => {
    if (!bean?.roasterId) {
      showToast({ title: '暂无烘焙师信息', icon: 'none' });
      return;
    }

    navigateTo({ url: `/pages/roaster-detail/index?id=${bean.roasterId}` });
  };

  if (loading) {
    return (
      <View className="bean-detail bean-detail--loading">
        <View className="bean-detail__skeleton">
          <View className="bean-detail__skeleton-image" />
          <View className="bean-detail__skeleton-content">
            <View className="bean-detail__skeleton-line bean-detail__skeleton-line--lg" />
            <View className="bean-detail__skeleton-line bean-detail__skeleton-line--md" />
            <View className="bean-detail__skeleton-line bean-detail__skeleton-line--sm" />
          </View>
        </View>
      </View>
    );
  }

  if (!bean) {
    return (
      <View className="bean-detail bean-detail--empty">
        <Icon name="coffee" size={64} color="rgba(139,90,43,0.2)" />
        <Text className="bean-detail__empty-text">未找到该咖啡豆</Text>
      </View>
    );
  }

  const infoItems = [
    { label: '产地', value: [bean.originCountry, bean.originRegion].filter(Boolean).join(' · ') },
    { label: '处理法', value: bean.process },
    { label: '烘焙度', value: bean.roastLevel },
    { label: '品种', value: bean.variety },
    { label: '庄园', value: bean.farm },
  ].filter((item) => item.value);

  return (
    <View className="bean-detail">
      <View className="bean-detail__hero">
        {bean.imageUrl ? (
          <Image src={bean.imageUrl} mode="aspectFill" className="bean-detail__hero-image" />
        ) : (
          <View className="bean-detail__hero-placeholder">
            <Icon name="coffee" size={80} color="rgba(139,90,43,0.2)" />
          </View>
        )}
        <View className="bean-detail__hero-overlay" />
        {bean.isNewArrival && (
          <View className="bean-detail__hero-badge">
            <Badge variant="primary" size="sm">NEW</Badge>
          </View>
        )}
      </View>

      <View className="bean-detail__content">
        <View
          className="bean-detail__roaster-section"
          hoverClass="bean-detail__roaster-section--active"
          hoverStartTime={20}
          hoverStayTime={80}
          onClick={handleRoasterTap}
        >
          <Avatar
            src={roaster?.logoUrl}
            fallback={<Text className="bean-detail__roaster-initial">{roasterInitial}</Text>}
            size="lg"
          />
          <View className="bean-detail__roaster-info">
            <Text className="bean-detail__roaster-label">烘焙师</Text>
            <Text className="bean-detail__roaster-name">{roasterName}</Text>
            <Text className="bean-detail__roaster-desc" numberOfLines={2}>
              {roasterDescription}
            </Text>
            {(roasterCity || roasterBeanCount) && (
              <View className="bean-detail__roaster-chips">
                {roasterCity && <Badge variant="default" size="sm">{roasterCity}</Badge>}
                {roasterBeanCount && <Badge variant="outline" size="sm">{roasterBeanCount}</Badge>}
              </View>
            )}
          </View>
          <View className="bean-detail__roaster-arrow">
            <Icon name="chevron-down" size={18} color="#c85c3d" />
          </View>
        </View>

        <View className="bean-detail__main">
          <Text className="bean-detail__name">{bean.name}</Text>

          <View className="bean-detail__price-section">
            <View className="bean-detail__price-group">
              {hasDiscount && <Text className="bean-detail__original-price">¥{bean.price}</Text>}
              <Text className="bean-detail__price">¥{displayPrice}</Text>
            </View>
            {salesLabel && <Badge variant="secondary">{salesLabel} 已售</Badge>}
          </View>
        </View>

        <Separator className="bean-detail__separator" />

        {infoItems.length > 0 && (
          <View className="bean-detail__info-card">
            <Text className="bean-detail__section-title">咖啡豆信息</Text>
            <View className="bean-detail__info-grid">
              {infoItems.map((item) => (
                <View key={item.label} className="bean-detail__info-row">
                  <Text className="bean-detail__info-label">{item.label}</Text>
                  <Text className="bean-detail__info-value">{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {(bean.tastingNotes?.length ?? 0) > 0 && (
          <View className="bean-detail__flavor-card">
            <Text className="bean-detail__section-title">风味描述</Text>
            <View className="bean-detail__flavor-tags">
              {bean.tastingNotes?.map((note) => (
                <Badge key={note} variant="outline" size="md">
                  {note}
                </Badge>
              ))}
            </View>
          </View>
        )}
      </View>

      <View className="bean-detail__bottom-bar">
        <View className="bean-detail__actions">
          <View
            className={`bean-detail__action-btn${favorited ? ' bean-detail__action-btn--active' : ''}`}
            onClick={handleFavorite}
          >
            <Icon name={favorited ? 'heart-filled' : 'heart'} size={20} color={favorited ? '#c85c3d' : '#7b5b45'} />
            <Text className="bean-detail__action-label">收藏</Text>
          </View>

          <Button className="bean-detail__action-btn" openType="share">
            <Icon name="share" size={20} color="#7b5b45" />
            <Text className="bean-detail__action-label">分享</Text>
          </Button>
        </View>

        <View className="bean-detail__purchase-section">
          <View className="bean-detail__purchase-price">
            <Text className="bean-detail__purchase-price-label">价格</Text>
            <Text className="bean-detail__purchase-price-value">¥{displayPrice}</Text>
          </View>

          {purchaseUrl ? (
            <View className="bean-detail__buy-btn" onClick={handlePurchase}>
              <Text className="bean-detail__buy-btn-text">去购买</Text>
            </View>
          ) : (
            <View className="bean-detail__buy-btn bean-detail__buy-btn--disabled">
              <Text className="bean-detail__buy-btn-text">暂无链接</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
