import { create } from 'zustand';

export type UiStyle = 'paper' | 'modern';

export interface ThemeOption {
  id: string;
  name: string;
  subName: string;
  isDark: boolean;
  colorDot: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'theme-sage', name: '竹青素笺', subName: 'Sage Green', isDark: false, colorDot: '#3F8256' },
  { id: 'theme-cotton', name: '特种米白', subName: 'Cotton White', isDark: false, colorDot: '#78634B' },
  { id: 'theme-kraft', name: '复古牛皮', subName: 'Kraft Paper', isDark: false, colorDot: '#BA6E38' },
  { id: 'theme-mist', name: '雾霭蓝卡', subName: 'Mist Blue', isDark: false, colorDot: '#3D7299' },
  { id: 'theme-cherry', name: '樱落绯灰', subName: 'Cherry Ash', isDark: false, colorDot: '#AC495E' },

  { id: 'theme-carbon', name: '复写碳纸', subName: 'Carbon Paper', isDark: true, colorDot: '#B5935A' },
  { id: 'theme-indigo', name: '古法靛蓝', subName: 'Indigo Night', isDark: true, colorDot: '#5289B3' },
  { id: 'theme-espresso', name: '深焙浓缩', subName: 'Espresso Dark', isDark: true, colorDot: '#CC814B' },
  { id: 'theme-obsidian', name: '黑曜石金', subName: 'Obsidian Gold', isDark: true, colorDot: '#C7A76E' },
  { id: 'theme-pine', name: '幽林松柏', subName: 'Forest Pine', isDark: true, colorDot: '#529E6C' },
];

const THEME_STORAGE_KEY = 'hamsterstash_theme_v4';
const UI_STYLE_STORAGE_KEY = 'hamsterstash_ui_style_v1';

const applyUiStyleToDOM = (uiStyle: UiStyle) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.uiStyle = uiStyle;
    document.body.dataset.uiStyle = uiStyle;
  }
};

const applyThemeToDOM = (themeId: string) => {
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

const getInitialTheme = (): string => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && THEME_OPTIONS.some((t) => t.id === saved)) {
      return saved;
    }
  } catch {
    void 0;
  }
  return 'theme-sage';
};

const getInitialUiStyle = (): UiStyle => {
  try {
    const saved = localStorage.getItem(UI_STYLE_STORAGE_KEY);
    if (saved === 'modern' || saved === 'paper') {
      return saved;
    }
  } catch {
    void 0;
  }
  return 'modern';
};

interface ThemeState {
  currentThemeId: string;
  uiStyle: UiStyle;
  isDark: boolean;
  setTheme: (themeId: string) => void;
  setUiStyle: (style: UiStyle) => void;
  setDark: (dark: boolean) => void;
  toggleDark: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialThemeId = getInitialTheme();
  const initialTheme = THEME_OPTIONS.find((t) => t.id === initialThemeId) || THEME_OPTIONS[0];
  const initialUiStyle = getInitialUiStyle();

  if (typeof document !== 'undefined') {
    applyThemeToDOM(initialThemeId);
    applyUiStyleToDOM(initialUiStyle);
  }

  return {
    currentThemeId: initialThemeId,
    uiStyle: initialUiStyle,
    isDark: initialTheme.isDark,

    setTheme: (themeId: string) => {
      const theme = THEME_OPTIONS.find((t) => t.id === themeId);
      if (!theme) return;

      applyThemeToDOM(theme.id);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme.id);
      } catch {
        void 0;
      }

      set({
        currentThemeId: theme.id,
        isDark: theme.isDark,
      });
    },

    setUiStyle: (style: UiStyle) => {
      applyUiStyleToDOM(style);
      try {
        localStorage.setItem(UI_STYLE_STORAGE_KEY, style);
      } catch {
        void 0;
      }
      set({ uiStyle: style });
    },

    setDark: (dark: boolean) => {
      const { isDark } = get();
      if (dark === isDark) return;
      if (dark) {
        get().setTheme('theme-carbon');
      } else {
        get().setTheme('theme-sage');
      }
    },

    toggleDark: () => {
      const { isDark } = get();
      if (isDark) {
        get().setTheme('theme-sage');
      } else {
        get().setTheme('theme-carbon');
      }
    },
  };
});
