import type { ReactNode } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

type ChipVariant = 'default' | 'active' | 'outline';

interface ChipProps {
  children: ReactNode;
  variant?: ChipVariant;
  count?: number;
  className?: string;
  onClick?: () => void;
}

export default function Chip({ children, variant = 'default', count, className = '', onClick }: ChipProps) {
  const classes = ['ui-chip', `ui-chip--${variant}`, className].filter(Boolean).join(' ');

  return (
    <View
      className={classes}
      hoverClass="ui-chip--pressed"
      hoverStartTime={20}
      hoverStayTime={70}
      onClick={onClick}
    >
      <Text className="ui-chip__label">{children}</Text>
      {count != null && <Text className="ui-chip__count">{count}</Text>}
    </View>
  );
}
