import React, { useState, useMemo, useEffect } from 'react';
import { CaretLeft as ChevronLeft, CaretRight as ChevronRight, ChartPie as PieChart } from '@phosphor-icons/react';
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
    <div className="py-2 space-y-3.5 pb-6">
      {!controlledMode && (
        <div className="mx-auto max-w-[200px]">
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
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg sm:text-xl text-(--ink-solid) font-serif not-italic tracking-tight truncate">
              {formattedPeriodTitle}
            </span>
            {weekBadge && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary) shrink-0">
                {weekBadge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevPeriod}
              className="w-7 h-7 flex items-center justify-center border border-(--rule-hairline) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all cursor-pointer font-mono rounded-(--btn-radius) bg-(--paper-sheet) shadow-xs"
              title="上个周期"
              aria-label="上个周期"
            >
              <ChevronLeft className="w-3.5 h-3.5 stroke-2" />
            </button>
            <button
              type="button"
              onClick={handleNextPeriod}
              className="w-7 h-7 flex items-center justify-center border border-(--rule-hairline) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all cursor-pointer font-mono rounded-(--btn-radius) bg-(--paper-sheet) shadow-xs"
              title="下个周期"
              aria-label="下个周期"
            >
              <ChevronRight className="w-3.5 h-3.5 stroke-2" />
            </button>
          </div>
        </div>

        {totalExpense === 0 ? (
          <div className="w-full p-6 bg-(--paper-sheet) paper-card border border-(--rule-hairline) text-center text-xs text-(--ink-tertiary) flex flex-col items-center gap-1.5 select-none transition-all duration-200 rounded-(--radius-md) shadow-xs">
            <PieChart className="w-6 h-6 stroke-[1.5] text-(--ink-faint)" />
            <span>本周期暂无支出记录</span>
          </div>
        ) : (
          <div className="w-full p-3.5 sm:p-5 bg-(--paper-sheet) paper-card border border-(--rule-hairline) select-none transition-all duration-200 rounded-(--radius-md) shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-serif italic text-(--ink-secondary)">
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
