import React from 'react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { MonthSummary } from '../../domain/finance/balanceCalculator';
import { cn } from '../../utils/cn';

export interface BalanceSummaryCardProps {
  summary: MonthSummary;
  monthStr?: string;
  className?: string;
}

export const BalanceSummaryCard: React.FC<BalanceSummaryCardProps> = ({
  summary,
  className,
}) => {
  const isSurplus = summary.netBalance >= 0;

  return (
    <div
      className={cn(
        'relative mx-4 mt-3.5 border border-(--rule-hairline) bg-(--paper-sheet) p-4 transition-all duration-200 select-none sm:p-5',
        'paper-deckle-bottom paper-summary-card',
        className
      )}
    >
      <div className="washi-tape absolute -top-2 left-1/2 z-10 -translate-x-1/2" />

      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[11px] font-medium text-(--ink-tertiary)">本月结余</span>
        <span
          className={cn(
            'real-stamp',
            isSurplus ? 'stamp-income text-(--color-income)' : 'stamp-expense text-(--color-expense)'
          )}
        >
          {isSurplus ? '盈余' : '超支'}
        </span>
      </div>

      <div className="mb-2.5 font-mono text-2xl leading-tight font-bold tracking-tight text-(--ink-solid) tabular-nums sm:text-3xl">
        ¥ {centsToYuan(summary.netBalance)}
      </div>

      <div className="summary-card-divider flex items-center border-t border-dashed border-(--rule-strong) pt-2 font-mono text-[11px] tabular-nums">
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] tracking-wider text-(--ink-tertiary) uppercase">收入</span>
          <span className="font-semibold text-(--color-income)">
            +{centsToYuan(summary.totalIncome)}
          </span>
        </div>

        <span className="px-2 text-xs text-(--ink-faint) select-none">–</span>

        <div className="flex items-baseline gap-1">
          <span className="text-[9px] tracking-wider text-(--ink-tertiary) uppercase">支出</span>
          <span className="font-semibold text-(--color-expense)">
            {centsToYuan(summary.totalExpense)}
          </span>
        </div>

        <span className="px-2 text-xs text-(--ink-faint) select-none">=</span>

        <div className="flex items-baseline gap-1">
          <span className="text-[9px] tracking-wider text-(--ink-tertiary) uppercase">结余</span>
          <span className={cn('font-bold', isSurplus ? 'text-(--color-income)' : 'text-(--color-expense)')}>
            {isSurplus ? '+' : ''}{centsToYuan(summary.netBalance)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BalanceSummaryCard;
