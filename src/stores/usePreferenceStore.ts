import { create } from 'zustand';
import { core } from '../core';
import type { StoredEntity } from '../types/adapter';

export interface AppPreferencesSetting extends StoredEntity {
  id: 'app_preferences';
  majorThresholdYuan: number;
  isReimbursementEnabled?: boolean;
}

const PREFS_STORAGE_KEY = 'hamsterstash_prefs_v1';
const DEFAULT_MAJOR_THRESHOLD_YUAN = 200;

const sanitizeThreshold = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_MAJOR_THRESHOLD_YUAN;
  return Math.round(num);
};

const getInitialPreferences = (): { majorThresholdYuan: number; isReimbursementEnabled: boolean } => {
  let majorThresholdYuan = DEFAULT_MAJOR_THRESHOLD_YUAN;
  let isReimbursementEnabled = true;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { majorThresholdYuan?: unknown; isReimbursementEnabled?: unknown };
      if (parsed.majorThresholdYuan !== undefined) {
        majorThresholdYuan = sanitizeThreshold(parsed.majorThresholdYuan);
      }
      if (typeof parsed.isReimbursementEnabled === 'boolean') {
        isReimbursementEnabled = parsed.isReimbursementEnabled;
      }
    }
  } catch {
    void 0;
  }
  return { majorThresholdYuan, isReimbursementEnabled };
};

const persistPreferencesToDB = async (prefs: { majorThresholdYuan: number; isReimbursementEnabled: boolean }) => {
  try {
    await core.init();
    const now = new Date().toISOString();
    const existing = await core.adapter.read<AppPreferencesSetting>('settings', 'app_preferences');
    if (existing) {
      await core.adapter.update<AppPreferencesSetting>('settings', 'app_preferences', {
        ...prefs,
        updatedAt: now,
      });
    } else {
      await core.adapter.create<AppPreferencesSetting>('settings', {
        id: 'app_preferences',
        ...prefs,
      });
    }
  } catch {
    void 0;
  }
};

interface PreferenceState {
  majorThresholdYuan: number;
  isReimbursementEnabled: boolean;
  setMajorThresholdYuan: (yuan: number) => void;
  setReimbursementEnabled: (enabled: boolean) => void;
  loadPreferencesFromDB: () => Promise<void>;
}

const initialPrefs = getInitialPreferences();

export const usePreferenceStore = create<PreferenceState>((set, get) => ({
  majorThresholdYuan: initialPrefs.majorThresholdYuan,
  isReimbursementEnabled: initialPrefs.isReimbursementEnabled,

  setMajorThresholdYuan: (yuan: number) => {
    const clean = sanitizeThreshold(yuan);
    const updated = {
      majorThresholdYuan: clean,
      isReimbursementEnabled: get().isReimbursementEnabled,
    };
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      void 0;
    }
    set({ majorThresholdYuan: clean });
    void persistPreferencesToDB(updated);
  },

  setReimbursementEnabled: (enabled: boolean) => {
    const updated = {
      majorThresholdYuan: get().majorThresholdYuan,
      isReimbursementEnabled: enabled,
    };
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      void 0;
    }
    set({ isReimbursementEnabled: enabled });
    void persistPreferencesToDB(updated);
  },

  loadPreferencesFromDB: async () => {
    try {
      await core.init();
      const record = await core.adapter.read<AppPreferencesSetting>('settings', 'app_preferences');
      if (record) {
        const clean = record.majorThresholdYuan !== undefined
          ? sanitizeThreshold(record.majorThresholdYuan)
          : get().majorThresholdYuan;
        const reimbEnabled = typeof record.isReimbursementEnabled === 'boolean'
          ? record.isReimbursementEnabled
          : get().isReimbursementEnabled;
        const updated = { majorThresholdYuan: clean, isReimbursementEnabled: reimbEnabled };
        try {
          localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          void 0;
        }
        set(updated);
      }
    } catch {
      void 0;
    }
  },
}));
