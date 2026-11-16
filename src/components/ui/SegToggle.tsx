import React from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
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
  const uiStyle = useThemeStore((s) => s.uiStyle);
  const isModern = uiStyle === 'modern';

  const sizeStyles = {
    sm: 'text-xs py-1 px-2.5',
    md: 'text-sm py-1.5 px-3.5',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center p-1 select-none transition-colors duration-200',
        isModern
          ? 'bg-(--paper-sunken) rounded-full border border-(--rule-hairline)'
          : 'bg-(--bg-sunken) rounded-(--radius-sm)',
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
              'flex-1 inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 cursor-pointer',
              sizeStyles[size],
              isModern
                ? isSelected
                  ? 'bg-[#1677ff] text-white dark:bg-[#4d94ff] dark:text-[#0d0f17] shadow-xs font-semibold rounded-full'
                  : 'text-(--ink-tertiary) hover:text-(--ink-primary) rounded-full'
                : isSelected
                  ? 'bg-(--bg-surface) text-(--ink-primary) shadow-(--shadow-xs) font-semibold rounded-[calc(var(--radius-sm)-2px)]'
                  : 'text-(--ink-tertiary) hover:text-(--ink-primary) hover:bg-[rgba(0,0,0,0.02)] rounded-[calc(var(--radius-sm)-2px)]'
            )}
          >
            {option.icon && (
              <span className="shrink-0 flex items-center">{option.icon}</span>
            )}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default SegToggle;
