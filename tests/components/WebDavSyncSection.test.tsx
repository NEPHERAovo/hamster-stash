import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { WebDavSyncSection } from '../../src/components/assets/WebDavSyncSection';
import { syncService } from '../../src/domain/sync/syncService';

vi.mock('../../src/domain/sync/syncService', () => ({
  syncService: {
    getWebDavConfig: vi.fn(),
    saveWebDavConfig: vi.fn(),
    testConnection: vi.fn(),
    sync: vi.fn(),
    prepareWebDavSync: vi.fn(),
    commitWebDavSync: vi.fn(),
    getPendingReview: vi.fn(),
    clearPendingReview: vi.fn(),
  },
}));

vi.mock('../../src/stores/useAccountStore', () => ({
  useAccountStore: () => ({ loadAccounts: vi.fn() }),
}));
vi.mock('../../src/stores/useCategoryStore', () => ({
  useCategoryStore: () => ({ loadCategories: vi.fn() }),
}));
vi.mock('../../src/stores/useLedgerStore', () => ({
  useLedgerStore: () => ({ loadMonth: vi.fn(), loadTransactions: vi.fn() }),
}));
vi.mock('../../src/stores/useThemeStore', () => ({
  useThemeStore: () => ({ loadThemeFromDB: vi.fn() }),
}));
vi.mock('../../src/stores/useToastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe('WebDavSyncSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(syncService.getWebDavConfig).mockResolvedValue({
      config: {
        url: 'https://dav.jianguoyun.com/dav/',
        username: 'test@example.com',
        password: 'secret-token-password',
        syncPath: 'hamsterstash',
        proxyMode: 'builtin',
      },
      lastSyncAt: undefined,
      autoSyncDaily: false,
      syncAttachments: false,
      uploadedAttachmentIds: [],
    });
  });

  it('toggles password visibility when clicking eye button', async () => {
    render(<WebDavSyncSection />);

    const expandBtn = screen.getByRole('button', { name: '展开配置' });
    fireEvent.click(expandBtn);

    const passwordInput = await screen.findByPlaceholderText('密码');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleEyeBtn = screen.getByRole('button', { name: '显示密码' });
    fireEvent.click(toggleEyeBtn);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: '隐藏密码' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '隐藏密码' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('fills preset url and selects proxy mode when preset chip is clicked', async () => {
    render(<WebDavSyncSection />);

    const expandBtn = screen.getByRole('button', { name: '展开配置' });
    fireEvent.click(expandBtn);

    const alistChip = await screen.findByRole('button', { name: 'Alist' });
    fireEvent.click(alistChip);

    const urlInput = screen.getByPlaceholderText('https://dav.jianguoyun.com/dav/');
    expect(urlInput).toHaveValue('http://localhost:5244/dav/');
  });

  it('allows multiline custom headers input when custom proxy mode is active', async () => {
    render(<WebDavSyncSection />);

    const expandBtn = screen.getByRole('button', { name: '展开配置' });
    fireEvent.click(expandBtn);

    await screen.findByDisplayValue('https://dav.jianguoyun.com/dav/');

    const customProxyOption = screen.getByText('自建代理');
    fireEvent.click(customProxyOption);

    const textarea = screen.getByPlaceholderText(/CF-Access-Client-Id: xxx/);
    expect(textarea.tagName).toBe('TEXTAREA');

    fireEvent.change(textarea, {
      target: { value: 'CF-Access-Client-Id: key1\nCF-Access-Client-Secret: secret2' },
    });

    const saveBtn = screen.getByRole('button', { name: '保存配置' });
    fireEvent.click(saveBtn);

    expect(syncService.saveWebDavConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        proxyMode: 'custom',
        customHeaders: {
          'CF-Access-Client-Id': 'key1',
          'CF-Access-Client-Secret': 'secret2',
        },
      }),
      expect.any(Object)
    );
  });
});
