import { create } from 'zustand';
import { core } from '../core';
import type { StoredEntity } from '../types/adapter';

export type UiStyle = 'paper' | 'modern';
export type ColorMode = 'light' | 'dark' | 'auto';

export interface AppThemeSetting extends StoredEntity {
  id: 'app_theme';
  themeId: string;
  uiStyle: UiStyle;
  colorMode?: ColorMode;
  lightThemeId?: string;
  darkThemeId?: string;
}

export interface ThemeOption {
  id: string;
  name: string;
  subName: string;
  isDark: boolean;
  colorDot: string;
  pairedId: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'theme-sage', name: '竹青素笺', subName: 'Sage Green', isDark: false, colorDot: '#3F8256', pairedId: 'theme-pine' },
  { id: 'theme-cotton', name: '特种米白', subName: 'Cotton White', isDark: false, colorDot: '#78634B', pairedId: 'theme-carbon' },
  { id: 'theme-kraft', name: '复古牛皮', subName: 'Kraft Paper', isDark: false, colorDot: '#BA6E38', pairedId: 'theme-espresso' },
  { id: 'theme-mist', name: '雾霭蓝卡', subName: 'Mist Blue', isDark: false, colorDot: '#3D7299', pairedId: 'theme-indigo' },
  { id: 'theme-cherry', name: '樱落绯灰', subName: 'Cherry Ash', isDark: false, colorDot: '#AC495E', pairedId: 'theme-crimson' },

  { id: 'theme-pine', name: '幽林松柏', subName: 'Forest Pine', isDark: true, colorDot: '#529E6C', pairedId: 'theme-sage' },
  { id: 'theme-carbon', name: '复写碳纸', subName: 'Carbon Paper', isDark: true, colorDot: '#B5935A', pairedId: 'theme-cotton' },
  { id: 'theme-espresso', name: '深焙浓缩', subName: 'Espresso Dark', isDark: true, colorDot: '#CC814B', pairedId: 'theme-kraft' },
  { id: 'theme-indigo', name: '古法靛蓝', subName: 'Indigo Night', isDark: true, colorDot: '#5289B3', pairedId: 'theme-mist' },
  { id: 'theme-crimson', name: '绯夜绛笺', subName: 'Crimson Night', isDark: true, colorDot: '#D16B80', pairedId: 'theme-cherry' },
];

const UI_STYLE_STORAGE_KEY = 'hamsterstash_ui_style_v1';
const COLOR_MODE_STORAGE_KEY = 'hamsterstash_color_mode_v1';
const LIGHT_THEME_STORAGE_KEY = 'hamsterstash_light_theme_v1';
const DARK_THEME_STORAGE_KEY = 'hamsterstash_dark_theme_v1';
const SPLASH_BG_STORAGE_KEY = 'hamsterstash_splash_bg_v1';
const SPLASH_DARK_STORAGE_KEY = 'hamsterstash_splash_dark_v1';

const PAPER_THEME_BASE_COLORS: Record<string, string> = {
  'theme-sage': '#EEF4ED',
  'theme-cotton': '#F5F2EA',
  'theme-kraft': '#EFE5D4',
  'theme-mist': '#E7EFF5',
  'theme-cherry': '#F6ECEE',
  'theme-pine': '#0C140E',
  'theme-carbon': '#141311',
  'theme-espresso': '#14100D',
  'theme-indigo': '#0E131C',
  'theme-crimson': '#160E10',
};

const resolveChromeBackground = (themeId: string, uiStyle: UiStyle, isDark: boolean): string => {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const computed = window.getComputedStyle(document.documentElement).getPropertyValue('--paper-base').trim();
    if (computed) return computed;
  }
  if (uiStyle === 'modern') {
    return isDark ? '#090A0D' : '#F3F4F6';
  }
  return PAPER_THEME_BASE_COLORS[themeId] || (isDark ? '#0C140E' : '#EEF4ED');
};

const applyChromeMetaAndRoot = (bg: string, isDark: boolean) => {
  if (typeof document === 'undefined') return;
  safeSetStorage(SPLASH_BG_STORAGE_KEY, bg);
  safeSetStorage(SPLASH_DARK_STORAGE_KEY, isDark ? '1' : '0');

  document.documentElement.style.backgroundColor = bg;
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  if (document.body) {
    document.body.style.backgroundColor = bg;
  }

  const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  const isAlreadySingleMatch =
    metas.length === 1 &&
    !metas[0].hasAttribute('media') &&
    metas[0].getAttribute('content') === bg;

  if (!isAlreadySingleMatch) {
    for (const meta of metas) {
      meta.remove();
    }
    if (document.head) {
      const nextMeta = document.createElement('meta');
      nextMeta.setAttribute('name', 'theme-color');
      nextMeta.setAttribute('content', bg);
      document.head.appendChild(nextMeta);
    }
  }
};

const syncSplashChrome = (themeId: string, uiStyle: UiStyle, isDark: boolean) => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  applyChromeMetaAndRoot(resolveChromeBackground(themeId, uiStyle, isDark), isDark);
};

const isLightTheme = (id: string) => THEME_OPTIONS.some((t) => t.id === id && !t.isDark);
const isDarkTheme = (id: string) => THEME_OPTIONS.some((t) => t.id === id && t.isDark);

const getSystemPrefersDark = (): boolean => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
};

const applyUiStyleToDOM = (uiStyle: UiStyle) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.uiStyle = uiStyle;
    document.body.dataset.uiStyle = uiStyle;
  }
};

const applyThemeToDOM = (themeId: string) => {
  if (typeof document === 'undefined') return;
  const theme = THEME_OPTIONS.find((t) => t.id === themeId) || THEME_OPTIONS[0];

  THEME_OPTIONS.forEach((t) => {
    document.body.classList.remove(t.id);
    document.documentElement.classList.remove(t.id);
  });

  document.body.classList.add(theme.id);
  document.documentElement.classList.add(theme.id);
  document.documentElement.setAttribute('data-theme', theme.id);

  if (theme.isDark) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }
};

const safeGetStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    void 0;
  }
};

const getInitialThemeSlots = (): {
  colorMode: ColorMode;
  lightThemeId: string;
  darkThemeId: string;
} => {
  const savedLight = safeGetStorage(LIGHT_THEME_STORAGE_KEY);
  const savedDark = safeGetStorage(DARK_THEME_STORAGE_KEY);
  const savedMode = safeGetStorage(COLOR_MODE_STORAGE_KEY);

  const lightThemeId = savedLight && isLightTheme(savedLight) ? savedLight : 'theme-sage';
  const darkThemeId = savedDark && isDarkTheme(savedDark) ? savedDark : 'theme-pine';
  const colorMode: ColorMode =
    savedMode === 'light' || savedMode === 'dark' || savedMode === 'auto' ? savedMode : 'light';

  return { colorMode, lightThemeId, darkThemeId };
};

const getInitialUiStyle = (): UiStyle => {
  const saved = safeGetStorage(UI_STYLE_STORAGE_KEY);
  if (saved === 'modern' || saved === 'paper') {
    return saved;
  }
  return 'modern';
};

const resolveEffective = (
  colorMode: ColorMode,
  lightThemeId: string,
  darkThemeId: string
): { isDark: boolean; themeId: string } => {
  const isDark = colorMode === 'auto' ? getSystemPrefersDark() : colorMode === 'dark';
  return {
    isDark,
    themeId: isDark ? darkThemeId : lightThemeId,
  };
};

const persistThemeToDB = async (payload: {
  themeId: string;
  uiStyle: UiStyle;
  colorMode: ColorMode;
  lightThemeId: string;
  darkThemeId: string;
}) => {
  try {
    await core.init();
    await core.settingsService.saveSetting<AppThemeSetting>('app_theme', payload);
  } catch {
    void 0;
  }
};

interface ThemeState {
  currentThemeId: string;
  lightThemeId: string;
  darkThemeId: string;
  colorMode: ColorMode;
  uiStyle: UiStyle;
  isDark: boolean;
  setTheme: (themeId: string) => 'applied' | 'saved_only';
  setColorMode: (mode: ColorMode) => void;
  setUiStyle: (style: UiStyle) => void;
  setDark: (dark: boolean) => void;
  toggleDark: () => void;
  loadThemeFromDB: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const { colorMode, lightThemeId, darkThemeId } = getInitialThemeSlots();
  const initialUiStyle = getInitialUiStyle();
  const effective = resolveEffective(colorMode, lightThemeId, darkThemeId);

  if (typeof document !== 'undefined') {
    applyThemeToDOM(effective.themeId);
    applyUiStyleToDOM(initialUiStyle);
    syncSplashChrome(effective.themeId, initialUiStyle, effective.isDark);
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      const state = get();
      if (state.colorMode !== 'auto') return;
      const next = resolveEffective('auto', state.lightThemeId, state.darkThemeId);
      if (next.themeId === state.currentThemeId && next.isDark === state.isDark) return;
      applyThemeToDOM(next.themeId);
      syncSplashChrome(next.themeId, state.uiStyle, next.isDark);
      set({
        currentThemeId: next.themeId,
        isDark: next.isDark,
      });
    };
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemChange);
    } else if (typeof (mediaQuery as unknown as { addListener?: (cb: () => void) => void }).addListener === 'function') {
      (mediaQuery as unknown as { addListener: (cb: () => void) => void }).addListener(handleSystemChange);
    }
  }

  const syncStateAndPersist = (next: {
    colorMode: ColorMode;
    lightThemeId: string;
    darkThemeId: string;
    uiStyle: UiStyle;
  }) => {
    const resolved = resolveEffective(next.colorMode, next.lightThemeId, next.darkThemeId);
    applyThemeToDOM(resolved.themeId);
    applyUiStyleToDOM(next.uiStyle);
    syncSplashChrome(resolved.themeId, next.uiStyle, resolved.isDark);

    safeSetStorage(UI_STYLE_STORAGE_KEY, next.uiStyle);
    safeSetStorage(COLOR_MODE_STORAGE_KEY, next.colorMode);
    safeSetStorage(LIGHT_THEME_STORAGE_KEY, next.lightThemeId);
    safeSetStorage(DARK_THEME_STORAGE_KEY, next.darkThemeId);

    set({
      currentThemeId: resolved.themeId,
      lightThemeId: next.lightThemeId,
      darkThemeId: next.darkThemeId,
      colorMode: next.colorMode,
      uiStyle: next.uiStyle,
      isDark: resolved.isDark,
    });

    void persistThemeToDB({
      themeId: resolved.themeId,
      uiStyle: next.uiStyle,
      colorMode: next.colorMode,
      lightThemeId: next.lightThemeId,
      darkThemeId: next.darkThemeId,
    });
  };

  return {
    currentThemeId: effective.themeId,
    lightThemeId,
    darkThemeId,
    colorMode,
    uiStyle: initialUiStyle,
    isDark: effective.isDark,

    loadThemeFromDB: async () => {
      try {
        await core.init();
        const record = await core.settingsService.getSetting<AppThemeSetting>('app_theme');
        if (!record) return;

        const state = get();
        const nextUiStyle: UiStyle =
          record.uiStyle === 'paper' || record.uiStyle === 'modern'
            ? record.uiStyle
            : state.uiStyle;
        let nextLight = state.lightThemeId;
        if (record.lightThemeId && isLightTheme(record.lightThemeId)) {
          nextLight = record.lightThemeId;
        } else if (record.themeId && isLightTheme(record.themeId)) {
          nextLight = record.themeId;
        }

        let nextDark = state.darkThemeId;
        if (record.darkThemeId && isDarkTheme(record.darkThemeId)) {
          nextDark = record.darkThemeId;
        } else if (record.themeId && isDarkTheme(record.themeId)) {
          nextDark = record.themeId;
        }

        let nextMode = state.colorMode;
        if (record.colorMode === 'light' || record.colorMode === 'dark' || record.colorMode === 'auto') {
          nextMode = record.colorMode;
        } else if (record.themeId && isDarkTheme(record.themeId)) {
          nextMode = 'dark';
        }

        const resolved = resolveEffective(nextMode, nextLight, nextDark);
        if (
          resolved.themeId === state.currentThemeId &&
          resolved.isDark === state.isDark &&
          nextUiStyle === state.uiStyle &&
          nextMode === state.colorMode &&
          nextLight === state.lightThemeId &&
          nextDark === state.darkThemeId
        ) {
          return;
        }
        applyThemeToDOM(resolved.themeId);
        applyUiStyleToDOM(nextUiStyle);
        syncSplashChrome(resolved.themeId, nextUiStyle, resolved.isDark);

        safeSetStorage(UI_STYLE_STORAGE_KEY, nextUiStyle);
        safeSetStorage(COLOR_MODE_STORAGE_KEY, nextMode);
        safeSetStorage(LIGHT_THEME_STORAGE_KEY, nextLight);
        safeSetStorage(DARK_THEME_STORAGE_KEY, nextDark);

        set({
          currentThemeId: resolved.themeId,
          lightThemeId: nextLight,
          darkThemeId: nextDark,
          colorMode: nextMode,
          uiStyle: nextUiStyle,
          isDark: resolved.isDark,
        });
      } catch {
        void 0;
      }
    },

    setColorMode: (mode: ColorMode) => {
      const state = get();
      syncStateAndPersist({
        colorMode: mode,
        lightThemeId: state.lightThemeId,
        darkThemeId: state.darkThemeId,
        uiStyle: state.uiStyle,
      });
    },

    setTheme: (targetThemeId: string) => {
      const theme = THEME_OPTIONS.find((t) => t.id === targetThemeId);
      if (!theme) return 'applied';

      const state = get();
      const nextLight = theme.isDark ? theme.pairedId : theme.id;
      const nextDark = theme.isDark ? theme.id : theme.pairedId;

      if (state.colorMode === 'auto') {
        syncStateAndPersist({
          colorMode: 'auto',
          lightThemeId: nextLight,
          darkThemeId: nextDark,
          uiStyle: state.uiStyle,
        });
        return theme.isDark === state.isDark ? 'applied' : 'saved_only';
      }

      const nextMode: ColorMode = theme.isDark ? 'dark' : 'light';
      syncStateAndPersist({
        colorMode: nextMode,
        lightThemeId: nextLight,
        darkThemeId: nextDark,
        uiStyle: state.uiStyle,
      });
      return 'applied';
    },

    setUiStyle: (style: UiStyle) => {
      const state = get();
      syncStateAndPersist({
        colorMode: state.colorMode,
        lightThemeId: state.lightThemeId,
        darkThemeId: state.darkThemeId,
        uiStyle: style,
      });
    },

    setDark: (dark: boolean) => {
      get().setColorMode(dark ? 'dark' : 'light');
    },

    toggleDark: () => {
      get().setColorMode(get().isDark ? 'light' : 'dark');
    },
  };
});
