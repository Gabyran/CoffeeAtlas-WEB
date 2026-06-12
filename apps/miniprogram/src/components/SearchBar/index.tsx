import { View, Input as TaroInput } from '@tarojs/components';
import Icon from '../Icon';
import './index.scss';

interface SearchBarProps {
  value: string;
  placeholder?: string;
  onInput: (value: string) => void;
}

export default function SearchBar({ value, placeholder = '搜索咖啡豆...', onInput }: SearchBarProps) {
  return (
    <View className="search-bar">
      <Icon name="search" size={18} color="rgba(139, 115, 85, 0.6)" className="search-bar__icon" />
      <TaroInput
        className="search-bar__input"
        value={value}
        placeholder={placeholder}
        placeholderClass="search-bar__placeholder"
        onInput={(e) => onInput(e.detail.value)}
      />
    </View>
  );
}
