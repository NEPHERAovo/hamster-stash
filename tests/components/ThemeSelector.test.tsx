import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSelector } from '../../src/components/ui/ThemeSelector';
import { THEME_OPTIONS, useThemeStore } from '../../src/stores/useThemeStore';

describe('ThemeSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.getState().setUiStyle('paper');
    useThemeStore.getState().setTheme('theme-sage');
    useThemeStore.getState().setTheme('theme-pine');
    useThemeStore.getState().setColorMode('light');
  });

  it('renders light and dark group labels without paper wording or visible theme names', () => {
    render(<ThemeSelector />);

    expect(screen.getByText('浅色')).toBeInTheDocument();
    expect(screen.getByText('深色')).toBeInTheDocument();
    expect(screen.queryByText('浅色纸张')).not.toBeInTheDocument();
    expect(screen.queryByText('深色纸张')).not.toBeInTheDocument();

    for (const theme of THEME_OPTIONS) {
      expect(screen.queryByText(theme.name)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: theme.name })).toBeInTheDocument();
    }
  });

  it('selects a color swatch and updates theme store', () => {
    render(<ThemeSelector />);

    fireEvent.click(screen.getByRole('button', { name: '复古牛皮' }));
    expect(useThemeStore.getState().lightThemeId).toBe('theme-kraft');
    expect(useThemeStore.getState().currentThemeId).toBe('theme-kraft');
  });
});
