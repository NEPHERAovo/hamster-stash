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
  computePeriodBalanceSummary,
  type CategoryStatItem,
} from '../../domain/finance/periodStats';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { cn } from '../../utils/cn';
import { TransactionGroup } from '../ledger/TransactionGroup';
import { DonutChart } from './DonutChart';
import { MonthlyTrendBar } from './MonthlyTrendBar';
import { SpendingRankList } from './SpendingRankList';
import { CategoryDetailSubPage } from './CategoryDetailSubPage';
import { SubPageShell, SubPageBackButton } from '../layout/SubPageShell';
import { PageHeader } from '../layout/PageHeader';
import { SegToggle } from '../ui/SegToggle';
import { PaperIconButton } from '../ui/PaperIconButton';
import { PaperEmptyState } from '../ui/PaperEmptyState';
import { useThemeStore } from '../../stores/useThemeStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { dayjs, type Dayjs, stepYearMonth, parseLocalDate } from '../../utils/date';

export type StatsDimension = 'expense' | 'income' | 'balance';

export interface CategoryDrilldownData {
  category: Category;
  periodLabel: string;
  transactions: Transaction[];
  totalExpense: number;
  categoryPercentage: number;
  previousAmount?: number;
  momRate?: number | null;
  isNew?: boolean;
}

export interface StatsViewProps {
  allTransactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onSelectTransaction?: (tx: Transaction) => void;
  mode?: PeriodMode;
  onModeChange?: (mode: PeriodMode) => void;
  compositionDimension?: StatsDimension;
  onCompositionDimensionChange?: (dimension: StatsDimension) => void;
  trendDimension?: StatsDimension;
  onTrendDimensionChange?: (dimension: StatsDimension) => void;
  dimension?: StatsDimension;
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
  compositionDimension: controlledCompDim,
  onCompositionDimensionChange,
  trendDimension: controlledTrendDim,
  onTrendDimensionChange,
  dimension: legacyDimension,
  onOpenCategoryDrilldown,
}) => {
  const [internalMode, setInternalMode] = useState<PeriodMode>('month');
  const [internalCompDimension, setInternalCompDimension] = useState<StatsDimension>(
    controlledCompDim || legacyDimension || 'expense'
  );
  const [internalTrendDimension, setInternalTrendDimension] = useState<StatsDimension>(
    controlledTrendDim || legacyDimension || 'expense'
  );
  const [internalDrilldown, setInternalDrilldown] = useState<CategoryDrilldownData | null>(null);

  const mode = controlledMode || internalMode;
  const setMode = onModeChange || setInternalMode;
  const compositionDimension = controlledCompDim || internalCompDimension;
  const setCompositionDimension = onCompositionDimensionChange || setInternalCompDimension;
  const trendDimension = controlledTrendDim || internalTrendDimension;
  const setTrendDimension = onTrendDimensionChange || setInternalTrendDimension;

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

  const balanceSummary = useMemo(() => {
    return computePeriodBalanceSummary(
      periodTransactions,
      allTransactions,
      periodInfo,
      mode,
      isAmortizationEnabled
    );
  }, [periodTransactions, allTransactions, periodInfo, mode, isAmortizationEnabled]);

  const { items: donutItems, totalAmount, circumference } = useMemo(() => {
    if (compositionDimension === 'balance') {
      const CIRCUMFERENCE = 326.73;
      const total = balanceSummary.income + balanceSummary.expense;
      if (total === 0) {
        return { items: [], totalAmount: 0, circumference: CIRCUMFERENCE };
      }
      const expDash = parseFloat(((balanceSummary.expense / total) * CIRCUMFERENCE).toFixed(2));
      const incDash = parseFloat(((balanceSummary.income / total) * CIRCUMFERENCE).toFixed(2));
      const items: CategoryStatItem[] = [
        {
          categoryId: 'balance_inc',
          name: '总收入',
          color: 'var(--color-income)',
          amount: balanceSummary.income,
          percentage: Math.round((balanceSummary.income / total) * 100),
          dashLength: incDash,
          dashOffset: 0,
          previousAmount: balanceSummary.previousIncome,
          momRate: balanceSummary.incomeMomRate,
        },
        {
          categoryId: 'balance_exp',
          name: '净支出',
          color: 'var(--color-expense)',
          amount: balanceSummary.expense,
          percentage: Math.round((balanceSummary.expense / total) * 100),
          dashLength: expDash,
          dashOffset: incDash,
          previousAmount: balanceSummary.previousExpense,
          momRate: balanceSummary.expenseMomRate,
        },
      ];
      return { items, totalAmount: balanceSummary.netBalance, circumference: CIRCUMFERENCE };
    }

    const res = computeCategoryDonutStats(
      periodTransactions,
      categories,
      allTransactions,
      isAmortizationEnabled,
      periodInfo.key,
      mode,
      compositionDimension
    );
    return { items: res.items, totalAmount: res.totalAmount, circumference: res.circumference };
  }, [compositionDimension, balanceSummary, periodTransactions, categories, allTransactions, isAmortizationEnabled, periodInfo.key, mode]);

  const isCompositionEmpty = useMemo(() => {
    if (compositionDimension === 'balance') {
      return balanceSummary.income === 0 && balanceSummary.expense === 0;
    }
    return totalAmount === 0;
  }, [compositionDimension, balanceSummary, totalAmount]);

  const prevEmptyRef = useRef(isCompositionEmpty);
  const shouldAnimateEmpty = prevEmptyRef.current !== isCompositionEmpty && isCompositionEmpty;

  useEffect(() => {
    prevEmptyRef.current = isCompositionEmpty;
  }, [isCompositionEmpty]);

  const [trendOffset, setTrendOffset] = useState<number>(0);

  useEffect(() => {
    setTrendOffset(0);
  }, [periodInfo.key, mode, trendDimension]);

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
      isAmortizationEnabled,
      trendDimension
    );
  }, [allTransactions, mode, trendTargetKey, isAmortizationEnabled, trendDimension]);

  const handleStepTrendPrev = () => {
    setTrendOffset((prev) => prev - 1);
  };

  const handleStepTrendNext = () => {
    setTrendOffset((prev) => Math.min(0, prev + 1));
  };

  const canStepTrendNext = trendOffset < 0;

  const trendTitle = useMemo(() => {
    let prefix = '月度';
    if (mode === 'week') prefix = '周度';
    else if (mode === 'year') prefix = '年度';

    let suffix = '支出趋势';
    if (trendDimension === 'income') suffix = '收入趋势';
    else if (trendDimension === 'balance') suffix = '结余趋势';

    return `${prefix}${suffix}`;
  }, [mode, trendDimension]);

  const compositionTitle = useMemo(() => {
    if (compositionDimension === 'income') return '收入构成';
    if (compositionDimension === 'balance') return '收支对比';
    return '支出构成';
  }, [compositionDimension]);

  const donutCenterLabel = useMemo(() => {
    if (compositionDimension === 'income') return '总收入';
    if (compositionDimension === 'balance') return '净结余';
    return '总支出';
  }, [compositionDimension]);

  const trendBarColor = trendDimension === 'income' ? 'var(--color-income)' : 'var(--color-expense)';

  const emptyTitle = useMemo(() => {
    if (compositionDimension === 'income') return '本周期暂无收入记录';
    if (compositionDimension === 'balance') return '本周期暂无收支记录';
    return '本周期暂无支出记录';
  }, [compositionDimension]);

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
      previousAmount: statItem?.previousAmount,
      momRate: statItem?.momRate,
      isNew: statItem?.isNew,
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
        <div className="flex justify-center">
          <SegToggle
            options={[
              { value: 'week', label: '周' },
              { value: 'month', label: '月' },
              { value: 'year', label: '年' },
            ]}
            value={mode}
            onChange={setMode}
            size="sm"
            fullWidth={false}
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
            <PaperIconButton
              icon={ChevronLeft}
              onClick={handlePrevPeriod}
              title="上个周期"
              aria-label="上个周期"
            />
            <PaperIconButton
              icon={ChevronRight}
              onClick={handleNextPeriod}
              title="下个周期"
              aria-label="下个周期"
            />
          </div>
        </div>

        <div className="paper-card w-full space-y-3.5 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3.5 shadow-xs transition-colors duration-200 select-none sm:p-5">
          <div className="flex items-center justify-between gap-2 select-none">
            <span className="truncate text-[13px] font-semibold tracking-tight text-(--ink-primary)">
              {compositionTitle}
            </span>
            <div className="shrink-0">
              <SegToggle
                options={[
                  { value: 'expense', label: '支出' },
                  { value: 'income', label: '收入' },
                  { value: 'balance', label: '结余' },
                ]}
                value={compositionDimension}
                onChange={(dim) => setCompositionDimension(dim as StatsDimension)}
                size="sm"
                fullWidth={false}
              />
            </div>
          </div>

          {isCompositionEmpty ? (
            <PaperEmptyState
              icon={PieChart}
              title={emptyTitle}
              variant="plain"
              animate={shouldAnimateEmpty}
            />
          ) : (
            <>
              <div className="flex items-center justify-center py-1">
                <DonutChart
                  items={donutItems}
                  totalAmount={totalAmount}
                  circumference={circumference}
                  periodKey={`${periodInfo.key}-${compositionDimension}`}
                  centerLabel={donutCenterLabel}
                />
              </div>

              <div className="border-t border-(--rule-hairline)/60 pt-1">
                {compositionDimension === 'balance' ? (
                  <div className="divide-y divide-dashed divide-(--rule-hairline)/60 pt-0.5 text-xs">
                    {(() => {
                      const incomeDiff = balanceSummary.income - balanceSummary.previousIncome;
                      const expenseDiff = balanceSummary.expense - balanceSummary.previousExpense;
                      const balanceDiff = balanceSummary.netBalance - balanceSummary.previousNetBalance;

                      const formatDiff = (diff: number) => {
                        if (diff > 0) return `+¥${centsToYuan(diff)}`;
                        if (diff < 0) return `-¥${centsToYuan(Math.abs(diff))}`;
                        return '= ¥0.00';
                      };

                      const getDiffColor = (type: 'income' | 'expense' | 'balance', diff: number) => {
                        if (diff === 0) return 'text-(--ink-tertiary)';
                        if (type === 'expense') {
                          if (diff > 0) return 'text-(--color-expense)';
                          return 'text-(--color-income)';
                        }
                        if (diff > 0) return 'text-(--color-income)';
                        return 'text-(--color-expense)';
                      };

                      return (
                        <>
                          <div className="flex items-center justify-between px-1 py-2">
                            <div className="flex items-center gap-2">
                              <span className="size-2.5 rounded-(--badge-radius) bg-(--color-income)" />
                              <span className="font-medium text-(--ink-primary)">总收入</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono tabular-nums">
                              <span className={cn('min-w-18 text-right text-[11px] font-medium tabular-nums', getDiffColor('income', incomeDiff))}>
                                {formatDiff(incomeDiff)}
                              </span>
                              <span className="min-w-20 text-right text-[13px] font-semibold text-(--ink-primary) tabular-nums">
                                ¥{centsToYuan(balanceSummary.income)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between px-1 py-2">
                            <div className="flex items-center gap-2">
                              <span className="size-2.5 rounded-(--badge-radius) bg-(--color-expense)" />
                              <span className="font-medium text-(--ink-primary)">净支出</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono tabular-nums">
                              <span className={cn('min-w-18 text-right text-[11px] font-medium tabular-nums', getDiffColor('expense', expenseDiff))}>
                                {formatDiff(expenseDiff)}
                              </span>
                              <span className="min-w-20 text-right text-[13px] font-semibold text-(--ink-primary) tabular-nums">
                                ¥{centsToYuan(balanceSummary.expense)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between px-1 py-2">
                            <div className="flex items-center gap-2">
                              <span className="size-2.5 rounded-(--badge-radius) bg-(--ink-solid)" />
                              <span className="font-medium text-(--ink-primary)">净结余</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono tabular-nums">
                              <span className={cn('min-w-18 text-right text-[11px] font-medium tabular-nums', getDiffColor('balance', balanceDiff))}>
                                {formatDiff(balanceDiff)}
                              </span>
                              <span
                                className={cn(
                                  'min-w-20 text-right text-[13px] font-semibold tabular-nums',
                                  balanceSummary.netBalance >= 0 ? 'text-(--color-income)' : 'text-(--color-expense)'
                                )}
                              >
                                {balanceSummary.netBalance < 0
                                  ? `-¥${centsToYuan(Math.abs(balanceSummary.netBalance))}`
                                  : `¥${centsToYuan(balanceSummary.netBalance)}`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between px-1 py-2">
                            <div className="flex items-center gap-2">
                              <span className="size-2.5" />
                              <span className="font-medium text-(--ink-secondary)">结余储蓄率</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono tabular-nums">
                              <span className="min-w-20 text-right text-[13px] font-semibold text-(--ink-primary) tabular-nums">
                                {balanceSummary.savingsRate}%
                              </span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <SpendingRankList
                    items={donutItems}
                    totalExpense={totalAmount}
                    onSelectCategory={handleSelectCategory}
                    txType={compositionDimension}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="tab-stagger-2">
        <MonthlyTrendBar
          title={trendTitle}
          trends={trends}
          barColor={trendBarColor}
          dimension={trendDimension}
          onDimensionChange={setTrendDimension}
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
          key={periodInfo.key}
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
