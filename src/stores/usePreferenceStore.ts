import { create } from 'zustand';
import { core } from '../core';
import type { StoredEntity } from '../types/adapter';

export interface AppPreferencesSetting extends StoredEntity {
  id: 'app_preferences';
  majorThresholdYuan: number;
}

const PREFS_STORAGE_KEY = 'hamsterstash_prefs_v1';
const DEFAULT_MAJOR_THRESHOLD_YUAN = 200;

const sanitizeThreshold = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_MAJOR_THRESHOLD_YUAN;
  return Math.round(num);
};

const getInitialMajorThreshold = (): number => {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { majorThresholdYuan?: unknown };
      if (parsed.majorThresholdYuan !== undefined) {
        return sanitizeThreshold(parsed.majorThresholdYuan);
      }
    }
  } catch {
    void 0;
  }
  return DEFAULT_MAJOR_THRESHOLD_YUAN;
};

const persistPreferencesToDB = async (majorThresholdYuan: number) => {
  try {
    await core.init();
    const now = new Date().toISOString();
    const existing = await core.adapter.read<AppPreferencesSetting>('settings', 'app_preferences');
    if (existing) {
      await core.adapter.update<AppPreferencesSetting>('settings', 'app_preferences', {
        majorThresholdYuan,
        updatedAt: now,
      });
    } else {
      await core.adapter.create<AppPreferencesSetting>('settings', {
        id: 'app_preferences',
        majorThresholdYuan,
      });
    }
  } catch {
    void 0;
  }
};

interface PreferenceState {
  majorThresholdYuan: number;
  setMajorThresholdYuan: (yuan: number) => void;
  loadPreferencesFromDB: () => Promise<void>;
}

export const usePreferenceStore = create<PreferenceState>((set) => ({
  majorThresholdYuan: getInitialMajorThreshold(),

  setMajorThresholdYuan: (yuan: number) => {
    const clean = sanitizeThreshold(yuan);
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ majorThresholdYuan: clean }));
    } catch {
      void 0;
    }
    set({ majorThresholdYuan: clean });
    void persistPreferencesToDB(clean);
  },

  loadPreferencesFromDB: async () => {
    try {
      await core.init();
      const record = await core.adapter.read<AppPreferencesSetting>('settings', 'app_preferences');
      if (record && record.majorThresholdYuan !== undefined) {
        const clean = sanitizeThreshold(record.majorThresholdYuan);
        try {
          localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ majorThresholdYuan: clean }));
        } catch {
          void 0;
        }
        set({ majorThresholdYuan: clean });
      }
    } catch {
      void 0;
    }
  },
}));
