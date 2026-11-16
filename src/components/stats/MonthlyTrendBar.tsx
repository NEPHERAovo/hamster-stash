import React from 'react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { cn } from '../../utils/cn';

export interface TrendItem {
  label: string;
  amount: number;
  percentage: number;
}

export interface MonthlyTrendBarProps {
  title: string;
  trends: TrendItem[];
  className?: string;
}

export const MonthlyTrendBar: React.FC<MonthlyTrendBarProps> = ({
  title,
  trends,
  className,
}) => {
  if (trends.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'w-full p-3.5 sm:p-4 bg-(--paper-sheet) paper-card border border-(--rule-hairline) select-none transition-all duration-200 rounded-(--radius-md) shadow-xs',
        className
      )}
    >
      <div className="text-[13px] font-semibold text-(--ink-primary) mb-2.5 tracking-tight">
        {title}
      </div>
      <div>
        {trends.map((t, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2.5 sm:gap-4 py-2 border-b border-dashed border-(--rule-hairline)/50 last:border-b-0"
          >
            <span className="w-8 sm:w-11 text-[11px] sm:text-xs font-medium text-(--ink-tertiary) text-right shrink-0 font-mono">
              {t.label}
            </span>
            <div className="flex-1 h-3.5 sm:h-4 bg-(--paper-sunken) overflow-hidden rounded-(--radius-sm)">
              <div
                className="h-full opacity-85 transition-all duration-300 rounded-(--radius-sm) bg-(--color-expense)"
                style={{ width: `${t.percentage}%` }}
              />
            </div>
            <span className="w-14 sm:w-18 text-[11px] sm:text-xs font-semibold text-(--ink-secondary) font-mono tabular-nums text-right shrink-0">
              ¥{centsToYuan(t.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonthlyTrendBar;
