import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import type { Transaction } from '../../types/transaction';
import type { Account } from '../../types/account';
import type { Category } from '../../types/category';

/**
 * 宿主流水数据响应式读取 Hook (按时间倒序的全量交易流水)
 */
export function useHostTransactions(): Transaction[] {
  return useLedgerStore((s) => s.transactions);
}

export function getHostTransactions(): Transaction[] {
  return useLedgerStore.getState().transactions;
}

/**
 * 宿主账户列表响应式读取 Hook
 */
export function useHostAccounts(): Account[] {
  return useAccountStore((s) => s.accounts);
}

/**
 * 宿主分类列表响应式读取 Hook
 */
export function useHostCategories(): Category[] {
  return useCategoryStore((s) => s.categories);
}

export function getHostCategories(): Category[] {
  return useCategoryStore.getState().categories;
}

/**
 * 宿主当前选定月份 (YYYY-MM)
 */
export function useHostCurrentMonth(): string {
  return useLedgerStore((s) => s.currentMonth);
}
