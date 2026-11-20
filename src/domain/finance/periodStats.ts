import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import type { Account } from '../../types/account';
import { buildOffsetMap, computeEffectiveExpenseAmount } from './balanceCalculator';
import {
  computeAmortizedMonthlyAmount,
  computeAmortizedYearlyAmount,
  getAmortizeConfig,
} from './amortization';
import {
  dayjs,
  getIsoWeekBounds,
  parseLocalDate,
  stepYearMonth,
  type ConfigType,
} from '../../utils/date';

export type PeriodMode = 'week' | 'month' | 'year';

export interface PeriodInfo {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  label: string; // 显示文案
  key: string;   // 用于状态索引
}

export interface CategoryStatItem {
  categoryId: string;
  name: string;
  color: string;
  amount: number;       // 单位：分
  percentage: number;   // 0 ~ 100 整数
  dashLength: number;   // 用于 SVG dasharray
  dashOffset: number;   // 用于 SVG dashoffset
}

export interface TrendItem {
  label: string;
  amount: number; // 单位：分
  percentage: number; // 0 ~ 100 (相对于这几期中的最大值)
}

export function getWeekPeriod(targetDate: ConfigType): PeriodInfo {
  const { start: monday, end: sunday, weekNumber, weekYear } = getIsoWeekBounds(targetDate);
  const start = monday.format('YYYY-MM-DD');
  const end = sunday.format('YYYY-MM-DD');

  return {
    start,
    end,
    key: start,
    label: `${weekYear}年第${weekNumber}周 (${monday.format('MM.DD')}-${sunday.format('MM.DD')})`,
  };
}

export function getMonthPeriod(yearMonth: string): PeriodInfo {
  const base = dayjs(`${yearMonth}-01`, 'YYYY-MM-DD', true);
  const start = base.startOf('month').format('YYYY-MM-DD');
  const end = base.endOf('month').format('YYYY-MM-DD');

  return {
    start,
    end,
    key: yearMonth,
    label: `${base.year()}年${base.month() + 1}月`,
  };
}

/**
 * 获取某年份的起始与结束
 */
export function getYearPeriod(year: string): PeriodInfo {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
    key: year,
    label: `${year}年`,
  };
}

/**
 * 过滤指定起止日期内的流水
 */
export function filterTransactionsByPeriod(
  transactions: Transaction[],
  startDate: string,
  endDate: string
): Transaction[] {
  return transactions.filter((t) => t.date >= startDate && t.date <= endDate);
}

export const STATS_CHART_PALETTE = [
  '#D1493B',
  '#2B6CB0',
  '#D98A1A',
  '#2E8B57',
  '#7C4DFF',
  '#0F8B8D',
  '#E06D3B',
  '#B83280',
  '#5C8D3E',
  '#64748B',
] as const;

export function getStatsChartColor(rankIndex: number): string {
  return STATS_CHART_PALETTE[rankIndex % STATS_CHART_PALETTE.length];
}

export function computeCategoryDonutStats(
  transactions: Transaction[],
  categories: Category[],
  allTransactions?: Transaction[],
  isAmortizationEnabled: boolean = false,
  periodKey?: string,
  mode?: PeriodMode
): {
  items: CategoryStatItem[];
  totalExpense: number;
  circumference: number;
} {
  const CIRCUMFERENCE = 326.73;
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const offsetMap = buildOffsetMap(allTransactions || transactions);

  let totalExpense = 0;
  const catTotals = new Map<string, number>();

  if (isAmortizationEnabled && allTransactions && mode === 'month' && periodKey) {
    for (const t of allTransactions) {
      if (t.type === 'expense') {
        let amt = 0;
        if (getAmortizeConfig(t)) {
          amt = computeAmortizedMonthlyAmount(t, periodKey, offsetMap);
        } else if (t.date.startsWith(periodKey)) {
          amt = computeEffectiveExpenseAmount(t, offsetMap);
        }
        if (amt > 0) {
          totalExpense += amt;
          catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + amt);
        }
      }
    }
  } else {
    for (const t of transactions) {
      if (t.type === 'expense') {
        const effective = computeEffectiveExpenseAmount(t, offsetMap);
        totalExpense += effective;
        catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + effective);
      }
    }
  }

  if (totalExpense === 0) {
    return { items: [], totalExpense: 0, circumference: CIRCUMFERENCE };
  }

  const sorted = Array.from(catTotals.entries())
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);

  let accumulatedOffset = 0;
  const items: CategoryStatItem[] = [];

  for (const [idx, entry] of sorted.entries()) {
    const cat = catMap.get(entry.categoryId);
    const percentage = Math.round((entry.amount / totalExpense) * 100);
    const fraction = entry.amount / totalExpense;
    const dashLength = parseFloat((fraction * CIRCUMFERENCE).toFixed(2));

    items.push({
      categoryId: entry.categoryId,
      name: cat?.name || '其他',
      color: getStatsChartColor(idx),
      amount: entry.amount,
      percentage,
      dashLength,
      dashOffset: parseFloat(accumulatedOffset.toFixed(2)),
    });

    accumulatedOffset += dashLength;
  }

  return { items, totalExpense, circumference: CIRCUMFERENCE };
}

/**
 * 计算近期趋势柱状条数据 (近 6 个周期)
 */
export function computePeriodTrends(
  allTransactions: Transaction[],
  mode: PeriodMode,
  currentKey: string,
  count: number = mode === 'year' ? 5 : 6,
  isAmortizationEnabled: boolean = false
): TrendItem[] {
  const trends: TrendItem[] = [];
  const offsetMap = buildOffsetMap(allTransactions);

  if (mode === 'month') {
    for (let i = count - 1; i >= 0; i--) {
      const ym = stepYearMonth(currentKey, -i);
      const monthNum = dayjs(`${ym}-01`, 'YYYY-MM-DD', true).month() + 1;
      let expense = 0;
      for (const t of allTransactions) {
        if (t.type === 'expense') {
          if (isAmortizationEnabled && getAmortizeConfig(t)) {
            expense += computeAmortizedMonthlyAmount(t, ym, offsetMap);
          } else if (t.date.startsWith(ym)) {
            expense += computeEffectiveExpenseAmount(t, offsetMap);
          }
        }
      }
      trends.push({ label: `${monthNum}月`, amount: expense, percentage: 0 });
    }
  } else if (mode === 'year') {
    const curY = parseInt(currentKey, 10);
    for (let i = count - 1; i >= 0; i--) {
      const y = (curY - i).toString();
      let expense = 0;
      for (const t of allTransactions) {
        if (t.type === 'expense') {
          if (isAmortizationEnabled && getAmortizeConfig(t)) {
            expense += computeAmortizedYearlyAmount(t, y, offsetMap);
          } else if (t.date.startsWith(y)) {
            expense += computeEffectiveExpenseAmount(t, offsetMap);
          }
        }
      }
      trends.push({ label: `${y}年`, amount: expense, percentage: 0 });
    }
  } else {
    const curDate = parseLocalDate(currentKey);
    for (let i = count - 1; i >= 0; i--) {
      const week = getWeekPeriod(curDate.subtract(i, 'week'));

      let expense = 0;
      for (const t of allTransactions) {
        if (t.type === 'expense' && t.date >= week.start && t.date <= week.end) {
          expense += computeEffectiveExpenseAmount(t, offsetMap);
        }
      }
      const weekStart = parseLocalDate(week.start);
      trends.push({
        label: `${weekStart.month() + 1}.${weekStart.date()}`,
        amount: expense,
        percentage: 0,
      });
    }
  }

  const maxAmount = Math.max(...trends.map((t) => t.amount), 1);
  for (const t of trends) {
    t.percentage = Math.round((t.amount / maxAmount) * 100);
  }

  return trends;
}

/**
 * 计算单个账户在近 N 个月份月末的资产结余走势
 */
export function computeAccountMonthlyBalanceTrends(
  account: Account,
  allTransactions: Transaction[],
  targetEndMonth: string,
  count: number = 6
): TrendItem[] {
  const trends: TrendItem[] = [];

  const computeTxDelta = (tx: Transaction): number => {
    let delta = 0;
    if (tx.accountId === account.id) {
      if (tx.type === 'expense') delta -= tx.amount;
      else if (tx.type === 'income') delta += tx.amount;
      else if (tx.type === 'transfer') delta -= tx.amount;
      else if (tx.type === 'loan') {
        if (tx.loanDirection === 'lend' && tx.loanRole === 'origin') delta -= tx.amount;
        else if (tx.loanDirection === 'borrow' && tx.loanRole === 'origin') delta += tx.amount;
        else if (tx.loanDirection === 'lend' && tx.loanRole === 'repayment') delta += tx.amount;
        else if (tx.loanDirection === 'borrow' && tx.loanRole === 'repayment') delta -= tx.amount;
      }
    }
    if (tx.toAccountId === account.id && tx.type === 'transfer') {
      delta += tx.amount;
    }
    return delta;
  };

  for (let i = count - 1; i >= 0; i--) {
    const ym = stepYearMonth(targetEndMonth, -i);
    const monthNum = dayjs(`${ym}-01`, 'YYYY-MM-DD', true).month() + 1;
    const monthEnd = dayjs(`${ym}-01`, 'YYYY-MM-DD', true).endOf('month').format('YYYY-MM-DD');

    let postMonthDelta = 0;
    for (const tx of allTransactions) {
      if (tx.date > monthEnd) {
        postMonthDelta += computeTxDelta(tx);
      }
    }

    const monthEndBalance = account.balance - postMonthDelta;
    trends.push({
      label: `${monthNum}月`,
      amount: monthEndBalance,
      percentage: 0,
    });
  }

  const maxAmount = Math.max(...trends.map((t) => Math.max(0, t.amount)), 1);
  for (const t of trends) {
    t.percentage = maxAmount > 0 ? Math.round((Math.max(0, t.amount) / maxAmount) * 100) : 0;
  }

  return trends;
}
