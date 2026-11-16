import React from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
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
    const uiStyle = useThemeStore((s) => s.uiStyle);
    const isModern = uiStyle === 'modern';

    const variantStyles = {
      ink: isModern
        ? 'bg-[#1677ff] text-white dark:bg-[#4d94ff] dark:text-[#0d0f17] shadow-sm hover:opacity-90 active:scale-[0.98]'
        : 'bg-(--ink-primary) text-(--bg-surface) shadow-(--shadow-xs) hover:opacity-95 active:scale-[0.98]',
      primary: isModern
        ? 'bg-[#1677ff] text-white dark:bg-[#4d94ff] dark:text-[#0d0f17] shadow-sm hover:opacity-90 active:scale-[0.98]'
        : 'bg-(--ink-primary) text-(--bg-surface) shadow-(--shadow-xs) hover:opacity-95 active:scale-[0.98]',
      secondary: isModern
        ? 'bg-(--paper-sheet) backdrop-blur-md text-(--ink-secondary) border border-(--rule-hairline) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-[0.98]'
        : 'bg-(--bg-surface) text-(--ink-secondary) border border-(--border-hairline) hover:bg-(--bg-hover) hover:text-(--ink-primary) active:scale-[0.98]',
      sunken: isModern
        ? 'bg-(--paper-sunken) backdrop-blur-md text-(--ink-primary) border border-(--rule-hairline) hover:bg-(--paper-sunken)/80 active:scale-[0.98]'
        : 'bg-(--bg-sunken) text-(--ink-primary) border border-(--border-hairline) hover:bg-(--bg-hover) active:scale-[0.98]',
      income: isModern
        ? 'bg-[var(--color-income-bg)] text-[var(--color-income)] border border-[rgba(63,130,86,0.22)] rounded-full active:scale-[0.98]'
        : 'bg-(--color-income-bg) text-(--color-income) border border-[rgba(63,130,86,0.22)] active:scale-[0.98]',
      danger: isModern
        ? 'bg-[var(--color-expense-bg)] text-[var(--color-expense)] border border-[rgba(189,88,64,0.22)] rounded-full active:scale-[0.98]'
        : 'bg-(--color-expense-bg) text-(--color-expense) border border-[rgba(189,88,64,0.22)] active:scale-[0.98]',
      ghost:
        'bg-transparent text-(--ink-secondary) hover:bg-(--bg-hover) hover:text-(--ink-primary) active:scale-[0.98]',
    };

    const sizeStyles = isModern
      ? {
          xs: 'h-6 px-2.5 text-xs rounded-full gap-1',
          sm: 'h-8 px-3.5 text-xs rounded-full gap-1.5',
          md: 'h-10 px-4.5 text-sm rounded-full gap-2',
          lg: 'h-12 px-6 text-base rounded-full gap-2.5',
          icon: 'h-9 w-9 p-0 rounded-full justify-center',
        }
      : {
          xs: 'h-6 px-2 text-xs rounded-(--radius-xs) gap-1',
          sm: 'h-8 px-3 text-xs rounded-(--radius-sm) gap-1.5',
          md: 'h-10 px-4 text-sm rounded-(--radius-sm) gap-2',
          lg: 'h-12 px-5 text-base rounded-(--radius-md) gap-2.5',
          icon: 'h-9 w-9 p-0 rounded-(--radius-sm) justify-center',
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
