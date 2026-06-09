import type { AllBeansLandingMode } from './route-params.ts';

const ALL_DISCOVER_VALUE = 'all';

export type GuidedProcessChoiceId = 'clean' | 'fruity' | 'sweet';
export type GuidedProcessStyleChoiceId = 'classic' | 'anaerobic' | 'experimental';
export type GuidedContinentChoiceId = 'floral' | 'balanced' | 'bold';

export interface GuidedDiscoverOption {
  id: string;
  label: string;
}

export interface GuidedDiscoverStepInput {
  selectedProcessBase: string;
  selectedProcessStyle: string;
  selectedContinent: string;
  selectedCountry: string;
}

export interface GuidedDiscoverStep {
  step: 'process_base' | 'process_style' | 'continent' | 'done';
  title: string;
  description: string;
}

export interface GuidedProcessChoice {
  id: GuidedProcessChoiceId;
  title: string;
  description: string;
}

export interface GuidedProcessStyleChoice {
  id: GuidedProcessStyleChoiceId;
  title: string;
  description: string;
}

export interface GuidedContinentChoice {
  id: GuidedContinentChoiceId;
  title: string;
  description: string;
}

export const GUIDED_PROCESS_CHOICES: GuidedProcessChoice[] = [
  { id: 'clean', title: '清爽干净', description: '水洗处理：干净明亮，酸质清稀。' },
  { id: 'fruity', title: '果香馥郁', description: '日晒处理：具有果汁感和发酵甜感。' },
  { id: 'sweet', title: '酸甜圆润', description: '蜜处理：甜感和酸质共存。' },
];

export const GUIDED_PROCESS_STYLE_CHOICES: GuidedProcessStyleChoice[] = [
  { id: 'classic', title: '传统一点', description: '先看传统风格，更容易建立稳定印象。' },
  { id: 'anaerobic', title: '想试厌氧', description: '直接把结果缩到厌氧路线，风味会更跳一点。' },
  { id: 'experimental', title: '更特别一点', description: '把酵母、热冲击等特殊处理一起纳入选择。' },
];

export const GUIDED_CONTINENT_CHOICES: GuidedContinentChoice[] = [
  { id: 'floral', title: '偏花香细腻', description: '先从非洲方向继续收窄。' },
  { id: 'balanced', title: '偏平衡甜感', description: '先从美洲方向继续收窄。' },
  { id: 'bold', title: '偏醇厚香料感', description: '先从亚洲方向继续收窄。' },
];

type KeywordGroups = string[][];

const PROCESS_KEYWORD_GROUPS: Record<GuidedProcessChoiceId, KeywordGroups> = {
  clean: [
    ['washed', 'wash', '水洗'],
    ['clean', '清爽'],
  ],
  fruity: [
    ['natural', '日晒'],
    ['fruit', 'fruity', '果'],
  ],
  sweet: [
    ['honey', '蜜处理'],
    ['sweet', '甜感'],
  ],
};

const PROCESS_STYLE_KEYWORD_GROUPS: Record<GuidedProcessStyleChoiceId, KeywordGroups> = {
  classic: [['traditional', '传统']],
  anaerobic: [['anaerobic', '厌氧']],
  experimental: [
    ['yeast', '酵母'],
    ['carbonic', '二氧化碳'],
    ['thermal', '热冲击'],
    ['other', '其他'],
  ],
};

const CONTINENT_KEYWORD_GROUPS: Record<GuidedContinentChoiceId, KeywordGroups> = {
  floral: [['africa', '非洲']],
  balanced: [['americas', 'america', '美洲']],
  bold: [['asia', '亚洲']],
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function matchWithKeyword(option: GuidedDiscoverOption, keyword: string): boolean {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return false;
  const optionId = normalizeText(option.id);
  const optionLabel = normalizeText(option.label);
  return optionId.includes(normalizedKeyword) || optionLabel.includes(normalizedKeyword);
}

function pickOptionByKeywordGroups(
  options: GuidedDiscoverOption[],
  keywordGroups: KeywordGroups
): GuidedDiscoverOption | null {
  for (const keywordGroup of keywordGroups) {
    const matched = options.find((option) => keywordGroup.some((keyword) => matchWithKeyword(option, keyword)));
    if (matched) {
      return {
        id: matched.id,
        label: matched.label,
      };
    }
  }

  return null;
}

function isSelected(value: string): boolean {
  return value !== ALL_DISCOVER_VALUE;
}

export function resolveGuidedProcessSelection(
  choice: GuidedProcessChoiceId,
  options: GuidedDiscoverOption[]
): GuidedDiscoverOption | null {
  return pickOptionByKeywordGroups(options, PROCESS_KEYWORD_GROUPS[choice]);
}

export function resolveGuidedProcessStyleSelection(
  choice: GuidedProcessStyleChoiceId,
  options: GuidedDiscoverOption[]
): GuidedDiscoverOption | null {
  return pickOptionByKeywordGroups(options, PROCESS_STYLE_KEYWORD_GROUPS[choice]);
}

export function resolveGuidedContinentSelection(
  choice: GuidedContinentChoiceId,
  options: GuidedDiscoverOption[]
): GuidedDiscoverOption | null {
  return pickOptionByKeywordGroups(options, CONTINENT_KEYWORD_GROUPS[choice]);
}

export function buildGuidedDiscoverStep(input: GuidedDiscoverStepInput): GuidedDiscoverStep {
  if (isSelected(input.selectedContinent) || isSelected(input.selectedCountry)) {
    return {
      step: 'done',
      title: '已经帮你缩小到一条可直接浏览的路径',
      description: '你可以直接往下看推荐和豆单，也可以重新回答一次，换一条路线。',
    };
  }

  if (!isSelected(input.selectedProcessBase)) {
    return {
      step: 'process_base',
      title: '从选咖啡豆处理法开始',
      description: '不同的处理带来不同的风格，\n根据喜好，缩小范围。',
    };
  }

  if (!isSelected(input.selectedProcessStyle)) {
    return {
      step: 'process_style',
      title: '接下来，选更细致的处理风格',
      description: '传统或是厌氧发酵，风味层次也不一样。',
    };
  }

  return {
    step: 'continent',
    title: '最后，通过产区来选豆',
    description: '风土、气候都决定着咖啡豆的糖分和香气。',
  };
}

export function shouldExpandGuidedDiscoverCard(landingMode: AllBeansLandingMode): boolean {
  return landingMode === 'guided';
}

export function shouldShowGuidedDiscoverCard(_landingMode: AllBeansLandingMode): boolean {
  return false;
}
