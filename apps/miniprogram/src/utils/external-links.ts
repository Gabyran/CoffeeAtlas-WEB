import Taro from '@tarojs/taro';
import { setClipboardData, showToast } from './miniprogram-api.ts';

function copyLink(url: string, label: string): void {
  setClipboardData({
    data: url,
    success: () => {
      showToast({
        title: `${label}链接已复制`,
        icon: 'none',
      });
    },
    fail: () => {
      showToast({
        title: `请手动复制${label}链接`,
        icon: 'none',
      });
    },
  });
}

export function openExternalLink(url: string, label: string): void {
  const normalized = url.trim();
  if (!normalized) {
    showToast({
      title: `${label}链接暂不可用`,
      icon: 'none',
    });
    return;
  }

  if (Taro.getEnv() === Taro.ENV_TYPE.WEB && typeof window !== 'undefined') {
    window.open(normalized, '_blank', 'noopener,noreferrer');
    showToast({
      title: `已打开${label}`,
      icon: 'none',
    });
    return;
  }

  copyLink(normalized, label);
}
