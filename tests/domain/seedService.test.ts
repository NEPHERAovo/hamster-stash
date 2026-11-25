import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { CoreContext } from '../../src/core';
import { SeedService } from '../../src/domain/bootstrap/seedService';
import { STORES } from '../../src/core/db/schema';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from '../../src/core/db/defaultData';
import type { Account } from '../../src/types/account';
import type { Category } from '../../src/types/category';
import type { Transaction } from '../../src/types/transaction';

describe('SeedService & CoreContext bootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('seeds default categories and accounts with epoch timestamp when empty', async () => {
    const adapter = new MemoryAdapter();
    await adapter.initialize();
    const seedService = new SeedService(adapter);

    await seedService.ensureSeeded();

    const categories = await adapter.query<Category>(STORES.CATEGORIES);
    const accounts = await adapter.query<Account>(STORES.ACCOUNTS);

    expect(categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(accounts).toHaveLength(DEFAULT_ACCOUNTS.length);
    expect(categories[0].updatedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('heals corrupted system category names and never resurrects deleted system categories', async () => {
    const adapter = new MemoryAdapter();
    await adapter.initialize();
    const seedService = new SeedService(adapter);

    await seedService.ensureSeeded();
    await adapter.update<Category>(STORES.CATEGORIES, 'cat_food', { name: 'corrupted_food' });
    await adapter.delete(STORES.CATEGORIES, 'cat_market');

    await seedService.ensureSeeded();

    const food = await adapter.read<Category>(STORES.CATEGORIES, 'cat_food');
    const market = await adapter.read<Category>(STORES.CATEGORIES, 'cat_market');
    expect(food?.name).toBe('餐饮');
    expect(market).toBeNull();
  });

  it('seeds sandbox demo data when sandbox mode is active', async () => {
    localStorage.setItem('hamsterstash_sandbox_mode', 'true');
    const memAdapter = new MemoryAdapter();
    const ctx = new CoreContext(memAdapter);

    await Promise.all([ctx.init(), ctx.init()]);

    const txs = await memAdapter.query<Transaction>(STORES.TRANSACTIONS);
    const accts = await memAdapter.query<Account>(STORES.ACCOUNTS);
    expect(txs.length).toBeGreaterThan(10);
    expect(accts.length).toBeGreaterThanOrEqual(4);
  });
});
