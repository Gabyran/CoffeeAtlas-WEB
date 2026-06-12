import { View } from '@tarojs/components';
import './index.scss';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
}

export default function Progress({ value, max = 100, className = '' }: ProgressProps) {
  const percent = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;

  return (
    <View className={`ui-progress ${className}`}>
      <View className="ui-progress__fill" style={{ width: `${percent}%` }} />
    </View>
  );
}
