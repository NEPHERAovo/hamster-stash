import React from 'react';
import { cn } from '../../utils/cn';

export interface PaperButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ink' | 'primary' | 'secondary' | 'sunken' | 'income' | 'danger' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
}

export const PaperButton = React.forwardRef<HTMLButtonElement, PaperButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      fullWidth = false,
      leftIcon,
      rightIcon,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      ink: 'bg-(--btn-primary-bg) text-(--btn-primary-fg) shadow-(--shadow-xs) hover:opacity-95 active:scale-[0.98]',
      primary: 'bg-(--btn-primary-bg) text-(--btn-primary-fg) shadow-(--shadow-xs) hover:opacity-95 active:scale-[0.98]',
      secondary: 'paper-glass-blur bg-(--paper-sheet) text-(--ink-secondary) border border-(--rule-hairline) hover:bg-(--paper-sunken) hover:text-(--ink-primary) active:scale-[0.98]',
      sunken: 'paper-glass-blur bg-(--paper-sunken) text-(--ink-primary) border border-(--rule-hairline) hover:bg-(--paper-sunken)/80 active:scale-[0.98]',
      income: 'bg-(--color-income-bg) text-(--color-income) border border-(--color-income)/25 active:scale-[0.98]',
      danger: 'bg-(--color-expense-bg) text-(--color-expense) border border-(--color-expense)/25 active:scale-[0.98]',
      ghost: 'bg-transparent text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary) active:scale-[0.98]',
    };

    const sizeStyles = {
      xs: 'h-6 px-2.5 text-xs rounded-(--btn-radius) gap-1',
      sm: 'h-8 px-3 text-xs rounded-(--btn-radius) gap-1.5',
      md: 'h-10 px-4 text-sm rounded-(--btn-radius) gap-2',
      lg: 'h-12 px-5.5 text-base rounded-(--btn-radius) gap-2.5',
      icon: 'h-9 w-9 p-0 rounded-(--btn-radius) justify-center',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-150 select-none cursor-pointer',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="inline-flex shrink-0 items-center">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

PaperButton.displayName = 'PaperButton';

export default PaperButton;
