import { View, Text } from '@tarojs/components';
import Icon from '../Icon';
import './index.scss';

interface EmptyStateProps {
  message?: string;
  icon?: 'coffee' | 'search';
}

export default function EmptyState({ message = '暂无数据', icon = 'coffee' }: EmptyStateProps) {
  return (
    <View className="empty-state">
      <View className="empty-state__icon-wrap">
        <Icon name={icon} size={56} color="rgba(139,90,43,0.18)" />
      </View>
      <Text className="empty-state__text">{message}</Text>
    </View>
  );
}
