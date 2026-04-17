import assert from 'node:assert/strict';
import test from 'node:test';

let storageState: Record<string, unknown>;
let importId = 0;

async function loadStorageModule() {
  storageState = {};
  (globalThis as { wx?: Record<string, unknown> }).wx = {
    getStorageSync: (key: string) => storageState[key],
    setStorageSync: (key: string, value: unknown) => {
      storageState[key] = value;
    },
    removeStorageSync: (key: string) => {
      delete storageState[key];
    },
  };

  importId += 1;
  return import(`../src/utils/storage.ts?case=${importId}`);
}

test('addToHistory stores variety and updates exploration set', async () => {
  const storage = await loadStorageModule();

  storage.addToHistory({
    id: 'bean-1',
    name: '桃桃乌龙',
    roasterName: 'Metal Hands',
    imageUrl: null,
    originCountry: '埃塞俄比亚',
    process: '水洗',
    variety: '74110',
    price: 128,
  });

  assert.equal(storage.getHistory().length, 1);
  assert.equal(storage.getHistory()[0]?.variety, '74110');
  assert.deepEqual(storage.getExplorationSet(), {
    countries: ['埃塞俄比亚'],
    processes: ['水洗'],
    varieties: ['74110'],
  });
  assert.deepEqual(storageState.exploration_set, {
    countries: ['埃塞俄比亚'],
    processes: ['水洗'],
    varieties: ['74110'],
  });
});

test('getExplorationSet backfills from legacy history when storage is empty', async () => {
  const storage = await loadStorageModule();

  storageState.coffee_history = [
    {
      id: 'bean-1',
      name: 'A',
      roasterName: 'R',
      imageUrl: null,
      originCountry: '哥伦比亚',
      process: '日晒',
      variety: 'Pink Bourbon',
      price: 88,
      viewedAt: 1,
    },
    {
      id: 'bean-2',
      name: 'B',
      roasterName: 'R',
      imageUrl: null,
      originCountry: '巴西',
      process: '日晒',
      price: 96,
      viewedAt: 2,
    },
  ];

  assert.deepEqual(storage.getExplorationSet(), {
    countries: ['哥伦比亚', '巴西'],
    processes: ['日晒'],
    varieties: ['Pink Bourbon'],
  });
  assert.deepEqual(storageState.exploration_set, {
    countries: ['哥伦比亚', '巴西'],
    processes: ['日晒'],
    varieties: ['Pink Bourbon'],
  });
});

test('purchase and share logs append entries in order', async () => {
  const storage = await loadStorageModule();

  storage.recordPurchaseClick({
    roasterId: 'roaster-1',
    beanId: 'bean-1',
    ts: 100,
  });
  storage.recordPurchaseClick({
    roasterId: 'roaster-1',
    beanId: 'bean-2',
    ts: 200,
  });
  storage.recordShareEvent({
    beanId: 'bean-1',
    ts: 300,
  });
  storage.recordShareEvent({
    beanId: 'bean-1',
    ts: 400,
  });

  assert.deepEqual(storage.getPurchaseClickLog(), [
    { roasterId: 'roaster-1', beanId: 'bean-1', ts: 100 },
    { roasterId: 'roaster-1', beanId: 'bean-2', ts: 200 },
  ]);
  assert.deepEqual(storage.getShareEventLog(), [
    { beanId: 'bean-1', ts: 300 },
    { beanId: 'bean-1', ts: 400 },
  ]);
});
