import React from 'react';
import { CaretRight as ChevronRight } from '@phosphor-icons/react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { CategoryStatItem } from '../../domain/finance/periodStats';
import { cn } from '../../utils/cn';

export interface SpendingRankListProps {
  items: CategoryStatItem[];
  totalExpense?: number;
  onSelectCategory?: (categoryId: string) => void;
  className?: string;
}

export const SpendingRankList: React.FC<SpendingRankListProps> = ({
  items,
  onSelectCategory,
  className,
}) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn('pt-0.5', className)}>
      {items.map((item) => (
        <button
          key={item.categoryId}
          type="button"
          onClick={() => onSelectCategory?.(item.categoryId)}
          className="w-full flex items-center py-2 px-1 rounded-(--radius-sm) hover:bg-(--paper-sunken)/60 active:scale-[0.99] transition-all cursor-pointer text-[13px] border-b border-dashed border-(--rule-hairline)/60 last:border-b-0 group text-left"
          title={`查看「${item.name}」支出明细`}
        >
          <div
            className="w-2.5 h-2.5 mr-2.5 shrink-0 rounded-(--badge-radius)"
            style={{ backgroundColor: item.color }}
          />
          <span className="flex-1 text-(--ink-primary) font-medium truncate">
            {item.name}
          </span>
          <span className="font-mono font-semibold text-(--ink-primary) tabular-nums mr-2">
            ¥{centsToYuan(item.amount)}
          </span>
          <span className="font-mono text-[11px] text-(--ink-tertiary) tabular-nums min-w-[34px] text-right mr-1.5">
            {item.percentage}%
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-(--ink-faint) group-hover:text-(--ink-secondary) transition-colors shrink-0" />
        </button>
      ))}
    </div>
  );
};

export default SpendingRankList;
