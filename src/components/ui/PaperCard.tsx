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
      default: 'bg-(--bg-surface) border border-(--border-hairline) shadow-(--shadow-xs)',
      sunken: 'bg-(--bg-sunken) border border-(--border-hairline)',
      elevated: 'bg-(--bg-surface) border border-(--border-default) shadow-(--shadow-sm)',
      dashed: 'bg-transparent border border-dashed border-(--border-default)',
      receipt: 'bg-(--bg-surface) border border-(--border-default) border-b-2 border-b-dashed shadow-(--shadow-xs)',
      journal: 'bg-(--bg-surface) border border-(--border-hairline) border-l-[3px] border-l-(--ink-primary) shadow-(--shadow-xs)',
      organic: 'bg-(--bg-surface) border border-(--border-hairline) corner-lift-shadow',
      deckle: 'bg-(--bg-surface) border border-(--border-default) paper-deckle-bottom corner-lift-shadow',
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
      full: 'rounded-(--radius-full)',
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
