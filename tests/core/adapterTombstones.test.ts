import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { STORES } from '../../src/core/db/schema';
import type { Transaction } from '../../src/types/transaction';

describe('Adapter soft-delete tombstones', () => {
  let adapter: MemoryAdapter;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.initialize();
  });

  it('writes deletedAt tombstone on delete and hides it from read and query', async () => {
    const created = await adapter.create<Transaction>(STORES.TRANSACTIONS, {
      id: 'tx_soft_1',
      type: 'expense',
      amount: 5000,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-11-25',
    });

    await adapter.delete(STORES.TRANSACTIONS, created.id);

    expect(await adapter.read(STORES.TRANSACTIONS, created.id)).toBeNull();
    expect(await adapter.query(STORES.TRANSACTIONS)).toHaveLength(0);

    const standardExport = await adapter.export();
    expect(standardExport.transactions).toHaveLength(0);

    const syncExport = await adapter.export({ includeTombstones: true });
    expect(syncExport.transactions).toHaveLength(1);
    expect(syncExport.transactions[0].id).toBe('tx_soft_1');
    expect((syncExport.transactions[0] as unknown as { deletedAt?: string }).deletedAt).toBeTruthy();
  });

  it('rejects updates to soft-deleted entities and supports re-creating with same id without tombstone', async () => {
    const created = await adapter.create<Transaction>(STORES.TRANSACTIONS, {
      id: 'tx_soft_2',
      type: 'expense',
      amount: 1200,
      accountId: 'acct_1',
      categoryId: 'cat_food',
      date: '2026-11-25',
    });

    await adapter.delete(STORES.TRANSACTIONS, created.id);

    await expect(
      adapter.update(STORES.TRANSACTIONS, created.id, { amount: 2000 })
    ).rejects.toThrow();

    const recreated = await adapter.create<Transaction>(STORES.TRANSACTIONS, {
      id: 'tx_soft_2',
      type: 'expense',
      amount: 3000,
      accountId: 'acct_1',
      categoryId: 'cat_food',
      date: '2026-11-25',
    });

    expect((recreated as unknown as { deletedAt?: string }).deletedAt).toBeUndefined();
    expect(await adapter.read(STORES.TRANSACTIONS, 'tx_soft_2')).not.toBeNull();
  });
});
