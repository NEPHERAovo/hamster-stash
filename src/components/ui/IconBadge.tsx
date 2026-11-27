import React from 'react';
import { getCategoryIcon, type CategoryIconProps } from '../../utils/categoryIcons';
import { cn } from '../../utils/cn';

export type IconBadgeTone =
  | 'neutral'
  | 'solid'
  | 'muted'
  | 'income'
  | 'expense'
  | 'transfer'
  | 'loan'
  | 'accent';
export type IconBadgeSize = 'sm' | 'md' | 'lg';
export type IconBadgeSurface = 'default' | 'sheet';

export interface IconBadgeProps {
  icon?: string | React.ComponentType<CategoryIconProps>;
  tone?: IconBadgeTone;
  size?: IconBadgeSize;
  surface?: IconBadgeSurface;
  bordered?: boolean;
  elevated?: boolean;
  className?: string;
  iconClassName?: string;
}

const SIZE_CONTAINER: Record<IconBadgeSize, string> = {
  sm: 'size-6',
  md: 'size-7.5',
  lg: 'size-9',
};

const SIZE_ICON: Record<IconBadgeSize, number> = {
  sm: 15,
  md: 17,
  lg: 20,
};

const TONE_CLASSES: Record<IconBadgeTone, string> = {
  neutral: 'bg-(--paper-sunken) text-(--ink-secondary) border-(--rule-hairline)',
  solid: 'bg-(--paper-sunken) text-(--ink-solid) border-(--rule-hairline)',
  muted: 'bg-(--paper-sunken) text-(--ink-tertiary) border-(--rule-hairline)',
  income: 'bg-(--color-income-bg) text-(--color-income) border-(--color-income)/25',
  expense: 'bg-(--color-expense-bg) text-(--color-expense) border-(--color-expense)/25',
  transfer: 'bg-(--paper-sunken) text-(--color-accent) border-(--rule-hairline)',
  loan: 'bg-(--color-accent-bg) text-(--color-accent) border-(--rule-hairline)',
  accent: 'bg-(--color-accent-bg) text-(--color-accent) border-(--color-accent)/25',
};

const SURFACE_CLASSES: Record<IconBadgeSurface, string> = {
  default: '',
  sheet: 'bg-(--paper-sheet)',
};

export const IconBadge: React.FC<IconBadgeProps> = ({
  icon = 'wallet',
  tone = 'neutral',
  size = 'md',
  surface = 'default',
  bordered = true,
  elevated = false,
  className,
  iconClassName,
}) => {
  const IconComponent = typeof icon === 'string' ? getCategoryIcon(icon) : icon;

  return (
    <div
      className={cn(
        'category-badge flex shrink-0 items-center justify-center rounded-(--badge-radius) transition-all duration-150',
        bordered && 'border',
        elevated && 'shadow-2xs',
        SIZE_CONTAINER[size],
        TONE_CLASSES[tone],
        SURFACE_CLASSES[surface],
        className
      )}
    >
      <IconComponent
        size={SIZE_ICON[size]}
        strokeWidth={1.85}
        className={cn('shrink-0', iconClassName)}
      />
    </div>
  );
};

export default IconBadge;
