import { describe, it, expect, beforeEach } from 'vitest';
import type { Transaction } from '../../src/types/transaction';
import {
  computeMonthSummary,
} from '../../src/domain/finance/balanceCalculator';
import {
  computeCategoryDonutStats,
  computePeriodTrends,
} from '../../src/domain/finance/periodStats';
import { MemoryAdapter } from '../../src/core/adapters/MemoryAdapter';
import { TransactionRepository } from '../../src/core/repositories/TransactionRepository';
import { AccountRepository } from '../../src/core/repositories/AccountRepository';
import { CategoryRepository } from '../../src/core/repositories/CategoryRepository';
import { TransactionService } from '../../src/domain/transaction/transactionService';

describe('AA 分摊 / 收入抵扣支出统计与业务核心', () => {
  describe('财务算子与跨月抵扣统计 (balanceCalculator & periodStats)', () => {
    it('单人 AA 部分分摊：收入不虚增，支出按净额冲减', () => {
      const dinnerExpense: Transaction = {
        id: 'tx_dinner',
        type: 'expense',
        amount: 30000, // 300 元
        categoryId: 'cat_food',
        accountId: 'acct_1',
        date: '2026-11-15',
        note: '三人聚餐火锅',
        createdAt: '2026-11-15T18:00:00.000Z',
        updatedAt: '2026-11-15T18:00:00.000Z',
      };

      const aaIncome: Transaction = {
        id: 'tx_aa_1',
        type: 'income',
        amount: 10000, // 100 元
        categoryId: 'cat_other_in',
        accountId: 'acct_1',
        date: '2026-11-15',
        note: 'AA回款 · 张三',
        offsetTransactionId: 'tx_dinner',
        createdAt: '2026-11-15T19:00:00.000Z',
        updatedAt: '2026-11-15T19:00:00.000Z',
      };

      const txs = [dinnerExpense, aaIncome];
      const summary = computeMonthSummary(txs);

      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpense).toBe(20000);
      expect(summary.netBalance).toBe(-20000);
    });

    it('多人 AA 多次分摊同一笔支出：累计抵扣', () => {
      const dinnerExpense: Transaction = {
        id: 'tx_dinner',
        type: 'expense',
        amount: 30000, // 300 元
        categoryId: 'cat_food',
        accountId: 'acct_1',
        date: '2026-11-15',
        note: '三人聚餐火锅',
        createdAt: '2026-11-15T18:00:00.000Z',
        updatedAt: '2026-11-15T18:00:00.000Z',
      };

      const aaIncome1: Transaction = {
        id: 'tx_aa_1',
        type: 'income',
        amount: 10000, // 100 元
        categoryId: 'cat_other_in',
        accountId: 'acct_1',
        date: '2026-11-15',
        offsetTransactionId: 'tx_dinner',
        createdAt: '2026-11-15T19:00:00.000Z',
        updatedAt: '2026-11-15T19:00:00.000Z',
      };

      const aaIncome2: Transaction = {
        id: 'tx_aa_2',
        type: 'income',
        amount: 10000, // 100 元
        categoryId: 'cat_other_in',
        accountId: 'acct_1',
        date: '2026-11-15',
        offsetTransactionId: 'tx_dinner',
        createdAt: '2026-11-15T19:30:00.000Z',
        updatedAt: '2026-11-15T19:30:00.000Z',
      };

      const txs = [dinnerExpense, aaIncome1, aaIncome2];
      const summary = computeMonthSummary(txs);

      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpense).toBe(10000); // 300 - 200 = 100 元
      expect(summary.netBalance).toBe(-10000);
    });

    it('全额抵扣：净支出降为 0，且不超过支出本身', () => {
      const advanceExpense: Transaction = {
        id: 'tx_advance',
        type: 'expense',
        amount: 50000, // 500 元
        categoryId: 'cat_shop',
        accountId: 'acct_1',
        date: '2026-11-10',
        note: '帮朋友代付演唱会门票',
        createdAt: '2026-11-10T10:00:00.000Z',
        updatedAt: '2026-11-10T10:00:00.000Z',
      };

      const fullRepay: Transaction = {
        id: 'tx_repay',
        type: 'income',
        amount: 50000, // 500 元
        categoryId: 'cat_other_in',
        accountId: 'acct_1',
        date: '2026-11-11',
        offsetTransactionId: 'tx_advance',
        createdAt: '2026-11-11T10:00:00.000Z',
        updatedAt: '2026-11-11T10:00:00.000Z',
      };

      const txs = [advanceExpense, fullRepay];
      const summary = computeMonthSummary(txs);

      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpense).toBe(0);
      expect(summary.netBalance).toBe(0);
    });

    it('跨月抵扣：11 月底聚餐支出，12 月初收到 AA 回款，11 月总支出被准确冲减', () => {
      const novExpense: Transaction = {
        id: 'tx_nov_dinner',
        type: 'expense',
        amount: 30000, // 11月30日支出 300 元
        categoryId: 'cat_food',
        accountId: 'acct_1',
        date: '2026-11-30',
        note: '月末聚餐',
        createdAt: '2026-11-30T20:00:00.000Z',
        updatedAt: '2026-11-30T20:00:00.000Z',
      };

      const decAAIncome: Transaction = {
        id: 'tx_dec_repay',
        type: 'income',
        amount: 15000, // 12月2日转回 150 元
        categoryId: 'cat_other_in',
        accountId: 'acct_1',
        date: '2026-12-02',
        offsetTransactionId: 'tx_nov_dinner',
        createdAt: '2026-12-02T10:00:00.000Z',
        updatedAt: '2026-12-02T10:00:00.000Z',
      };

      const allTxs = [novExpense, decAAIncome];

      const novTxs = [novExpense];
      const novSummary = computeMonthSummary(novTxs, allTxs);
      expect(novSummary.totalExpense).toBe(15000); // 300 - 150 = 150 元
      expect(novSummary.totalIncome).toBe(0);

      const decTxs = [decAAIncome];
      const decSummary = computeMonthSummary(decTxs, allTxs);
      expect(decSummary.totalIncome).toBe(0); // 抵扣型收入不计入收入
      expect(decSummary.totalExpense).toBe(0);
    });

    it('分类环形图与周期趋势按净有效金额统计', () => {
      const categories = [
        { id: 'cat_food', name: '餐饮', type: 'expense' as const, icon: 'utensils', color: '#BA6E38', sortOrder: 1, createdAt: '', updatedAt: '' },
      ];

      const dinner: Transaction = {
        id: 'tx_dinner',
        type: 'expense',
        amount: 20000,
        categoryId: 'cat_food',
        accountId: 'acct_1',
        date: '2026-11-15',
        createdAt: '',
        updatedAt: '',
      };

      const offset: Transaction = {
        id: 'tx_aa',
        type: 'income',
        amount: 8000,
        categoryId: 'cat_food',
        accountId: 'acct_1',
        date: '2026-11-16',
        offsetTransactionId: 'tx_dinner',
        createdAt: '',
        updatedAt: '',
      };

      const all = [dinner, offset];
      const donutStats = computeCategoryDonutStats([dinner], categories, all);
      expect(donutStats.totalExpense).toBe(12000); // 200 - 80 = 120 元
      expect(donutStats.items[0].amount).toBe(12000);

      const trends = computePeriodTrends(all, 'month', '2026-11');
      const currentMonthTrend = trends.find((t) => t.label === '11月');
      expect(currentMonthTrend?.amount).toBe(12000);
    });
  });

  describe('TransactionService 业务与级联保护', () => {
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
        id: 'acct_card',
        name: '招商银行',
        type: 'savings',
        balance: 100000, // 1000 元
        currency: 'CNY',
        icon: 'credit-card',
        sortOrder: 1,
      });

      await catRepo.create({
        id: 'cat_food',
        name: '餐饮',
        type: 'expense',
        icon: 'utensils',
        color: '#BA6E38',
        sortOrder: 1,
      });

      await catRepo.create({
        id: 'cat_other_in',
        name: '其他收入',
        type: 'income',
        icon: 'plus',
        color: '#2E6E4E',
        sortOrder: 2,
      });
    });

    it('删除原支出时，自动清空所有关联收入流水的 offsetTransactionId，防止悬空引用', async () => {
      const expense = await txService.recordTransaction({
        type: 'expense',
        amount: 20000,
        accountId: 'acct_card',
        categoryId: 'cat_food',
        date: '2026-11-15',
        note: '聚餐',
      });

      const income = await txService.recordTransaction({
        type: 'income',
        amount: 10000,
        accountId: 'acct_card',
        categoryId: 'cat_other_in',
        date: '2026-11-15',
        note: 'AA 回款',
        offsetTransactionId: expense.id,
      });

      expect(income.offsetTransactionId).toBe(expense.id);

      await txService.deleteTransaction(expense.id);

      const updatedIncome = await txRepo.findById(income.id);
      expect(updatedIncome).not.toBeNull();
      expect(updatedIncome?.offsetTransactionId).toBeUndefined();
    });

    it('报销结清 (settleReimbursement) 自动将收入流水绑定原垫付支出', async () => {
      const reimbExpense = await txService.recordTransaction({
        type: 'expense',
        amount: 15000, // 150 元
        accountId: 'acct_card',
        categoryId: 'cat_food',
        date: '2026-11-10',
        note: '出差打车',
        isReimbursable: true,
        reimburseTarget: '公司财务',
      });

      const settleIncome = await txService.settleReimbursement(reimbExpense.id, 'acct_card');

      expect(settleIncome.offsetTransactionId).toBe(reimbExpense.id);

      const all = await txRepo.findAll();
      const summary = computeMonthSummary(all);
      expect(summary.totalIncome).toBe(0);
      expect(summary.totalExpense).toBe(0);
    });

    it('computeMonthSummary properly respects includedAccountIds filter', () => {
      const tx1: Transaction = {
        id: 'tx_1',
        type: 'expense',
        amount: 5000,
        categoryId: 'cat_food',
        accountId: 'acct_personal',
        date: '2026-11-01',
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-01T10:00:00.000Z',
      };
      const tx2: Transaction = {
        id: 'tx_2',
        type: 'expense',
        amount: 10000,
        categoryId: 'cat_family',
        accountId: 'acct_family_excluded',
        date: '2026-11-02',
        createdAt: '2026-11-02T10:00:00.000Z',
        updatedAt: '2026-11-02T10:00:00.000Z',
      };
      const tx3: Transaction = {
        id: 'tx_3',
        type: 'income',
        amount: 20000,
        categoryId: 'cat_salary',
        accountId: 'acct_personal',
        date: '2026-11-05',
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z',
      };
      const tx4: Transaction = {
        id: 'tx_4',
        type: 'income',
        amount: 8000,
        categoryId: 'cat_family_in',
        accountId: 'acct_family_excluded',
        date: '2026-11-06',
        createdAt: '2026-11-06T10:00:00.000Z',
        updatedAt: '2026-11-06T10:00:00.000Z',
      };

      const all = [tx1, tx2, tx3, tx4];
      const included = new Set(['acct_personal']);
      const filteredSummary = computeMonthSummary(all, all, { includedAccountIds: included });

      expect(filteredSummary.totalExpense).toBe(5000);
      expect(filteredSummary.totalIncome).toBe(20000);
      expect(filteredSummary.netBalance).toBe(15000);
    });
  });
});
