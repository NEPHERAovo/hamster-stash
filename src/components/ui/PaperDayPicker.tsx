import React from 'react';
import { cn } from '../../utils/cn';

export interface PaperDayPickerProps {
  title: string;
  selectedDay?: number;
  onSelectDay: (day: number) => void;
  onClear: () => void;
  className?: string;
}

export const PaperDayPicker: React.FC<PaperDayPickerProps> = ({
  title,
  selectedDay,
  onSelectDay,
  onClear,
  className,
}) => {
  return (
    <div
      className={cn(
        'picker-fade-enter space-y-2 rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sheet) p-2.5 shadow-xs',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-(--ink-tertiary)">
          {title} (1-31日)
        </span>
        <button
          type="button"
          onClick={onClear}
          className="cursor-pointer text-[11px] font-medium text-(--ink-tertiary) hover:text-(--ink-primary)"
        >
          清除设置
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
          const isSelected = selectedDay === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelectDay(d)}
              className={cn(
                'flex h-7 cursor-pointer items-center justify-center rounded-(--radius-xs) font-mono text-xs transition-all',
                isSelected
                  ? 'bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg) shadow-2xs'
                  : 'bg-(--paper-sunken)/60 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)'
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
};
