import React from 'react';
import {
  CaretLeftIcon as CaretLeft,
  CaretRightIcon as CaretRight,
  CaretDownIcon as CaretDown,
} from '@phosphor-icons/react';
import { PaperIconButton } from '../PaperIconButton';
import { todayDate, type Dayjs } from '../../../utils/date';
import { cn } from '../../../utils/cn';

const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTHS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

export interface CalendarDayCell {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
}

export interface DatePickerSubViewsProps {
  mode: 'date' | 'datetime' | 'range' | 'month' | 'year';
  subView: 'calendar' | 'month' | 'year';
  onChangeSubView: (subView: 'calendar' | 'month' | 'year') => void;
  viewMonth: Dayjs;
  yearPageStart: number;
  selectedYear: string;
  selectedMonth: string;
  selectedDate: string;
  range: { start: string; end: string };
  minDate?: string;
  maxDate?: string;
  calendarDays: CalendarDayCell[];
  onSelectYear: (yearNum: number) => void;
  onSelectMonth: (monthIdx: number) => void;
  onSelectDay: (dateStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export const DatePickerSubViews: React.FC<DatePickerSubViewsProps> = ({
  mode,
  subView,
  onChangeSubView,
  viewMonth,
  yearPageStart,
  selectedYear,
  selectedMonth,
  selectedDate,
  range,
  minDate,
  maxDate,
  calendarDays,
  onSelectYear,
  onSelectMonth,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}) => {
  if (subView === 'year') {
    return (
      <div className="mt-3 space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => {
            const isSelected =
              mode === 'year'
                ? selectedYear === y.toString()
                : viewMonth.year() === y;
            return (
              <button
                key={y}
                type="button"
                onClick={() => onSelectYear(y)}
                className={cn(
                  'flex h-9 cursor-pointer items-center justify-center rounded-(--radius-sm) font-mono text-xs transition-colors',
                  isSelected
                    ? 'bg-(--btn-primary-bg) font-bold text-(--btn-primary-fg) shadow-2xs'
                    : 'bg-(--paper-sunken)/60 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)'
                )}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (subView === 'month') {
    return (
      <div className="mt-3 space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((mLabel, idx) => {
            const monthKey = `${viewMonth.year()}-${String(idx + 1).padStart(2, '0')}`;
            const isSelected =
              mode === 'month'
                ? selectedMonth === monthKey
                : viewMonth.month() === idx;
            return (
              <button
                key={mLabel}
                type="button"
                onClick={() => onSelectMonth(idx)}
                className={cn(
                  'flex h-9 cursor-pointer items-center justify-center rounded-(--radius-sm) font-mono text-xs transition-colors',
                  isSelected
                    ? 'bg-(--btn-primary-bg) font-bold text-(--btn-primary-fg) shadow-2xs'
                    : 'bg-(--paper-sunken)/60 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)'
                )}
              >
                {mLabel}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between px-1 py-1.5 select-none">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChangeSubView('year')}
            className="group flex cursor-pointer items-center gap-0.5 rounded-(--radius-xs) px-1.5 py-0.5 font-mono text-xs font-semibold text-(--ink-solid) hover:bg-(--paper-sunken)"
            title="点击选择年份"
          >
            <span>{viewMonth.format('YYYY年')}</span>
            <CaretDown className="size-3 text-(--ink-tertiary) transition-transform group-hover:text-(--ink-primary)" />
          </button>
          <button
            type="button"
            onClick={() => onChangeSubView('month')}
            className="group flex cursor-pointer items-center gap-0.5 rounded-(--radius-xs) px-1.5 py-0.5 font-mono text-xs font-semibold text-(--ink-solid) hover:bg-(--paper-sunken)"
            title="点击选择月份"
          >
            <span>{viewMonth.format('M月')}</span>
            <CaretDown className="size-3 text-(--ink-tertiary) transition-transform group-hover:text-(--ink-primary)" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <PaperIconButton
            icon={CaretLeft}
            size="sm"
            onClick={onPrevMonth}
            title="上个月"
            aria-label="上个月"
          />
          <PaperIconButton
            icon={CaretRight}
            size="sm"
            onClick={onNextMonth}
            title="下个月"
            aria-label="下个月"
          />
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center font-mono text-[11px] text-(--ink-tertiary)">
        {WEEK_DAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
          const isSelected = mode !== 'range' && selectedDate === dateStr;
          const isRangeStart = mode === 'range' && range.start === dateStr;
          const isRangeEnd = mode === 'range' && range.end === dateStr;
          const isHighlighted = isSelected || isRangeStart || isRangeEnd;
          const isInRange =
            mode === 'range' &&
            range.start &&
            range.end &&
            dateStr > range.start &&
            dateStr < range.end;

          const isDisabled =
            Boolean(minDate && dateStr < minDate) ||
            Boolean(maxDate && dateStr > maxDate);
          const isToday = dateStr === todayDate();

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDay(dateStr)}
              className={cn(
                'relative flex h-8 w-full cursor-pointer items-center justify-center font-mono text-xs transition-all duration-150',
                isHighlighted &&
                  'bg-(--btn-primary-bg) font-bold text-(--btn-primary-fg) shadow-2xs hover:opacity-95',
                isHighlighted && isRangeStart && isRangeEnd && 'rounded-(--radius-sm)',
                isHighlighted && isRangeStart && !isRangeEnd && 'rounded-l-(--radius-sm)',
                isHighlighted && isRangeEnd && !isRangeStart && 'rounded-r-(--radius-sm)',
                isHighlighted && isSelected && 'rounded-(--radius-sm)',
                !isHighlighted &&
                  isInRange &&
                  'bg-(--paper-sunken) font-medium text-(--ink-solid)',
                !isHighlighted &&
                  !isInRange &&
                  isCurrentMonth &&
                  'text-(--ink-primary) hover:bg-(--paper-sunken)/70',
                !isHighlighted &&
                  !isInRange &&
                  isCurrentMonth &&
                  isToday &&
                  'font-bold',
                !isHighlighted &&
                  !isInRange &&
                  !isCurrentMonth &&
                  'text-(--ink-faint) opacity-40 hover:bg-(--paper-sunken)/40',
                isDisabled && 'pointer-events-none opacity-20'
              )}
            >
              {dayNum}
              {isToday && !isHighlighted && (
                <span className="absolute bottom-0.5 size-1 rounded-full bg-(--color-accent)" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
