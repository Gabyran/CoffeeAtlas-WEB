import {
  createEntryIntentStore,
  type AllBeansEntryIntent,
} from './entry-intent-store.ts';
import { getStorageSync, removeStorageSync, setStorageSync } from '../../utils/miniprogram-api.ts';

export type { AllBeansEntryIntent };

const ENTRY_INTENT_KEY = 'all_beans_entry_intent';

const taroEntryIntentStore = createEntryIntentStore({
  get: () => getStorageSync<AllBeansEntryIntent>(ENTRY_INTENT_KEY),
  set: (intent) => setStorageSync(ENTRY_INTENT_KEY, intent),
  remove: () => removeStorageSync(ENTRY_INTENT_KEY),
});

export function setAllBeansEntryIntent(intent: AllBeansEntryIntent): void {
  taroEntryIntentStore.setIntent(intent);
}

export function consumeAllBeansEntryIntent(): AllBeansEntryIntent | null {
  return taroEntryIntentStore.consumeIntent();
}
