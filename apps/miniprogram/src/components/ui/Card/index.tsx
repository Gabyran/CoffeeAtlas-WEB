import type { ReactNode } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

type CardVariant = 'default' | 'elevated' | 'outlined' | 'glass';
type CardSize = 'sm' | 'md' | 'lg';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  size?: CardSize;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  onClick,
  hoverable = false,
}: CardProps) {
  const classes = [
    'ui-card',
    `ui-card--${variant}`,
    `ui-card--${size}`,
    hoverable ? 'ui-card--hoverable' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View
      className={classes}
      hoverClass={hoverable ? 'ui-card--active' : ''}
      hoverStartTime={20}
      hoverStayTime={70}
      onClick={onClick}
    >
      {children}
    </View>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return <View className={`ui-card__header ${className}`}>{children}</View>;
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return <Text className={`ui-card__title ${className}`}>{children}</Text>;
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return <Text className={`ui-card__description ${className}`}>{children}</Text>;
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <View className={`ui-card__content ${className}`}>{children}</View>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return <View className={`ui-card__footer ${className}`}>{children}</View>;
}

export default Card;
