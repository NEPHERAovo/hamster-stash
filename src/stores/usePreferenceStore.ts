import { create } from 'zustand';
import { core } from '../core';
import type { StoredEntity } from '../types/adapter';

export interface AppPreferencesSetting extends StoredEntity {
  id: 'app_preferences';
  majorThresholdYuan: number;
  isReimbursementEnabled?: boolean;
  isAmortizationEnabled?: boolean;
}

const PREFS_STORAGE_KEY = 'hamsterstash_prefs_v1';
const DEFAULT_MAJOR_THRESHOLD_YUAN = 200;

const sanitizeThreshold = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 1) return DEFAULT_MAJOR_THRESHOLD_YUAN;
  return Math.round(num);
};

interface PreferencesPayload {
  majorThresholdYuan: number;
  isReimbursementEnabled: boolean;
  isAmortizationEnabled: boolean;
}

const getInitialPreferences = (): PreferencesPayload => {
  let majorThresholdYuan = DEFAULT_MAJOR_THRESHOLD_YUAN;
  let isReimbursementEnabled = true;
  let isAmortizationEnabled = true;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as {
        majorThresholdYuan?: unknown;
        isReimbursementEnabled?: unknown;
        isAmortizationEnabled?: unknown;
      };
      if (parsed.majorThresholdYuan !== undefined) {
        majorThresholdYuan = sanitizeThreshold(parsed.majorThresholdYuan);
      }
      if (typeof parsed.isReimbursementEnabled === 'boolean') {
        isReimbursementEnabled = parsed.isReimbursementEnabled;
      }
      if (typeof parsed.isAmortizationEnabled === 'boolean') {
        isAmortizationEnabled = parsed.isAmortizationEnabled;
      }
    }
  } catch {
    void 0;
  }
  return { majorThresholdYuan, isReimbursementEnabled, isAmortizationEnabled };
};

const persistPreferencesToDB = async (prefs: PreferencesPayload) => {
  try {
    await core.init();
    await core.settingsRepo.saveSetting<AppPreferencesSetting>('app_preferences', prefs);
  } catch {
    void 0;
  }
};

interface PreferenceState {
  majorThresholdYuan: number;
  isReimbursementEnabled: boolean;
  isAmortizationEnabled: boolean;
  setMajorThresholdYuan: (yuan: number) => void;
  setReimbursementEnabled: (enabled: boolean) => void;
  setAmortizationEnabled: (enabled: boolean) => void;
  loadPreferencesFromDB: () => Promise<void>;
}

const initialPrefs = getInitialPreferences();

export const usePreferenceStore = create<PreferenceState>((set, get) => ({
  majorThresholdYuan: initialPrefs.majorThresholdYuan,
  isReimbursementEnabled: initialPrefs.isReimbursementEnabled,
  isAmortizationEnabled: initialPrefs.isAmortizationEnabled,

  setMajorThresholdYuan: (yuan: number) => {
    const clean = sanitizeThreshold(yuan);
    const updated = {
      majorThresholdYuan: clean,
      isReimbursementEnabled: get().isReimbursementEnabled,
      isAmortizationEnabled: get().isAmortizationEnabled,
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
      isAmortizationEnabled: get().isAmortizationEnabled,
    };
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      void 0;
    }
    set({ isReimbursementEnabled: enabled });
    void persistPreferencesToDB(updated);
  },

  setAmortizationEnabled: (enabled: boolean) => {
    const updated = {
      majorThresholdYuan: get().majorThresholdYuan,
      isReimbursementEnabled: get().isReimbursementEnabled,
      isAmortizationEnabled: enabled,
    };
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      void 0;
    }
    set({ isAmortizationEnabled: enabled });
    void persistPreferencesToDB(updated);
  },

  loadPreferencesFromDB: async () => {
    try {
      await core.init();
      const record = await core.settingsRepo.getSetting<AppPreferencesSetting>('app_preferences');
      if (record) {
        const clean = record.majorThresholdYuan !== undefined
          ? sanitizeThreshold(record.majorThresholdYuan)
          : get().majorThresholdYuan;
        const reimbEnabled = typeof record.isReimbursementEnabled === 'boolean'
          ? record.isReimbursementEnabled
          : get().isReimbursementEnabled;
        const amortEnabled = typeof record.isAmortizationEnabled === 'boolean'
          ? record.isAmortizationEnabled
          : get().isAmortizationEnabled;
        const updated = {
          majorThresholdYuan: clean,
          isReimbursementEnabled: reimbEnabled,
          isAmortizationEnabled: amortEnabled,
        };
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
