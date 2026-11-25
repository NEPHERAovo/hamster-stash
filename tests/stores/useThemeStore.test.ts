import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../../src/stores/useThemeStore';

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
});
