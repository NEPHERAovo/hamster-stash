import { describe, it, expect, beforeEach } from 'vitest';
import { THEME_OPTIONS, useThemeStore } from '../../src/stores/useThemeStore';

describe('useThemeStore iOS status bar & root chrome sync', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#F3F4F6" />';
    document.documentElement.style.backgroundColor = '#F3F4F6';
    document.documentElement.style.colorScheme = 'light';
    useThemeStore.getState().setUiStyle('modern');
    useThemeStore.getState().setColorMode('light');
  });

  it('updates html backgroundColor, colorScheme, and theme-color meta tag immediately when toggling dark/light mode', () => {
    useThemeStore.getState().setColorMode('dark');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(9, 10, 13)');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#090A0D');

    useThemeStore.getState().setColorMode('light');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(243, 244, 246)');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#F3F4F6');
  });

  it('syncs paper theme base colors to html backgroundColor and theme-color when switching uiStyle or paper themes', () => {
    useThemeStore.getState().setUiStyle('paper');
    useThemeStore.getState().setTheme('theme-indigo');

    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(14, 19, 28)');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0E131C');

    useThemeStore.getState().setTheme('theme-sage');

    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.documentElement.style.backgroundColor).toBe('rgb(238, 244, 237)');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#EEF4ED');
  });

  it('replaces the single meta[name="theme-color"] node without media attribute and persists splash polarity', () => {
    useThemeStore.getState().setUiStyle('paper');
    useThemeStore.getState().setTheme('theme-sage');
    useThemeStore.getState().setTheme('theme-pine');
    useThemeStore.getState().setColorMode('auto');

    const metas = document.querySelectorAll('meta[name="theme-color"]');
    expect(metas).toHaveLength(1);
    expect(metas[0].hasAttribute('media')).toBe(false);
    expect(metas[0].getAttribute('content')).toBe('#EEF4ED');
    expect(localStorage.getItem('hamsterstash_splash_bg_v1')).toBe('#EEF4ED');
    expect(localStorage.getItem('hamsterstash_splash_dark_v1')).toBe('0');

    const firstMetaNode = metas[0];
    useThemeStore.getState().setColorMode('dark');
    const updatedMetas = document.querySelectorAll('meta[name="theme-color"]');
    expect(updatedMetas).toHaveLength(1);
    expect(updatedMetas[0]).not.toBe(firstMetaNode);
    expect(updatedMetas[0].getAttribute('content')).toBe('#0C140E');
    expect(localStorage.getItem('hamsterstash_splash_dark_v1')).toBe('1');
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
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0C140E');

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
