import { describe, it, expect } from 'vitest';
import { predictFrequentCategory } from '../../src/domain/category/categoryPredictor';
import type { Category } from '../../src/types/category';
import type { Transaction } from '../../src/types/transaction';
import { dayjs, combineLocalDateTimeToIso } from '../../src/utils/date';

describe('predictFrequentCategory', () => {
  const categories: Category[] = [
    {
      id: 'cat_breakfast',
      name: '早餐',
      type: 'expense',
      icon: 'coffee',
      color: '#f59e0b',
      sortOrder: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'cat_lunch',
      name: '午餐',
      type: 'expense',
      icon: 'fork-knife',
      color: '#ef4444',
      sortOrder: 2,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'cat_night',
      name: '夜宵',
      type: 'expense',
      icon: 'moon',
      color: '#8b5cf6',
      sortOrder: 3,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'cat_archived',
      name: '已归档',
      type: 'expense',
      icon: 'archive',
      color: '#6b7280',
      sortOrder: 4,
      isArchived: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'cat_salary',
      name: '工资',
      type: 'income',
      icon: 'wallet',
      color: '#10b981',
      sortOrder: 1,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ];

  it('returns null if categories list is empty', () => {
    const res = predictFrequentCategory({
      transactions: [],
      categories: [],
      txType: 'expense',
      targetTime: '12:00',
    });
    expect(res).toBeNull();
  });

  it('returns null if transactions list is empty', () => {
    const res = predictFrequentCategory({
      transactions: [],
      categories,
      txType: 'expense',
      targetTime: '12:00',
    });
    expect(res).toBeNull();
  });

  it('predicts the high-frequency category in the current time slot (morning vs noon)', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_1',
        type: 'expense',
        amount: 1500,
        accountId: 'acct_1',
        categoryId: 'cat_breakfast',
        date: '2026-11-20',
        createdAt: combineLocalDateTimeToIso('2026-11-20', '08:15'),
        updatedAt: combineLocalDateTimeToIso('2026-11-20', '08:15'),
      },
      {
        id: 'tx_2',
        type: 'expense',
        amount: 2000,
        accountId: 'acct_1',
        categoryId: 'cat_breakfast',
        date: '2026-11-21',
        createdAt: combineLocalDateTimeToIso('2026-11-21', '08:45'),
        updatedAt: combineLocalDateTimeToIso('2026-11-21', '08:45'),
      },
      {
        id: 'tx_3',
        type: 'expense',
        amount: 3500,
        accountId: 'acct_1',
        categoryId: 'cat_lunch',
        date: '2026-11-21',
        createdAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
        updatedAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
      },
    ];

    // At 08:30, breakfast should be predicted
    const morningPick = predictFrequentCategory({
      transactions,
      categories,
      txType: 'expense',
      targetTime: '08:30',
    });
    expect(morningPick).toBe('cat_breakfast');

    // At 12:15, lunch should be predicted
    const noonPick = predictFrequentCategory({
      transactions,
      categories,
      txType: 'expense',
      targetTime: '12:15',
    });
    expect(noonPick).toBe('cat_lunch');
  });

  it('correctly handles circular distance around midnight (e.g. 23:45 and 00:15)', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_midnight',
        type: 'expense',
        amount: 4500,
        accountId: 'acct_1',
        categoryId: 'cat_night',
        date: '2026-11-21',
        createdAt: combineLocalDateTimeToIso('2026-11-21', '00:15'),
        updatedAt: combineLocalDateTimeToIso('2026-11-21', '00:15'),
      },
      {
        id: 'tx_lunch',
        type: 'expense',
        amount: 3500,
        accountId: 'acct_1',
        categoryId: 'cat_lunch',
        date: '2026-11-21',
        createdAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
        updatedAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
      },
    ];

    // At 23:45, distance to 00:15 is 0.5 hours (< 1.0 hr), cat_night should win
    const nightPick = predictFrequentCategory({
      transactions,
      categories,
      txType: 'expense',
      targetTime: '23:45',
    });
    expect(nightPick).toBe('cat_night');
  });

  it('favors recent transactions over old ones due to recency weighting', () => {
    const now = dayjs();
    const recentDate = now.subtract(5, 'day').format('YYYY-MM-DD');
    const oldDate = now.subtract(100, 'day').format('YYYY-MM-DD');

    const transactions: Transaction[] = [
      {
        id: 'tx_old_1',
        type: 'expense',
        amount: 2500,
        accountId: 'acct_1',
        categoryId: 'cat_breakfast',
        date: oldDate,
        createdAt: combineLocalDateTimeToIso(oldDate, '08:30'),
        updatedAt: combineLocalDateTimeToIso(oldDate, '08:30'),
      },
      {
        id: 'tx_old_2',
        type: 'expense',
        amount: 2500,
        accountId: 'acct_1',
        categoryId: 'cat_breakfast',
        date: oldDate,
        createdAt: combineLocalDateTimeToIso(oldDate, '08:30'),
        updatedAt: combineLocalDateTimeToIso(oldDate, '08:30'),
      },
      {
        id: 'tx_recent',
        type: 'expense',
        amount: 3500,
        accountId: 'acct_1',
        categoryId: 'cat_lunch',
        date: recentDate,
        createdAt: combineLocalDateTimeToIso(recentDate, '08:30'),
        updatedAt: combineLocalDateTimeToIso(recentDate, '08:30'),
      },
    ];

    // cat_lunch: 1 tx * 3.0 (slot) * 1.5 (recent) = 4.5
    // cat_breakfast: 2 tx * 3.0 (slot) * 0.6 (old) = 3.6
    // cat_lunch should win
    const pick = predictFrequentCategory({
      transactions,
      categories,
      txType: 'expense',
      targetTime: '08:30',
    });
    expect(pick).toBe('cat_lunch');
  });

  it('falls back to overall frequent category when no transactions exist in the target time slot', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_1',
        type: 'expense',
        amount: 1500,
        accountId: 'acct_1',
        categoryId: 'cat_lunch',
        date: '2026-11-20',
        createdAt: combineLocalDateTimeToIso('2026-11-20', '12:30'),
        updatedAt: combineLocalDateTimeToIso('2026-11-20', '12:30'),
      },
      {
        id: 'tx_2',
        type: 'expense',
        amount: 2000,
        accountId: 'acct_1',
        categoryId: 'cat_lunch',
        date: '2026-11-21',
        createdAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
        updatedAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
      },
    ];

    // At 03:00 (no transactions within 3 hours), falls back to cat_lunch which has highest overall score
    const fallbackPick = predictFrequentCategory({
      transactions,
      categories,
      txType: 'expense',
      targetTime: '03:00',
    });
    expect(fallbackPick).toBe('cat_lunch');
  });

  it('ignores archived categories and categories of mismatched transaction type', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_archived',
        type: 'expense',
        amount: 5000,
        accountId: 'acct_1',
        categoryId: 'cat_archived',
        date: '2026-11-21',
        createdAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
        updatedAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
      },
      {
        id: 'tx_salary',
        type: 'income',
        amount: 100000,
        accountId: 'acct_1',
        categoryId: 'cat_salary',
        date: '2026-11-21',
        createdAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
        updatedAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
      },
      {
        id: 'tx_lunch',
        type: 'expense',
        amount: 2000,
        accountId: 'acct_1',
        categoryId: 'cat_lunch',
        date: '2026-11-21',
        createdAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
        updatedAt: combineLocalDateTimeToIso('2026-11-21', '12:30'),
      },
    ];

    const pick = predictFrequentCategory({
      transactions,
      categories,
      txType: 'expense',
      targetTime: '12:30',
    });
    expect(pick).toBe('cat_lunch');
  });

  it('breaks ties using the latest transaction timestamp', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_older',
        type: 'expense',
        amount: 2000,
        accountId: 'acct_1',
        categoryId: 'cat_breakfast',
        date: '2026-11-20',
        createdAt: combineLocalDateTimeToIso('2026-11-20', '08:30'),
        updatedAt: combineLocalDateTimeToIso('2026-11-20', '08:30'),
      },
      {
        id: 'tx_newer',
        type: 'expense',
        amount: 2000,
        accountId: 'acct_1',
        categoryId: 'cat_lunch',
        date: '2026-11-21',
        createdAt: combineLocalDateTimeToIso('2026-11-21', '08:30'),
        updatedAt: combineLocalDateTimeToIso('2026-11-21', '08:30'),
      },
    ];

    // Both have equal score at 08:30, but cat_lunch is newer
    const pick = predictFrequentCategory({
      transactions,
      categories,
      txType: 'expense',
      targetTime: '08:30',
    });
    expect(pick).toBe('cat_lunch');
  });
});
