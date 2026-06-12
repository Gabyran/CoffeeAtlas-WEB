import { ScrollView, Text, View } from '@tarojs/components';
import { Chip } from '../ui';
import type { NewArrivalFilterOption, NewArrivalFiltersMode } from '../../types';
import './index.scss';

interface NewArrivalFilterBarProps {
  mode: NewArrivalFiltersMode;
  roasterOptions: NewArrivalFilterOption[];
  processOptions: NewArrivalFilterOption[];
  originOptions: NewArrivalFilterOption[];
  selectedRoasterId: string;
  selectedProcess: string;
  selectedOriginCountry: string;
  onRoasterChange: (value: string) => void;
  onProcessChange: (value: string) => void;
  onOriginChange: (value: string) => void;
}

function getModeLabel(mode: NewArrivalFiltersMode) {
  switch (mode) {
    case 'personalized':
      return '基于你的收藏';
    case 'mixed':
      return '收藏 + 热门新品';
    case 'fallback':
    default:
      return '热门新品';
  }
}

function FilterGroup({
  title,
  options,
  selectedValue,
  onChange,
}: {
  title: string;
  options: NewArrivalFilterOption[];
  selectedValue: string;
  onChange: (value: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <View className="new-arrival-filter-bar__group">
      <Text className="new-arrival-filter-bar__group-title">{title}</Text>
      <ScrollView scrollX className="new-arrival-filter-bar__row">
        <View className="new-arrival-filter-bar__chips">
          {options.map((option) => {
            const active = selectedValue === option.id;
            return (
              <Chip
                key={option.id}
                variant={active ? 'active' : 'default'}
                count={option.count}
                onClick={() => onChange(active ? '' : option.id)}
              >
                {option.label}
              </Chip>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export default function NewArrivalFilterBar({
  mode,
  roasterOptions,
  processOptions,
  originOptions,
  selectedRoasterId,
  selectedProcess,
  selectedOriginCountry,
  onRoasterChange,
  onProcessChange,
  onOriginChange,
}: NewArrivalFilterBarProps) {
  return (
    <View className="new-arrival-filter-bar">
      <View className="new-arrival-filter-bar__header">
        <Text className="new-arrival-filter-bar__title">猜你喜欢筛选</Text>
        <Text className="new-arrival-filter-bar__meta">{getModeLabel(mode)}</Text>
      </View>

      <FilterGroup title="烘焙商" options={roasterOptions} selectedValue={selectedRoasterId} onChange={onRoasterChange} />
      <FilterGroup title="处理法" options={processOptions} selectedValue={selectedProcess} onChange={onProcessChange} />
      <FilterGroup title="产地" options={originOptions} selectedValue={selectedOriginCountry} onChange={onOriginChange} />
    </View>
  );
}
