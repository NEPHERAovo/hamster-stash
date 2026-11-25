import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { CategoryRepository } from '../../src/core/repositories/CategoryRepository';
import { TransactionRepository } from '../../src/core/repositories/TransactionRepository';
import { CategoryService } from '../../src/domain/category/categoryService';
import { DataLifecycleService } from '../../src/domain/data/dataLifecycleService';
import { AccountRepository } from '../../src/core/repositories/AccountRepository';
import { SeedService } from '../../src/domain/bootstrap/seedService';

describe('CategoryService & DataLifecycleService', () => {
  let adapter: MemoryAdapter;
  let catRepo: CategoryRepository;
  let txRepo: TransactionRepository;
  let acctRepo: AccountRepository;
  let catService: CategoryService;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.initialize();
    catRepo = new CategoryRepository(adapter);
    txRepo = new TransactionRepository(adapter);
    acctRepo = new AccountRepository(adapter);
    catService = new CategoryService(catRepo, txRepo);
  });

  it('archives categories linked to transactions and enforces minimum active category count', async () => {
    const c1 = await catService.createCategory({ name: '餐饮', type: 'expense' });
    const c2 = await catService.createCategory({ name: '交通', type: 'expense' });
    await acctRepo.create({
      id: 'acct_1',
      name: '钱包',
      type: 'savings',
      balance: 1000,
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
    });
    await txRepo.create({
      id: 'tx_1',
      type: 'expense',
      amount: 100,
      accountId: 'acct_1',
      categoryId: c1.id,
      date: '2026-11-25',
    });

    const res1 = await catService.removeCategory(c1.id);
    expect(res1.archived).toBe(true);
    const reloadedC1 = await catRepo.findById(c1.id);
    expect(reloadedC1?.isArchived).toBe(true);

    await expect(catService.removeCategory(c2.id)).rejects.toThrow('至少需保留一个可用分类');
  });

  it('reorders categories atomically and exports scoped CSV via DataLifecycleService', async () => {
    const c1 = await catService.createCategory({ name: 'A', type: 'expense' });
    const c2 = await catService.createCategory({ name: 'B', type: 'expense' });

    const reordered = await catService.reorderCategories([c2.id, c1.id]);
    expect(reordered[0].id).toBe(c2.id);
    expect(reordered[0].sortOrder).toBe(1);
    expect(reordered[1].sortOrder).toBe(2);

    const seedService = new SeedService(adapter);
    const lifecycle = new DataLifecycleService({
      adapterResolver: adapter,
      txRepo,
      acctRepo,
      catRepo,
      seedService,
    });

    const csvOut = await lifecycle.exportCsvRange({ start: null, end: null });
    expect(csvOut.exportedCount).toBe(0);
    expect(csvOut.csvContent).toContain('日期');

    await lifecycle.clearAllData();
    const afterCats = await catService.listCategories();
    expect(afterCats.length).toBeGreaterThan(10);
  });
});
