import type { ReactNode } from 'react';
import { View, Image, Text } from '@tarojs/components';
import './index.scss';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: ReactNode;
  size?: AvatarSize;
  className?: string;
}

export default function Avatar({ src, alt, fallback, size = 'md', className = '' }: AvatarProps) {
  const classes = ['ui-avatar', `ui-avatar--${size}`, className].filter(Boolean).join(' ');
  const showFallback = !src;

  return (
    <View className={classes}>
      {showFallback ? (
        <View className="ui-avatar__fallback">
          {fallback ?? <Text className="ui-avatar__fallback-text">{alt?.charAt(0)?.toUpperCase() || '?'}</Text>}
        </View>
      ) : (
        <Image src={src!} mode="aspectFill" className="ui-avatar__image" />
      )}
    </View>
  );
}
