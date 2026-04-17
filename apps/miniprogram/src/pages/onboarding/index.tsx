import { Component } from 'react';
import { View, Text } from '@tarojs/components';

import { setAllBeansEntryIntent } from '../all-beans/entry-intent';
import { reLaunch } from '../../utils/miniprogram-api.ts';
import { getOnboardingProfile, setOnboardingProfile } from '../../utils/storage';
import { createOnboardingFlow } from './onboarding-logic';
import { resolveOnboardingNavigation } from './navigation';
import { ONBOARDING_OPTION_COPY } from './copy';
import './index.scss';

type OnboardingState = {
  selectedLevel: 'beginner' | 'intermediate' | null;
};

export default class Onboarding extends Component<Record<string, never>, OnboardingState> {
  state: OnboardingState = {
    selectedLevel: null,
  };

  private readonly flow = createOnboardingFlow({
    getProfile: getOnboardingProfile,
    setProfile: setOnboardingProfile,
  });

  componentDidMount(): void {
    const redirectUrl = this.flow.getRedirectUrl();
    if (!redirectUrl) return;

    const navigation = resolveOnboardingNavigation({
      url: redirectUrl,
      entryIntent: null,
    });
    reLaunch({ url: navigation.url });
  }

  private handleSelectLevel = (level: 'beginner' | 'intermediate'): void => {
    this.setState({ selectedLevel: level });
  };

  private handleConfirm = (): void => {
    const { selectedLevel } = this.state;
    if (!selectedLevel) return;

    const result = this.flow.complete(selectedLevel);
    const navigation = resolveOnboardingNavigation(result);
    if (navigation.entryIntent) {
      setAllBeansEntryIntent(navigation.entryIntent);
    }
    reLaunch({ url: navigation.url });
  };

  render() {
    const { selectedLevel } = this.state;

    return (
      <View className="onboarding">
        <View className="onboarding__frame">
          <View className="onboarding__hero-visual" />
          <View className="onboarding__hero-wordmark" aria-hidden>
            <Text className="onboarding__hero-wordmark-en">COFFEE</Text>
            <Text className="onboarding__hero-wordmark-atlas">Atlas</Text>
          </View>
          <View className="onboarding__hero-scrim" />
          <View className="onboarding__hero">
            <View className="onboarding__hero-header">
              <View className="onboarding__hero-copy">
                <Text className="onboarding__title">进入咖啡地图</Text>
                <Text className="onboarding__subtitle">
                  从零开始或自由探索
                </Text>
              </View>
            </View>
          </View>

          <View className="onboarding__actions">
            <View
              className={`onboarding__action ${
                selectedLevel === 'beginner'
                  ? 'onboarding__action--selected'
                  : 'onboarding__action--idle'
              }`}
              hoverClass="onboarding__action--active"
              hoverStartTime={20}
              hoverStayTime={70}
              onClick={() => this.handleSelectLevel('beginner')}
            >
              <Text className="onboarding__action-label">{ONBOARDING_OPTION_COPY.beginner.label}</Text>
              <Text className="onboarding__action-meta">{ONBOARDING_OPTION_COPY.beginner.meta}</Text>
            </View>

            <View
              className={`onboarding__action ${
                selectedLevel === 'intermediate'
                  ? 'onboarding__action--selected'
                  : 'onboarding__action--idle'
              }`}
              hoverClass="onboarding__action--active"
              hoverStartTime={20}
              hoverStayTime={70}
              onClick={() => this.handleSelectLevel('intermediate')}
            >
              <Text className="onboarding__action-label">{ONBOARDING_OPTION_COPY.intermediate.label}</Text>
              <Text className="onboarding__action-meta">{ONBOARDING_OPTION_COPY.intermediate.meta}</Text>
            </View>
          </View>

          <View
            className={`onboarding__confirm ${
              selectedLevel ? 'onboarding__confirm--enabled' : 'onboarding__confirm--disabled'
            }`}
            hoverClass={selectedLevel ? 'onboarding__confirm--enabled-active' : ''}
            hoverStartTime={20}
            hoverStayTime={70}
            onClick={this.handleConfirm}
          >
            <Text className="onboarding__confirm-text">开始进入</Text>
          </View>
        </View>
      </View>
    );
  }
}
