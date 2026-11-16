import React from 'react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { TrendItem } from '../../domain/finance/periodStats';
import { useThemeStore } from '../../stores/useThemeStore';
import { cn } from '../../utils/cn';

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
  const uiStyle = useThemeStore((s) => s.uiStyle);
  const isModern = uiStyle === 'modern';

  return (
    <div
      className={cn(
        'w-full p-3.5 sm:p-4 bg-(--paper-sheet) border border-(--rule-hairline) select-none transition-all duration-200',
        isModern
          ? 'rounded-[22px] backdrop-blur-xl shadow-md'
          : 'rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25)]',
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
            <div
              className={cn(
                'flex-1 h-3.5 sm:h-4 bg-(--paper-sunken) overflow-hidden',
                isModern ? 'rounded-full' : 'rounded-[1px]'
              )}
            >
              <div
                className={cn(
                  'h-full opacity-85 transition-all duration-300',
                  isModern ? 'rounded-full bg-(--color-expense)' : 'rounded-[1px] bg-(--color-expense)'
                )}
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
