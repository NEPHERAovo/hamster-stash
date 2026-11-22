import React from 'react';
import { cn } from '../../utils/cn';

export interface PaperIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ComponentType<{ className?: string }>;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'surface' | 'sunken' | 'ghost' | 'primary';
  rounded?: 'normal' | 'full';
  active?: boolean;
}

export const PaperIconButton = React.forwardRef<HTMLButtonElement, PaperIconButtonProps>(
  (
    {
      className,
      icon: Icon,
      size = 'md',
      variant = 'surface',
      rounded = 'normal',
      active = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      sm: 'size-6',
      md: 'size-7',
      lg: 'size-8',
    };

    const iconSizes = {
      sm: 'size-3 stroke-2',
      md: 'size-3.5 stroke-2',
      lg: 'size-4 stroke-2',
    };

    const variantStyles = {
      surface:
        'border border-(--rule-hairline) bg-(--paper-sheet) text-(--ink-secondary) shadow-xs hover:bg-(--paper-sunken) hover:text-(--ink-primary)',
      sunken:
        'border border-(--rule-hairline) bg-(--paper-sunken) text-(--ink-secondary) hover:bg-(--paper-sheet) hover:text-(--ink-primary)',
      ghost:
        'border-transparent bg-transparent text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)',
      primary:
        'border-transparent bg-(--btn-primary-bg) text-(--btn-primary-fg) shadow-sm hover:opacity-95',
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          'paper-icon-btn',
          rounded === 'full' ? 'rounded-full' : 'rounded-(--btn-radius)',
          sizeStyles[size],
          variantStyles[variant],
          active && 'border-(--color-accent) text-(--color-accent)',
          className
        )}
        {...props}
      >
        <Icon className={iconSizes[size]} />
      </button>
    );
  }
);

PaperIconButton.displayName = 'PaperIconButton';

export default PaperIconButton;
