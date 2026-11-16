import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { AccountRepository } from '../../src/core/repositories/AccountRepository';
import { TransactionRepository } from '../../src/core/repositories/TransactionRepository';
import { AccountService } from '../../src/domain/account/accountService';

describe('AccountService', () => {
  let adapter: MemoryAdapter;
  let acctRepo: AccountRepository;
  let txRepo: TransactionRepository;
  let acctService: AccountService;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.initialize();
    acctRepo = new AccountRepository(adapter);
    txRepo = new TransactionRepository(adapter);
    acctService = new AccountService(acctRepo, txRepo);
  });

  it('成功创建账户并初始化余额与排序权重', async () => {
    const acct1 = await acctService.createAccount({
      name: '招商银行储蓄卡',
      type: 'bank',
      initialBalance: 500000,
    });

    expect(acct1.id).toBeDefined();
    expect(acct1.name).toBe('招商银行储蓄卡');
    expect(acct1.balance).toBe(500000);
    expect(acct1.sortOrder).toBe(1);

    const acct2 = await acctService.createAccount({
      name: '微信零钱',
      type: 'ewallet',
      initialBalance: 12000,
    });
    expect(acct2.sortOrder).toBe(2);
  });

  it('账户名称为空时抛出错误', async () => {
    await expect(
      acctService.createAccount({
        name: '   ',
        type: 'cash',
      })
    ).rejects.toThrow('账户名称不能为空');
  });

  it('计算净资产：准确合并所有有效账户余额', async () => {
    await acctService.createAccount({
      name: '储蓄卡',
      type: 'bank',
      initialBalance: 800000, // +8000
    });
    await acctService.createAccount({
      name: '信用卡',
      type: 'credit',
      initialBalance: -300000, // -3000 (信用卡负债)
    });

    const netWorth = await acctService.calculateNetWorth();
    expect(netWorth).toBe(500000); // 8000 - 3000 = 5000 元 (500000 分)
  });

  it('安全检查：存在交易流水的账户阻止物理删除', async () => {
    const acct = await acctService.createAccount({
      name: '零钱',
      type: 'ewallet',
      initialBalance: 1000,
    });

    await txRepo.create({
      type: 'expense',
      amount: 500,
      accountId: acct.id,
      categoryId: 'cat_food',
      date: '2026-10-09',
    });

    await expect(acctService.deleteAccount(acct.id)).rejects.toThrow(
      '该账户下已有 1 条交易流水'
    );
  });
});
