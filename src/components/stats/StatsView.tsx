import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, PieChart } from 'lucide-react';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import type { Account } from '../../types/account';
import {
  type PeriodMode,
  getWeekPeriod,
  getMonthPeriod,
  getYearPeriod,
  filterTransactionsByPeriod,
  computeCategoryDonutStats,
  computePeriodTrends,
} from '../../domain/finance/periodStats';
import { TransactionGroup } from '../ledger/TransactionGroup';
import { DonutChart } from './DonutChart';
import { CategoryLegend } from './CategoryLegend';
import { MonthlyTrendBar } from './MonthlyTrendBar';
import { SpendingRankList } from './SpendingRankList';
import { cn } from '../../utils/cn';

export interface StatsViewProps {
  allTransactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onSelectTransaction?: (tx: Transaction) => void;
  mode?: PeriodMode;
  onModeChange?: (mode: PeriodMode) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const StatsView: React.FC<StatsViewProps> = ({
  allTransactions,
  categories,
  accounts,
  onSelectTransaction,
  mode: controlledMode,
  onModeChange,
}) => {
  const [internalMode, setInternalMode] = useState<PeriodMode>('month');
  const mode = controlledMode || internalMode;
  const setMode = onModeChange || setInternalMode;

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  const periodInfo = useMemo(() => {
    if (mode === 'week') {
      return getWeekPeriod(currentDate);
    }
    if (mode === 'year') {
      return getYearPeriod(currentDate.getFullYear().toString());
    }
    const ym = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
    return getMonthPeriod(ym);
  }, [mode, currentDate]);

  const handlePrevPeriod = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (mode === 'week') {
        next.setDate(next.getDate() - 7);
      } else if (mode === 'month') {
        next.setMonth(next.getMonth() - 1);
      } else {
        next.setFullYear(next.getFullYear() - 1);
      }
      return next;
    });
  };

  const handleNextPeriod = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (mode === 'week') {
        next.setDate(next.getDate() + 7);
      } else if (mode === 'month') {
        next.setMonth(next.getMonth() + 1);
      } else {
        next.setFullYear(next.getFullYear() + 1);
      }
      return next;
    });
  };

  const periodTransactions = useMemo(() => {
    return filterTransactionsByPeriod(allTransactions, periodInfo.start, periodInfo.end);
  }, [allTransactions, periodInfo]);

  const { items: donutItems, totalExpense, circumference } = useMemo(() => {
    return computeCategoryDonutStats(periodTransactions, categories, allTransactions);
  }, [periodTransactions, categories, allTransactions]);

  const trends = useMemo(() => {
    return computePeriodTrends(allTransactions, mode, periodInfo.key);
  }, [allTransactions, mode, periodInfo.key]);

  const trendTitle =
    mode === 'week' ? '周度支出趋势' : mode === 'month' ? '月度支出趋势' : '年度支出趋势';

  const formattedPeriodTitle = useMemo(() => {
    if (mode === 'month') {
      const parts = periodInfo.key.split('-');
      const y = parts[0];
      const mIdx = parseInt(parts[1] || '1', 10) - 1;
      const monthName = MONTH_NAMES[mIdx] || parts[1];
      return `${monthName} ${y}`;
    }
    if (mode === 'year') {
      return `Year ${periodInfo.key}`;
    }
    if (mode === 'week') {
      const startParts = periodInfo.start.split('-');
      const endParts = periodInfo.end.split('-');
      return `${periodInfo.key} · ${startParts[1]}.${startParts[2]}-${endParts[1]}.${endParts[2]}`;
    }
    return periodInfo.label;
  }, [mode, periodInfo]);

  return (
    <div className="py-2 space-y-3.5 pb-6">
      {!controlledMode && (
        <div className="flex bg-(--paper-sunken) p-0.5 rounded-[3px] border border-(--rule-hairline) mx-auto max-w-[200px] select-none">
          {(['week', 'month', 'year'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 py-1 text-xs font-semibold rounded-xs transition-all cursor-pointer text-center font-mono',
                mode === m
                  ? 'bg-(--paper-sheet) text-(--ink-primary) shadow-2xs font-bold'
                  : 'text-(--ink-tertiary) hover:text-(--ink-secondary)'
              )}
            >
              {m === 'week' ? '周' : m === 'month' ? '月' : '年'}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-1 select-none">
        <span className="font-serif not-italic text-lg sm:text-xl text-(--ink-solid) tracking-tight">
          {formattedPeriodTitle}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevPeriod}
            className="w-7 h-7 flex items-center justify-center rounded-xs bg-(--paper-base) border border-(--rule-hairline) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all cursor-pointer font-mono"
            title="上个周期"
            aria-label="上个周期"
          >
            <ChevronLeft className="w-3.5 h-3.5 stroke-2" />
          </button>
          <button
            type="button"
            onClick={handleNextPeriod}
            className="w-7 h-7 flex items-center justify-center rounded-xs bg-(--paper-base) border border-(--rule-hairline) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all cursor-pointer font-mono"
            title="下个周期"
            aria-label="下个周期"
          >
            <ChevronRight className="w-3.5 h-3.5 stroke-2" />
          </button>
        </div>
      </div>

      {totalExpense === 0 ? (
        <div className="w-full p-6 bg-(--paper-sheet) border border-(--rule-hairline) rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25)] text-center text-xs text-(--ink-tertiary) flex flex-col items-center gap-1.5 select-none">
          <PieChart className="w-6 h-6 stroke-[1.5] text-(--ink-faint)" />
          <span>本周期暂无支出记录</span>
        </div>
      ) : (
        <SpendingRankList items={donutItems} totalExpense={totalExpense} />
      )}

      {totalExpense > 0 && (
        <div className="w-full p-3.5 sm:p-5 bg-(--paper-sheet) border border-(--rule-hairline) rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25)] select-none">
          <div className="flex items-center gap-5 sm:gap-8 justify-around">
            <DonutChart
              items={donutItems}
              totalExpense={totalExpense}
              circumference={circumference}
            />
            <CategoryLegend items={donutItems} limit={6} />
          </div>
        </div>
      )}

      <MonthlyTrendBar title={trendTitle} trends={trends} />

      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between px-1 select-none">
          <span className="text-xs font-semibold text-(--ink-secondary)">
            周期账单
          </span>
          <span className="text-[11px] font-mono text-(--ink-tertiary)">
            共 {periodTransactions.length} 笔
          </span>
        </div>

        <TransactionGroup
          transactions={periodTransactions}
          categories={categories}
          accounts={accounts}
          onSelectTransaction={onSelectTransaction}
          pageSize={12}
          contained
        />
      </div>
    </div>
  );
};

export default StatsView;
