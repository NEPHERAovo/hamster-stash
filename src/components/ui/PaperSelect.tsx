import React from 'react';
import { CaretDownIcon as CaretDown } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';

export interface PaperSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'md';
  variant?: 'sunken' | 'surface';
  containerClassName?: string;
}

export const PaperSelect = React.forwardRef<HTMLSelectElement, PaperSelectProps>(
  ({ className, containerClassName, children, disabled, size = 'md', variant = 'sunken', ...props }, ref) => {
    const sizeStyles = {
      sm: 'h-8 pr-7 pl-2.5 text-xs',
      md: 'h-10 pr-8 pl-3 text-sm',
    };

    const variantStyles = {
      sunken: 'bg-(--paper-sunken) border-(--rule-hairline)',
      surface: 'bg-(--paper-sheet) border-(--rule-hairline)',
    };

    return (
      <div className={cn('relative w-full', containerClassName)}>
        <select
          ref={ref}
          disabled={disabled}
          className={cn(
            'paper-select font-medium text-(--ink-primary)',
            sizeStyles[size],
            variantStyles[variant],
            className
          )}
          {...props}
        >
          {children}
        </select>
        <CaretDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 stroke-2 text-(--ink-tertiary)" />
      </div>
    );
  }
);

PaperSelect.displayName = 'PaperSelect';

export default PaperSelect;
