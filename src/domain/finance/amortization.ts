import type { Transaction } from '../../types/transaction';
import { computeEffectiveExpenseAmount } from './balanceCalculator';

export interface AmortizeConfig {
  enabled: boolean;
  months: number;
  startMonth?: string; // YYYY-MM
}

/**
 * Extract valid amortization configuration from a transaction's ext data.
 */
export function getAmortizeConfig(tx: Transaction): AmortizeConfig | null {
  const ext = tx.ext?.amortize as Partial<AmortizeConfig> | undefined;
  if (!ext || ext.enabled === false) return null;
  const months = Math.round(Number(ext.months));
  if (!Number.isFinite(months) || months <= 1) return null;

  const startMonth = ext.startMonth || (tx.date ? tx.date.slice(0, 7) : undefined);
  return {
    enabled: true,
    months,
    startMonth,
  };
}

/**
 * Calculate the difference in months between two YYYY-MM strings.
 * Returns targetMonth - startMonth.
 */
export function diffInMonths(startYearMonth: string, targetYearMonth: string): number {
  const [startY, startM] = startYearMonth.split('-').map(Number);
  const [targetY, targetM] = targetYearMonth.split('-').map(Number);
  return (targetY - startY) * 12 + (targetM - startM);
}

/**
 * Compute the amortized expense amount in cents that applies to a specific target month (YYYY-MM).
 */
export function computeAmortizedMonthlyAmount(
  tx: Transaction,
  targetYearMonth: string,
  offsetMap?: Map<string, number>
): number {
  if (tx.type !== 'expense') return 0;
  const config = getAmortizeConfig(tx);
  const totalAmount = offsetMap ? computeEffectiveExpenseAmount(tx, offsetMap) : tx.amount;
  if (totalAmount <= 0) return 0;

  if (!config) {
    return tx.date.startsWith(targetYearMonth) ? totalAmount : 0;
  }

  const startMonth = config.startMonth || tx.date.slice(0, 7);
  const monthDelta = diffInMonths(startMonth, targetYearMonth);

  if (monthDelta < 0 || monthDelta >= config.months) {
    return 0;
  }

  const baseMonthly = Math.floor(totalAmount / config.months);
  const remainder = totalAmount - baseMonthly * config.months;

  // Remainder is loaded onto the first period (delta === 0) so the sum is exact.
  return monthDelta === 0 ? baseMonthly + remainder : baseMonthly;
}

/**
 * Compute the amortized expense amount in cents that applies to a specific year (YYYY).
 */
export function computeAmortizedYearlyAmount(
  tx: Transaction,
  targetYear: string,
  offsetMap?: Map<string, number>
): number {
  if (tx.type !== 'expense') return 0;
  const config = getAmortizeConfig(tx);
  const totalAmount = offsetMap ? computeEffectiveExpenseAmount(tx, offsetMap) : tx.amount;
  if (totalAmount <= 0) return 0;

  if (!config) {
    return tx.date.startsWith(targetYear) ? totalAmount : 0;
  }

  let yearTotal = 0;
  for (let m = 1; m <= 12; m++) {
    const ym = `${targetYear}-${String(m).padStart(2, '0')}`;
    yearTotal += computeAmortizedMonthlyAmount(tx, ym, offsetMap);
  }
  return yearTotal;
}

export interface ActiveInstallment {
  transaction: Transaction;
  totalAmount: number;
  months: number;
  startMonth: string;
  elapsedMonths: number;
  remainingMonths: number;
  monthlyAmount: number;
  remainingDebt: number;
}

export function computePendingInstallments(
  transactions: Transaction[],
  currentYearMonth: string,
  offsetMap?: Map<string, number>
): {
  totalRemainingDebt: number;
  installments: ActiveInstallment[];
} {
  const installments: ActiveInstallment[] = [];
  let totalRemainingDebt = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const config = getAmortizeConfig(tx);
    if (!config) continue;

    const totalAmount = offsetMap ? computeEffectiveExpenseAmount(tx, offsetMap) : tx.amount;
    if (totalAmount <= 0) continue;

    const startMonth = config.startMonth || tx.date.slice(0, 7);
    const monthDelta = diffInMonths(startMonth, currentYearMonth);

    if (monthDelta >= config.months) continue;

    const baseMonthly = Math.floor(totalAmount / config.months);
    let remainingMonths = 0;
    let elapsedMonths = 0;
    let remainingDebt = 0;

    if (monthDelta < 0) {
      elapsedMonths = 0;
      remainingMonths = config.months;
      remainingDebt = totalAmount;
    } else {
      elapsedMonths = monthDelta + 1;
      remainingMonths = config.months - elapsedMonths;
      remainingDebt = remainingMonths * baseMonthly;
    }

    if (remainingMonths > 0 && remainingDebt > 0) {
      totalRemainingDebt += remainingDebt;
      installments.push({
        transaction: tx,
        totalAmount,
        months: config.months,
        startMonth,
        elapsedMonths,
        remainingMonths,
        monthlyAmount: baseMonthly,
        remainingDebt,
      });
    }
  }

  installments.sort((a, b) => b.remainingDebt - a.remainingDebt);

  return {
    totalRemainingDebt,
    installments,
  };
}
