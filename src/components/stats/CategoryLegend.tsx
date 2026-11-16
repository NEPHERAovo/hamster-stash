import React from 'react';
import type { CategoryStatItem } from '../../domain/finance/periodStats';
import { cn } from '../../utils/cn';

export interface CategoryLegendProps {
  items: CategoryStatItem[];
  limit?: number;
  className?: string;
}

export const CategoryLegend: React.FC<CategoryLegendProps> = ({
  items,
  limit = 6,
  className,
}) => {
  const displayItems = limit > 0 ? items.slice(0, limit) : items;

  return (
    <div className={cn('flex flex-col gap-2 flex-1 min-w-0 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3', className)}>
      {displayItems.map((item) => (
        <div key={item.categoryId} className="flex items-center gap-2 text-xs">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="flex-1 text-(--ink-secondary) truncate">
            {item.name}
          </span>
          <span className="font-semibold text-(--ink-primary) font-mono tabular-nums">
            {item.percentage}%
          </span>
        </div>
      ))}
    </div>
  );
};

export default CategoryLegend;
