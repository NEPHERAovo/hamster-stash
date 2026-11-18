import { describe, it, expect } from 'vitest';
import { mergeSyncPayloads } from '../../src/domain/sync/diffMerger';
import type { ExportData } from '../../types/adapter';
import type { Transaction } from '../../types/transaction';
import type { Account } from '../../types/account';
import type { Category } from '../../types/category';

describe('diffMerger', () => {
  const createBaseExport = (): ExportData => ({
    version: '4.0.0',
    exportedAt: '2026-11-18T10:00:00.000Z',
    transactions: [],
    accounts: [],
    categories: [],
    settings: {},
    plugins: {
      data: [],
      settings: {},
    },
  });

  it('merges new local items to remote payload', () => {
    const local = createBaseExport();
    const remote = createBaseExport();

    const tx: Transaction = {
      id: 'tx_1',
      accountId: 'acct_1',
      categoryId: 'cat_1',
      type: 'expense',
      amount: 1500,
      timestamp: '2026-11-18T09:00:00.000Z',
      createdAt: '2026-11-18T09:00:00.000Z',
      updatedAt: '2026-11-18T09:00:00.000Z',
    };
    local.transactions.push(tx);

    const result = mergeSyncPayloads(local, remote);

    expect(result.merged.transactions).toHaveLength(1);
    expect(result.merged.transactions[0].id).toBe('tx_1');
    expect(result.stats.addedRemote).toBe(1);
    expect(result.changedRemote).toBe(true);
    expect(result.changedLocal).toBe(false);
  });

  it('merges new remote items into local payload', () => {
    const local = createBaseExport();
    const remote = createBaseExport();

    const acct: Account = {
      id: 'acct_remote',
      name: 'Cloud Vault',
      type: 'bank',
      balance: 100000,
      sortOrder: 1,
      createdAt: '2026-11-18T09:00:00.000Z',
      updatedAt: '2026-11-18T09:00:00.000Z',
    };
    remote.accounts.push(acct);

    const result = mergeSyncPayloads(local, remote);

    expect(result.merged.accounts).toHaveLength(1);
    expect(result.merged.accounts[0].id).toBe('acct_remote');
    expect(result.stats.addedLocal).toBe(1);
    expect(result.changedLocal).toBe(true);
    expect(result.changedRemote).toBe(false);
  });

  it('resolves conflicts using Last-Write-Wins based on updatedAt', () => {
    const local = createBaseExport();
    const remote = createBaseExport();

    const catLocal: Category = {
      id: 'cat_food',
      name: 'Food & Dining (Local)',
      type: 'expense',
      icon: 'utensils',
      sortOrder: 1,
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T09:00:00.000Z',
    };

    const catRemote: Category = {
      id: 'cat_food',
      name: 'Food & Dining (Remote Updated)',
      type: 'expense',
      icon: 'utensils',
      sortOrder: 1,
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T09:30:00.000Z',
    };

    local.categories.push(catLocal);
    remote.categories.push(catRemote);

    const result = mergeSyncPayloads(local, remote);

    expect(result.merged.categories).toHaveLength(1);
    expect(result.merged.categories[0].name).toBe('Food & Dining (Remote Updated)');
    expect(result.stats.updatedLocal).toBe(1);
    expect(result.changedLocal).toBe(true);
  });

  it('propagates tombstone deletion from remote to local', () => {
    const local = createBaseExport();
    const remote = createBaseExport();

    const txLocal: Transaction = {
      id: 'tx_tombstone',
      accountId: 'acct_1',
      categoryId: 'cat_1',
      type: 'expense',
      amount: 2000,
      timestamp: '2026-11-18T08:00:00.000Z',
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-18T08:00:00.000Z',
    };

    const txRemoteDeleted: Transaction = {
      ...txLocal,
      updatedAt: '2026-11-18T09:00:00.000Z',
      deletedAt: '2026-11-18T09:00:00.000Z',
    };

    local.transactions.push(txLocal);
    remote.transactions.push(txRemoteDeleted);

    const result = mergeSyncPayloads(local, remote);

    expect(result.merged.transactions).toHaveLength(0);
    expect(result.stats.deletedLocal).toBe(1);
    expect(result.changedLocal).toBe(true);
  });

  it('merges settings and plugin data correctly', () => {
    const local = createBaseExport();
    const remote = createBaseExport();

    local.settings = {
      app_theme: { themeId: 'theme-sage', uiStyle: 'paper' },
    };
    remote.settings = {
      webdav_config: { url: 'https://dav.example.com', username: 'user1' },
    };

    const result = mergeSyncPayloads(local, remote);

    expect(result.merged.settings).toBeDefined();
    expect(result.merged.settings?.app_theme).toBeDefined();
    expect(result.merged.settings?.webdav_config).toBeDefined();
  });
});
