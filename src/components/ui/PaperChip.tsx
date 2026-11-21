import React from 'react';
import { cn } from '../../utils/cn';

export interface PaperChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  size?: 'sm' | 'md';
}

export const PaperChip = React.forwardRef<HTMLButtonElement, PaperChipProps>(
  ({ className, selected = false, size = 'md', disabled, children, ...props }, ref) => {
    const sizeStyles = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-xs',
    };

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          'cursor-pointer truncate rounded-(--btn-radius) border font-mono transition-all select-none',
          'disabled:pointer-events-none disabled:opacity-40',
          sizeStyles[size],
          selected
            ? 'border-transparent bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg) shadow-2xs'
            : 'border-(--rule-hairline)/60 bg-(--paper-sunken)/70 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

PaperChip.displayName = 'PaperChip';

export default PaperChip;
