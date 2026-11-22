import React from 'react';
import { cn } from '../../utils/cn';

export interface PaperChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  variant?: 'default' | 'accent' | 'expense' | 'income' | 'brass';
  size?: 'xs' | 'sm' | 'md';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const PaperChip = React.forwardRef<HTMLButtonElement, PaperChipProps>(
  (
    {
      className,
      selected = false,
      variant = 'default',
      size = 'md',
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      xs: 'h-5 px-1.5 text-[11px] gap-1',
      sm: 'h-6 px-2 text-xs gap-1',
      md: 'h-7 px-2.5 text-xs gap-1.5',
    };

    const variantStyles = {
      default: selected
        ? 'border-transparent bg-(--btn-primary-bg) text-(--btn-primary-fg) shadow-2xs'
        : 'border-(--rule-hairline)/60 bg-(--paper-sunken)/70 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)',
      accent: selected
        ? 'border-transparent bg-(--color-accent) text-white shadow-2xs'
        : 'border-(--color-accent)/30 bg-(--color-accent)/10 text-(--color-accent) hover:bg-(--color-accent)/20',
      expense: selected
        ? 'border-(--color-expense)/30 bg-(--color-expense-bg) text-(--color-expense) shadow-2xs'
        : 'border-(--rule-hairline)/60 bg-(--paper-sunken)/70 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)',
      income: selected
        ? 'border-(--color-income)/30 bg-(--color-income-bg) text-(--color-income) shadow-2xs'
        : 'border-(--rule-hairline)/60 bg-(--paper-sunken)/70 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)',
      brass: selected
        ? 'border-(--brass-metal)/30 bg-(--paper-sunken) text-(--brass-metal) shadow-2xs'
        : 'border-(--rule-hairline)/60 bg-(--paper-sunken)/70 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)',
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          'paper-chip',
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {leftIcon && <span className="flex shrink-0 items-center">{leftIcon}</span>}
        {children && <span>{children}</span>}
        {rightIcon && <span className="flex shrink-0 items-center">{rightIcon}</span>}
      </button>
    );
  }
);

PaperChip.displayName = 'PaperChip';

export default PaperChip;
