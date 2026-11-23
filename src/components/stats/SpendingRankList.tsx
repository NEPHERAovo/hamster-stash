import React, { useState } from 'react';
import { CaretRightIcon as ChevronRight, CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react';
import { PaperButton } from '../ui/PaperButton';
import { CategoryBadge } from '../ui/CategoryBadge';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { CategoryStatItem } from '../../domain/finance/periodStats';
import { cn } from '../../utils/cn';

export interface SpendingRankListProps {
  items: CategoryStatItem[];
  totalExpense?: number;
  onSelectCategory?: (categoryId: string) => void;
  className?: string;
  txType?: 'expense' | 'income';
}

function getDiffColor(txType: 'expense' | 'income', diff: number): string {
  if (diff === 0) {
    return 'text-(--ink-tertiary)';
  }
  if (txType === 'income') {
    if (diff > 0) return 'text-(--color-income)';
    return 'text-(--color-expense)';
  }
  if (diff > 0) return 'text-(--color-expense)';
  return 'text-(--color-income)';
}

function formatDiffText(diff: number): string {
  if (diff > 0) return `+¥${centsToYuan(diff)}`;
  if (diff < 0) return `-¥${centsToYuan(Math.abs(diff))}`;
  return '= ¥0.00';
}

export const SpendingRankList: React.FC<SpendingRankListProps> = ({
  items,
  onSelectCategory,
  className,
  txType = 'expense',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (items.length === 0) {
    return null;
  }

  const hasMore = items.length > 5;
  const displayedItems = isExpanded || !hasMore ? items : items.slice(0, 5);

  return (
    <div className={cn('pt-0.5', className)}>
      <div className="divide-y divide-dashed divide-(--rule-hairline)/60">
        {displayedItems.map((item) => {
          const previousAmount = item.previousAmount ?? 0;
          const diff = item.amount - previousAmount;
          const diffText = formatDiffText(diff);
          const diffColor = getDiffColor(txType, diff);

          return (
            <div key={item.categoryId}>
              <PaperButton
                variant="ghost"
                fullWidth
                size="sm"
                onClick={() => onSelectCategory?.(item.categoryId)}
                className="group flex h-auto cursor-pointer items-center justify-between rounded-(--radius-sm) border-0 !px-1 py-2 text-left font-normal transition-colors hover:bg-(--paper-sunken)/60"
                title={`查看「${item.name}」明细`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <CategoryBadge
                    iconName={item.icon}
                    type={txType}
                    size="md"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="size-2 shrink-0 rounded-(--badge-radius)"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-[13px] font-medium text-(--ink-primary)">
                        {item.name}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-(--ink-tertiary) tabular-nums">
                      {item.percentage}%
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex flex-col items-end gap-0.5 font-mono tabular-nums">
                    <span className="text-[13px] font-semibold text-(--ink-primary) tabular-nums">
                      ¥{centsToYuan(item.amount)}
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-medium tabular-nums',
                        diffColor
                      )}
                    >
                      {diffText}
                    </span>
                  </div>
                  <ChevronRight className="size-3.5 shrink-0 text-(--ink-faint) transition-colors group-hover:text-(--ink-secondary)" />
                </div>
              </PaperButton>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="pt-2 text-center">
          <PaperButton
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="h-auto gap-1 border-0 py-1 text-xs text-(--ink-tertiary) hover:text-(--ink-primary)"
          >
            <span>{isExpanded ? '收起' : '展开'}</span>
            {isExpanded ? (
              <CaretUpIcon className="size-3.5" />
            ) : (
              <CaretDownIcon className="size-3.5" />
            )}
          </PaperButton>
        </div>
      )}
    </div>
  );
};

export default SpendingRankList;
