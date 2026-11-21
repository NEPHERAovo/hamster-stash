import React from 'react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { CategoryStatItem } from '../../domain/finance/periodStats';
import { cn } from '../../utils/cn';

export interface DonutChartProps {
  items: CategoryStatItem[];
  totalExpense: number;
  circumference: number;
  className?: string;
  periodKey?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  items,
  totalExpense,
  circumference,
  className,
  periodKey,
}) => {
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
          总支出
        </span>
        <span className="font-mono text-[15px] font-bold tracking-tight text-(--ink-primary) tabular-nums">
          ¥{centsToYuan(totalExpense)}
        </span>
      </div>
    </div>
  );
};

export default DonutChart;
