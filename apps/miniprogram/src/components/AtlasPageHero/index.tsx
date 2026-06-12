import type { ReactNode } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface AtlasPageHeroProps {
  subtitle?: string;
  children?: ReactNode;
}

const DEFAULT_SUBTITLE = '探索咖啡产地与杯中风味';

export default function AtlasPageHero({ subtitle = DEFAULT_SUBTITLE, children }: AtlasPageHeroProps) {
  return (
    <View className="atlas-page-hero">
      <View className="atlas-page-hero__brand">
        <Text className="atlas-page-hero__title-en">COFFEE</Text>
        <Text className="atlas-page-hero__title-atlas">Atlas</Text>
      </View>
      <Text className="atlas-page-hero__subtitle">{subtitle}</Text>
      {children ? <View className="atlas-page-hero__extra">{children}</View> : null}
    </View>
  );
}
