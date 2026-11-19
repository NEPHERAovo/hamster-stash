import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SettingsCard } from '../../src/components/assets/SettingsCard';
import { usePwaStore } from '../../src/stores/usePwaStore';

vi.mock('../../src/components/assets/WebDavSyncSection', () => ({
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
});
