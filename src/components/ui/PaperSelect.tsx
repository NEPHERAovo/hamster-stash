import React from 'react';
import { CaretDownIcon as CaretDown } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';

export interface PaperSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  containerClassName?: string;
}

export const PaperSelect = React.forwardRef<HTMLSelectElement, PaperSelectProps>(
  ({ className, containerClassName, children, disabled, ...props }, ref) => {
    return (
      <div className={cn('relative w-full', containerClassName)}>
        <select
          ref={ref}
          disabled={disabled}
          className={cn('paper-select', className)}
          {...props}
        >
          {children}
        </select>
        <CaretDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 stroke-2 text-(--ink-tertiary)" />
      </div>
    );
  }
);

PaperSelect.displayName = 'PaperSelect';

export default PaperSelect;
