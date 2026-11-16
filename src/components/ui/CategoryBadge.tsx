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

const CATEGORY_COLOR_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  cat_food: {
    bg: 'bg-[rgba(186,110,56,0.12)]',
    text: 'text-[var(--cat-food,#BA6E38)]',
    border: 'border-[rgba(186,110,56,0.24)]',
  },
  cat_transit: {
    bg: 'bg-[rgba(61,114,153,0.12)]',
    text: 'text-[var(--cat-transit,#3D7299)]',
    border: 'border-[rgba(61,114,153,0.24)]',
  },
  cat_shop: {
    bg: 'bg-[rgba(84,136,75,0.12)]',
    text: 'text-[var(--cat-shop,#54884B)]',
    border: 'border-[rgba(84,136,75,0.24)]',
  },
  cat_home: {
    bg: 'bg-[rgba(145,100,74,0.12)]',
    text: 'text-[var(--cat-home,#91644A)]',
    border: 'border-[rgba(145,100,74,0.24)]',
  },
  cat_fun: {
    bg: 'bg-[rgba(131,84,158,0.12)]',
    text: 'text-[var(--cat-fun,#83549E)]',
    border: 'border-[rgba(131,84,158,0.24)]',
  },
  cat_comm: {
    bg: 'bg-[rgba(47,124,124,0.12)]',
    text: 'text-[var(--cat-comm,#2F7C7C)]',
    border: 'border-[rgba(47,124,124,0.24)]',
  },
  cat_health: {
    bg: 'bg-[rgba(172,73,94,0.12)]',
    text: 'text-[var(--cat-health,#AC495E)]',
    border: 'border-[rgba(172,73,94,0.24)]',
  },
  cat_edu: {
    bg: 'bg-[rgba(82,88,146,0.12)]',
    text: 'text-[var(--cat-edu,#525892)]',
    border: 'border-[rgba(82,88,146,0.24)]',
  },
};

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

  const catKey = category?.id || '';
  const matchedStyle = CATEGORY_COLOR_STYLES[catKey];

  let colorClasses = 'bg-[rgba(186,110,56,0.10)] text-[var(--cat-food,#BA6E38)] border-[rgba(186,110,56,0.22)]';

  if (isIncome) {
    colorClasses = 'bg-[var(--color-income-bg)] text-[var(--color-income)] border-[rgba(63,130,86,0.24)]';
  } else if (isTransfer) {
    colorClasses = 'bg-[rgba(61,114,153,0.12)] text-[var(--cat-transit)] border-[rgba(61,114,153,0.24)]';
  } else if (isLoan) {
    colorClasses = 'bg-[var(--color-accent-bg)] text-[var(--color-accent)] border-[var(--border-default)]';
  } else if (matchedStyle) {
    colorClasses = `${matchedStyle.bg} ${matchedStyle.text} ${matchedStyle.border}`;
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
