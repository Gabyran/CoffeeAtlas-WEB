import { getStorageSync, removeStorageSync, setStorageSync } from '../../utils/miniprogram-api.ts';

import { createGuidedSeedStore } from './guided-seed-store.ts';
import type { GuidedSeedState } from './guided-seed-store.ts';

const GUIDED_SEED_KEY = 'all_beans_guided_seed';

const taroGuidedSeedStore = createGuidedSeedStore({
  get: () => getStorageSync<GuidedSeedState>(GUIDED_SEED_KEY),
  set: (state) => setStorageSync(GUIDED_SEED_KEY, state),
  remove: () => removeStorageSync(GUIDED_SEED_KEY),
});

export function setAllBeansGuidedSeed(state: GuidedSeedState): void {
  taroGuidedSeedStore.setState(state);
}

export function consumeAllBeansGuidedSeed(): GuidedSeedState | null {
  return taroGuidedSeedStore.consumeState();
}
