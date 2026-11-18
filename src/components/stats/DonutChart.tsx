import React from 'react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { CategoryStatItem } from '../../domain/finance/periodStats';
import { cn } from '../../utils/cn';

export interface DonutChartProps {
  items: CategoryStatItem[];
  totalExpense: number;
  circumference: number;
  className?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  items,
  totalExpense,
  circumference,
  className,
}) => {
  return (
    <div className={cn('relative w-[130px] h-[130px] shrink-0', className)}>
      <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90">
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
      <div className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none">
        <span className="text-[10px] text-(--ink-tertiary) font-medium">
          总支出
        </span>
        <span className="text-[15px] font-bold text-(--ink-primary) tracking-tight font-mono tabular-nums">
          ¥{centsToYuan(totalExpense)}
        </span>
      </div>
    </div>
  );
};

export default DonutChart;
