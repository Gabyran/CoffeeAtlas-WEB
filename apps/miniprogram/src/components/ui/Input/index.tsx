import { View, Input as TaroInput } from '@tarojs/components';
import Icon from '../../Icon';
import './index.scss';

interface InputProps {
  value: string;
  placeholder?: string;
  onInput: (value: string) => void;
  icon?: string;
  className?: string;
}

export default function Input({ value, placeholder = '', onInput, className = '' }: InputProps) {
  return (
    <View className={`ui-input ${className}`}>
      <Icon name="search" size={18} color="rgba(139, 115, 85, 0.6)" className="ui-input__icon" />
      <TaroInput
        className="ui-input__field"
        value={value}
        placeholder={placeholder}
        placeholderClass="ui-input__placeholder"
        onInput={(e) => onInput(e.detail.value)}
      />
    </View>
  );
}
