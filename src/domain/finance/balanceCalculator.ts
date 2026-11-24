import type { Transaction } from '../../types/transaction';
import { getAmortizeConfig, computeAmortizedMonthlyAmount } from './amortization';

export interface MonthSummary {
  totalIncome: number;    // 单位：分
  totalExpense: number;   // 单位：分
  netBalance: number;     // 净结余 (单位：分)
  retentionRate: number;  // 结余留存率 (0 ~ 100 整数百分比)
}

/**
 * 构建全量流水中的支出抵扣映射表 (Map<expenseId, totalOffsetAmount>)
 */
export function buildOffsetMap(allTransactions: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const tx of allTransactions) {
    if (tx.type === 'income' && tx.offsetTransactionId) {
      const current = map.get(tx.offsetTransactionId) || 0;
      map.set(tx.offsetTransactionId, current + tx.amount);
    }
  }
  return map;
}

/**
 * 计算某笔支出的实际净额（扣除所有关联的 AA 分摊/报销到账收入）
 */
export function computeEffectiveExpenseAmount(
  tx: Transaction,
  offsetMap: Map<string, number>
): number {
  if (tx.type !== 'expense') return 0;
  const offset = offsetMap.get(tx.id) || 0;
  return Math.max(0, tx.amount - offset);
}

/**
 * 计算某月份流水的收支结余汇总
 * @param transactions 当前月份或周期的流水
 * @param allTransactions 全量流水（用于支持跨月/跨周期抵扣，若未传则基于 transactions 构建）
 */
export function computeMonthSummary(
  transactions: Transaction[],
  allTransactions?: Transaction[],
  options?: {
    includedAccountIds?: Set<string>;
    currentMonth?: string;
    isAmortizationEnabled?: boolean;
  }
): MonthSummary {
  const allTxs = allTransactions || transactions;
  const filteredAll = options?.includedAccountIds
    ? allTxs.filter((t) => options.includedAccountIds!.has(t.accountId))
    : allTxs;
  const filteredCurrent = options?.includedAccountIds
    ? transactions.filter((t) => options.includedAccountIds!.has(t.accountId))
    : transactions;

  const offsetMap = buildOffsetMap(filteredAll);
  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of filteredCurrent) {
    if (tx.type === 'income') {
      if (!tx.offsetTransactionId) {
        totalIncome += tx.amount;
      }
    }
  }

  const targetMonth = options?.currentMonth || (transactions.length > 0 ? transactions[0].date.slice(0, 7) : undefined);

  if (options?.isAmortizationEnabled && targetMonth) {
    for (const t of filteredAll) {
      if (t.type === 'expense') {
        if (getAmortizeConfig(t)) {
          totalExpense += computeAmortizedMonthlyAmount(t, targetMonth, offsetMap);
        } else if (t.date.startsWith(targetMonth)) {
          totalExpense += computeEffectiveExpenseAmount(t, offsetMap);
        }
      }
    }
  } else {
    for (const tx of filteredCurrent) {
      if (tx.type === 'expense') {
        totalExpense += computeEffectiveExpenseAmount(tx, offsetMap);
      }
    }
  }

  const netBalance = totalIncome - totalExpense;
  const retentionRate =
    totalIncome > 0 ? Math.max(0, Math.min(100, Math.round((netBalance / totalIncome) * 100))) : 0;

  return {
    totalIncome,
    totalExpense,
    netBalance,
    retentionRate,
  };
}

/**
 * 分转元字符串格式化（例如 1050 分 -> "10.50"）
 */
export function centsToYuan(cents: number): string {
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const yuan = Math.floor(abs / 100);
  const remainder = abs % 100;
  const str = `${yuan}.${remainder.toString().padStart(2, '0')}`;
  return isNegative ? `-${str}` : str;
}

/**
 * 元数值或字符串转为整数分（例如 "10.50" 或 10.5 -> 1050）
 */
export function yuanToCents(val: string | number): number {
  if (typeof val === 'number') {
    return Math.round(val * 100);
  }
  const clean = val.replace(/[^\d.-]/g, '').trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}
