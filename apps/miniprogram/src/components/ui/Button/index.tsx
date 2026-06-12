import type { ReactNode } from 'react';
import { View, Text, Button as TaroButton } from '@tarojs/components';
import './index.scss';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  openType?: 'share' | 'getUserInfo' | 'contact' | 'getPhoneNumber';
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  disabled = false,
  loading = false,
  fullWidth = false,
  openType,
}: ButtonProps) {
  const classes = [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    fullWidth ? 'ui-button--full' : '',
    disabled ? 'ui-button--disabled' : '',
    loading ? 'ui-button--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (openType) {
    return (
      <TaroButton className={classes} openType={openType} disabled={disabled || loading}>
        {children}
      </TaroButton>
    );
  }

  return (
    <View
      className={classes}
      hoverClass="ui-button--active"
      hoverStartTime={20}
      hoverStayTime={70}
      onClick={disabled || loading ? undefined : onClick}
    >
      {loading && <View className="ui-button__spinner" />}
      {children}
    </View>
  );
}

interface ButtonLabelProps {
  children: ReactNode;
  className?: string;
}

export function ButtonLabel({ children, className = '' }: ButtonLabelProps) {
  return <Text className={`ui-button__label ${className}`}>{children}</Text>;
}
