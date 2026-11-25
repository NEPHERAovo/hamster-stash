import React from 'react';
import { cn } from '../../utils/cn';

export interface PaperSummaryCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tapeClassName?: string;
}

export const PaperSummaryCard = React.forwardRef<HTMLDivElement, PaperSummaryCardProps>(
  ({ className, tapeClassName, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'paper-deckle-bottom paper-summary-card relative border border-(--rule-hairline) bg-(--paper-sheet) text-(--ink-solid) shadow-xs transition-all duration-200 select-none',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'washi-tape absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 shadow-2xs',
            tapeClassName
          )}
        />
        {children}
      </div>
    );
  }
);

PaperSummaryCard.displayName = 'PaperSummaryCard';

export default PaperSummaryCard;
