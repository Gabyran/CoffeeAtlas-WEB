import type { ReactNode } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export default function Sheet({ open, onClose, children, title }: SheetProps) {
  if (!open) return null;

  return (
    <View className="ui-sheet-mask" onClick={onClose}>
      <View className="ui-sheet" onClick={(e) => e.stopPropagation()}>
        <View className="ui-sheet__handle" />
        {title && <Text className="ui-sheet__title">{title}</Text>}
        <View className="ui-sheet__content">{children}</View>
      </View>
    </View>
  );
}
