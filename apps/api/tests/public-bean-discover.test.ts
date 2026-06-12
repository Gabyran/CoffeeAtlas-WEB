import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildContinentOptions,
  buildCountryOptions,
  buildDiscoverPrimaryPayload,
  buildEditorialReason,
  buildProcessBaseOptions,
  buildProcessStyleOptions,
  createBeanDiscoverService,
} from '../lib/server/public-bean-discover.ts';

const discoverRowsFixture = [
  { roaster_bean_id: 'bean-1', origin_country: 'ethiopia', process_method: ' Washed ' },
  { roaster_bean_id: 'bean-2', origin_country: 'Ethiopia', process_method: '厌氧水洗' },
  { roaster_bean_id: 'bean-3', origin_country: 'kenya', process_method: 'Natural' },
  { roaster_bean_id: 'bean-4', origin_country: 'brazil', process_method: 'anaerobic natural' },
  { roaster_bean_id: 'bean-5', origin_country: 'brazil', process_method: 'Honey' },
  { roaster_bean_id: 'bean-6', origin_country: 'yunnan', process_method: '热冲击蜜处理' },
  { roaster_bean_id: 'bean-7', origin_country: null, process_method: 'experimental infused lot' },
  { roaster_bean_id: 'bean-8', origin_country: 'not-a-country', process_method: null },
];

const primaryPayloadFixture = {
  processBaseOptions: [{ id: 'washed', label: '水洗', count: 1 }],
  processStyleOptions: [{ id: 'anaerobic', label: '厌氧', count: 1 }],
  continentOptions: [{ id: 'africa', label: 'Africa', count: 2 }],
  countryOptions: [{ id: 'Ethiopia', label: 'Ethiopia', count: 2 }],
  editorial: {
    title: 'Primary path',
    subtitle: 'Primary payload',
    mode: 'manual',
  },
  editorPicks: [],
  resultSummary: {
    total: 2,
    processBase: 'washed',
    processStyle: 'anaerobic',
    continent: 'africa',
    country: 'Ethiopia',
  },
};

const fallbackPayloadFixture = {
  processBaseOptions: [{ id: 'natural', label: '日晒', count: 1 }],
  processStyleOptions: [{ id: 'traditional', label: '传统', count: 1 }],
  continentOptions: [{ id: 'americas', label: 'Americas', count: 1 }],
  countryOptions: [{ id: 'Brazil', label: 'Brazil', count: 1 }],
  editorial: {
    title: 'Fallback path',
    subtitle: 'Fallback payload',
    mode: 'fallback',
  },
  editorPicks: [],
  resultSummary: {
    total: 1,
    processBase: undefined,
    processStyle: undefined,
    continent: undefined,
    country: undefined,
  },
};

const beanFixture = {
  id: 'bean-ethiopia',
  name: 'Ethiopia Guji',
  roasterId: 'roaster-1',
  roasterName: 'Roaster One',
  city: 'Shanghai',
  originCountry: 'Ethiopia',
  process: 'Washed',
  roastLevel: 'Light',
  price: 88,
  currency: 'CNY',
  salesCount: 24,
  imageUrl: 'https://example.com/bean.jpg',
  isInStock: true,
  originRegion: 'Guji',
  farm: 'Halo',
  variety: '74110',
  discountedPrice: null,
  tastingNotes: ['jasmine'],
  isNewArrival: false,
};

const localPrimaryBeansFixture = [
  {
    ...beanFixture,
    id: 'bean-1',
    originCountry: 'Ethiopia',
    process: 'Washed',
  },
  {
    ...beanFixture,
    id: 'bean-2',
    name: 'Kenya Kirinyaga',
    originCountry: 'Kenya',
    process: 'Natural',
  },
  {
    ...beanFixture,
    id: 'bean-3',
    name: 'Yunnan Baoshan',
    originCountry: 'Yunnan',
    process: 'Washed',
  },
];

test('buildProcessBaseOptions returns deduped base options with normalized labels', () => {
  const options = buildProcessBaseOptions(discoverRowsFixture);

  assert.deepEqual(
    options.map((option) => [option.id, option.count]),
    [
      ['honey', 2],
      ['natural', 2],
      ['washed', 2],
      ['other', 1],
    ]
  );
});

test('buildProcessStyleOptions returns normalized style options and hides traditional for other-base flows', () => {
  assert.deepEqual(
    buildProcessStyleOptions(discoverRowsFixture).map((option) => [option.id, option.count]),
    [
      ['traditional', 3],
      ['anaerobic', 2],
      ['thermal_shock', 1],
      ['other', 1],
    ]
  );

  assert.deepEqual(
    buildProcessStyleOptions(discoverRowsFixture, 'other').map((option) => option.id),
    ['other']
  );
});

test('buildContinentOptions returns atlas-order continent options with counts', () => {
  const options = buildContinentOptions(discoverRowsFixture);

  assert.deepEqual(
    options.map((option) => [option.id, option.count]),
    [
      ['asia', 1],
      ['africa', 3],
      ['americas', 2],
    ]
  );
  assert.ok(options.every((option) => typeof option.label === 'string' && option.label.length > 0));
  assert.ok(options.every((option) => typeof option.description === 'string' && option.description.length > 0));
});

test('buildCountryOptions returns canonical country labels with counts', () => {
  const options = buildCountryOptions(discoverRowsFixture);

  assert.deepEqual(options.map((option) => option.count), [2, 2, 1, 1]);
  assert.equal(options.length, 4);
  assert.ok(options.every((option) => typeof option.id === 'string' && option.id.length > 0));
  assert.ok(options.every((option) => typeof option.label === 'string' && option.label.length > 0));
});

test('createBeanDiscoverService returns primary payload when main path succeeds', async () => {
  const primaryCalls: unknown[] = [];
  const fallbackCalls: unknown[] = [];

  const service = createBeanDiscoverService({
    loadPrimaryPayload: async (filters) => {
      primaryCalls.push(filters);
      return primaryPayloadFixture;
    },
    loadFallbackPayload: async (filters) => {
      fallbackCalls.push(filters);
      return fallbackPayloadFixture;
    },
  });

  const filters = {
    q: 'berry',
    processBase: 'washed',
    processStyle: 'anaerobic',
    continent: 'africa',
    country: 'Ethiopia',
  };

  const result = await service.getBeanDiscoverPayload(filters);

  assert.equal(result.editorial.title, 'Primary path');
  assert.equal(result.editorial.mode, 'manual');
  assert.deepEqual(result.processBaseOptions, primaryPayloadFixture.processBaseOptions);
  assert.deepEqual(result.processStyleOptions, primaryPayloadFixture.processStyleOptions);
  assert.deepEqual(result.continentOptions, primaryPayloadFixture.continentOptions);
  assert.deepEqual(result.countryOptions, primaryPayloadFixture.countryOptions);
  assert.deepEqual(result.resultSummary, primaryPayloadFixture.resultSummary);
  assert.equal(primaryCalls.length, 1);
  assert.equal((primaryCalls[0] as typeof filters).q, 'berry');
  assert.equal((primaryCalls[0] as typeof filters).processBase, 'washed');
  assert.equal((primaryCalls[0] as typeof filters).processStyle, 'anaerobic');
  assert.equal((primaryCalls[0] as typeof filters).continent, 'africa');
  assert.equal((primaryCalls[0] as typeof filters).country, 'Ethiopia');
  assert.deepEqual(fallbackCalls, []);
});

test('createBeanDiscoverService propagates primary failures without fallback', async () => {
  const primaryCalls: unknown[] = [];
  const fallbackCalls: unknown[] = [];

  const service = createBeanDiscoverService({
    loadPrimaryPayload: async (filters) => {
      primaryCalls.push(filters);
      throw new Error('primary_failed');
    },
    loadFallbackPayload: async (filters) => {
      fallbackCalls.push(filters);
      return fallbackPayloadFixture;
    },
  });

  const filters = {
    q: 'berry',
    processBase: 'washed',
    processStyle: 'anaerobic',
    continent: 'africa',
    country: 'Ethiopia',
  };

  await assert.rejects(service.getBeanDiscoverPayload(filters), /primary_failed/);
  assert.equal(primaryCalls.length, 1);
  assert.equal(fallbackCalls.length, 0);
});

test('buildEditorialReason keeps country, process, and fallback copy stable', () => {
  assert.match(
    buildEditorialReason(beanFixture, { country: '埃塞俄比亚' }),
    /埃塞俄比亚/
  );
  assert.match(
    buildEditorialReason(beanFixture, { processBase: 'washed' }),
    /水洗/
  );
  assert.equal(
    buildEditorialReason(
      {
        ...beanFixture,
        salesCount: 0,
        isNewArrival: false,
      },
      {}
    ),
    '风味辨识度和稳定性都不错，适合作为当前探索路径的起点。'
  );
});

test('buildDiscoverPrimaryPayload keeps local no-supabase path stable', async () => {
  const loadLocalBeansCalls: unknown[] = [];
  const editorPicks = [
    {
      bean: {
        id: 'bean-1',
        name: 'Ethiopia Guji',
        roasterId: 'roaster-1',
        roasterName: 'Roaster One',
        city: 'Shanghai',
        originCountry: 'Ethiopia',
        process: 'Washed',
        roastLevel: 'Light',
        price: 88,
        currency: 'CNY',
        salesCount: 24,
        imageUrl: 'https://example.com/bean.jpg',
        isInStock: true,
        originRegion: 'Guji',
        farm: 'Halo',
        variety: '74110',
        discountedPrice: null,
        tastingNotes: ['jasmine'],
        isNewArrival: false,
      },
      reason: '代表 Ethiopia 当前路径的典型杯型，适合先建立国家风味印象。',
    },
  ];

  const result = await buildDiscoverPrimaryPayload(
    {
      q: 'berry',
      processBase: 'washed',
      processStyle: 'anaerobic',
      continent: 'africa',
      country: 'Ethiopia',
    },
    {
      hasSupabaseEnv: false,
      loadLocalBeansFn: async (filters) => {
        loadLocalBeansCalls.push(filters);

        if (filters.country === 'Ethiopia') {
          return [localPrimaryBeansFixture[0]];
        }

        return localPrimaryBeansFixture;
      },
      buildEditorialPicksFn: async () => editorPicks,
    }
  );

  assert.deepEqual(
    result.processBaseOptions.map((option) => [option.id, option.count]),
    [
      ['washed', 2],
      ['natural', 1],
    ]
  );
  assert.deepEqual(result.processStyleOptions.map((option) => [option.id, option.count]), [
    ['traditional', 2],
  ]);
  assert.deepEqual(
    result.continentOptions.map((option) => [option.id, option.count]),
    [
      ['asia', 1],
      ['africa', 1],
    ]
  );
  assert.deepEqual(
    result.countryOptions.map((option) => [option.id, option.count]),
    [['埃塞俄比亚', 1]]
  );
  assert.equal(result.resultSummary.total, 1);
  assert.equal(result.resultSummary.processBase, 'washed');
  assert.equal(result.resultSummary.processStyle, 'anaerobic');
  assert.equal(result.resultSummary.continent, 'africa');
  assert.equal(result.resultSummary.country, 'Ethiopia');
  assert.deepEqual(result.editorPicks, editorPicks);
  assert.deepEqual(loadLocalBeansCalls, [
    { q: 'berry' },
    {
      q: 'berry',
      processBase: 'washed',
      processStyle: 'anaerobic',
      continent: 'africa',
      country: 'Ethiopia',
    },
  ]);
});
