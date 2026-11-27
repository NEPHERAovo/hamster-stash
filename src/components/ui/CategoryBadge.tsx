import React from 'react';
import type { Category } from '../../types/category';
import { IconBadge, type IconBadgeTone } from './IconBadge';

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
  let tone: IconBadgeTone = 'neutral';
  if (isIncome) {
    tone = 'income';
  } else if (type === 'transfer') {
    tone = 'transfer';
  } else if (type === 'loan') {
    tone = 'loan';
  }

  return (
    <IconBadge
      icon={iconName || category?.icon || 'wallet'}
      tone={tone}
      size={size}
      className={className}
    />
  );
};

export default CategoryBadge;
