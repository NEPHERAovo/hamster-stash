import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CaretLeftIcon as CaretLeft,
  CaretRightIcon as CaretRight,
  CaretDownIcon as CaretDown,
  XIcon as X,
} from '@phosphor-icons/react';
import { PaperButton } from './PaperButton';
import { PaperIconButton } from './PaperIconButton';
import { useCloseWatcher } from '../../hooks/useCloseWatcher';
import {
  dayjs,
  todayDate,
  nowTime,
  addDaysToToday,
  parseLocalDate,
  type Dayjs,
} from '../../utils/date';
import { cn } from '../../utils/cn';
import { TimeWheelPanel } from './date-picker/TimeWheelPanel';
import { normalizeTimeString } from './date-picker/datePickerUtils';
import { DatePickerSubViews, type CalendarDayCell } from './date-picker/CalendarGridPanel';

export type DatePickerMode = 'date' | 'datetime' | 'range' | 'month' | 'year';

export interface DateRangeValue {
  start: string;
  end: string;
}

export interface PaperDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: DatePickerMode;
  value?: string;
  onChange?: (value: string) => void;
  rangeValue?: DateRangeValue;
  onRangeChange?: (range: DateRangeValue) => void;
  title?: string;
  minDate?: string;
  maxDate?: string;
}

export const PaperDatePickerModal: React.FC<PaperDatePickerModalProps> = ({
  isOpen,
  onClose,
  mode = 'date',
  value,
  onChange,
  rangeValue,
  onRangeChange,
  title,
  minDate,
  maxDate,
}) => {
  const [mounted, setMounted] = useState(false);

  const initialDate = useMemo(() => {
    if (mode === 'range') {
      return rangeValue?.start ? parseLocalDate(rangeValue.start) : dayjs();
    }
    if (mode === 'month') {
      const parsed = parseLocalDate(value ? `${value}-01` : todayDate());
      return parsed.isValid() ? parsed : dayjs();
    }
    if (mode === 'year') {
      const parsed = parseLocalDate(value ? `${value}-01-01` : todayDate());
      return parsed.isValid() ? parsed : dayjs();
    }
    const parsed = parseLocalDate(value ? value.split(' ')[0] : todayDate());
    return parsed.isValid() ? parsed : dayjs();
  }, [mode, rangeValue, value]);

  const [viewMonth, setViewMonth] = useState<Dayjs>(initialDate);
  const [subView, setSubView] = useState<'calendar' | 'month' | 'year'>(() => {
    if (mode === 'month') return 'month';
    if (mode === 'year') return 'year';
    return 'calendar';
  });

  const [yearPageStart, setYearPageStart] = useState<number>(() => Math.floor(initialDate.year() / 12) * 12);

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (mode === 'range') return rangeValue?.start || todayDate();
    return value ? value.split(' ')[0] || todayDate() : todayDate();
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    mode === 'month' && value ? value : dayjs().format('YYYY-MM')
  );

  const [selectedYear, setSelectedYear] = useState<string>(() =>
    mode === 'year' && value ? value : dayjs().format('YYYY')
  );

  const [selectedTime, setSelectedTime] = useState<string>(() =>
    value && value.includes(' ') ? normalizeTimeString(value.split(' ')[1]) : nowTime()
  );

  const [range, setRange] = useState<DateRangeValue>(() =>
    rangeValue ?? { start: todayDate(), end: todayDate() }
  );

  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'range' && rangeValue) {
      setRange(rangeValue);
      const p = parseLocalDate(rangeValue.start);
      if (p.isValid()) {
        setViewMonth(p);
        setYearPageStart(Math.floor(p.year() / 12) * 12);
      }
      setIsSelectingEnd(false);
      setSubView('calendar');
    } else if (mode === 'month') {
      const val = value || dayjs().format('YYYY-MM');
      setSelectedMonth(val);
      const p = parseLocalDate(`${val}-01`);
      if (p.isValid()) {
        setViewMonth(p);
        setYearPageStart(Math.floor(p.year() / 12) * 12);
      }
      setSubView('month');
    } else if (mode === 'year') {
      const val = value || dayjs().format('YYYY');
      setSelectedYear(val);
      const yNum = parseInt(val, 10);
      if (!isNaN(yNum)) {
        setViewMonth(dayjs().year(yNum));
        setYearPageStart(Math.floor(yNum / 12) * 12);
      }
      setSubView('year');
    } else if (value) {
      const parts = value.split(' ');
      setSelectedDate(parts[0] || todayDate());
      setSelectedTime(parts[1] ? normalizeTimeString(parts[1]) : nowTime());
      const p = parseLocalDate(parts[0] || todayDate());
      if (p.isValid()) {
        setViewMonth(p);
        setYearPageStart(Math.floor(p.year() / 12) * 12);
      }
      setSubView('calendar');
    } else {
      setSelectedDate(todayDate());
      setSelectedTime(nowTime());
      const now = dayjs();
      setViewMonth(now);
      setYearPageStart(Math.floor(now.year() / 12) * 12);
      setSubView('calendar');
    }
  }, [isOpen, mode, value, rangeValue]);

  useCloseWatcher({ isOpen: mounted && isOpen, onClose });

  const calendarDays = useMemo<CalendarDayCell[]>(() => {
    const startOfMonth = viewMonth.startOf('month');
    const daysInMonth = viewMonth.daysInMonth();
    const firstDayOfWeek = (startOfMonth.day() + 6) % 7;

    const days: CalendarDayCell[] = [];
    const prevMonth = viewMonth.subtract(1, 'month');
    const daysInPrevMonth = prevMonth.daysInMonth();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      days.push({ dateStr: prevMonth.date(dayNum).format('YYYY-MM-DD'), dayNum, isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ dateStr: viewMonth.date(i).format('YYYY-MM-DD'), dayNum: i, isCurrentMonth: true });
    }
    const remaining = (7 - (days.length % 7)) % 7;
    const nextMonth = viewMonth.add(1, 'month');
    for (let i = 1; i <= remaining; i++) {
      days.push({ dateStr: nextMonth.date(i).format('YYYY-MM-DD'), dayNum: i, isCurrentMonth: false });
    }
    return days;
  }, [viewMonth]);

  const handleSelectDay = useCallback(
    (dateStr: string) => {
      if (mode === 'range') {
        if (!isSelectingEnd) {
          setRange({ start: dateStr, end: dateStr });
          setIsSelectingEnd(true);
        } else {
          setRange(dateStr < range.start ? { start: dateStr, end: range.start } : { start: range.start, end: dateStr });
          setIsSelectingEnd(false);
        }
      } else {
        setSelectedDate(dateStr);
      }
    },
    [mode, isSelectingEnd, range.start]
  );

  const handleSelectMonth = (monthIndex: number) => {
    const newMonth = viewMonth.month(monthIndex);
    setViewMonth(newMonth);
    setSelectedMonth(newMonth.format('YYYY-MM'));
    if (mode !== 'month') {
      setSubView('calendar');
    }
  };

  const handleSelectYear = (yearNum: number) => {
    setViewMonth(viewMonth.year(yearNum));
    setSelectedYear(yearNum.toString());
    if (mode === 'month') {
      setSubView('month');
    } else if (mode !== 'year') {
      setSubView('calendar');
    }
  };

  const handleConfirm = () => {
    if (mode === 'range') {
      onRangeChange?.(range);
    } else if (mode === 'datetime') {
      onChange?.(`${selectedDate} ${selectedTime}`);
    } else if (mode === 'month') {
      onChange?.(selectedMonth);
    } else if (mode === 'year') {
      onChange?.(selectedYear);
    } else {
      onChange?.(selectedDate);
    }
    onClose();
  };

  if (!mounted || !isOpen) {
    return null;
  }

  const rangeQuickPresets = [
    { label: '最近7天', getRange: () => ({ start: addDaysToToday(-6), end: todayDate() }) },
    { label: '最近30天', getRange: () => ({ start: addDaysToToday(-29), end: todayDate() }) },
    {
      label: '本月',
      getRange: () => ({
        start: dayjs().startOf('month').format('YYYY-MM-DD'),
        end: dayjs().endOf('month').format('YYYY-MM-DD'),
      }),
    },
    {
      label: '上月',
      getRange: () => {
        const lastM = dayjs().subtract(1, 'month');
        return {
          start: lastM.startOf('month').format('YYYY-MM-DD'),
          end: lastM.endOf('month').format('YYYY-MM-DD'),
        };
      },
    },
  ];

  const renderHeaderLeft = () => {
    if (subView === 'year') {
      return (
        <div className="flex items-center gap-1.5">
          {mode !== 'year' && (
            <button
              type="button"
              onClick={() => setSubView(mode === 'month' ? 'month' : 'calendar')}
              className="flex cursor-pointer items-center gap-0.5 rounded-(--radius-xs) px-1.5 py-0.5 font-mono text-[11px] text-(--ink-tertiary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
              title="返回"
            >
              <CaretLeft className="size-3" />
              <span>返回</span>
            </button>
          )}
          {mode === 'year' && (
            <span className="font-mono text-xs font-semibold text-(--ink-solid)">
              {title || '选择年份'}
            </span>
          )}
          <span className="font-mono text-xs font-semibold text-(--ink-solid)">
            {yearPageStart} – {yearPageStart + 11}
          </span>
        </div>
      );
    }

    if (subView === 'month') {
      return (
        <div className="flex items-center gap-1.5">
          {mode !== 'month' && (
            <button
              type="button"
              onClick={() => setSubView('calendar')}
              className="flex cursor-pointer items-center gap-0.5 rounded-(--radius-xs) px-1.5 py-0.5 font-mono text-[11px] text-(--ink-tertiary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
              title="返回日历"
            >
              <CaretLeft className="size-3" />
              <span>返回</span>
            </button>
          )}
          {mode === 'month' && (
            <span className="font-mono text-xs font-semibold text-(--ink-solid)">
              {title || '选择月份'}
            </span>
          )}
          <button
            type="button"
            onClick={() => setSubView('year')}
            className="group flex cursor-pointer items-center gap-1 font-mono text-xs font-semibold text-(--ink-solid) hover:text-(--ink-primary)"
            title="点击选择年份"
          >
            <span>{viewMonth.format('YYYY年')}</span>
            <CaretDown className="size-3 text-(--ink-tertiary) transition-transform group-hover:text-(--ink-primary)" />
          </button>
        </div>
      );
    }

    if (mode === 'date' || mode === 'datetime') {
      return (
        <div className="flex items-center gap-1.5">
          {['今天', '昨天', '前天'].map((label, idx) => {
            const targetDate = idx === 0 ? todayDate() : addDaysToToday(-idx);
            const isSelected = selectedDate === targetDate;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setSelectedDate(targetDate);
                  setViewMonth(parseLocalDate(targetDate));
                }}
                className={cn(
                  'cursor-pointer rounded-(--badge-radius) px-2.5 py-0.5 font-mono text-xs transition-colors',
                  isSelected
                    ? 'bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg)'
                    : 'bg-(--paper-sunken)/70 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      );
    }

    if (mode === 'range') {
      return (
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {rangeQuickPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setRange(preset.getRange());
                setIsSelectingEnd(false);
              }}
              className="shrink-0 cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
            >
              {preset.label}
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="font-mono text-xs font-semibold text-(--ink-solid)">
        {title || (mode === 'month' ? '选择月份' : '选择年份')}
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-3 select-none"
      role="dialog"
      aria-modal="true"
    >
      <div
        data-testid="date-picker-backdrop"
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="paper-card relative w-full max-w-sm overflow-hidden rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-4 shadow-xl select-none sm:p-5">
        <div className="flex items-center justify-between gap-2 border-b border-dashed border-(--rule-hairline)/60 pb-2.5">
          {renderHeaderLeft()}

          <div className="flex items-center gap-1">
            {subView === 'year' && (
              <>
                <PaperIconButton
                  icon={CaretLeft}
                  size="sm"
                  onClick={() => setYearPageStart((prev) => prev - 12)}
                  title="上一页"
                  aria-label="上一页"
                />
                <PaperIconButton
                  icon={CaretRight}
                  size="sm"
                  onClick={() => setYearPageStart((prev) => prev + 12)}
                  title="下一页"
                  aria-label="下一页"
                />
              </>
            )}
            {subView === 'month' && (
              <>
                <PaperIconButton
                  icon={CaretLeft}
                  size="sm"
                  onClick={() => setViewMonth((prev) => prev.subtract(1, 'year'))}
                  title="上一年"
                  aria-label="上一年"
                />
                <PaperIconButton
                  icon={CaretRight}
                  size="sm"
                  onClick={() => setViewMonth((prev) => prev.add(1, 'year'))}
                  title="下一年"
                  aria-label="下一年"
                />
              </>
            )}
            <PaperIconButton
              icon={X}
              size="sm"
              onClick={onClose}
              title="关闭"
              aria-label="关闭"
            />
          </div>
        </div>

        <DatePickerSubViews
          mode={mode}
          subView={subView}
          onChangeSubView={setSubView}
          viewMonth={viewMonth}
          yearPageStart={yearPageStart}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          selectedDate={selectedDate}
          range={range}
          minDate={minDate}
          maxDate={maxDate}
          calendarDays={calendarDays}
          onSelectYear={handleSelectYear}
          onSelectMonth={handleSelectMonth}
          onSelectDay={handleSelectDay}
          onPrevMonth={() => setViewMonth((prev) => prev.subtract(1, 'month'))}
          onNextMonth={() => setViewMonth((prev) => prev.add(1, 'month'))}
        />

        {subView === 'calendar' && mode === 'datetime' && (
          <TimeWheelPanel selectedTime={selectedTime} onChangeTime={setSelectedTime} />
        )}

        <div className="mt-3.5 flex items-center gap-2 border-t border-dashed border-(--rule-hairline)/60 pt-3">
          <PaperButton
            type="button"
            variant="sunken"
            size="md"
            className="flex-1"
            onClick={onClose}
          >
            取消
          </PaperButton>
          <PaperButton
            type="button"
            variant="primary"
            size="md"
            className="flex-1"
            onClick={handleConfirm}
          >
            确定
          </PaperButton>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaperDatePickerModal;
