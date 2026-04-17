import assert from 'node:assert/strict';
import test from 'node:test';

let storageState: Record<string, unknown>;
let importId = 0;
let lastSetCall: { key: string; value: unknown } | null = null;
let removedKeys: string[] = [];

const loadStorage = async () => {
  storageState = {};
  lastSetCall = null;
  removedKeys = [];
  (globalThis as { wx?: Record<string, unknown> }).wx = {
    getStorageSync: (key: string) => storageState[key],
    setStorageSync: (key: string, value: unknown) => {
      storageState[key] = value;
      lastSetCall = { key, value };
    },
    removeStorageSync: (key: string) => {
      delete storageState[key];
      removedKeys.push(key);
    },
  };

  importId += 1;
  return import(`../src/utils/storage.ts?case=${importId}`);
};

test('getOnboardingProfile returns null when storage empty', async () => {
  const storage = await loadStorage();

  assert.equal(storage.getOnboardingProfile(), null);
});

test('setOnboardingProfile persist and read back profile', async () => {
  const storage = await loadStorage();

  const profile = {
    experienceLevel: 'beginner' as const,
    completedAt: Date.now(),
  };

  storage.setOnboardingProfile(profile);

  assert.deepEqual(lastSetCall, {
    key: 'onboarding_profile',
    value: profile,
  });
  assert.deepEqual(storage.getOnboardingProfile(), profile);
});

test('clearOnboardingProfile removes stored profile', async () => {
  const storage = await loadStorage();

  storage.setOnboardingProfile({
    experienceLevel: 'intermediate',
    completedAt: 0,
  });

  storage.clearOnboardingProfile();

  assert.deepEqual(removedKeys, ['onboarding_profile']);
  assert.equal(storage.getOnboardingProfile(), null);
});

test('getOnboardingProfile returns null for invalid stored shape', async () => {
  const storage = await loadStorage();

  storageState.onboarding_profile = {
    experienceLevel: 'expert',
    completedAt: Date.now(),
  };

  assert.equal(storage.getOnboardingProfile(), null);
});

test('getOnboardingProfile returns null when stored value is not an object', async () => {
  const storage = await loadStorage();

  storageState.onboarding_profile = 'beginner';

  assert.equal(storage.getOnboardingProfile(), null);
});

test('getOnboardingProfile returns null when completedAt is not a number', async () => {
  const storage = await loadStorage();

  storageState.onboarding_profile = {
    experienceLevel: 'beginner',
    completedAt: 'today',
  };

  assert.equal(storage.getOnboardingProfile(), null);
});
