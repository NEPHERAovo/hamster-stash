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
        'relative mx-4 mt-3.5 p-4 sm:p-5 bg-(--paper-sheet) border border-(--rule-hairline) select-none transition-all duration-200',
        'paper-deckle-bottom paper-summary-card',
        className
      )}
    >
      <div className="washi-tape absolute -top-2 left-1/2 -translate-x-1/2 z-10" />

      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-mono font-medium text-(--ink-tertiary)">本月结余</span>
        <span
          className={cn(
            'real-stamp',
            isSurplus ? 'stamp-income text-(--color-income)' : 'stamp-expense text-(--color-expense)'
          )}
        >
          {isSurplus ? '盈余' : '超支'}
        </span>
      </div>

      <div className="font-mono text-2xl sm:text-3xl font-bold text-(--ink-solid) tracking-tight tabular-nums leading-tight mb-2.5">
        ¥ {centsToYuan(summary.netBalance)}
      </div>

      <div className="summary-card-divider flex items-center pt-2 font-mono text-[11px] tabular-nums border-t border-dashed border-(--rule-strong)">
        <div className="flex items-baseline gap-1">
          <span className="text-[9px] uppercase tracking-wider text-(--ink-tertiary)">收入</span>
          <span className="font-semibold text-(--color-income)">
            +{centsToYuan(summary.totalIncome)}
          </span>
        </div>

        <span className="text-(--ink-faint) px-2 text-xs select-none">–</span>

        <div className="flex items-baseline gap-1">
          <span className="text-[9px] uppercase tracking-wider text-(--ink-tertiary)">支出</span>
          <span className="font-semibold text-(--color-expense)">
            {centsToYuan(summary.totalExpense)}
          </span>
        </div>

        <span className="text-(--ink-faint) px-2 text-xs select-none">=</span>

        <div className="flex items-baseline gap-1">
          <span className="text-[9px] uppercase tracking-wider text-(--ink-tertiary)">结余</span>
          <span className={cn('font-bold', isSurplus ? 'text-(--color-income)' : 'text-(--color-expense)')}>
            {isSurplus ? '+' : ''}{centsToYuan(summary.netBalance)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BalanceSummaryCard;
