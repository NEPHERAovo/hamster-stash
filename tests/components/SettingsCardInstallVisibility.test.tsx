import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { SettingsCard } from '../../src/components/settings/SettingsCard';
import { usePwaStore } from '../../src/stores/usePwaStore';

vi.mock('../../src/components/settings/WebDavSyncSection', () => ({
  WebDavSyncSection: () => <div data-testid="mock-webdav" />,
}));

describe('SettingsCard PWA install row visibility', () => {
  beforeEach(() => {
    usePwaStore.setState({
      isInstalled: false,
      installPrompt: null,
    });
  });

  it('renders add to desktop row when not installed', () => {
    render(<SettingsCard />);
    expect(screen.getByText('添加到桌面')).toBeInTheDocument();
  });

  it('hides add to desktop row completely when already installed', () => {
    usePwaStore.setState({
      isInstalled: true,
    });

    render(<SettingsCard />);
    expect(screen.queryByText('添加到桌面')).not.toBeInTheDocument();
  });

  it('reveals GitHub repository link and description inside expanded About section', () => {
    render(<SettingsCard />);
    fireEvent.click(screen.getByText('关于'));

    expect(screen.getByText('个人账本 - 日常收支、物品收纳、资产管理。')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /github\.com\/NEPHERAovo\/hamster-stash/i });
    expect(link).toHaveAttribute('href', 'https://github.com/NEPHERAovo/hamster-stash');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
