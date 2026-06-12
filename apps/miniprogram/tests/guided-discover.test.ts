import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGuidedDiscoverStep,
  resolveGuidedContinentSelection,
  resolveGuidedProcessSelection,
  resolveGuidedProcessStyleSelection,
  shouldExpandGuidedDiscoverCard,
  shouldShowGuidedDiscoverCard,
  type GuidedContinentChoiceId,
  type GuidedProcessChoiceId,
  type GuidedProcessStyleChoiceId,
} from '../src/pages/all-beans/guided-discover.ts';

const PROCESS_BASE_OPTIONS = [
  { id: 'washed', label: '水洗', count: 12 },
  { id: 'natural', label: '日晒', count: 8 },
  { id: 'honey', label: '蜜处理', count: 6 },
];

const PROCESS_STYLE_OPTIONS = [
  { id: 'traditional', label: '传统', count: 18 },
  { id: 'anaerobic', label: '厌氧', count: 4 },
  { id: 'yeast', label: '酵母', count: 2 },
];

const CONTINENT_OPTIONS = [
  { id: 'africa', label: '非洲', count: 10 },
  { id: 'americas', label: '美洲', count: 18 },
  { id: 'asia', label: '亚洲', count: 6 },
];

test('resolveGuidedProcessSelection maps clean choice to washed-like options first', () => {
  const selection = resolveGuidedProcessSelection('clean' satisfies GuidedProcessChoiceId, PROCESS_BASE_OPTIONS);

  assert.deepEqual(selection, {
    id: 'washed',
    label: '水洗',
  });
});

test('resolveGuidedProcessSelection maps fruity choice to natural-like options first', () => {
  const selection = resolveGuidedProcessSelection('fruity' satisfies GuidedProcessChoiceId, PROCESS_BASE_OPTIONS);

  assert.deepEqual(selection, {
    id: 'natural',
    label: '日晒',
  });
});

test('resolveGuidedProcessSelection maps sweet choice to honey-like options first', () => {
  const selection = resolveGuidedProcessSelection('sweet' satisfies GuidedProcessChoiceId, PROCESS_BASE_OPTIONS);

  assert.deepEqual(selection, {
    id: 'honey',
    label: '蜜处理',
  });
});

test('resolveGuidedProcessSelection returns null when preferred labels are missing', () => {
  const selection = resolveGuidedProcessSelection('clean' satisfies GuidedProcessChoiceId, [
    { id: 'other', label: '其他', count: 5 },
  ]);

  assert.equal(selection, null);
});

test('resolveGuidedProcessStyleSelection maps classic choice to traditional first', () => {
  const selection = resolveGuidedProcessStyleSelection(
    'classic' satisfies GuidedProcessStyleChoiceId,
    PROCESS_STYLE_OPTIONS
  );

  assert.deepEqual(selection, {
    id: 'traditional',
    label: '传统',
  });
});

test('resolveGuidedProcessStyleSelection maps anaerobic choice to anaerobic first', () => {
  const selection = resolveGuidedProcessStyleSelection(
    'anaerobic' satisfies GuidedProcessStyleChoiceId,
    PROCESS_STYLE_OPTIONS
  );

  assert.deepEqual(selection, {
    id: 'anaerobic',
    label: '厌氧',
  });
});

test('resolveGuidedProcessStyleSelection maps experimental choice to yeast-like options first', () => {
  const selection = resolveGuidedProcessStyleSelection(
    'experimental' satisfies GuidedProcessStyleChoiceId,
    PROCESS_STYLE_OPTIONS
  );

  assert.deepEqual(selection, {
    id: 'yeast',
    label: '酵母',
  });
});

test('resolveGuidedContinentSelection maps floral choice to africa', () => {
  const selection = resolveGuidedContinentSelection('floral' satisfies GuidedContinentChoiceId, CONTINENT_OPTIONS);

  assert.deepEqual(selection, {
    id: 'africa',
    label: '非洲',
  });
});

test('resolveGuidedContinentSelection maps balanced choice to americas', () => {
  const selection = resolveGuidedContinentSelection('balanced' satisfies GuidedContinentChoiceId, CONTINENT_OPTIONS);

  assert.deepEqual(selection, {
    id: 'americas',
    label: '美洲',
  });
});

test('resolveGuidedContinentSelection maps bold choice to asia', () => {
  const selection = resolveGuidedContinentSelection('bold' satisfies GuidedContinentChoiceId, CONTINENT_OPTIONS);

  assert.deepEqual(selection, {
    id: 'asia',
    label: '亚洲',
  });
});

test('buildGuidedDiscoverStep starts from process base question', () => {
  assert.deepEqual(
    buildGuidedDiscoverStep({
      selectedProcessBase: 'all',
      selectedProcessStyle: 'all',
      selectedContinent: 'all',
      selectedCountry: 'all',
    }),
    {
      step: 'process_base',
      title: '从选咖啡豆处理法开始',
      description: '不同的处理带来不同的风格，\n根据喜好，缩小范围。',
    }
  );
});

test('buildGuidedDiscoverStep moves to process style question after base is selected', () => {
  assert.deepEqual(
    buildGuidedDiscoverStep({
      selectedProcessBase: 'washed',
      selectedProcessStyle: 'all',
      selectedContinent: 'all',
      selectedCountry: 'all',
    }),
    {
      step: 'process_style',
      title: '接下来，选更细致的处理风格',
      description: '传统或是厌氧发酵，风味层次也不一样。',
    }
  );
});

test('buildGuidedDiscoverStep moves to continent question after style is selected', () => {
  assert.deepEqual(
    buildGuidedDiscoverStep({
      selectedProcessBase: 'washed',
      selectedProcessStyle: 'traditional',
      selectedContinent: 'all',
      selectedCountry: 'all',
    }),
    {
      step: 'continent',
      title: '最后，通过产区来选豆',
      description: '风土、气候都决定着咖啡豆的糖分和香气。',
    }
  );
});

test('buildGuidedDiscoverStep finishes once continent is selected', () => {
  assert.deepEqual(
    buildGuidedDiscoverStep({
      selectedProcessBase: 'washed',
      selectedProcessStyle: 'traditional',
      selectedContinent: 'africa',
      selectedCountry: 'all',
    }),
    {
      step: 'done',
      title: '已经帮你缩小到一条可直接浏览的路径',
      description: '你可以直接往下看推荐和豆单，也可以重新回答一次，换一条路线。',
    }
  );
});

test('buildGuidedDiscoverStep finishes once country is selected', () => {
  assert.deepEqual(
    buildGuidedDiscoverStep({
      selectedProcessBase: 'washed',
      selectedProcessStyle: 'traditional',
      selectedContinent: 'all',
      selectedCountry: '埃塞俄比亚',
    }),
    {
      step: 'done',
      title: '已经帮你缩小到一条可直接浏览的路径',
      description: '你可以直接往下看推荐和豆单，也可以重新回答一次，换一条路线。',
    }
  );
});

test('shouldExpandGuidedDiscoverCard keeps guided entry collapsed for now', () => {
  assert.equal(shouldExpandGuidedDiscoverCard('guided'), true);
});

test('shouldExpandGuidedDiscoverCard keeps direct entry collapsed by default', () => {
  assert.equal(shouldExpandGuidedDiscoverCard('direct'), false);
});

test('shouldExpandGuidedDiscoverCard keeps default entry collapsed by default', () => {
  assert.equal(shouldExpandGuidedDiscoverCard('default'), false);
});

test('shouldShowGuidedDiscoverCard hides guided entry card for now', () => {
  assert.equal(shouldShowGuidedDiscoverCard('guided'), false);
});

test('shouldShowGuidedDiscoverCard hides direct entry card for now', () => {
  assert.equal(shouldShowGuidedDiscoverCard('direct'), false);
});

test('shouldShowGuidedDiscoverCard hides default entry card for now', () => {
  assert.equal(shouldShowGuidedDiscoverCard('default'), false);
});
