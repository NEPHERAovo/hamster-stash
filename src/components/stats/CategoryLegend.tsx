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
    <div className={cn('flex min-w-0 flex-1 flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3', className)}>
      {displayItems.map((item) => (
        <div key={item.categoryId} className="flex items-center gap-2 text-xs">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="flex-1 truncate text-(--ink-secondary)">
            {item.name}
          </span>
          <span className="font-mono font-semibold text-(--ink-primary) tabular-nums">
            {item.percentage}%
          </span>
        </div>
      ))}
    </div>
  );
};

export default CategoryLegend;
