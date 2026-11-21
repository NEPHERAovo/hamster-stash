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
          className={cn(
            'w-full cursor-pointer appearance-none rounded-(--input-radius) border border-(--rule-hairline) bg-(--paper-sheet) py-1.5 pr-7 pl-2.5 text-xs font-semibold text-(--ink-primary) transition-colors outline-none focus:border-(--ink-tertiary) disabled:cursor-not-allowed disabled:opacity-40',
            className
          )}
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
