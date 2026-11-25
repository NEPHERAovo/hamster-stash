import React from 'react';
import { cn } from '../../utils/cn';
import { PaperCard } from './PaperCard';

export interface PaperEmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  variant?: 'card' | 'dashed' | 'plain';
  animate?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const PaperEmptyState: React.FC<PaperEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  variant = 'dashed',
  animate = false,
  className,
  children,
}) => {
  const containerVariants = {
    card: 'flex w-full flex-col items-center gap-1.5 text-center text-xs text-(--ink-tertiary) shadow-xs transition-all duration-200 select-none',
    dashed:
      'my-4 rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sheet) p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] select-none dark:shadow-[0_1px_4px_rgba(0,0,0,0.12)]',
    plain: 'py-8 text-center text-xs text-(--ink-tertiary) select-none',
  };

  if (variant === 'plain') {
    return (
      <div className={cn(containerVariants.plain, animate && 'filter-fade-enter', className)}>
        {Icon && <Icon className="stroke-1.5 mx-auto mb-2 size-6 text-(--ink-faint)" />}
        <p className="font-medium text-(--ink-secondary)">{title}</p>
        {description && <p className="mt-1 font-mono text-[11px] text-(--ink-tertiary)">{description}</p>}
        {children}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <PaperCard
        rounded="md"
        padding="lg"
        className={cn(containerVariants.card, animate && 'filter-fade-enter', className)}
      >
        {Icon && <Icon className="stroke-1.5 size-6 text-(--ink-faint)" />}
        <span className="font-medium text-(--ink-secondary)">{title}</span>
        {description && <span className="font-mono text-[11px] text-(--ink-tertiary)">{description}</span>}
        {children}
      </PaperCard>
    );
  }

  return (
    <div className={cn(containerVariants.dashed, animate && 'filter-fade-enter', className)}>
      <div className="rounded-xs border border-dashed border-(--rule-hairline) px-4 py-8">
        {Icon && <Icon className="mx-auto mb-2 size-8 stroke-1 text-(--ink-tertiary)/40" />}
        <p className="text-xs font-semibold text-(--ink-tertiary)">{title}</p>
        {description && <p className="mt-1 font-mono text-[11px] text-(--ink-tertiary)">{description}</p>}
        {children}
      </div>
    </div>
  );
};

export default PaperEmptyState;
