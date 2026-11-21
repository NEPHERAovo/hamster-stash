import React from 'react';
import { cn } from '../../utils/cn';

export interface SegToggleOption<T extends string | number> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export interface SegToggleProps<T extends string | number> {
  options: SegToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
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
    sm: 'text-xs py-1 px-2.5',
    md: 'text-sm py-1.5 px-3.5',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-(--toggle-radius) border border-(--rule-hairline) bg-(--toggle-bg) p-1 transition-colors duration-200 select-none',
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
              'inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-(--toggle-item-radius) font-medium whitespace-nowrap transition-all duration-150',
              sizeStyles[size],
              isSelected
                ? 'bg-(--toggle-active-bg) font-semibold text-(--toggle-active-fg) shadow-xs'
                : 'text-(--ink-tertiary) hover:text-(--ink-primary)'
            )}
          >
            {option.icon && (
              <span className="flex shrink-0 items-center">{option.icon}</span>
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegToggle;
