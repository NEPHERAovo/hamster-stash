import { describe, it, expect, beforeEach } from 'vitest';
import { THEME_OPTIONS, useThemeStore } from '../../src/stores/useThemeStore';

describe('useThemeStore mobile PWA status bar & root chrome sync', () => {
  beforeEach(() => {
    document.head.innerHTML = [
      '<meta name="color-scheme" content="light dark" />',
      '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F3F4F6" />',
      '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#090A0D" />',
    ].join('\n');
    document.documentElement.style.backgroundColor = '#F3F4F6';
    document.documentElement.style.colorScheme = 'light';
    if (document.body) {
      document.body.style.backgroundColor = '#F3F4F6';
    }
    localStorage.clear();
    useThemeStore.getState().setUiStyle('modern');
    useThemeStore.getState().setTheme('theme-sage');
    useThemeStore.getState().setTheme('theme-pine');
    useThemeStore.getState().setColorMode('light');
  });

  const getThemeColorValues = () =>
    Array.from(document.querySelectorAll('meta[name="theme-color"]')).map((el) => ({
      media: el.getAttribute('media'),
      content: el.getAttribute('content'),
    }));

  it('syncs html/body backgroundColor, color-scheme meta, and both media theme-color tags in manual dark and light modes', () => {
    useThemeStore.getState().setColorMode('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(9, 10, 13)');
    expect(document.body.style.backgroundColor).toBe('rgb(9, 10, 13)');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark');
    expect(getThemeColorValues()).toEqual([
      { media: '(prefers-color-scheme: light)', content: '#090A0D' },
      { media: '(prefers-color-scheme: dark)', content: '#090A0D' },
    ]);

    useThemeStore.getState().setColorMode('light');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(243, 244, 246)');
    expect(document.body.style.backgroundColor).toBe('rgb(243, 244, 246)');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light');
    expect(getThemeColorValues()).toEqual([
      { media: '(prefers-color-scheme: light)', content: '#F3F4F6' },
      { media: '(prefers-color-scheme: dark)', content: '#F3F4F6' },
    ]);
  });

  it('syncs paper theme base colors to html/body backgroundColor and theme-color when switching uiStyle or paper themes', () => {
    useThemeStore.getState().setUiStyle('paper');
    useThemeStore.getState().setTheme('theme-indigo');

    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(14, 19, 28)');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark');
    expect(getThemeColorValues()).toEqual([
      { media: '(prefers-color-scheme: light)', content: '#0E131C' },
      { media: '(prefers-color-scheme: dark)', content: '#0E131C' },
    ]);

    useThemeStore.getState().setTheme('theme-sage');

    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(238, 244, 237)');
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light');
    expect(getThemeColorValues()).toEqual([
      { media: '(prefers-color-scheme: light)', content: '#EEF4ED' },
      { media: '(prefers-color-scheme: dark)', content: '#EEF4ED' },
    ]);
  });

  it('tracks independent light and dark colors in auto mode and avoids unnecessary DOM replacements when unchanged', () => {
    useThemeStore.getState().setUiStyle('paper');
    useThemeStore.getState().setTheme('theme-cherry');
    useThemeStore.getState().setTheme('theme-indigo');
    useThemeStore.getState().setColorMode('auto');

    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('light dark');
    expect(getThemeColorValues()).toEqual([
      { media: '(prefers-color-scheme: light)', content: '#F6ECEE' },
      { media: '(prefers-color-scheme: dark)', content: '#0E131C' },
    ]);
    expect(localStorage.getItem('hamsterstash_splash_bg_light_v1')).toBe('#F6ECEE');
    expect(localStorage.getItem('hamsterstash_splash_bg_dark_v1')).toBe('#0E131C');

    const initialMetas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    useThemeStore.getState().setColorMode('auto');
    const sameMetas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    expect(sameMetas[0]).toBe(initialMetas[0]);
    expect(sameMetas[1]).toBe(initialMetas[1]);

    useThemeStore.getState().setColorMode('dark');
    const replacedMetas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    expect(replacedMetas[0]).not.toBe(initialMetas[0]);
    expect(replacedMetas[1]).not.toBe(initialMetas[1]);
    expect(getThemeColorValues()).toEqual([
      { media: '(prefers-color-scheme: light)', content: '#0E131C' },
      { media: '(prefers-color-scheme: dark)', content: '#0E131C' },
    ]);
  });

  it('aligns light and dark themes by color family while keeping light/dark selection independent', () => {
    const lightThemes = THEME_OPTIONS.filter((t) => !t.isDark);
    const darkThemes = THEME_OPTIONS.filter((t) => t.isDark);

    expect(lightThemes.map((t) => t.id)).toEqual([
      'theme-sage',
      'theme-cotton',
      'theme-kraft',
      'theme-mist',
      'theme-cherry',
    ]);
    expect(darkThemes.map((t) => t.id)).toEqual([
      'theme-pine',
      'theme-carbon',
      'theme-espresso',
      'theme-indigo',
      'theme-crimson',
    ]);

    useThemeStore.getState().setUiStyle('paper');
    useThemeStore.getState().setTheme('theme-pine');
    useThemeStore.getState().setTheme('theme-cherry');
    expect(useThemeStore.getState().lightThemeId).toBe('theme-cherry');
    expect(useThemeStore.getState().darkThemeId).toBe('theme-pine');

    useThemeStore.getState().setColorMode('dark');
    expect(useThemeStore.getState().currentThemeId).toBe('theme-pine');
    expect(getThemeColorValues()).toEqual([
      { media: '(prefers-color-scheme: light)', content: '#0C140E' },
      { media: '(prefers-color-scheme: dark)', content: '#0C140E' },
    ]);

    useThemeStore.getState().setTheme('theme-indigo');
    expect(useThemeStore.getState().darkThemeId).toBe('theme-indigo');
    expect(useThemeStore.getState().lightThemeId).toBe('theme-cherry');

    useThemeStore.getState().setColorMode('light');
    expect(useThemeStore.getState().currentThemeId).toBe('theme-cherry');

    useThemeStore.getState().setColorMode('auto');
    const result = useThemeStore.getState().setTheme('theme-espresso');
    expect(result).toBe('saved_only');
    expect(useThemeStore.getState().darkThemeId).toBe('theme-espresso');
    expect(useThemeStore.getState().lightThemeId).toBe('theme-cherry');
  });
});
