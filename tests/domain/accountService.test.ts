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

  it('creates an account with initial balance and sort order', async () => {
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

  it('throws an error when account name is blank', async () => {
    await expect(
      acctService.createAccount({
        name: '   ',
        type: 'cash',
      })
    ).rejects.toThrow('账户名称不能为空');
  });

  it('calculates total net worth across active accounts', async () => {
    await acctService.createAccount({
      name: '储蓄卡',
      type: 'bank',
      initialBalance: 800000,
    });
    await acctService.createAccount({
      name: '信用卡',
      type: 'credit',
      initialBalance: -300000,
    });

    const netWorth = await acctService.calculateNetWorth();
    expect(netWorth).toBe(500000);
  });

  it('prevents deleting the last remaining account', async () => {
    const acct = await acctService.createAccount({
      name: '默认账户',
      type: 'cash',
      initialBalance: 0,
    });

    await expect(acctService.deleteAccount(acct.id)).rejects.toThrow(
      '系统至少需保留一个资金账户'
    );
  });

  it('prevents deleting an account with transactions unless force is specified', async () => {
    const acct1 = await acctService.createAccount({
      name: '零钱',
      type: 'ewallet',
      initialBalance: 1000,
    });
    await acctService.createAccount({
      name: '备用账户',
      type: 'cash',
      initialBalance: 0,
    });

    await txRepo.create({
      type: 'expense',
      amount: 500,
      accountId: acct1.id,
      categoryId: 'cat_food',
      date: '2026-10-09',
    });

    await expect(acctService.deleteAccount(acct1.id, false)).rejects.toThrow(
      '该账户下已有 1 条交易流水'
    );

    await acctService.deleteAccount(acct1.id, true);
    expect(await acctRepo.findById(acct1.id)).toBeNull();
    const remainingTxs = await txRepo.findByAccount(acct1.id);
    expect(remainingTxs.length).toBe(0);
  });
});
