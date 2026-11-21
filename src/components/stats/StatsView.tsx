import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight, ChartPieIcon as PieChart } from '@phosphor-icons/react';
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
import { MonthlyTrendBar } from './MonthlyTrendBar';
import { SpendingRankList } from './SpendingRankList';
import { CategoryDetailSubPage } from './CategoryDetailSubPage';
import { SubPageShell, SubPageBackButton } from '../layout/SubPageShell';
import { PageHeader } from '../layout/PageHeader';
import { SegToggle } from '../ui/SegToggle';
import { useThemeStore } from '../../stores/useThemeStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { dayjs, type Dayjs, stepYearMonth, parseLocalDate } from '../../utils/date';
import { cn } from '../../utils/cn';

export interface CategoryDrilldownData {
  category: Category;
  periodLabel: string;
  transactions: Transaction[];
  totalExpense: number;
  categoryPercentage: number;
}

export interface StatsViewProps {
  allTransactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onSelectTransaction?: (tx: Transaction) => void;
  mode?: PeriodMode;
  onModeChange?: (mode: PeriodMode) => void;
  onOpenCategoryDrilldown?: (data: CategoryDrilldownData) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const StatsView: React.FC<StatsViewProps> = ({
  allTransactions,
  categories,
  accounts,
  onSelectTransaction,
  mode: controlledMode,
  onModeChange,
  onOpenCategoryDrilldown,
}) => {
  const [internalMode, setInternalMode] = useState<PeriodMode>('month');
  const [internalDrilldown, setInternalDrilldown] = useState<CategoryDrilldownData | null>(null);
  const mode = controlledMode || internalMode;
  const setMode = onModeChange || setInternalMode;

  const uiStyle = useThemeStore((s) => s.uiStyle);
  const isModern = uiStyle === 'modern';

  const [currentDate, setCurrentDate] = useState<Dayjs>(() => dayjs());

  const periodInfo = useMemo(() => {
    if (mode === 'week') {
      return getWeekPeriod(currentDate);
    }
    if (mode === 'year') {
      return getYearPeriod(currentDate.format('YYYY'));
    }
    return getMonthPeriod(currentDate.format('YYYY-MM'));
  }, [mode, currentDate]);

  const handlePrevPeriod = () => {
    setCurrentDate((prev) => prev.subtract(1, mode));
  };

  const handleNextPeriod = () => {
    setCurrentDate((prev) => prev.add(1, mode));
  };

  const isAmortizationEnabled = usePreferenceStore((s) => s.isAmortizationEnabled);

  const periodTransactions = useMemo(() => {
    return filterTransactionsByPeriod(allTransactions, periodInfo.start, periodInfo.end);
  }, [allTransactions, periodInfo]);

  const { items: donutItems, totalExpense, circumference } = useMemo(() => {
    return computeCategoryDonutStats(
      periodTransactions,
      categories,
      allTransactions,
      isAmortizationEnabled,
      periodInfo.key,
      mode
    );
  }, [periodTransactions, categories, allTransactions, isAmortizationEnabled, periodInfo.key, mode]);

  const prevExpenseRef = useRef(totalExpense);
  const wasEmptyExpense = prevExpenseRef.current === 0;
  const isEmptyExpense = totalExpense === 0;
  const shouldAnimateEmptyExpense = !wasEmptyExpense && isEmptyExpense;

  useEffect(() => {
    prevExpenseRef.current = totalExpense;
  }, [totalExpense]);

  const [trendOffset, setTrendOffset] = useState<number>(0);

  useEffect(() => {
    setTrendOffset(0);
  }, [periodInfo.key, mode]);

  const trendTargetKey = useMemo(() => {
    if (trendOffset === 0) return periodInfo.key;
    if (mode === 'month') return stepYearMonth(periodInfo.key, trendOffset);
    if (mode === 'year') {
      const y = parseInt(periodInfo.key, 10) + trendOffset;
      return y.toString();
    }
    const d = parseLocalDate(periodInfo.key).add(trendOffset, 'week');
    return d.format('YYYY-MM-DD');
  }, [periodInfo.key, trendOffset, mode]);

  const trends = useMemo(() => {
    return computePeriodTrends(
      allTransactions,
      mode,
      trendTargetKey,
      mode === 'year' ? 5 : 6,
      isAmortizationEnabled
    );
  }, [allTransactions, mode, trendTargetKey, isAmortizationEnabled]);

  const handleStepTrendPrev = () => {
    setTrendOffset((prev) => prev - 1);
  };

  const handleStepTrendNext = () => {
    setTrendOffset((prev) => Math.min(0, prev + 1));
  };

  const canStepTrendNext = trendOffset < 0;

  const trendTitles: Record<string, string> = {
    week: '周度支出趋势',
    month: '月度支出趋势',
    year: '年度支出趋势',
  };
  const trendTitle = trendTitles[mode] || '月度支出趋势';

  const weekBadge = useMemo(() => {
    if (mode !== 'week') return null;
    const today = dayjs();
    const thisWeek = getWeekPeriod(today);
    if (periodInfo.start === thisWeek.start) return '本周';
    const lastWeek = getWeekPeriod(today.subtract(1, 'week'));
    if (periodInfo.start === lastWeek.start) return '上周';
    return null;
  }, [mode, periodInfo.start]);

  const formattedPeriodTitle = useMemo(() => {
    if (mode === 'month') {
      const parts = periodInfo.key.split('-');
      const y = parts[0];
      const mIdx = parseInt(parts[1] || '1', 10) - 1;
      const monthName = isModern
        ? `${SHORT_MONTH_NAMES[mIdx] || parts[1]}, ${y}`
        : `${MONTH_NAMES[mIdx] || parts[1]} ${y}`;
      return monthName;
    }
    if (mode === 'year') {
      return isModern ? `${periodInfo.key} 年` : `Year ${periodInfo.key}`;
    }
    if (mode === 'week') {
      const [sy, sm, sd] = periodInfo.start.split('-');
      const [ey, em, ed] = periodInfo.end.split('-');
      if (sy !== ey) {
        return `${sy}.${sm}.${sd} – ${ey}.${em}.${ed}`;
      }
      return `${sy} · ${sm}.${sd} – ${em}.${ed}`;
    }
    return periodInfo.label;
  }, [mode, periodInfo, isModern]);

  const handleSelectCategory = (categoryId: string) => {
    const targetCategory = categories.find((c) => c.id === categoryId);
    if (!targetCategory) return;
    const statItem = donutItems.find((d) => d.categoryId === categoryId);
    const catTxs = periodTransactions.filter((tx) => tx.categoryId === categoryId);
    const drilldownData: CategoryDrilldownData = {
      category: targetCategory,
      periodLabel: formattedPeriodTitle,
      transactions: catTxs,
      totalExpense: statItem ? statItem.amount : 0,
      categoryPercentage: statItem ? statItem.percentage : 0,
    };
    if (onOpenCategoryDrilldown) {
      onOpenCategoryDrilldown(drilldownData);
    } else {
      setInternalDrilldown(drilldownData);
    }
  };

  return (
    <div className="space-y-3.5 py-2 pb-6">
      {!controlledMode && (
        <div className="mx-auto max-w-50">
          <SegToggle
            options={[
              { value: 'week', label: '周' },
              { value: 'month', label: '月' },
              { value: 'year', label: '年' },
            ]}
            value={mode}
            onChange={setMode}
            size="sm"
          />
        </div>
      )}

      <div className="tab-stagger-1 space-y-2">
        <div className="flex items-center justify-between px-1 select-none">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-serif text-lg tracking-tight text-(--ink-solid) not-italic sm:text-xl">
              {formattedPeriodTitle}
            </span>
            {weekBadge && (
              <span className="shrink-0 rounded-(--badge-radius) bg-(--paper-sunken) px-1.5 py-0.5 font-mono text-[10px] text-(--ink-secondary)">
                {weekBadge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevPeriod}
              className="flex size-7 cursor-pointer items-center justify-center rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sheet) font-mono text-(--ink-secondary) shadow-xs transition-all hover:bg-(--paper-sunken) hover:text-(--ink-primary) active:scale-95"
              title="上个周期"
              aria-label="上个周期"
            >
              <ChevronLeft className="size-3.5 stroke-2" />
            </button>
            <button
              type="button"
              onClick={handleNextPeriod}
              className="flex size-7 cursor-pointer items-center justify-center rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sheet) font-mono text-(--ink-secondary) shadow-xs transition-all hover:bg-(--paper-sunken) hover:text-(--ink-primary) active:scale-95"
              title="下个周期"
              aria-label="下个周期"
            >
              <ChevronRight className="size-3.5 stroke-2" />
            </button>
          </div>
        </div>

        {totalExpense === 0 ? (
          <div
            className={cn(
              'paper-card flex w-full flex-col items-center gap-1.5 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-6 text-center text-xs text-(--ink-tertiary) shadow-xs transition-all duration-200 select-none',
              shouldAnimateEmptyExpense && 'filter-fade-enter'
            )}
          >
            <PieChart className="stroke-1.5 size-6 text-(--ink-faint)" />
            <span>本周期暂无支出记录</span>
          </div>
        ) : (
          <div className="paper-card w-full space-y-3.5 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3.5 shadow-xs transition-all duration-200 select-none sm:p-5">
            <div className="flex items-center justify-between">
              <span className="font-serif text-sm text-(--ink-secondary)">
                支出构成
              </span>
              <span className="font-mono text-xs text-(--ink-tertiary)">
                共 {donutItems.length} 项分类
              </span>
            </div>

            <div className="flex items-center justify-center py-1">
              <DonutChart
                items={donutItems}
                totalExpense={totalExpense}
                circumference={circumference}
                periodKey={periodInfo.key}
              />
            </div>

            <div className="border-t border-(--rule-hairline)/60 pt-1">
              <SpendingRankList
                items={donutItems}
                totalExpense={totalExpense}
                onSelectCategory={handleSelectCategory}
              />
            </div>
          </div>
        )}
      </div>

      <div className="tab-stagger-2">
        <MonthlyTrendBar
          title={trendTitle}
          trends={trends}
          onStepPrev={handleStepTrendPrev}
          onStepNext={handleStepTrendNext}
          canStepNext={canStepTrendNext}
        />
      </div>

      <div className="tab-stagger-3 space-y-1.5 pt-1">
        <div className="flex items-center justify-between px-1 select-none">
          <span className="text-xs font-semibold text-(--ink-secondary)">
            周期账单
          </span>
          <span className="font-mono text-[11px] text-(--ink-tertiary)">
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

      <SubPageShell
        isOpen={Boolean(internalDrilldown)}
        onClose={() => setInternalDrilldown(null)}
        header={
          <PageHeader
            title={internalDrilldown?.category.name || '分类明细'}
            centerTitle={true}
            leftAction={<SubPageBackButton label="统计" />}
          />
        }
      >
        {internalDrilldown && (
          <CategoryDetailSubPage
            data={internalDrilldown}
            categories={categories}
            accounts={accounts}
            onSelectTransaction={onSelectTransaction}
          />
        )}
      </SubPageShell>
    </div>
  );
};

export default StatsView;
