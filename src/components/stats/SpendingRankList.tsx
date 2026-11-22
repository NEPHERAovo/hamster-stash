import React from 'react';
import { CaretRightIcon as ChevronRight } from '@phosphor-icons/react';
import { PaperButton } from '../ui/PaperButton';
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
        <PaperButton
          key={item.categoryId}
          variant="ghost"
          fullWidth
          size="md"
          onClick={() => onSelectCategory?.(item.categoryId)}
          className="group h-auto justify-start gap-0 rounded-(--radius-sm) border-b border-dashed border-(--rule-hairline)/60 px-1 py-2 text-left text-[13px] font-normal last:border-b-0 hover:bg-(--paper-sunken)/60"
          title={`查看「${item.name}」支出明细`}
        >
          <div
            className="mr-2.5 size-2.5 shrink-0 rounded-(--badge-radius)"
            style={{ backgroundColor: item.color }}
          />
          <span className="flex-1 truncate font-medium text-(--ink-primary)">
            {item.name}
          </span>
          <span className="mr-2 font-mono font-semibold text-(--ink-primary) tabular-nums">
            ¥{centsToYuan(item.amount)}
          </span>
          <span className="mr-1.5 min-w-[34px] text-right font-mono text-[11px] text-(--ink-tertiary) tabular-nums">
            {item.percentage}%
          </span>
          <ChevronRight className="size-3.5 shrink-0 text-(--ink-faint) transition-colors group-hover:text-(--ink-secondary)" />
        </PaperButton>
      ))}
    </div>
  );
};

export default SpendingRankList;
