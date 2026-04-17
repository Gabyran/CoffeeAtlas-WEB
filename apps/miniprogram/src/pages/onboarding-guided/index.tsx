import { Component } from 'react';
import { Text, View } from '@tarojs/components';

import { getBeanDiscover } from '../../services/api';
import type { BeanDiscoverPayload, DiscoverContinentId, ProcessBaseId, ProcessStyleId } from '../../types';
import { ORIGIN_ATLAS_COUNTRY_MAP } from '../../utils/origin-atlas';
import { reLaunch, showToast } from '../../utils/miniprogram-api.ts';
import { setAllBeansEntryIntent } from '../all-beans/entry-intent';
import {
  buildGuidedDiscoverStep,
  GUIDED_CONTINENT_CHOICES,
  GUIDED_PROCESS_CHOICES,
  GUIDED_PROCESS_STYLE_CHOICES,
  resolveGuidedContinentSelection,
  resolveGuidedProcessSelection,
  resolveGuidedProcessStyleSelection,
} from '../all-beans/guided-discover';
import { setAllBeansGuidedSeed } from '../all-beans/guided-seed';
import { ONBOARDING_ALL_BEANS_URL } from '../onboarding/onboarding-logic';
import './index.scss';

const ALL_DISCOVER_VALUE = 'all';
const SEARCH_DEBOUNCE_MS = 250;

type DiscoverContinentKey = DiscoverContinentId | 'all';

type OnboardingGuidedState = {
  selectedProcessBase: string;
  selectedProcessStyle: string;
  selectedContinent: DiscoverContinentKey;
  selectedCountry: string;
  selectedVariety: string;
  discoverPayload: BeanDiscoverPayload | null;
  discoverLoading: boolean;
  discoverError: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '加载失败';
}

function hasSelectionChanged(
  prevState: OnboardingGuidedState,
  nextState: OnboardingGuidedState
): boolean {
  return (
    prevState.selectedProcessBase !== nextState.selectedProcessBase ||
    prevState.selectedProcessStyle !== nextState.selectedProcessStyle ||
    prevState.selectedContinent !== nextState.selectedContinent ||
    prevState.selectedCountry !== nextState.selectedCountry ||
    prevState.selectedVariety !== nextState.selectedVariety
  );
}

export default class OnboardingGuided extends Component<Record<string, never>, OnboardingGuidedState> {
  state: OnboardingGuidedState = {
    selectedProcessBase: ALL_DISCOVER_VALUE,
    selectedProcessStyle: ALL_DISCOVER_VALUE,
    selectedContinent: ALL_DISCOVER_VALUE,
    selectedCountry: ALL_DISCOVER_VALUE,
    selectedVariety: ALL_DISCOVER_VALUE,
    discoverPayload: null,
    discoverLoading: false,
    discoverError: '',
  };

  private requestVersion = 0;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;

  componentDidMount(): void {
    this.scheduleLoadDiscoverPayload();
  }

  componentDidUpdate(
    _prevProps: Record<string, never>,
    prevState: OnboardingGuidedState
  ): void {
    if (hasSelectionChanged(prevState, this.state)) {
      this.scheduleLoadDiscoverPayload();
    }

    if (
      prevState.discoverPayload !== this.state.discoverPayload ||
      hasSelectionChanged(prevState, this.state)
    ) {
      this.reconcileSelections();
    }
  }

  componentWillUnmount(): void {
    if (this.loadTimer) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
    this.requestVersion += 1;
  }

  private scheduleLoadDiscoverPayload(): void {
    if (this.loadTimer) {
      clearTimeout(this.loadTimer);
    }

    this.loadTimer = setTimeout(() => {
      void this.loadDiscoverPayload();
    }, SEARCH_DEBOUNCE_MS);
  }

  private async loadDiscoverPayload(): Promise<void> {
    const requestVersion = this.requestVersion + 1;
    this.requestVersion = requestVersion;

    this.setState({
      discoverLoading: true,
      discoverError: '',
    });

    try {
      const {
        selectedProcessBase,
        selectedProcessStyle,
        selectedContinent,
        selectedCountry,
        selectedVariety,
      } = this.state;

      const response = await getBeanDiscover({
        processBase:
          selectedProcessBase !== ALL_DISCOVER_VALUE ? (selectedProcessBase as ProcessBaseId) : undefined,
        processStyle:
          selectedProcessStyle !== ALL_DISCOVER_VALUE ? (selectedProcessStyle as ProcessStyleId) : undefined,
        continent: selectedContinent !== ALL_DISCOVER_VALUE ? selectedContinent : undefined,
        country: selectedCountry !== ALL_DISCOVER_VALUE ? selectedCountry : undefined,
        variety: selectedVariety !== ALL_DISCOVER_VALUE ? selectedVariety : undefined,
      });

      if (requestVersion !== this.requestVersion) return;

      this.setState({
        discoverPayload: response,
      });
    } catch (error) {
      if (requestVersion !== this.requestVersion) return;

      this.setState({
        discoverError: getErrorMessage(error),
      });
      showToast({ title: '探索加载失败', icon: 'none' });
    } finally {
      if (requestVersion === this.requestVersion) {
        this.setState({
          discoverLoading: false,
        });
      }
    }
  }

  private reconcileSelections(): void {
    const {
      discoverPayload,
      selectedProcessBase,
      selectedProcessStyle,
      selectedContinent,
      selectedCountry,
      selectedVariety,
    } = this.state;

    if (!discoverPayload) return;

    if (
      selectedProcessBase !== ALL_DISCOVER_VALUE &&
      !discoverPayload.processBaseOptions.some((option) => option.id === selectedProcessBase)
    ) {
      this.setState({
        selectedProcessBase: ALL_DISCOVER_VALUE,
        selectedProcessStyle: ALL_DISCOVER_VALUE,
        selectedContinent: ALL_DISCOVER_VALUE,
        selectedCountry: ALL_DISCOVER_VALUE,
        selectedVariety: ALL_DISCOVER_VALUE,
      });
      return;
    }

    if (
      selectedProcessStyle !== ALL_DISCOVER_VALUE &&
      !discoverPayload.processStyleOptions.some((option) => option.id === selectedProcessStyle)
    ) {
      this.setState({
        selectedProcessStyle: ALL_DISCOVER_VALUE,
        selectedContinent: ALL_DISCOVER_VALUE,
        selectedCountry: ALL_DISCOVER_VALUE,
        selectedVariety: ALL_DISCOVER_VALUE,
      });
      return;
    }

    if (
      selectedContinent !== ALL_DISCOVER_VALUE &&
      !discoverPayload.continentOptions.some((option) => option.id === selectedContinent)
    ) {
      this.setState({
        selectedContinent: ALL_DISCOVER_VALUE,
        selectedCountry: ALL_DISCOVER_VALUE,
        selectedVariety: ALL_DISCOVER_VALUE,
      });
      return;
    }

    if (
      selectedCountry !== ALL_DISCOVER_VALUE &&
      !discoverPayload.countryOptions.some((option) => option.label === selectedCountry)
    ) {
      this.setState({
        selectedCountry: ALL_DISCOVER_VALUE,
        selectedVariety: ALL_DISCOVER_VALUE,
      });
      return;
    }

    if (
      selectedVariety !== ALL_DISCOVER_VALUE &&
      !discoverPayload.varietyOptions.some((option) => option.label === selectedVariety)
    ) {
      this.setState({
        selectedVariety: ALL_DISCOVER_VALUE,
      });
    }
  }

  private handleGuidedProcessAnswer = (choice: (typeof GUIDED_PROCESS_CHOICES)[number]['id']): void => {
    const { discoverPayload } = this.state;
    if (!discoverPayload || discoverPayload.processBaseOptions.length === 0) return;

    const selection = resolveGuidedProcessSelection(choice, discoverPayload.processBaseOptions);
    if (!selection) {
      showToast({ title: '当前没有匹配的基础处理法方向', icon: 'none' });
      return;
    }

    this.setState({
      selectedProcessBase: selection.id,
      selectedProcessStyle: ALL_DISCOVER_VALUE,
      selectedContinent: ALL_DISCOVER_VALUE,
      selectedCountry: ALL_DISCOVER_VALUE,
      selectedVariety: ALL_DISCOVER_VALUE,
    });
  };

  private handleGuidedProcessStyleAnswer = (choice: (typeof GUIDED_PROCESS_STYLE_CHOICES)[number]['id']): void => {
    const { discoverPayload } = this.state;
    if (!discoverPayload || discoverPayload.processStyleOptions.length === 0) return;

    const selection = resolveGuidedProcessStyleSelection(choice, discoverPayload.processStyleOptions);
    if (!selection) {
      showToast({ title: '当前没有匹配的处理风格方向', icon: 'none' });
      return;
    }

    this.setState({
      selectedProcessStyle: selection.id,
      selectedContinent: ALL_DISCOVER_VALUE,
      selectedCountry: ALL_DISCOVER_VALUE,
      selectedVariety: ALL_DISCOVER_VALUE,
    });
  };

  private handleGuidedContinentAnswer = (choice: (typeof GUIDED_CONTINENT_CHOICES)[number]['id']): void => {
    const { discoverPayload } = this.state;
    if (!discoverPayload || discoverPayload.continentOptions.length === 0) return;

    const selection = resolveGuidedContinentSelection(choice, discoverPayload.continentOptions);
    if (!selection) {
      showToast({ title: '当前没有匹配的大洲方向', icon: 'none' });
      return;
    }

    this.setState({
      selectedContinent: selection.id as DiscoverContinentId,
      selectedCountry: ALL_DISCOVER_VALUE,
      selectedVariety: ALL_DISCOVER_VALUE,
    });
  };

  private handleCountrySelect = (value: string): void => {
    const atlasCountry = ORIGIN_ATLAS_COUNTRY_MAP.get(value) ?? null;
    this.setState({
      selectedContinent: atlasCountry ? atlasCountry.continentId : this.state.selectedContinent,
      selectedCountry: value,
      selectedVariety: ALL_DISCOVER_VALUE,
    });
  };

  private handleVarietySelect = (value: string): void => {
    this.setState({
      selectedVariety: value,
    });
  };

  private handleRestart = (): void => {
    this.setState({
      selectedProcessBase: ALL_DISCOVER_VALUE,
      selectedProcessStyle: ALL_DISCOVER_VALUE,
      selectedContinent: ALL_DISCOVER_VALUE,
      selectedCountry: ALL_DISCOVER_VALUE,
      selectedVariety: ALL_DISCOVER_VALUE,
    });
  };

  private handleConfirm = (): void => {
    const {
      selectedProcessBase,
      selectedProcessStyle,
      selectedContinent,
      selectedCountry,
      selectedVariety,
    } = this.state;

    const guidedDiscoverStep = buildGuidedDiscoverStep({
      selectedProcessBase,
      selectedProcessStyle,
      selectedContinent,
      selectedCountry,
      selectedVariety,
    });
    const canFinish = guidedDiscoverStep.step === 'done' || guidedDiscoverStep.step === 'variety';

    if (!canFinish) return;

    setAllBeansGuidedSeed({
      processBase: selectedProcessBase !== ALL_DISCOVER_VALUE ? selectedProcessBase : null,
      processStyle: selectedProcessStyle !== ALL_DISCOVER_VALUE ? selectedProcessStyle : null,
      continent: selectedContinent !== ALL_DISCOVER_VALUE ? selectedContinent : null,
      country: selectedCountry !== ALL_DISCOVER_VALUE ? selectedCountry : null,
      variety: selectedVariety !== ALL_DISCOVER_VALUE ? selectedVariety : null,
    });
    setAllBeansEntryIntent('guided');
    reLaunch({ url: ONBOARDING_ALL_BEANS_URL });
  };

  render() {
    const {
      selectedProcessBase,
      selectedProcessStyle,
      selectedContinent,
      selectedCountry,
      selectedVariety,
      discoverPayload,
      discoverError,
    } = this.state;

    const guidedDiscoverStep = buildGuidedDiscoverStep({
      selectedProcessBase,
      selectedProcessStyle,
      selectedContinent,
      selectedCountry,
      selectedVariety,
    });

    const visibleGuidedProcessStyleChoices =
      !discoverPayload || discoverPayload.processStyleOptions.length === 0
        ? []
        : GUIDED_PROCESS_STYLE_CHOICES.filter((choice) =>
            Boolean(resolveGuidedProcessStyleSelection(choice.id, discoverPayload.processStyleOptions))
          );

    const canFinish = guidedDiscoverStep.step === 'done' || guidedDiscoverStep.step === 'variety';

    return (
      <View className="onboarding-guided">
        <View className="onboarding-guided__frame">
          <View className="onboarding-guided__header">
            <Text className="onboarding-guided__title">{guidedDiscoverStep.title}</Text>
            <Text className="onboarding-guided__description">{guidedDiscoverStep.description}</Text>
          </View>

          <View className="onboarding-guided__body">
            {discoverError ? <Text className="onboarding-guided__hint">{discoverError}</Text> : null}

            {guidedDiscoverStep.step === 'process_base' ? (
              discoverPayload && discoverPayload.processBaseOptions.length > 0 ? (
                <View className="onboarding-guided__choices">
                  {GUIDED_PROCESS_CHOICES.map((choice) => (
                    <View
                      key={choice.id}
                      className="onboarding-guided__choice"
                      hoverClass="onboarding-guided__choice--active"
                      hoverStartTime={20}
                      hoverStayTime={70}
                      onClick={() => this.handleGuidedProcessAnswer(choice.id)}
                    >
                      <Text className="onboarding-guided__choice-title">{choice.title}</Text>
                      <Text className="onboarding-guided__choice-description">{choice.description}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="onboarding-guided__hint">正在准备基础处理法选项...</Text>
              )
            ) : null}

            {guidedDiscoverStep.step === 'process_style' ? (
              discoverPayload && visibleGuidedProcessStyleChoices.length > 0 ? (
                <View className="onboarding-guided__choices">
                  {visibleGuidedProcessStyleChoices.map((choice) => (
                    <View
                      key={choice.id}
                      className="onboarding-guided__choice"
                      hoverClass="onboarding-guided__choice--active"
                      hoverStartTime={20}
                      hoverStayTime={70}
                      onClick={() => this.handleGuidedProcessStyleAnswer(choice.id)}
                    >
                      <Text className="onboarding-guided__choice-title">{choice.title}</Text>
                      <Text className="onboarding-guided__choice-description">{choice.description}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="onboarding-guided__hint">正在准备处理风格选项...</Text>
              )
            ) : null}

            {guidedDiscoverStep.step === 'continent' ? (
              discoverPayload && discoverPayload.continentOptions.length > 0 ? (
                <View className="onboarding-guided__choices">
                  {GUIDED_CONTINENT_CHOICES.map((choice) => (
                    <View
                      key={choice.id}
                      className="onboarding-guided__choice"
                      hoverClass="onboarding-guided__choice--active"
                      hoverStartTime={20}
                      hoverStayTime={70}
                      onClick={() => this.handleGuidedContinentAnswer(choice.id)}
                    >
                      <Text className="onboarding-guided__choice-title">{choice.title}</Text>
                      <Text className="onboarding-guided__choice-description">{choice.description}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="onboarding-guided__hint">正在准备大洲选项...</Text>
              )
            ) : null}

            {guidedDiscoverStep.step === 'country' ? (
              discoverPayload ? (
                discoverPayload.countryOptions.length > 0 ? (
                  <View className="onboarding-guided__choices">
                    {discoverPayload.countryOptions.map((option) => (
                      <View
                        key={option.id}
                        className="onboarding-guided__choice"
                        hoverClass="onboarding-guided__choice--active"
                        hoverStartTime={20}
                        hoverStayTime={70}
                        onClick={() => this.handleCountrySelect(option.label)}
                      >
                        <Text className="onboarding-guided__choice-title">{option.label}</Text>
                        <Text className="onboarding-guided__choice-description">{`${option.count} 款可选豆子`}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="onboarding-guided__hint">这个大洲下暂时没有可继续缩小的国家结果，可以直接往下浏览当前结果。</Text>
                )
              ) : (
                <Text className="onboarding-guided__hint">正在准备国家选项...</Text>
              )
            ) : null}

            {guidedDiscoverStep.step === 'variety' ? (
              discoverPayload ? (
                discoverPayload.varietyOptions.length > 0 ? (
                  <>
                    <View className="onboarding-guided__choices">
                      {discoverPayload.varietyOptions.slice(0, 6).map((option) => (
                        <View
                          key={option.id}
                          className="onboarding-guided__choice"
                          hoverClass="onboarding-guided__choice--active"
                          hoverStartTime={20}
                          hoverStayTime={70}
                          onClick={() => this.handleVarietySelect(option.label)}
                        >
                          <Text className="onboarding-guided__choice-title">{option.label}</Text>
                          <Text className="onboarding-guided__choice-description">{`${option.count} 款可选豆子`}</Text>
                        </View>
                      ))}
                    </View>
                    <Text className="onboarding-guided__secondary" onClick={this.handleConfirm}>
                      跳过
                    </Text>
                  </>
                ) : (
                  <Text className="onboarding-guided__hint">当前路径下暂时没有可继续细分的豆种，可以直接查看结果。</Text>
                )
              ) : (
                <Text className="onboarding-guided__hint">正在准备豆种选项...</Text>
              )
            ) : null}

            {guidedDiscoverStep.step === 'done' ? (
              <Text className="onboarding-guided__secondary" onClick={this.handleRestart}>
                重新回答
              </Text>
            ) : null}
          </View>

          <View
            className={`onboarding-guided__confirm ${
              canFinish ? 'onboarding-guided__confirm--enabled' : 'onboarding-guided__confirm--disabled'
            }`}
            hoverClass={canFinish ? 'onboarding-guided__confirm--enabled-active' : ''}
            hoverStartTime={20}
            hoverStayTime={70}
            onClick={this.handleConfirm}
          >
            <Text className="onboarding-guided__confirm-text">开始进入</Text>
          </View>
        </View>
      </View>
    );
  }
}
