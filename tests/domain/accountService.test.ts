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

  it('excludes accounts with includeInNetWorth set to false from total net worth', async () => {
    await acctService.createAccount({
      name: '工资卡',
      type: 'bank',
      initialBalance: 800000,
      includeInNetWorth: true,
    });
    await acctService.createAccount({
      name: '代管资金',
      type: 'ewallet',
      initialBalance: 250000,
      includeInNetWorth: false,
    });

    const netWorth = await acctService.calculateNetWorth();
    expect(netWorth).toBe(800000);
  });

  it('updates account metadata including name, type, icon, and includeInNetWorth', async () => {
    const acct = await acctService.createAccount({
      name: '默认卡',
      type: 'bank',
      initialBalance: 100000,
    });

    const updated = await acctService.updateAccount(acct.id, {
      name: '招行信用卡',
      type: 'credit',
      icon: 'credit-card',
      includeInNetWorth: false,
    });

    expect(updated.name).toBe('招行信用卡');
    expect(updated.type).toBe('credit');
    expect(updated.icon).toBe('credit-card');
    expect(updated.includeInNetWorth).toBe(false);
    expect(await acctService.calculateNetWorth()).toBe(0);

    await expect(
      acctService.updateAccount(acct.id, { name: '   ' })
    ).rejects.toThrow('账户名称不能为空');
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

  it('creates and updates credit accounts with repayment day, autoRepay, and linked repayment account', async () => {
    const debit = await acctService.createAccount({
      name: '招商银行储蓄卡',
      type: 'bank',
      initialBalance: 500000,
    });

    const credit = await acctService.createAccount({
      name: '招商信用卡',
      type: 'credit',
      accountCategory: 'credit',
      initialBalance: -150000,
      creditLimit: 2000000,
      billDay: 5,
      repaymentDay: 23,
      repaymentAccountId: debit.id,
      autoRepay: true,
    });

    expect(credit.accountCategory).toBe('credit');
    expect(credit.creditLimit).toBe(2000000);
    expect(credit.billDay).toBe(5);
    expect(credit.repaymentDay).toBe(23);
    expect(credit.repaymentAccountId).toBe(debit.id);
    expect(credit.autoRepay).toBe(true);

    const updated = await acctService.updateAccount(credit.id, {
      repaymentDay: 25,
      autoRepay: false,
      creditLimit: 3000000,
    });

    expect(updated.repaymentDay).toBe(25);
    expect(updated.autoRepay).toBe(false);
    expect(updated.creditLimit).toBe(3000000);
  });
});
