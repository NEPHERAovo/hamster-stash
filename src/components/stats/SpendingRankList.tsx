import React from 'react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { CategoryStatItem } from '../../domain/finance/periodStats';
import { cn } from '../../utils/cn';

export interface SpendingRankListProps {
  items: CategoryStatItem[];
  totalExpense: number;
  className?: string;
}

export const SpendingRankList: React.FC<SpendingRankListProps> = ({
  items,
  totalExpense,
  className,
}) => {
  return (
    <div
      className={cn(
        'w-full p-3.5 sm:p-4 bg-(--paper-sheet) border border-(--rule-hairline) rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25)] select-none',
        className
      )}
    >
      <div className="font-serif italic text-sm text-(--ink-secondary) mb-1">
        支出构成
      </div>
      <div className="font-mono text-xl sm:text-2xl font-bold text-(--ink-solid) tabular-nums mb-2.5">
        ¥ {centsToYuan(totalExpense)}
      </div>

      <div className="w-full h-3 rounded-[1px] overflow-hidden flex border border-(--rule-hairline) my-2.5">
        {items.map((item) => (
          <div
            key={item.categoryId}
            className="h-full transition-all duration-300"
            style={{ width: `${item.percentage}%`, background: item.color }}
            title={`${item.name}: ${item.percentage}%`}
          />
        ))}
      </div>

      <div className="pt-0.5">
        {items.map((item) => (
          <div
            key={item.categoryId}
            className="flex items-center py-2 text-[13px] border-b border-dashed border-(--rule-hairline)/60 last:border-b-0"
          >
            <div
              className="w-2 h-2 rounded-[1px] mr-2 shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="flex-1 text-(--ink-primary) truncate">
              {item.name}
            </span>
            <span className="font-mono font-semibold text-(--ink-primary) tabular-nums mr-2">
              ¥{centsToYuan(item.amount)}
            </span>
            <span className="font-mono text-[11px] text-(--ink-tertiary) tabular-nums min-w-[34px] text-right">
              {item.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpendingRankList;
