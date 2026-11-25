import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { TransactionRepository } from '../../src/core/repositories/TransactionRepository';
import { AccountRepository } from '../../src/core/repositories/AccountRepository';
import { SettingsRepository } from '../../src/core/repositories/SettingsRepository';
import { DataLifecycleService } from '../../src/domain/data/dataLifecycleService';
import { STORES } from '../../src/core/db/schema';
import type { Transaction } from '../../src/types/transaction';

describe('Repository soft-delete tombstones and adapter transactions', () => {
  let adapter: MemoryAdapter;
  let txRepo: TransactionRepository;
  let acctRepo: AccountRepository;
  let settingsRepo: SettingsRepository;
  let lifecycle: DataLifecycleService;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.initialize();
    txRepo = new TransactionRepository(adapter);
    acctRepo = new AccountRepository(adapter);
    settingsRepo = new SettingsRepository(adapter);
    lifecycle = new DataLifecycleService(adapter);
  });

  it('writes deletedAt tombstone on delete and hides it from findById and findAll', async () => {
    const created = await txRepo.create({
      id: 'tx_soft_1',
      type: 'expense',
      amount: 5000,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-11-25',
    });

    await txRepo.delete(created.id);

    expect(await txRepo.findById(created.id)).toBeNull();
    expect(await txRepo.findAll()).toHaveLength(0);

    const standardExport = await lifecycle.exportData();
    expect(standardExport.transactions).toHaveLength(0);

    const syncExport = await lifecycle.exportData({ includeTombstones: true });
    expect(syncExport.transactions).toHaveLength(1);
    expect(syncExport.transactions[0].id).toBe('tx_soft_1');
    expect((syncExport.transactions[0] as unknown as { deletedAt?: string }).deletedAt).toBeTruthy();
  });

  it('rejects updates to soft-deleted entities and supports re-creating with same id without tombstone', async () => {
    const created = await txRepo.create({
      id: 'tx_soft_2',
      type: 'expense',
      amount: 1200,
      accountId: 'acct_1',
      categoryId: 'cat_food',
      date: '2026-11-25',
    });

    await txRepo.delete(created.id);

    await expect(
      txRepo.update(created.id, { amount: 2000 })
    ).rejects.toThrow();

    const recreated = await txRepo.create({
      id: 'tx_soft_2',
      type: 'expense',
      amount: 3000,
      accountId: 'acct_1',
      categoryId: 'cat_food',
      date: '2026-11-25',
    });

    expect((recreated as unknown as { deletedAt?: string }).deletedAt).toBeUndefined();
    expect(await txRepo.findById('tx_soft_2')).not.toBeNull();
  });

  it('physically deletes entities in non-tombstone repositories and rolls back failed transactions', async () => {
    await settingsRepo.saveSetting('sample_setting', { flag: true });
    expect(await settingsRepo.findById('sample_setting')).not.toBeNull();
    await settingsRepo.delete('sample_setting');
    expect(await settingsRepo.findById('sample_setting')).toBeNull();
    expect(await adapter.get(STORES.SETTINGS, 'sample_setting')).toBeNull();

    await acctRepo.create({
      id: 'acct_tx_1',
      name: 'Wallet',
      type: 'savings',
      balance: 10000,
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
    });

    await expect(
      adapter.runInTransaction([STORES.ACCOUNTS, STORES.TRANSACTIONS], async () => {
        await acctRepo.adjustBalance('acct_tx_1', -2500);
        throw new Error('simulated failure');
      })
    ).rejects.toThrow('simulated failure');

    const acctAfter = await acctRepo.findById('acct_tx_1');
    expect(acctAfter?.balance).toBe(10000);
    const rawTxs = await adapter.getAll<Transaction>(STORES.TRANSACTIONS);
    expect(rawTxs).toHaveLength(0);
  });
});
