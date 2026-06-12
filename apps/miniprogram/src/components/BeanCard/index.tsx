import { View, Image, Text } from '@tarojs/components';
import type { CoffeeBean } from '../../types';
import { formatSalesCount } from '../../utils/formatters';
import { navigateTo } from '../../utils/miniprogram-api';
import Icon from '../Icon';
import { Badge } from '../ui';
import './index.scss';

interface BeanCardProps {
  bean: CoffeeBean;
  index?: number;
}

export default function BeanCard({ bean, index = 0 }: BeanCardProps) {
  const salesLabel = formatSalesCount(bean.salesCount);
  const roasterName = bean.roasterName?.trim() || '';
  const originInfo = [bean.originCountry, bean.originRegion].filter(Boolean).join(' · ');
  const detailInfo = [bean.farm, bean.variety].filter(Boolean).join(' · ');
  const displayPrice = bean.discountedPrice ?? bean.price;
  const hasDiscount = bean.discountedPrice != null && bean.discountedPrice < bean.price;

  const handleTap = () => {
    navigateTo({ url: `/pages/bean-detail/index?id=${bean.id}` });
  };

  const delayStyle = index < 5 ? { animationDelay: `${index * 0.05}s` } : {};

  return (
    <View className="bean-card" style={delayStyle} hoverClass="bean-card-active" hoverStartTime={20} hoverStayTime={70} onClick={handleTap}>
      <View className="bean-card__media">
        {bean.imageUrl ? (
          <Image src={bean.imageUrl} mode="aspectFill" lazyLoad className="bean-card__image" />
        ) : (
          <View className="bean-card__placeholder">
            <Icon name="coffee" size={56} color="rgba(139,90,43,0.18)" />
          </View>
        )}
        {bean.isNewArrival && (
          <View className="bean-card__new-badge">
            <Text className="bean-card__new-badge-text">NEW</Text>
          </View>
        )}
      </View>

      <View className="bean-card__content">
        <View className="bean-card__header">
          {roasterName && <Text className="bean-card__roaster">{roasterName}</Text>}
          <Text className="bean-card__name" numberOfLines={1}>
            {bean.name}
          </Text>
          {originInfo && (
            <Text className="bean-card__origin" numberOfLines={1}>
              {originInfo}
            </Text>
          )}
        </View>

        {detailInfo && (
          <Text className="bean-card__detail" numberOfLines={1}>
            {detailInfo}
          </Text>
        )}

        <View className="bean-card__meta">
          {bean.process && (
            <View className="bean-card__process">
              <Text className="bean-card__process-label">处理法</Text>
              <Text className="bean-card__process-value">{bean.process}</Text>
            </View>
          )}
        </View>

        <View className="bean-card__footer">
          <View className="bean-card__badges">
            {salesLabel && <Badge variant="secondary" size="sm">{salesLabel}</Badge>}
          </View>
          <View className="bean-card__price-section">
            {hasDiscount && <Text className="bean-card__original-price">¥{bean.price}</Text>}
            <Text className="bean-card__price">¥{displayPrice}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
