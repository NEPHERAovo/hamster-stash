import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import { buildOffsetMap, computeEffectiveExpenseAmount } from './balanceCalculator';

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

/**
 * 获取某个日期所在周（周一至周日）
 */
export function getWeekPeriod(targetDate: Date): PeriodInfo {
  const d = new Date(targetDate);
  const day = d.getDay(); // 0 is Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatLocalDate = (date: Date) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const start = formatLocalDate(monday);
  const end = formatLocalDate(sunday);

  const firstDayOfYear = new Date(monday.getFullYear(), 0, 1, 12, 0, 0);
  const pastDaysOfYear = Math.round((monday.getTime() - firstDayOfYear.getTime()) / 86400000);
  const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

  const m1 = (monday.getMonth() + 1).toString().padStart(2, '0');
  const d1 = monday.getDate().toString().padStart(2, '0');
  const m2 = (sunday.getMonth() + 1).toString().padStart(2, '0');
  const d2 = sunday.getDate().toString().padStart(2, '0');

  return {
    start,
    end,
    key: start,
    label: `${monday.getFullYear()}年第${weekNum}周 (${m1}.${d1}-${m2}.${d2})`,
  };
}

/**
 * 获取某月份的起始与结束
 */
export function getMonthPeriod(yearMonth: string): PeriodInfo {
  const [yStr, mStr] = yearMonth.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);

  const lastDay = new Date(y, m, 0).getDate();
  const start = `${yearMonth}-01`;
  const end = `${yearMonth}-${lastDay.toString().padStart(2, '0')}`;

  return {
    start,
    end,
    key: yearMonth,
    label: `${y}年${m}月`,
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

/**
 * 计算分类支出占比与 SVG 环形图参数
 * 环形半径 r = 52，周长 = 2 * PI * 52 ≈ 326.73
 */
export function computeCategoryDonutStats(
  transactions: Transaction[],
  categories: Category[],
  allTransactions?: Transaction[]
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

  for (const t of transactions) {
    if (t.type === 'expense') {
      const effective = computeEffectiveExpenseAmount(t, offsetMap);
      totalExpense += effective;
      catTotals.set(t.categoryId, (catTotals.get(t.categoryId) || 0) + effective);
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

  for (const entry of sorted) {
    const cat = catMap.get(entry.categoryId);
    const percentage = Math.round((entry.amount / totalExpense) * 100);
    const fraction = entry.amount / totalExpense;
    const dashLength = parseFloat((fraction * CIRCUMFERENCE).toFixed(2));

    items.push({
      categoryId: entry.categoryId,
      name: cat?.name || '其他',
      color: cat?.color || 'var(--ink-secondary)',
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
 * 计算近期趋势柱状条数据 (近 4 个周期)
 */
export function computePeriodTrends(
  allTransactions: Transaction[],
  mode: PeriodMode,
  currentKey: string
): TrendItem[] {
  const trends: TrendItem[] = [];
  const offsetMap = buildOffsetMap(allTransactions);

  if (mode === 'month') {
    const [yStr, mStr] = currentKey.split('-');
    const curY = parseInt(yStr, 10);
    const curM = parseInt(mStr, 10);

    const months: { ym: string; label: string }[] = [];
    for (let i = 3; i >= 0; i--) {
      let targetM = curM - i;
      let targetY = curY;
      while (targetM <= 0) {
        targetM += 12;
        targetY -= 1;
      }
      const ym = `${targetY}-${targetM.toString().padStart(2, '0')}`;
      months.push({ ym, label: `${targetM}月` });
    }

    for (const m of months) {
      let expense = 0;
      for (const t of allTransactions) {
        if (t.type === 'expense' && t.date.startsWith(m.ym)) {
          expense += computeEffectiveExpenseAmount(t, offsetMap);
        }
      }
      trends.push({ label: m.label, amount: expense, percentage: 0 });
    }
  } else if (mode === 'year') {
    const curY = parseInt(currentKey, 10);
    for (let i = 3; i >= 0; i--) {
      const y = (curY - i).toString();
      let expense = 0;
      for (const t of allTransactions) {
        if (t.type === 'expense' && t.date.startsWith(y)) {
          expense += computeEffectiveExpenseAmount(t, offsetMap);
        }
      }
      trends.push({ label: `${y}年`, amount: expense, percentage: 0 });
    }
  } else {
    const [ky, km, kd] = currentKey.split('-').map(Number);
    const curDate = new Date(ky, km - 1, kd, 12, 0, 0);
    for (let i = 3; i >= 0; i--) {
      const d = new Date(curDate);
      d.setDate(d.getDate() - i * 7);
      const week = getWeekPeriod(d);

      let expense = 0;
      for (const t of allTransactions) {
        if (t.type === 'expense' && t.date >= week.start && t.date <= week.end) {
          expense += computeEffectiveExpenseAmount(t, offsetMap);
        }
      }
      const m = parseInt(week.start.split('-')[1], 10);
      const day = parseInt(week.start.split('-')[2], 10);
      trends.push({ label: `${m}.${day}`, amount: expense, percentage: 0 });
    }
  }

  const maxAmount = Math.max(...trends.map((t) => t.amount), 1);
  for (const t of trends) {
    t.percentage = Math.round((t.amount / maxAmount) * 100);
  }

  return trends;
}
