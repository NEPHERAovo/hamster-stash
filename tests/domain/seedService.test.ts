import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { CoreContext } from '../../src/core';
import { SeedService } from '../../src/domain/bootstrap/seedService';
import { AccountRepository } from '../../src/core/repositories/AccountRepository';
import { CategoryRepository } from '../../src/core/repositories/CategoryRepository';
import { TransactionRepository } from '../../src/core/repositories/TransactionRepository';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES } from '../../src/core/db/defaultData';

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

    const catRepo = new CategoryRepository(adapter);
    const acctRepo = new AccountRepository(adapter);
    const categories = await catRepo.findAll();
    const accounts = await acctRepo.findAll();

    expect(categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(accounts).toHaveLength(DEFAULT_ACCOUNTS.length);
    expect(categories[0].updatedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('preserves user-renamed system categories and never resurrects deleted system categories', async () => {
    const adapter = new MemoryAdapter();
    await adapter.initialize();
    const seedService = new SeedService(adapter);
    const catRepo = new CategoryRepository(adapter);

    await seedService.ensureSeeded();
    await catRepo.update('cat_food', { name: '日常餐饮' });
    await catRepo.delete('cat_market');

    await seedService.ensureSeeded();

    const food = await catRepo.findById('cat_food');
    const market = await catRepo.findById('cat_market');
    expect(food?.name).toBe('日常餐饮');
    expect(market).toBeNull();
  });

  it('seeds sandbox demo data when sandbox mode is active', async () => {
    localStorage.setItem('hamsterstash_sandbox_mode', 'true');
    const memAdapter = new MemoryAdapter();
    const ctx = new CoreContext(memAdapter);

    await Promise.all([ctx.init(), ctx.init()]);

    const txRepo = new TransactionRepository(memAdapter);
    const acctRepo = new AccountRepository(memAdapter);
    const txs = await txRepo.findAll();
    const accts = await acctRepo.findAll();
    expect(txs.length).toBeGreaterThan(10);
    expect(accts.length).toBeGreaterThanOrEqual(4);
  });
});
