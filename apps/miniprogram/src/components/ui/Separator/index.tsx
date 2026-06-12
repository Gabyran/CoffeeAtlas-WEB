import { View } from '@tarojs/components';
import './index.scss';

type SeparatorOrientation = 'horizontal' | 'vertical';

interface SeparatorProps {
  orientation?: SeparatorOrientation;
  decorative?: boolean;
  className?: string;
}

export default function Separator({ orientation = 'horizontal', decorative = true, className = '' }: SeparatorProps) {
  const classes = [
    'ui-separator',
    `ui-separator--${orientation}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <View className={classes} aria-hidden={decorative} />;
}
