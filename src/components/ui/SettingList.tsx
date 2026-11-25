import React from 'react';
import { CaretRightIcon as ChevronRight } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { PaperCard } from './PaperCard';

export interface SettingSectionProps {
  title?: string;
  uppercase?: boolean;
  danger?: boolean;
  children: React.ReactNode;
  className?: string;
  cardClassName?: string;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  uppercase = false,
  danger = false,
  children,
  className,
  cardClassName,
}) => {
  return (
    <div className={cn('space-y-1.5', className)}>
      {title && (
        <div
          className={cn(
            'px-1 pt-1 font-mono text-xs tracking-wider',
            danger ? 'text-(--color-expense)' : 'text-(--ink-tertiary)',
            uppercase && 'uppercase'
          )}
        >
          <span>{title}</span>
        </div>
      )}
      <PaperCard
        rounded="lg"
        padding="none"
        divided
        className={cn(
          'px-3.5 shadow-xs',
          danger && 'border-(--color-expense)/30',
          cardClassName
        )}
      >
        {children}
      </PaperCard>
    </div>
  );
};

export interface SettingRowProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: string;
  value?: React.ReactNode;
  right?: React.ReactNode;
  chevron?: boolean;
  danger?: boolean;
  onClick?: () => void;
  className?: string;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  title,
  description,
  value,
  right,
  chevron = false,
  danger = false,
  onClick,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5 select-none',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className="flex min-w-0 items-center gap-2.5 pr-2">
        {icon && (
          <div
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius)',
              danger
                ? 'bg-(--color-expense-bg) text-(--color-expense)'
                : 'bg-(--paper-sunken) text-(--ink-secondary)'
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div
            className={cn(
              'text-[13px] font-medium',
              danger ? 'text-(--color-expense)' : 'text-(--ink-primary)'
            )}
          >
            {title}
          </div>
          {description && (
            <p className="mt-0.5 truncate text-[11px] leading-tight text-(--ink-tertiary)">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-(--ink-tertiary)">
        {value}
        {right}
        {chevron && (
          <ChevronRight
            className={cn('size-3.5', danger && 'text-(--color-expense)/70')}
          />
        )}
      </div>
    </div>
  );
};
