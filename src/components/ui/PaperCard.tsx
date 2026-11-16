import React from 'react';
import { cn } from '../../utils/cn';

export interface PaperCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'sunken' | 'elevated' | 'dashed' | 'receipt' | 'journal' | 'organic' | 'deckle';
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  rounded?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'full';
  interactive?: boolean;
}

export const PaperCard = React.forwardRef<HTMLDivElement, PaperCardProps>(
  (
    {
      className,
      variant = 'default',
      padding = 'md',
      rounded = 'sm',
      interactive = false,
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      default: 'paper-card bg-(--paper-sheet) border border-(--rule-hairline) shadow-(--shadow-xs)',
      sunken: 'paper-card bg-(--paper-sunken) border border-(--rule-hairline)',
      elevated: 'paper-card bg-(--paper-sheet) border border-(--rule-strong) shadow-(--shadow-sm)',
      dashed: 'paper-card bg-(--paper-sunken)/40 border border-dashed border-(--rule-hairline)',
      receipt: 'paper-card bg-(--paper-sheet) border border-(--rule-hairline) border-b-2 border-b-dashed shadow-(--shadow-xs)',
      journal: 'paper-card bg-(--paper-sheet) border border-(--rule-hairline) border-l-[3px] border-l-(--ink-primary) shadow-(--shadow-xs)',
      organic: 'paper-card bg-(--paper-sheet) border border-(--rule-hairline) corner-lift-shadow',
      deckle: 'paper-card bg-(--paper-sheet) border border-(--rule-hairline) paper-deckle-bottom corner-lift-shadow',
    };

    const paddingStyles = {
      none: 'p-0',
      xs: 'p-2',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-5',
    };

    const roundedStyles = {
      none: 'rounded-none',
      xs: 'rounded-(--radius-xs)',
      sm: 'rounded-(--radius-sm)',
      md: 'rounded-(--radius-md)',
      lg: 'rounded-(--radius-lg)',
      full: 'rounded-full',
    };

    const interactiveStyles = interactive
      ? 'cursor-pointer transition-all duration-200 active:scale-[0.99] active:bg-(--bg-hover)'
      : '';

    return (
      <div
        ref={ref}
        className={cn(
          'transition-colors duration-200',
          variantStyles[variant],
          paddingStyles[padding],
          roundedStyles[rounded],
          interactiveStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

PaperCard.displayName = 'PaperCard';

export default PaperCard;
