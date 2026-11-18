import React from 'react';
import { getCategoryIcon } from '../../utils/categoryIcons';
import type { Category } from '../../types/category';
import { cn } from '../../utils/cn';

export interface CategoryBadgeProps {
  category?: Category;
  type?: 'expense' | 'income' | 'transfer' | 'loan' | 'reconcile';
  iconName?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  type = 'expense',
  iconName,
  size = 'md',
  className,
}) => {
  const isIncome = type === 'income' || category?.type === 'income';
  const isTransfer = type === 'transfer';
  const isLoan = type === 'loan';

  const IconComponent = getCategoryIcon(iconName || category?.icon || 'wallet');

  let colorClasses = 'bg-(--paper-sunken) text-(--ink-secondary) border-(--rule-hairline)';

  if (isIncome) {
    colorClasses = 'bg-(--color-income-bg) text-(--color-income) border-(--color-income)/25';
  } else if (isTransfer) {
    colorClasses = 'bg-(--paper-sunken) text-(--color-accent) border-(--rule-hairline)';
  } else if (isLoan) {
    colorClasses = 'bg-(--color-accent-bg) text-(--color-accent) border-(--rule-hairline)';
  }

  const sizeClasses = size === 'sm' ? 'w-5.5 h-5.5' : 'w-7 h-7';

  return (
    <div
      className={cn(
        'category-badge flex items-center justify-center shrink-0 border transition-all duration-150 rounded-(--badge-radius)',
        sizeClasses,
        colorClasses,
        className
      )}
    >
      <IconComponent
        size={size === 'sm' ? 12 : 14}
        strokeWidth={1.85}
        className="shrink-0"
      />
    </div>
  );
};

export default CategoryBadge;
