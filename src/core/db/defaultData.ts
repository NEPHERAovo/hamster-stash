import type { Account } from '../../types/account';
import type { Category } from '../../types/category';

export const DEFAULT_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: 'var(--cat-food)', colorClass: 'cat-food', sortOrder: 1, isSystem: true },
  { id: 'cat_transit', name: '交通', type: 'expense', icon: 'train-front', color: 'var(--cat-transit)', colorClass: 'cat-transit', sortOrder: 2, isSystem: true },
  { id: 'cat_shop', name: '购物', type: 'expense', icon: 'shopping-cart', color: 'var(--cat-shop)', colorClass: 'cat-shop', sortOrder: 3, isSystem: true },
  { id: 'cat_home', name: '居住', type: 'expense', icon: 'house', color: 'var(--cat-home)', colorClass: 'cat-home', sortOrder: 4, isSystem: true },
  { id: 'cat_fun', name: '娱乐', type: 'expense', icon: 'clapperboard', color: 'var(--cat-fun)', colorClass: 'cat-fun', sortOrder: 5, isSystem: true },
  { id: 'cat_comm', name: '通讯', type: 'expense', icon: 'smartphone', color: 'var(--cat-comm)', colorClass: 'cat-comm', sortOrder: 6, isSystem: true },
  { id: 'cat_health', name: '医疗', type: 'expense', icon: 'heart-pulse', color: 'var(--cat-health)', colorClass: 'cat-health', sortOrder: 7, isSystem: true },
  { id: 'cat_edu', name: '教育', type: 'expense', icon: 'graduation-cap', color: 'var(--cat-edu)', colorClass: 'cat-edu', sortOrder: 8, isSystem: true },

  { id: 'cat_salary', name: '工资', type: 'income', icon: 'wallet', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 1, isSystem: true },
  { id: 'cat_bonus', name: '奖金', type: 'income', icon: 'coins', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 2, isSystem: true },
  { id: 'cat_invest', name: '理财收益', type: 'income', icon: 'trending-up', color: 'var(--color-income)', colorClass: 'cat-salary', sortOrder: 3, isSystem: true },
  { id: 'cat_other_in', name: '其他收入', type: 'income', icon: 'plus-circle', color: 'var(--ink-secondary)', colorClass: 'cat-salary', sortOrder: 4, isSystem: true },

  { id: 'cat_lend_out', name: '借给他人', type: 'loan', icon: 'arrow-up-right', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 1, isSystem: true },
  { id: 'cat_borrow_in', name: '向人借款', type: 'loan', icon: 'arrow-down-left', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 2, isSystem: true },
  { id: 'cat_loan_repay', name: '收回还款', type: 'loan', icon: 'check-circle-2', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 3, isSystem: true },
  { id: 'cat_debt_clear', name: '偿还欠款', type: 'loan', icon: 'corner-down-right', color: 'var(--color-accent)', colorClass: 'cat-loan', sortOrder: 4, isSystem: true },
];

export const DEFAULT_ACCOUNTS: Omit<Account, 'createdAt' | 'updatedAt'>[] = [
  { id: 'acct_default', name: '默认账户', type: 'cash', balance: 0, currency: 'CNY', icon: 'wallet', sortOrder: 1 },
];
