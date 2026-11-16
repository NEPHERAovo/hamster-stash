import React from 'react';
import { cn } from '../../utils/cn';

export interface PaperBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'income' | 'expense' | 'accent' | 'warning' | 'sunken' | 'outline' | 'stamp' | 'stamp-income' | 'stamp-expense';
  size?: 'xs' | 'sm' | 'md';
  icon?: React.ReactNode;
  interactive?: boolean;
}

export const PaperBadge: React.FC<PaperBadgeProps> = ({
  className,
  variant = 'default',
  size = 'sm',
  icon,
  interactive = false,
  children,
  onClick,
  ...props
}) => {
  const isStamp = variant.startsWith('stamp');

  const variantStyles = {
    default:
      'bg-(--bg-sunken) text-(--ink-secondary) border border-(--border-hairline)',
    income:
      'bg-(--color-income-bg) text-(--color-income) border border-[rgba(63,130,86,0.22)]',
    expense:
      'bg-(--color-expense-bg) text-(--color-expense) border border-[rgba(189,88,64,0.22)]',
    accent:
      'bg-(--color-accent-bg) text-(--color-accent) border border-[rgba(120,99,75,0.22)]',
    warning:
      'bg-[rgba(186,110,56,0.12)] text-[#BA6E38] border border-[rgba(186,110,56,0.22)]',
    sunken:
      'bg-(--bg-sunken) text-(--ink-secondary) border-transparent',
    outline:
      'bg-transparent text-(--ink-secondary) border border-(--border-default)',
    stamp:
      'paper-stamp text-(--ink-primary) bg-(--bg-surface)',
    'stamp-income':
      'paper-stamp text-(--color-income) bg-(--bg-surface)',
    'stamp-expense':
      'paper-stamp text-(--color-expense) bg-(--bg-surface)',
  };

  const sizeStyles = {
    xs: isStamp ? 'leading-none' : 'h-4 px-1.5 text-[0.625rem] rounded-(--radius-xs) gap-1 leading-none',
    sm: isStamp ? 'leading-none' : 'h-5 px-1.5 text-[0.6875rem] rounded-(--radius-xs) gap-1',
    md: isStamp ? 'leading-none' : 'h-6 px-2 text-xs rounded-(--radius-sm) gap-1.5',
  };

  return (
    <span
      className={cn(
        'paper-badge inline-flex items-center font-medium select-none shrink-0 whitespace-nowrap transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        interactive && 'cursor-pointer hover:opacity-85 active:scale-95',
        className
      )}
      onClick={onClick}
      {...props}
    >
      {icon && <span className="inline-flex items-center shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export default PaperBadge;
