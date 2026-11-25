import { describe, it, expect } from 'vitest';
import { fuzzyMatchField, fuzzyMatchTransaction } from '../../src/utils/fuzzySearch';
import type { Transaction } from '../../src/types/transaction';
import type { Category } from '../../src/types/category';
import type { Account } from '../../src/types/account';

describe('fuzzySearch utilities', () => {
  const catMap = new Map<string, Category>([
    ['cat_food', { id: 'cat_food', name: '餐饮美食', type: 'expense', icon: 'utensils', color: '', sortOrder: 1, createdAt: '', updatedAt: '' }],
    ['cat_transit', { id: 'cat_transit', name: '交通出行', type: 'expense', icon: 'train', color: '', sortOrder: 2, createdAt: '', updatedAt: '' }],
  ]);

  const acctMap = new Map<string, Account>([
    ['acct_cmb', { id: 'acct_cmb', name: '招商银行卡', type: 'savings', balance: 0, currency: 'CNY', icon: 'landmark', sortOrder: 1, createdAt: '', updatedAt: '' }],
    ['acct_wx', { id: 'acct_wx', name: '微信零钱', type: 'savings', balance: 0, currency: 'CNY', icon: 'wallet', sortOrder: 2, createdAt: '', updatedAt: '' }],
  ]);

  const sampleTx: Transaction = {
    id: 'tx_1',
    type: 'expense',
    amount: 28800,
    categoryId: 'cat_food',
    accountId: 'acct_cmb',
    date: '2026-11-05',
    note: '星巴克手冲咖啡 MacBook 办公',
    isReimbursable: true,
    createdAt: '2026-11-05T10:00:00.000Z',
    updatedAt: '2026-11-05T10:00:00.000Z',
  };

  it('matches ordered subsequences for text while keeping numeric tokens exact', () => {
    expect(fuzzyMatchField('招商银行卡', '招卡')).toBe(true);
    expect(fuzzyMatchField('MacBook Pro', 'mbp')).toBe(true);
    expect(fuzzyMatchField('星巴克手冲咖啡', '星咖')).toBe(true);
    expect(fuzzyMatchField('2026-11-05', '25')).toBe(false);
    expect(fuzzyMatchField('2026-11-05', '11-05')).toBe(true);
  });

  it('supports multi-keyword AND queries across note, category, account, date, amount, and status', () => {
    expect(fuzzyMatchTransaction(sampleTx, '星咖 招卡', catMap, acctMap)).toBe(true);
    expect(fuzzyMatchTransaction(sampleTx, '餐饮 288', catMap, acctMap)).toBe(true);
    expect(fuzzyMatchTransaction(sampleTx, '11月5日 待报销', catMap, acctMap)).toBe(true);
    expect(fuzzyMatchTransaction(sampleTx, '11.05 mb', catMap, acctMap)).toBe(true);
    expect(fuzzyMatchTransaction(sampleTx, '星咖 微信', catMap, acctMap)).toBe(false);
  });
});
