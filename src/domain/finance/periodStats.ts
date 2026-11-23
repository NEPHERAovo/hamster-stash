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
  icon?: string;
  color: string;
  amount: number;       // 单位：分
  percentage: number;   // 0 ~ 100 整数
  dashLength: number;   // 用于 SVG dasharray
  dashOffset: number;   // 用于 SVG dashoffset
  previousAmount?: number;     // 上期金额 (单位：分)
  momRate?: number | null;     // 环比增长率 (如 15.2 表示 +15.2%, -8.4 表示 -8.4%, null 表示新增或无法比对)
  isNew?: boolean;             // 上期为 0 本期新增
}

export interface TrendItem {
  label: string;
  amount: number; // 单位：分
  percentage: number; // 0 ~ 100 (相对于这几期中的最大绝对值)
  income?: number;
  expense?: number;
}

export interface PeriodBalanceSummary {
  income: number;              // 本期总收入 (分)
  expense: number;             // 本期净支出 (分)
  netBalance: number;          // 本期净结余 (分) = income - expense
  savingsRate: number;         // 结余率 / 储蓄率 (0 ~ 100 整数)
  previousIncome: number;      // 上期总收入 (分)
  previousExpense: number;     // 上期净支出 (分)
  previousNetBalance: number;  // 上期净结余 (分)
  incomeMomRate: number | null;
  expenseMomRate: number | null;
  balanceMomRate: number | null;
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

export function getPreviousPeriodBounds(
  mode: PeriodMode,
  currentKey: string
): { key: string; start: string; end: string } {
  if (mode === 'month') {
    const prevKey = stepYearMonth(currentKey, -1);
    const p = getMonthPeriod(prevKey);
    return { key: prevKey, start: p.start, end: p.end };
  }
  if (mode === 'year') {
    const prevKey = (parseInt(currentKey, 10) - 1).toString();
    const p = getYearPeriod(prevKey);
    return { key: prevKey, start: p.start, end: p.end };
  }
  const curStart = parseLocalDate(currentKey);
  const prevWeek = getWeekPeriod(curStart.subtract(1, 'week'));
  return { key: prevWeek.key, start: prevWeek.start, end: prevWeek.end };
}

export function computeCategoryDonutStats(
  transactions: Transaction[],
  categories: Category[],
  allTransactions?: Transaction[],
  isAmortizationEnabled: boolean = false,
  periodKey?: string,
  mode?: PeriodMode,
  txType: 'expense' | 'income' = 'expense'
): {
  items: CategoryStatItem[];
  totalExpense: number;
  totalAmount: number;
  circumference: number;
} {
  const CIRCUMFERENCE = 326.73;
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const offsetMap = buildOffsetMap(allTransactions || transactions);

  let totalAmount = 0;
  const catTotals = new Map<string, number>();

  if (txType === 'expense') {
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
            totalAmount += amt;
            catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + amt);
          }
        }
      }
    } else if (isAmortizationEnabled && allTransactions && mode === 'year' && periodKey) {
      for (const t of allTransactions) {
        if (t.type === 'expense') {
          let amt = 0;
          if (getAmortizeConfig(t)) {
            amt = computeAmortizedYearlyAmount(t, periodKey, offsetMap);
          } else if (t.date.startsWith(periodKey)) {
            amt = computeEffectiveExpenseAmount(t, offsetMap);
          }
          if (amt > 0) {
            totalAmount += amt;
            catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + amt);
          }
        }
      }
    } else {
      for (const t of transactions) {
        if (t.type === 'expense') {
          const effective = computeEffectiveExpenseAmount(t, offsetMap);
          totalAmount += effective;
          catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + effective);
        }
      }
    }
  } else {
    // txType === 'income': strictly exclude offset reimbursements
    for (const t of transactions) {
      if (t.type === 'income' && !t.offsetTransactionId) {
        totalAmount += t.amount;
        catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + t.amount);
      }
    }
  }

  // Calculate previous period category totals if allTransactions and periodKey are available
  const prevCatTotals = new Map<string, number>();
  if (allTransactions && periodKey && mode) {
    const prevBounds = getPreviousPeriodBounds(mode, periodKey);
    if (txType === 'expense') {
      if (isAmortizationEnabled && mode === 'month') {
        for (const t of allTransactions) {
          if (t.type === 'expense') {
            let amt = 0;
            if (getAmortizeConfig(t)) {
              amt = computeAmortizedMonthlyAmount(t, prevBounds.key, offsetMap);
            } else if (t.date.startsWith(prevBounds.key)) {
              amt = computeEffectiveExpenseAmount(t, offsetMap);
            }
            if (amt > 0) {
              prevCatTotals.set(t.categoryId, (prevCatTotals.get(t.categoryId) || 0) + amt);
            }
          }
        }
      } else if (isAmortizationEnabled && mode === 'year') {
        for (const t of allTransactions) {
          if (t.type === 'expense') {
            let amt = 0;
            if (getAmortizeConfig(t)) {
              amt = computeAmortizedYearlyAmount(t, prevBounds.key, offsetMap);
            } else if (t.date.startsWith(prevBounds.key)) {
              amt = computeEffectiveExpenseAmount(t, offsetMap);
            }
            if (amt > 0) {
              prevCatTotals.set(t.categoryId, (prevCatTotals.get(t.categoryId) || 0) + amt);
            }
          }
        }
      } else {
        for (const t of allTransactions) {
          if (t.type === 'expense' && t.date >= prevBounds.start && t.date <= prevBounds.end) {
            const effective = computeEffectiveExpenseAmount(t, offsetMap);
            prevCatTotals.set(t.categoryId, (prevCatTotals.get(t.categoryId) || 0) + effective);
          }
        }
      }
    } else {
      // Income previous period
      for (const t of allTransactions) {
        if (t.type === 'income' && !t.offsetTransactionId) {
          if (t.date >= prevBounds.start && t.date <= prevBounds.end) {
            prevCatTotals.set(t.categoryId, (prevCatTotals.get(t.categoryId) || 0) + t.amount);
          }
        }
      }
    }
  }

  if (totalAmount === 0) {
    return { items: [], totalExpense: 0, totalAmount: 0, circumference: CIRCUMFERENCE };
  }

  const sorted = Array.from(catTotals.entries())
    .map(([categoryId, amount]) => ({ categoryId, amount }))
    .sort((a, b) => b.amount - a.amount);

  let accumulatedOffset = 0;
  const items: CategoryStatItem[] = [];

  for (const [idx, entry] of sorted.entries()) {
    const cat = catMap.get(entry.categoryId);
    const percentage = Math.round((entry.amount / totalAmount) * 100);
    const fraction = entry.amount / totalAmount;
    const dashLength = parseFloat((fraction * CIRCUMFERENCE).toFixed(2));
    const previousAmount = prevCatTotals.get(entry.categoryId) || 0;

    let momRate: number | null = null;
    let isNew = false;
    if (previousAmount === 0 && entry.amount > 0) {
      isNew = true;
    } else if (previousAmount > 0) {
      const rate = ((entry.amount - previousAmount) / previousAmount) * 100;
      momRate = Math.round(rate * 10) / 10;
    } else if (previousAmount === 0 && entry.amount === 0) {
      momRate = 0;
    }

    items.push({
      categoryId: entry.categoryId,
      name: cat?.name || '其他',
      icon: cat?.icon,
      color: getStatsChartColor(idx),
      amount: entry.amount,
      percentage,
      dashLength,
      dashOffset: parseFloat(accumulatedOffset.toFixed(2)),
      previousAmount,
      momRate,
      isNew,
    });

    accumulatedOffset += dashLength;
  }

  return { items, totalExpense: totalAmount, totalAmount, circumference: CIRCUMFERENCE };
}

/**
 * 计算近期趋势柱状条数据 (近 6 个周期)
 */
export function computePeriodTrends(
  allTransactions: Transaction[],
  mode: PeriodMode,
  currentKey: string,
  count: number = mode === 'year' ? 5 : 6,
  isAmortizationEnabled: boolean = false,
  dimension: 'expense' | 'income' | 'balance' = 'expense'
): TrendItem[] {
  const trends: TrendItem[] = [];
  const offsetMap = buildOffsetMap(allTransactions);

  if (mode === 'month') {
    for (let i = count - 1; i >= 0; i--) {
      const ym = stepYearMonth(currentKey, -i);
      const monthNum = dayjs(`${ym}-01`, 'YYYY-MM-DD', true).month() + 1;
      let expense = 0;
      let income = 0;
      for (const t of allTransactions) {
        if (t.type === 'expense') {
          if (isAmortizationEnabled && getAmortizeConfig(t)) {
            expense += computeAmortizedMonthlyAmount(t, ym, offsetMap);
          } else if (t.date.startsWith(ym)) {
            expense += computeEffectiveExpenseAmount(t, offsetMap);
          }
        } else if (t.type === 'income' && !t.offsetTransactionId && t.date.startsWith(ym)) {
          income += t.amount;
        }
      }

      let amount = expense;
      if (dimension === 'income') amount = income;
      else if (dimension === 'balance') amount = income - expense;

      trends.push({ label: `${monthNum}月`, amount, percentage: 0, income, expense });
    }
  } else if (mode === 'year') {
    const curY = parseInt(currentKey, 10);
    for (let i = count - 1; i >= 0; i--) {
      const y = (curY - i).toString();
      let expense = 0;
      let income = 0;
      for (const t of allTransactions) {
        if (t.type === 'expense') {
          if (isAmortizationEnabled && getAmortizeConfig(t)) {
            expense += computeAmortizedYearlyAmount(t, y, offsetMap);
          } else if (t.date.startsWith(y)) {
            expense += computeEffectiveExpenseAmount(t, offsetMap);
          }
        } else if (t.type === 'income' && !t.offsetTransactionId && t.date.startsWith(y)) {
          income += t.amount;
        }
      }

      let amount = expense;
      if (dimension === 'income') amount = income;
      else if (dimension === 'balance') amount = income - expense;

      trends.push({ label: `${y}年`, amount, percentage: 0, income, expense });
    }
  } else {
    const curDate = parseLocalDate(currentKey);
    for (let i = count - 1; i >= 0; i--) {
      const week = getWeekPeriod(curDate.subtract(i, 'week'));

      let expense = 0;
      let income = 0;
      for (const t of allTransactions) {
        if (t.date >= week.start && t.date <= week.end) {
          if (t.type === 'expense') {
            expense += computeEffectiveExpenseAmount(t, offsetMap);
          } else if (t.type === 'income' && !t.offsetTransactionId) {
            income += t.amount;
          }
        }
      }

      let amount = expense;
      if (dimension === 'income') amount = income;
      else if (dimension === 'balance') amount = income - expense;

      const weekStart = parseLocalDate(week.start);
      trends.push({
        label: `${weekStart.month() + 1}.${weekStart.date()}`,
        amount,
        percentage: 0,
        income,
        expense,
      });
    }
  }

  const maxAbsAmount = Math.max(...trends.map((t) => Math.abs(t.amount)), 1);
  for (const t of trends) {
    t.percentage = Math.round((t.amount / maxAbsAmount) * 100);
  }

  return trends;
}

/**
 * 计算周期收支结构与结余总括 (含上期环比)
 */
export function computePeriodBalanceSummary(
  transactions: Transaction[],
  allTransactions: Transaction[],
  periodInfo: PeriodInfo,
  mode: PeriodMode,
  isAmortizationEnabled: boolean = false
): PeriodBalanceSummary {
  const offsetMap = buildOffsetMap(allTransactions);

  let income = 0;
  for (const t of transactions) {
    if (t.type === 'income' && !t.offsetTransactionId) {
      income += t.amount;
    }
  }

  let expense = 0;
  if (isAmortizationEnabled && mode === 'month') {
    for (const t of allTransactions) {
      if (t.type === 'expense') {
        if (getAmortizeConfig(t)) {
          expense += computeAmortizedMonthlyAmount(t, periodInfo.key, offsetMap);
        } else if (t.date.startsWith(periodInfo.key)) {
          expense += computeEffectiveExpenseAmount(t, offsetMap);
        }
      }
    }
  } else if (isAmortizationEnabled && mode === 'year') {
    for (const t of allTransactions) {
      if (t.type === 'expense') {
        if (getAmortizeConfig(t)) {
          expense += computeAmortizedYearlyAmount(t, periodInfo.key, offsetMap);
        } else if (t.date.startsWith(periodInfo.key)) {
          expense += computeEffectiveExpenseAmount(t, offsetMap);
        }
      }
    }
  } else {
    for (const t of transactions) {
      if (t.type === 'expense') {
        expense += computeEffectiveExpenseAmount(t, offsetMap);
      }
    }
  }

  const netBalance = income - expense;
  const savingsRate = income > 0 ? Math.max(0, Math.round((netBalance / income) * 100)) : 0;

  // Previous period calculations
  const prevBounds = getPreviousPeriodBounds(mode, periodInfo.key);
  let prevIncome = 0;
  let prevExpense = 0;

  if (isAmortizationEnabled && mode === 'month') {
    for (const t of allTransactions) {
      if (t.type === 'income' && !t.offsetTransactionId && t.date.startsWith(prevBounds.key)) {
        prevIncome += t.amount;
      } else if (t.type === 'expense') {
        if (getAmortizeConfig(t)) {
          prevExpense += computeAmortizedMonthlyAmount(t, prevBounds.key, offsetMap);
        } else if (t.date.startsWith(prevBounds.key)) {
          prevExpense += computeEffectiveExpenseAmount(t, offsetMap);
        }
      }
    }
  } else if (isAmortizationEnabled && mode === 'year') {
    for (const t of allTransactions) {
      if (t.type === 'income' && !t.offsetTransactionId && t.date.startsWith(prevBounds.key)) {
        prevIncome += t.amount;
      } else if (t.type === 'expense') {
        if (getAmortizeConfig(t)) {
          prevExpense += computeAmortizedYearlyAmount(t, prevBounds.key, offsetMap);
        } else if (t.date.startsWith(prevBounds.key)) {
          prevExpense += computeEffectiveExpenseAmount(t, offsetMap);
        }
      }
    }
  } else {
    for (const t of allTransactions) {
      if (t.date >= prevBounds.start && t.date <= prevBounds.end) {
        if (t.type === 'income' && !t.offsetTransactionId) {
          prevIncome += t.amount;
        } else if (t.type === 'expense') {
          prevExpense += computeEffectiveExpenseAmount(t, offsetMap);
        }
      }
    }
  }

  const prevNetBalance = prevIncome - prevExpense;

  const calcRate = (cur: number, prev: number): number | null => {
    if (prev === 0 && cur > 0) return null; // new / baseline 0
    if (prev === 0 && cur === 0) return 0;
    const r = ((cur - prev) / Math.abs(prev)) * 100;
    return Math.round(r * 10) / 10;
  };

  return {
    income,
    expense,
    netBalance,
    savingsRate,
    previousIncome: prevIncome,
    previousExpense: prevExpense,
    previousNetBalance: prevNetBalance,
    incomeMomRate: calcRate(income, prevIncome),
    expenseMomRate: calcRate(expense, prevExpense),
    balanceMomRate: calcRate(netBalance, prevNetBalance),
  };
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
