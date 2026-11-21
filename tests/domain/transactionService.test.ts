import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { TransactionRepository } from '../../src/core/repositories/TransactionRepository';
import { AccountRepository } from '../../src/core/repositories/AccountRepository';
import { CategoryRepository } from '../../src/core/repositories/CategoryRepository';
import { TransactionService } from '../../src/domain/transaction/transactionService';
import {
  computeMonthSummary,
  centsToYuan,
  yuanToCents,
} from '../../src/domain/finance/balanceCalculator';

describe('TransactionService & Core Bookkeeping Logic', () => {
  let adapter: MemoryAdapter;
  let txRepo: TransactionRepository;
  let acctRepo: AccountRepository;
  let catRepo: CategoryRepository;
  let txService: TransactionService;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.initialize();

    txRepo = new TransactionRepository(adapter);
    acctRepo = new AccountRepository(adapter);
    catRepo = new CategoryRepository(adapter);

    txService = new TransactionService(txRepo, acctRepo, catRepo);

    await acctRepo.create({
      id: 'acct_wechat',
      name: '微信零钱',
      type: 'savings',
      balance: 100000, // 初始 1000.00 元
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
    });

    await acctRepo.create({
      id: 'acct_bank',
      name: '招商银行卡',
      type: 'savings',
      balance: 500000, // 初始 5000.00 元
      currency: 'CNY',
      icon: 'landmark',
      sortOrder: 2,
    });

    await catRepo.create({
      id: 'cat_food',
      name: '餐饮',
      type: 'expense',
      icon: 'utensils',
      color: 'var(--cat-food)',
      sortOrder: 1,
    });

    await catRepo.create({
      id: 'cat_salary',
      name: '工资',
      type: 'income',
      icon: 'wallet',
      color: 'var(--color-income)',
      sortOrder: 2,
    });
  });

  describe('支出记录 (Expense Recording)', () => {
    it('正确录入支出并扣减对应账户余额', async () => {
      const tx = await txService.recordTransaction({
        type: 'expense',
        amount: 2550, // 25.50 元
        accountId: 'acct_wechat',
        categoryId: 'cat_food',
        date: '2026-10-09',
        note: '工作日午餐',
      });

      expect(tx.id).toBeDefined();
      expect(tx.amount).toBe(2550);
      expect(tx.type).toBe('expense');
      expect(tx.note).toBe('工作日午餐');

      const acct = await acctRepo.findById('acct_wechat');
      expect(acct?.balance).toBe(97450);

      const monthTxs = await txRepo.findByMonth('2026-10');
      expect(monthTxs.length).toBe(1);
      expect(monthTxs[0].id).toBe(tx.id);
    });
  });

  describe('收入记录 (Income Recording)', () => {
    it('正确录入收入并增加对应账户余额', async () => {
      const tx = await txService.recordTransaction({
        type: 'income',
        amount: 1200000, // 12000.00 元
        accountId: 'acct_bank',
        categoryId: 'cat_salary',
        date: '2026-10-10',
        note: '十月工资入账',
      });

      expect(tx.id).toBeDefined();
      expect(tx.amount).toBe(1200000);
      expect(tx.type).toBe('income');

      const acct = await acctRepo.findById('acct_bank');
      expect(acct?.balance).toBe(1700000);
    });
  });

  describe('账户间转账 (Transfer)', () => {
    it('正确执行转账并同时更新转出与转入账户余额', async () => {
      const tx = await txService.recordTransaction({
        type: 'transfer',
        amount: 20000, // 200.00 元
        accountId: 'acct_bank',
        toAccountId: 'acct_wechat',
        categoryId: 'cat_transfer',
        date: '2026-10-09',
        note: '银行卡充值到微信',
      });

      expect(tx.type).toBe('transfer');
      expect(tx.toAccountId).toBe('acct_wechat');

      const fromAcct = await acctRepo.findById('acct_bank');
      expect(fromAcct?.balance).toBe(480000);

      const toAcct = await acctRepo.findById('acct_wechat');
      expect(toAcct?.balance).toBe(120000);
    });

    it('转出与转入账户相同时抛出错误', async () => {
      await expect(
        txService.recordTransaction({
          type: 'transfer',
          amount: 5000,
          accountId: 'acct_wechat',
          toAccountId: 'acct_wechat',
          categoryId: 'cat_transfer',
          date: '2026-10-09',
        })
      ).rejects.toThrow('转入账户与转出账户不能相同');
    });

    it('未指定转入账户时抛出错误', async () => {
      await expect(
        txService.recordTransaction({
          type: 'transfer',
          amount: 5000,
          accountId: 'acct_wechat',
          categoryId: 'cat_transfer',
          date: '2026-10-09',
        })
      ).rejects.toThrow('转账必须指定目标账户');
    });
  });

  describe('数据校验 (Validation)', () => {
    it('金额为 0 或负数时拒绝录入', async () => {
      await expect(
        txService.recordTransaction({
          type: 'expense',
          amount: 0,
          accountId: 'acct_wechat',
          categoryId: 'cat_food',
          date: '2026-10-09',
        })
      ).rejects.toThrow('交易金额必须为大于 0 的整型分');

      await expect(
        txService.recordTransaction({
          type: 'expense',
          amount: -500,
          accountId: 'acct_wechat',
          categoryId: 'cat_food',
          date: '2026-10-09',
        })
      ).rejects.toThrow('交易金额必须为大于 0 的整型分');
    });

    it('金额为浮点数非整型分时拒绝录入', async () => {
      await expect(
        txService.recordTransaction({
          type: 'expense',
          amount: 12.34,
          accountId: 'acct_wechat',
          categoryId: 'cat_food',
          date: '2026-10-09',
        })
      ).rejects.toThrow('交易金额必须为大于 0 的整型分');
    });

    it('账户不存在时拒绝录入', async () => {
      await expect(
        txService.recordTransaction({
          type: 'expense',
          amount: 1000,
          accountId: 'acct_non_exist',
          categoryId: 'cat_food',
          date: '2026-10-09',
        })
      ).rejects.toThrow('账户不存在: acct_non_exist');
    });

    it('日期格式错误时拒绝录入', async () => {
      await expect(
        txService.recordTransaction({
          type: 'expense',
          amount: 1000,
          accountId: 'acct_wechat',
          categoryId: 'cat_food',
          date: '2026/10/09',
        })
      ).rejects.toThrow('交易日期格式必须为 YYYY-MM-DD');
    });
  });

  describe('账户平账校准 (Reconciliation)', () => {
    it('平账调增：正确计算差额并更新账户为实际盘点余额', async () => {
      const res = await txService.reconcileAccount({
        accountId: 'acct_wechat',
        targetBalance: 105000,
        date: '2026-10-09',
        note: '盘点零钱发现多了50元',
      });

      expect(res.diff).toBe(5000);
      expect(res.transaction).toBeDefined();
      expect(res.transaction?.type).toBe('reconcile');
      expect(res.transaction?.amount).toBe(5000);
      expect(res.transaction?.reconcileDiff).toBe(5000);

      const acct = await acctRepo.findById('acct_wechat');
      expect(acct?.balance).toBe(105000);
    });

    it('平账调减：正确计算负差额并生成平账流水', async () => {
      const res = await txService.reconcileAccount({
        accountId: 'acct_wechat',
        targetBalance: 96000,
        date: '2026-10-09',
      });

      expect(res.diff).toBe(-4000);
      expect(res.transaction?.amount).toBe(4000);
      expect(res.transaction?.reconcileDiff).toBe(-4000);

      const acct = await acctRepo.findById('acct_wechat');
      expect(acct?.balance).toBe(96000);
    });

    it('余额无差异时无需产生流水', async () => {
      const res = await txService.reconcileAccount({
        accountId: 'acct_wechat',
        targetBalance: 100000,
        date: '2026-10-09',
      });

      expect(res.diff).toBe(0);
      expect(res.transaction).toBeUndefined();
    });
  });

  describe('修改与删除交易 (Update & Delete)', () => {
    it('删除支出交易时回滚账户余额', async () => {
      const tx = await txService.recordTransaction({
        type: 'expense',
        amount: 3000, // 30元
        accountId: 'acct_wechat',
        categoryId: 'cat_food',
        date: '2026-10-09',
      });

      let acct = await acctRepo.findById('acct_wechat');
      expect(acct?.balance).toBe(97000);

      await txService.deleteTransaction(tx.id);

      acct = await acctRepo.findById('acct_wechat');
      expect(acct?.balance).toBe(100000);

      const found = await txRepo.findById(tx.id);
      expect(found).toBeNull();
    });

    it('修改交易金额时自动调整账户差额', async () => {
      const tx = await txService.recordTransaction({
        type: 'expense',
        amount: 2000, // 20元
        accountId: 'acct_wechat',
        categoryId: 'cat_food',
        date: '2026-10-09',
      });

      let acct = await acctRepo.findById('acct_wechat');
      expect(acct?.balance).toBe(98000);

      await txService.updateTransaction(tx.id, {
        amount: 5000,
      });

      acct = await acctRepo.findById('acct_wechat');
      expect(acct?.balance).toBe(95000);
    });
  });

  describe('财务结余与汇算规则 (Financial Calculations)', () => {
    it('正确计算月度总收入、总支出、净结余与留存率', async () => {
      const txs = [
        { id: '1', type: 'income', amount: 1000000, categoryId: 'c1', accountId: 'a1', date: '2026-10-01', createdAt: '', updatedAt: '' },
        { id: '2', type: 'expense', amount: 300000, categoryId: 'c2', accountId: 'a1', date: '2026-10-02', createdAt: '', updatedAt: '' },
        { id: '3', type: 'expense', amount: 200000, categoryId: 'c3', accountId: 'a1', date: '2026-10-05', createdAt: '', updatedAt: '' },
      ] as const;

      const summary = computeMonthSummary([...txs]);
      expect(summary.totalIncome).toBe(1000000);   // 10000 元
      expect(summary.totalExpense).toBe(500000);    // 5000 元
      expect(summary.netBalance).toBe(500000);      // 5000 元
      expect(summary.retentionRate).toBe(50);       // 留存率 50%
    });

    it('分与元互转工具函数边界与精度测试', () => {
      expect(centsToYuan(1050)).toBe('10.50');
      expect(centsToYuan(0)).toBe('0.00');
      expect(centsToYuan(9)).toBe('0.09');
      expect(centsToYuan(-500)).toBe('-5.00');

      expect(yuanToCents('10.50')).toBe(1050);
      expect(yuanToCents(10.5)).toBe(1050);
      expect(yuanToCents('0.09')).toBe(9);
      expect(yuanToCents('¥ 1,234.56')).toBe(123456);
    });
  });
});
