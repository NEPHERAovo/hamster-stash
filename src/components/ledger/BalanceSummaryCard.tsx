import React from 'react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { MonthSummary } from '../../domain/finance/balanceCalculator';
import { cn } from '../../utils/cn';
import { PaperSummaryCard } from '../ui/PaperSummaryCard';

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
    <PaperSummaryCard
      tapeClassName="-top-2"
      className={cn('mx-4 mt-3.5 p-4 sm:p-5', className)}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[11px] font-medium text-(--ink-tertiary)">本月支出</span>
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
        ¥ {centsToYuan(summary.totalExpense)}
      </div>

      <div className="summary-card-divider flex items-center border-(--rule-strong) pt-2 font-mono text-[11px] tabular-nums rule-dashed-t">
        <div className="flex items-end gap-1 leading-none">
          <span className="text-[10px] text-(--ink-tertiary)">收入</span>
          <span className="font-semibold text-(--color-income)">
            +{centsToYuan(summary.totalIncome)}
          </span>
        </div>

        <span className="px-2 text-xs leading-none text-(--ink-faint) select-none">–</span>

        <div className="flex items-end gap-1 leading-none">
          <span className="text-[10px] text-(--ink-tertiary)">支出</span>
          <span className="font-semibold text-(--color-expense)">
            {centsToYuan(summary.totalExpense)}
          </span>
        </div>

        <span className="px-2 text-xs leading-none text-(--ink-faint) select-none">=</span>

        <div className="flex items-end gap-1 leading-none">
          <span className="text-[10px] text-(--ink-tertiary)">结余</span>
          <span className={cn('font-bold', isSurplus ? 'text-(--color-income)' : 'text-(--color-expense)')}>
            {isSurplus ? '+' : ''}{centsToYuan(summary.netBalance)}
          </span>
        </div>
      </div>
    </PaperSummaryCard>
  );
};

export default BalanceSummaryCard;
