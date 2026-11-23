import { describe, it, expect } from 'vitest';
import {
  getWeekPeriod,
  getMonthPeriod,
  getYearPeriod,
  getCustomPeriod,
  getPreviousPeriodBounds,
  filterTransactionsByPeriod,
  computeCategoryDonutStats,
  computePeriodTrends,
  computeAccountMonthlyBalanceTrends,
} from '../../src/domain/finance/periodStats';
import type { Transaction } from '../../src/types/transaction';
import type { Category } from '../../src/types/category';
import type { Account } from '../../src/types/account';

describe('Period Statistics Domain Logic', () => {
  it('should compute week period boundaries correctly (Monday to Sunday)', () => {
    const date = new Date(2026, 9, 9); // Month is 0-indexed, so 9 is October
    const week = getWeekPeriod(date);

    expect(week.start).toBe('2026-10-05'); // Monday
    expect(week.end).toBe('2026-10-11');   // Sunday
    expect(week.label).toContain('2026年第');
  });

  it('should compute month period boundaries correctly', () => {
    const month = getMonthPeriod('2026-10');
    expect(month.start).toBe('2026-10-01');
    expect(month.end).toBe('2026-10-31');
    expect(month.label).toBe('2026年10月');
  });

  it('should compute year period boundaries correctly', () => {
    const year = getYearPeriod('2026');
    expect(year.start).toBe('2026-01-01');
    expect(year.end).toBe('2026-12-31');
    expect(year.label).toBe('2026年');
  });

  it('should filter transactions by period boundaries', () => {
    const txs: Transaction[] = [
      { id: '1', type: 'expense', amount: 1000, categoryId: 'cat_food', accountId: 'a1', date: '2026-10-02', createdAt: '', updatedAt: '' },
      { id: '2', type: 'expense', amount: 2000, categoryId: 'cat_food', accountId: 'a1', date: '2026-10-15', createdAt: '', updatedAt: '' },
      { id: '3', type: 'expense', amount: 3000, categoryId: 'cat_food', accountId: 'a1', date: '2026-11-01', createdAt: '', updatedAt: '' },
    ];

    const inRange = filterTransactionsByPeriod(txs, '2026-10-01', '2026-10-31');
    expect(inRange.length).toBe(2);
    expect(inRange.map((t) => t.id)).toEqual(['1', '2']);
  });

  it('should compute category donut chart breakdown with percentages', () => {
    const categories: Category[] = [
      { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: 'var(--cat-food)', sortOrder: 1, createdAt: '', updatedAt: '' },
      { id: 'cat_shop', name: '购物', type: 'expense', icon: 'shopping-cart', color: 'var(--cat-shop)', sortOrder: 2, createdAt: '', updatedAt: '' },
    ];
    const txs: Transaction[] = [
      { id: '1', type: 'expense', amount: 6000, categoryId: 'cat_food', accountId: 'a1', date: '2026-10-05', createdAt: '', updatedAt: '' },
      { id: '2', type: 'expense', amount: 4000, categoryId: 'cat_shop', accountId: 'a1', date: '2026-10-06', createdAt: '', updatedAt: '' },
    ];

    const { items, totalExpense } = computeCategoryDonutStats(txs, categories);
    expect(totalExpense).toBe(10000);
    expect(items.length).toBe(2);
    expect(items[0].name).toBe('餐饮');
    expect(items[0].percentage).toBe(60);
    expect(items[1].name).toBe('购物');
    expect(items[1].percentage).toBe(40);
    expect(items[0].color).not.toBe(items[1].color);
  });

  it('assigns distinct high-contrast chart colors by rank even when categories share stored colors', () => {
    const categories: Category[] = [
      { id: 'c1', name: '奶茶', type: 'expense', icon: 'coffee', color: 'var(--cat-food)', sortOrder: 1, createdAt: '', updatedAt: '' },
      { id: 'c2', name: '宠物', type: 'expense', icon: 'box', color: 'var(--cat-food)', sortOrder: 2, createdAt: '', updatedAt: '' },
      { id: 'c3', name: '运动', type: 'expense', icon: 'bike', color: 'var(--cat-food)', sortOrder: 3, createdAt: '', updatedAt: '' },
    ];
    const txs: Transaction[] = [
      { id: '1', type: 'expense', amount: 3000, categoryId: 'c1', accountId: 'a1', date: '2026-10-05', createdAt: '', updatedAt: '' },
      { id: '2', type: 'expense', amount: 5000, categoryId: 'c2', accountId: 'a1', date: '2026-10-06', createdAt: '', updatedAt: '' },
      { id: '3', type: 'expense', amount: 2000, categoryId: 'c3', accountId: 'a1', date: '2026-10-07', createdAt: '', updatedAt: '' },
    ];

    const { items } = computeCategoryDonutStats(txs, categories);
    const uniqueColors = new Set(items.map((item) => item.color));
    expect(items.map((i) => i.categoryId)).toEqual(['c2', 'c1', 'c3']);
    expect(uniqueColors.size).toBe(3);
  });

  it('should compute trend bars for recent months', () => {
    const txs: Transaction[] = [
      { id: '1', type: 'expense', amount: 5000, categoryId: 'c1', accountId: 'a1', date: '2026-07-15', createdAt: '', updatedAt: '' },
      { id: '2', type: 'expense', amount: 8000, categoryId: 'c1', accountId: 'a1', date: '2026-08-15', createdAt: '', updatedAt: '' },
      { id: '3', type: 'expense', amount: 10000, categoryId: 'c1', accountId: 'a1', date: '2026-10-15', createdAt: '', updatedAt: '' },
    ];

    const trends = computePeriodTrends(txs, 'month', '2026-10');
    expect(trends.length).toBe(6); // 5月, 6月, 7月, 8月, 9月, 10月
    expect(trends[5].label).toBe('10月');
    expect(trends[5].amount).toBe(10000);
    expect(trends[5].percentage).toBe(100); // 最大值 100%
  });

  it('should compute monthly balance trends for a specific account', () => {
    const mockAccount: Account = {
      id: 'acct_1',
      name: '招商银行',
      type: 'savings',
      balance: 150000, // 1500.00 current balance
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    };

    const txs: Transaction[] = [
      // September expense 500.00
      { id: '1', type: 'expense', amount: 50000, categoryId: 'c1', accountId: 'acct_1', date: '2026-09-15', createdAt: '', updatedAt: '' },
      // October income 800.00
      { id: '2', type: 'income', amount: 80000, categoryId: 'c1', accountId: 'acct_1', date: '2026-10-15', createdAt: '', updatedAt: '' },
      // November expense 200.00 (current month)
      { id: '3', type: 'expense', amount: 20000, categoryId: 'c1', accountId: 'acct_1', date: '2026-11-05', createdAt: '', updatedAt: '' },
    ];

    const trends = computeAccountMonthlyBalanceTrends(mockAccount, txs, '2026-11', 6);
    expect(trends.length).toBe(6);

    // Current month (November): balance is exactly account.balance = 150000
    expect(trends[5].label).toBe('11月');
    expect(trends[5].amount).toBe(150000);

    // October month-end: November had -20000, so end of October balance was 150000 - (-20000) = 170000
    expect(trends[4].label).toBe('10月');
    expect(trends[4].amount).toBe(170000);

    // September month-end: October had +80000, November had -20000. Total post-Sep delta = +60000.
    // End of September balance was 150000 - (+60000) = 90000
    expect(trends[3].label).toBe('9月');
    expect(trends[3].amount).toBe(90000);
  });

  it('平滑分摊支出：启用分期后，大额分期支出在趋势柱状图中按月平滑分布', () => {
    const rentTx: Transaction = {
      id: 'tx_rent',
      type: 'expense',
      amount: 600000, // 6000元房租
      categoryId: 'cat_rent',
      accountId: 'a1',
      date: '2026-11-01',
      ext: { amortize: { enabled: true, months: 6 } },
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    };

    // 未启用分期：11月承担全部 6000元，12月为 0
    const rawTrends = computePeriodTrends([rentTx], 'month', '2026-12', 2, false);
    expect(rawTrends[0].amount).toBe(600000); // 11月
    expect(rawTrends[1].amount).toBe(0);      // 12月

    // 启用分期：11月和12月各自平滑分摊 1000元
    const amortizedTrends = computePeriodTrends([rentTx], 'month', '2026-12', 2, true);
    expect(amortizedTrends[0].amount).toBe(100000); // 11月: 1000元
    expect(amortizedTrends[1].amount).toBe(100000); // 12月: 1000元
  });

  it('平滑分摊支出：启用分期后，环形图统计准确计算当月分摊额度', () => {
    const rentCat: Category = {
      id: 'cat_rent',
      name: '房租',
      type: 'expense',
      icon: 'home',
      color: '#fff',
      createdAt: '',
      updatedAt: '',
    };
    const rentTx: Transaction = {
      id: 'tx_rent',
      type: 'expense',
      amount: 600000, // 6000元
      categoryId: 'cat_rent',
      accountId: 'a1',
      date: '2026-11-01',
      ext: { amortize: { enabled: true, months: 6 } },
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    };

    const decStats = computeCategoryDonutStats(
      [],
      [rentCat],
      [rentTx],
      true,
      '2026-12',
      'month'
    );

    expect(decStats.totalExpense).toBe(100000);
    expect(decStats.items[0].name).toBe('房租');
    expect(decStats.items[0].amount).toBe(100000);
  });

  it('平滑分摊支出：启用分期后，年度环形图准确按年计算摊销总额', () => {
    const rentCat: Category = {
      id: 'cat_rent',
      name: '房租',
      type: 'expense',
      icon: 'home',
      color: '#fff',
      createdAt: '',
      updatedAt: '',
    };
    const rentTx: Transaction = {
      id: 'tx_rent',
      type: 'expense',
      amount: 1200000,
      categoryId: 'cat_rent',
      accountId: 'a1',
      date: '2026-11-01',
      ext: { amortize: { enabled: true, months: 12 } },
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    };

    const stats2026 = computeCategoryDonutStats(
      [],
      [rentCat],
      [rentTx],
      true,
      '2026',
      'year'
    );
    expect(stats2026.totalExpense).toBe(200000);

    const stats2027 = computeCategoryDonutStats(
      [],
      [rentCat],
      [rentTx],
      true,
      '2027',
      'year'
    );
    expect(stats2027.totalExpense).toBe(1000000);
  });

  describe('Period-over-Period (环比) & Multi-Dimension Stats', () => {
    const categories: Category[] = [
      { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: 'var(--cat-food)', sortOrder: 1, createdAt: '', updatedAt: '' },
      { id: 'cat_shopping', name: '购物', type: 'expense', icon: 'shopping-cart', color: 'var(--cat-shop)', sortOrder: 2, createdAt: '', updatedAt: '' },
      { id: 'cat_salary', name: '工资', type: 'income', icon: 'money', color: 'var(--cat-income)', sortOrder: 1, createdAt: '', updatedAt: '' },
    ];

    it('computes category MoM (环比) comparison correctly for expenses', () => {
      const allTxs: Transaction[] = [
        // October (prev month): food 2000, shopping 4000
        { id: '1', type: 'expense', amount: 200000, categoryId: 'cat_food', accountId: 'a1', date: '2026-10-15', createdAt: '', updatedAt: '' },
        { id: '2', type: 'expense', amount: 400000, categoryId: 'cat_shopping', accountId: 'a1', date: '2026-10-20', createdAt: '', updatedAt: '' },
        // November (current month): food 3000 (+50%), shopping 2000 (-50%), entertainment 1000 (new)
        { id: '3', type: 'expense', amount: 300000, categoryId: 'cat_food', accountId: 'a1', date: '2026-11-05', createdAt: '', updatedAt: '' },
        { id: '4', type: 'expense', amount: 200000, categoryId: 'cat_shopping', accountId: 'a1', date: '2026-11-10', createdAt: '', updatedAt: '' },
        { id: '5', type: 'expense', amount: 100000, categoryId: 'cat_ent', accountId: 'a1', date: '2026-11-12', createdAt: '', updatedAt: '' },
      ];

      const currentPeriodTxs = allTxs.filter((t) => t.date.startsWith('2026-11'));
      const stats = computeCategoryDonutStats(
        currentPeriodTxs,
        categories,
        allTxs,
        false,
        '2026-11',
        'month',
        'expense'
      );

      expect(stats.totalExpense).toBe(600000);
      expect(stats.items.length).toBe(3);

      const foodItem = stats.items.find((i) => i.categoryId === 'cat_food')!;
      expect(foodItem.amount).toBe(300000);
      expect(foodItem.previousAmount).toBe(200000);
      expect(foodItem.momRate).toBe(50); // +50%
      expect(foodItem.isNew).toBe(false);

      const shopItem = stats.items.find((i) => i.categoryId === 'cat_shopping')!;
      expect(shopItem.amount).toBe(200000);
      expect(shopItem.previousAmount).toBe(400000);
      expect(shopItem.momRate).toBe(-50); // -50%
      expect(shopItem.isNew).toBe(false);

      const entItem = stats.items.find((i) => i.categoryId === 'cat_ent')!;
      expect(entItem.amount).toBe(100000);
      expect(entItem.previousAmount).toBe(0);
      expect(entItem.isNew).toBe(true);
      expect(entItem.momRate).toBeNull();
    });

    it('computes category stats and trends for income dimension', () => {
      const allTxs: Transaction[] = [
        // October: salary 10000
        { id: '1', type: 'income', amount: 1000000, categoryId: 'cat_salary', accountId: 'a1', date: '2026-10-10', createdAt: '', updatedAt: '' },
        // November: salary 12000 (+20%) + offset reimbursement 500 (should be excluded from income)
        { id: '2', type: 'income', amount: 1200000, categoryId: 'cat_salary', accountId: 'a1', date: '2026-11-10', createdAt: '', updatedAt: '' },
        { id: '3', type: 'income', amount: 50000, categoryId: 'cat_salary', accountId: 'a1', date: '2026-11-15', offsetTransactionId: 'exp_1', createdAt: '', updatedAt: '' },
      ];

      const currentPeriodTxs = allTxs.filter((t) => t.date.startsWith('2026-11'));
      const incomeStats = computeCategoryDonutStats(
        currentPeriodTxs,
        categories,
        allTxs,
        false,
        '2026-11',
        'month',
        'income'
      );

      expect(incomeStats.totalAmount).toBe(1200000); // 50000 reimbursement excluded
      expect(incomeStats.items.length).toBe(1);
      expect(incomeStats.items[0].previousAmount).toBe(1000000);
      expect(incomeStats.items[0].momRate).toBe(20);

      const incomeTrends = computePeriodTrends(allTxs, 'month', '2026-11', 2, false, 'income');
      expect(incomeTrends[0].amount).toBe(1000000); // 10月
      expect(incomeTrends[1].amount).toBe(1200000); // 11月
    });

    it('computes net balance trends supporting positive and negative amounts', () => {
      const allTxs: Transaction[] = [
        // October: Income 10000, Expense 6000 -> Net +4000
        { id: '1', type: 'income', amount: 1000000, categoryId: 'cat_salary', accountId: 'a1', date: '2026-10-10', createdAt: '', updatedAt: '' },
        { id: '2', type: 'expense', amount: 600000, categoryId: 'cat_food', accountId: 'a1', date: '2026-10-15', createdAt: '', updatedAt: '' },
        // November: Income 5000, Expense 8000 -> Net -3000
        { id: '3', type: 'income', amount: 500000, categoryId: 'cat_salary', accountId: 'a1', date: '2026-11-10', createdAt: '', updatedAt: '' },
        { id: '4', type: 'expense', amount: 800000, categoryId: 'cat_food', accountId: 'a1', date: '2026-11-15', createdAt: '', updatedAt: '' },
      ];

      const balanceTrends = computePeriodTrends(allTxs, 'month', '2026-11', 2, false, 'balance');
      expect(balanceTrends[0].amount).toBe(400000);  // 10月: +4000
      expect(balanceTrends[1].amount).toBe(-300000); // 11月: -3000
    });

    it('supports custom period range calculation and previous period shift', () => {
      const customP = getCustomPeriod('2026-11-01', '2026-11-10');
      expect(customP.start).toBe('2026-11-01');
      expect(customP.end).toBe('2026-11-10');
      expect(customP.key).toBe('2026-11-01_2026-11-10');
      expect(customP.label).toBe('2026-11-01 ~ 2026-11-10');

      const prev = getPreviousPeriodBounds('custom', customP.key);
      expect(prev.end).toBe('2026-10-31');
      expect(prev.start).toBe('2026-10-22');
    });

    it('computes daily trends for short custom period', () => {
      const allTxs: Transaction[] = [
        { id: '1', type: 'expense', amount: 10000, categoryId: 'cat_food', accountId: 'a1', date: '2026-11-01', createdAt: '', updatedAt: '' },
        { id: '2', type: 'expense', amount: 20000, categoryId: 'cat_food', accountId: 'a1', date: '2026-11-02', createdAt: '', updatedAt: '' },
      ];
      const trends = computePeriodTrends(allTxs, 'custom', '2026-11-01_2026-11-03', 6, false, 'expense');
      expect(trends.length).toBe(3);
      expect(trends[0].amount).toBe(10000);
      expect(trends[1].amount).toBe(20000);
      expect(trends[2].amount).toBe(0);
    });
  });
});
