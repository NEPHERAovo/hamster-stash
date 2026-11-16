import React from 'react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { MonthSummary } from '../../domain/finance/balanceCalculator';
import { useThemeStore } from '../../stores/useThemeStore';
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
  const uiStyle = useThemeStore((s) => s.uiStyle);
  const isModern = uiStyle === 'modern';
  const isSurplus = summary.netBalance >= 0;

  return (
    <div
      className={cn(
        'relative mx-4 mt-3.5 p-4 sm:p-5 bg-(--paper-sheet) border border-(--rule-hairline) select-none transition-all duration-200',
        isModern
          ? 'rounded-[22px] backdrop-blur-xl shadow-md rotate-0'
          : 'border-b-0 -rotate-[0.2deg] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.25)] paper-deckle-bottom paper-summary-card',
        className
      )}
    >
      {!isModern && <div className="washi-tape absolute -top-2 left-1/2 -translate-x-1/2 z-10" />}

      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-mono font-medium text-(--ink-tertiary)">本月结余</span>
        <span
          className={cn(
            'real-stamp',
            isSurplus ? 'stamp-income text-(--color-income)' : 'text-(--color-expense)'
          )}
        >
          {isSurplus ? '盈余' : '超支'}
        </span>
      </div>

      <div className="font-mono text-2xl sm:text-3xl font-bold text-(--ink-solid) tracking-tight tabular-nums leading-tight mb-2.5">
        ¥ {centsToYuan(summary.netBalance)}
      </div>

      <div
        className={cn(
          'flex items-center pt-2 font-mono text-[11px] tabular-nums',
          isModern ? 'border-t border-(--rule-hairline)' : 'border-t border-dashed border-(--rule-strong)'
        )}
      >
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
          <span className="text-[9px] uppercase tracking-wider text-(--ink-tertiary)">净余</span>
          <span className="font-bold text-(--ink-solid)">
            {isSurplus ? '+' : ''}{centsToYuan(summary.netBalance)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BalanceSummaryCard;
