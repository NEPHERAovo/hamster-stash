import React from 'react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { CategoryStatItem } from '../../domain/finance/periodStats';
import { cn } from '../../utils/cn';

export interface DonutChartProps {
  items: CategoryStatItem[];
  totalExpense?: number;
  totalAmount?: number;
  circumference: number;
  className?: string;
  periodKey?: string;
  centerLabel?: string;
}

function getDonutAmountColor(isBalanceMode: boolean, amount: number): string {
  if (!isBalanceMode) return 'text-(--ink-primary)';
  return amount < 0 ? 'text-(--color-expense)' : 'text-(--color-income)';
}

export const DonutChart: React.FC<DonutChartProps> = ({
  items,
  totalExpense = 0,
  totalAmount,
  circumference,
  className,
  periodKey,
  centerLabel = '总支出',
}) => {
  const displayAmount = totalAmount !== undefined ? totalAmount : totalExpense;
  const isBalanceMode = centerLabel === '净结余';

  return (
    <div className={cn('relative size-[130px] shrink-0', className)}>
      <svg key={periodKey} viewBox="0 0 130 130" className="donut-ring-spin size-full -rotate-90">
        {items.map((item) => {
          const visibleDash = items.length > 1 ? Math.max(0.8, item.dashLength - 1.8) : item.dashLength;
          return (
            <circle
              key={item.categoryId}
              cx={65}
              cy={65}
              r={52}
              fill="none"
              strokeWidth={18}
              stroke={item.color}
              strokeDasharray={`${visibleDash} ${circumference}`}
              strokeDashoffset={-item.dashOffset}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center select-none">
        <span className="text-[10px] font-medium text-(--ink-tertiary)">
          {centerLabel}
        </span>
        <span
          className={cn(
            'font-mono text-[15px] font-bold tracking-tight tabular-nums',
            getDonutAmountColor(isBalanceMode, displayAmount)
          )}
        >
          {displayAmount < 0
            ? `-¥${centsToYuan(Math.abs(displayAmount))}`
            : `¥${centsToYuan(displayAmount)}`}
        </span>
      </div>
    </div>
  );
};

export default DonutChart;
