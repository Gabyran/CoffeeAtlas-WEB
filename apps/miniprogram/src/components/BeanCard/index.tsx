import { View, Image, Text } from '@tarojs/components';
import type { CoffeeBean } from '../../types';
import { formatSalesCount } from '../../utils/formatters';
import { navigateTo } from '../../utils/miniprogram-api';
import Icon from '../Icon';
import './index.scss';

interface BeanCardProps {
  bean: CoffeeBean;
  index?: number;
}

export default function BeanCard({ bean, index = 0 }: BeanCardProps) {
  const salesLabel = formatSalesCount(bean.salesCount);
  const line1 = [bean.roasterName, bean.originCountry].filter(Boolean).join(' · ');
  const line2 = [bean.originRegion, bean.farm, bean.variety].filter(Boolean).join(' · ');
  const displayPrice = bean.discountedPrice ?? bean.price;

  const handleTap = () => {
    navigateTo({ url: `/pages/bean-detail/index?id=${bean.id}` });
  };

  const delayStyle = index < 5 ? { animationDelay: `${index * 0.05}s` } : {};

  return (
    <View className="bean-card" style={delayStyle} hoverClass="bean-card-active" hoverStartTime={20} hoverStayTime={70} onClick={handleTap}>
      <View className="bean-card__image">
        {bean.imageUrl ? (
          <Image
            src={bean.imageUrl}
            mode="aspectFill"
            lazyLoad
            className="bean-card__img"
          />
        ) : (
          <View className="bean-card__placeholder">
            <Icon name="coffee" size={64} color="rgba(139,90,43,0.2)" />
          </View>
        )}
        {bean.isNewArrival && <View className="bean-card__badge">新品</View>}
      </View>
      <View className="bean-card__body">
        <View className="bean-card__meta">
          <View className="bean-card__titles">
            <Text className="bean-card__line1">{line1}</Text>
            {line2 ? <Text className="bean-card__line2">{line2}</Text> : null}
          </View>
          <View className="bean-card__tags">
            {salesLabel && <Text className="bean-card__tag bean-card__tag--sales">{salesLabel}</Text>}
            {displayPrice > 0 && (
              <Text className="bean-card__tag bean-card__tag--price">¥{displayPrice}</Text>
            )}
          </View>
        </View>
        <View className="bean-card__footer">
          <Text className="bean-card__label">处理法</Text>
          <Text className="bean-card__value">{bean.process || '-'}</Text>
        </View>
      </View>
    </View>
  );
}
