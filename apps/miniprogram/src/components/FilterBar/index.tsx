import { ScrollView, View } from '@tarojs/components';
import { Chip } from '../ui';
import './index.scss';

export interface FilterOption {
  label: string;
  value: string;
}

export const PROCESS_OPTIONS: FilterOption[] = [
  { label: '水洗', value: '水洗' },
  { label: '日晒', value: '日晒' },
  { label: '蜜处理', value: '蜜处理' },
  { label: '厌氧', value: '厌氧' },
  { label: '湿刨', value: '湿刨' },
];

export const ROAST_OPTIONS: FilterOption[] = [
  { label: '浅烘', value: '浅' },
  { label: '中浅烘', value: '中浅' },
  { label: '中烘', value: '中烘' },
  { label: '中深烘', value: '中深' },
  { label: '深烘', value: '深' },
];

interface FilterBarProps {
  processValue: string;
  roastValue: string;
  onProcessChange: (v: string) => void;
  onRoastChange: (v: string) => void;
}

export default function FilterBar({ processValue, roastValue, onProcessChange, onRoastChange }: FilterBarProps) {
  return (
    <View className="filter-bar">
      <ScrollView scrollX className="filter-bar__row">
        <View className="filter-bar__group">
          {PROCESS_OPTIONS.map((opt) => {
            const active = processValue === opt.value;
            return (
              <Chip
                key={opt.value}
                variant={active ? 'active' : 'default'}
                onClick={() => onProcessChange(active ? '' : opt.value)}
              >
                {opt.label}
              </Chip>
            );
          })}
          <View className="filter-bar__divider" />
          {ROAST_OPTIONS.map((opt) => {
            const active = roastValue === opt.value;
            return (
              <Chip
                key={opt.value}
                variant={active ? 'active' : 'default'}
                onClick={() => onRoastChange(active ? '' : opt.value)}
              >
                {opt.label}
              </Chip>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
