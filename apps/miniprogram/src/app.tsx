import { PropsWithChildren, useEffect } from 'react';
import { Text, View } from '@tarojs/components';

import { silentLogin } from './utils/auth';
import { restartOnboarding } from './utils/restart-onboarding';
import { getWindowInfo, reLaunch } from './utils/miniprogram-api';
import { clearOnboardingProfile } from './utils/storage';
import './app.scss';

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    const timer = setTimeout(() => {
      void silentLogin().catch(() => {
        // 静默登录失败不阻断页面渲染
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleRestartOnboarding = () => {
    restartOnboarding({
      clearProfile: clearOnboardingProfile,
      relaunch: (url) => {
        reLaunch({ url });
      },
    });
  };

  const statusBarHeight = getWindowInfo().statusBarHeight ?? 0;

  return (
    <View className="app-shell">
      {children}
      <View
        className="app-shell__restart-onboarding"
        hoverClass="app-shell__restart-onboarding--active"
        hoverStartTime={20}
        hoverStayTime={70}
        style={{ top: `${statusBarHeight + 12}px` }}
        onClick={handleRestartOnboarding}
      >
        <Text className="app-shell__restart-onboarding-text">重新进入冷启动</Text>
      </View>
    </View>
  );
}

export default App;
