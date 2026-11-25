import React from 'react';
import { cn } from '../../utils/cn';

export interface SegToggleOption<T extends string | number> {
  value: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface SegToggleProps<T extends string | number> {
  options: SegToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'xs' | 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

export function SegToggle<T extends string | number>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = true,
  className,
}: SegToggleProps<T>) {
  const sizeStyles = {
    xs: 'text-xs py-1 px-1.5',
    sm: 'text-xs py-1 px-2.5',
    md: 'text-sm py-1.5 px-3.5',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-(--toggle-radius) border border-(--rule-hairline) bg-(--toggle-bg) transition-colors duration-200 select-none',
        size === 'xs' ? 'p-0.5' : 'p-1',
        fullWidth && 'w-full',
        className
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-(--toggle-item-radius) font-medium whitespace-nowrap tabular-nums transition-[color,background-color,box-shadow] duration-150',
              sizeStyles[size],
              isSelected
                ? 'bg-(--toggle-active-bg) text-(--toggle-active-fg) shadow-xs'
                : 'text-(--ink-tertiary) hover:text-(--ink-primary)'
            )}
          >
            {option.icon && (
              <span className="flex shrink-0 items-center">{option.icon}</span>
            )}
            <span className="inline-flex items-baseline gap-0.5">
              <span>{option.label}</span>
              {option.count !== undefined && (
                <span
                  className={cn(
                    'font-mono text-[10px] leading-none font-normal tabular-nums',
                    isSelected ? 'text-(--toggle-active-fg) opacity-65' : 'opacity-70'
                  )}
                >
                  {option.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default SegToggle;
