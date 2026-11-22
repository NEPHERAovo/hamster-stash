import React from 'react';
import { cn } from '../../utils/cn';

export interface PaperButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'ink'
    | 'primary'
    | 'secondary'
    | 'sunken'
    | 'accent'
    | 'income'
    | 'danger'
    | 'danger-ghost'
    | 'ghost'
    | 'nav';
  size?: 'xs' | 'compact' | 'sm' | 'md' | 'lg' | 'icon';
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
      type = 'button',
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
      accent: 'bg-(--color-accent)/10 text-(--color-accent) border border-(--color-accent)/30 hover:bg-(--color-accent)/20 active:scale-[0.98]',
      income: 'bg-(--color-income-bg) text-(--color-income) border border-(--color-income)/25 active:scale-[0.98]',
      danger: 'bg-(--color-expense-bg) text-(--color-expense) border border-(--color-expense)/25 active:scale-[0.98]',
      'danger-ghost': 'bg-transparent text-(--color-expense) hover:bg-(--color-expense-bg)/40 active:scale-[0.98]',
      ghost: 'bg-transparent text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary) active:scale-[0.98]',
      nav: 'bg-transparent text-(--ink-secondary) hover:text-(--ink-primary) p-0 font-semibold active:scale-[0.98]',
    };

    const sizeStyles = {
      xs: 'h-6 px-2 text-[11px] rounded-(--btn-radius) gap-1 leading-none',
      compact: 'h-7 px-2.5 text-xs rounded-(--btn-radius) gap-1.5 leading-none',
      sm: 'h-8 px-3 text-xs rounded-(--btn-radius) gap-1.5 leading-none',
      md: 'h-10 px-4 text-sm rounded-(--btn-radius) gap-2 leading-none',
      lg: 'h-12 px-5.5 text-base rounded-(--btn-radius) gap-2.5 leading-none',
      icon: 'h-9 w-9 p-0 rounded-(--btn-radius) justify-center leading-none',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          'paper-btn',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0 items-center justify-center">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="inline-flex shrink-0 items-center justify-center">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

PaperButton.displayName = 'PaperButton';

export default PaperButton;
