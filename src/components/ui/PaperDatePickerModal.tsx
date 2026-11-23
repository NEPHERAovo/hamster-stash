import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CaretLeftIcon as CaretLeft,
  CaretRightIcon as CaretRight,
  CaretDownIcon as CaretDown,
  XIcon as X,
  CalendarBlankIcon as CalendarIcon,
  ClockIcon,
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

const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTHS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
];

const COMMON_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const ALL_MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function getDefaultTitle(mode: DatePickerMode, customTitle?: string): string {
  if (customTitle) return customTitle;
  if (mode === 'range') return '选择日期范围';
  if (mode === 'datetime') return '选择日期与时间';
  if (mode === 'month') return '选择月份';
  if (mode === 'year') return '选择年份';
  return '选择日期';
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
      const val = value ? `${value}-01` : todayDate();
      const parsed = parseLocalDate(val);
      return parsed.isValid() ? parsed : dayjs();
    }
    if (mode === 'year') {
      const val = value ? `${value}-01-01` : todayDate();
      const parsed = parseLocalDate(val);
      return parsed.isValid() ? parsed : dayjs();
    }
    const val = value ? value.split(' ')[0] : todayDate();
    const parsed = parseLocalDate(val);
    return parsed.isValid() ? parsed : dayjs();
  }, [mode, rangeValue, value]);

  const [viewMonth, setViewMonth] = useState<Dayjs>(initialDate);
  const [subView, setSubView] = useState<'calendar' | 'month' | 'year'>(() => {
    if (mode === 'month') return 'month';
    if (mode === 'year') return 'year';
    return 'calendar';
  });

  const [yearPageStart, setYearPageStart] = useState<number>(() => {
    const y = initialDate.year();
    return Math.floor(y / 12) * 12;
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (mode === 'range') return rangeValue?.start || todayDate();
    return value ? value.split(' ')[0] || todayDate() : todayDate();
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (mode === 'month' && value) return value;
    return dayjs().format('YYYY-MM');
  });

  const [selectedYear, setSelectedYear] = useState<string>(() => {
    if (mode === 'year' && value) return value;
    return dayjs().format('YYYY');
  });

  const [selectedTime, setSelectedTime] = useState<string>(() => {
    if (value && value.includes(' ')) {
      return value.split(' ')[1] || nowTime();
    }
    return nowTime();
  });

  const [range, setRange] = useState<DateRangeValue>(() => {
    if (rangeValue) return rangeValue;
    const today = todayDate();
    return { start: today, end: today };
  });

  const [isSelectingEnd, setIsSelectingEnd] = useState(false);
  const [activeTab, setActiveTab] = useState<'date' | 'time'>('date');

  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'time') {
      requestAnimationFrame(() => {
        const curH = hourListRef.current?.querySelector('[data-selected="true"]');
        curH?.scrollIntoView({ block: 'center' });
        const curM = minuteListRef.current?.querySelector('[data-selected="true"]');
        curM?.scrollIntoView({ block: 'center' });
      });
    }
  }, [activeTab]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
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
        if (parts[1]) setSelectedTime(parts[1]);
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
      setActiveTab('date');
    }
  }, [isOpen, mode, value, rangeValue]);

  useCloseWatcher({
    isOpen: mounted && isOpen,
    onClose,
  });

  const handlePrevMonth = () => {
    setViewMonth((prev) => prev.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setViewMonth((prev) => prev.add(1, 'month'));
  };

  const handlePrevYear = () => {
    setViewMonth((prev) => prev.subtract(1, 'year'));
  };

  const handleNextYear = () => {
    setViewMonth((prev) => prev.add(1, 'year'));
  };

  const handlePrevDecade = () => {
    setYearPageStart((prev) => prev - 12);
  };

  const handleNextDecade = () => {
    setYearPageStart((prev) => prev + 12);
  };

  const calendarDays = useMemo(() => {
    const startOfMonth = viewMonth.startOf('month');
    const daysInMonth = viewMonth.daysInMonth();
    const firstDayOfWeek = (startOfMonth.day() + 6) % 7;

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    const prevMonth = viewMonth.subtract(1, 'month');
    const daysInPrevMonth = prevMonth.daysInMonth();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const dateStr = prevMonth.date(dayNum).format('YYYY-MM-DD');
      days.push({ dateStr, dayNum, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = viewMonth.date(i).format('YYYY-MM-DD');
      days.push({ dateStr, dayNum: i, isCurrentMonth: true });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    const nextMonth = viewMonth.add(1, 'month');
    for (let i = 1; i <= remaining; i++) {
      const dateStr = nextMonth.date(i).format('YYYY-MM-DD');
      days.push({ dateStr, dayNum: i, isCurrentMonth: false });
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
          if (dateStr < range.start) {
            setRange({ start: dateStr, end: range.start });
          } else {
            setRange({ start: range.start, end: dateStr });
          }
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
    const mStr = newMonth.format('YYYY-MM');
    setSelectedMonth(mStr);

    if (mode === 'month') {
      // Stay on month view
    } else {
      setSubView('calendar');
    }
  };

  const handleSelectYear = (yearNum: number) => {
    const newDate = viewMonth.year(yearNum);
    setViewMonth(newDate);
    setSelectedYear(yearNum.toString());

    if (mode === 'year') {
      // Stay on year view
    } else if (mode === 'month') {
      setSubView('month');
    } else {
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

  const rangeDaysCount = useMemo(() => {
    if (mode !== 'range') return 0;
    const s = parseLocalDate(range.start);
    const e = parseLocalDate(range.end);
    if (!s.isValid() || !e.isValid()) return 1;
    return Math.max(1, e.diff(s, 'day') + 1);
  }, [mode, range]);

  if (!mounted || !isOpen) {
    return null;
  }

  const defaultTitle = getDefaultTitle(mode, title);

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
        <div className="flex items-start justify-between gap-2 border-b border-dashed border-(--rule-hairline)/60 pb-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold tracking-tight text-(--ink-primary)">
              {defaultTitle}
            </h3>
            <div className="mt-0.5 font-mono text-xs text-(--ink-secondary)">
              {mode === 'range' && (
                <span>
                  {range.start} 至 {range.end}{' '}
                  <span className="text-(--ink-tertiary)">({rangeDaysCount}天)</span>
                </span>
              )}
              {mode === 'date' && <span>{selectedDate}</span>}
              {mode === 'month' && <span>{selectedMonth}</span>}
              {mode === 'year' && <span>{selectedYear}年</span>}
              {mode === 'datetime' && (
                <span className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('date')}
                    className={cn(
                      'cursor-pointer underline-offset-2 hover:underline',
                      activeTab === 'date'
                        ? 'font-bold text-(--ink-primary)'
                        : 'text-(--ink-secondary)'
                    )}
                  >
                    {selectedDate}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('time')}
                    className={cn(
                      'cursor-pointer underline-offset-2 hover:underline',
                      activeTab === 'time'
                        ? 'font-bold text-(--ink-primary)'
                        : 'text-(--ink-secondary)'
                    )}
                  >
                    {selectedTime}
                  </button>
                </span>
              )}
            </div>
          </div>
          <PaperIconButton
            icon={X}
            size="sm"
            onClick={onClose}
            title="关闭"
            aria-label="关闭"
          />
        </div>

        {mode === 'datetime' && (
          <div className="mt-3 flex items-center justify-center gap-1 border-b border-(--rule-hairline)/40 pb-2.5">
            <PaperButton
              variant={activeTab === 'date' ? 'primary' : 'ghost'}
              size="xs"
              onClick={() => setActiveTab('date')}
              leftIcon={<CalendarIcon className="size-3.5" />}
              className="px-3"
            >
              日期
            </PaperButton>
            <PaperButton
              variant={activeTab === 'time' ? 'primary' : 'ghost'}
              size="xs"
              onClick={() => setActiveTab('time')}
              leftIcon={<ClockIcon className="size-3.5" />}
              className="px-3"
            >
              时间
            </PaperButton>
          </div>
        )}

        {subView === 'calendar' && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pb-1">
            {mode === 'range' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setRange({ start: addDaysToToday(-6), end: todayDate() });
                    setIsSelectingEnd(false);
                  }}
                  className="cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
                >
                  最近7天
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRange({ start: addDaysToToday(-29), end: todayDate() });
                    setIsSelectingEnd(false);
                  }}
                  className="cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
                >
                  最近30天
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRange({
                      start: dayjs().startOf('month').format('YYYY-MM-DD'),
                      end: dayjs().endOf('month').format('YYYY-MM-DD'),
                    });
                    setIsSelectingEnd(false);
                  }}
                  className="cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
                >
                  本月
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const lastM = dayjs().subtract(1, 'month');
                    setRange({
                      start: lastM.startOf('month').format('YYYY-MM-DD'),
                      end: lastM.endOf('month').format('YYYY-MM-DD'),
                    });
                    setIsSelectingEnd(false);
                  }}
                  className="cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
                >
                  上月
                </button>
              </>
            )}

            {(mode === 'date' || mode === 'datetime') && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(todayDate());
                    setViewMonth(dayjs());
                  }}
                  className="cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2.5 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
                >
                  今天
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const y = addDaysToToday(-1);
                    setSelectedDate(y);
                    setViewMonth(parseLocalDate(y));
                  }}
                  className="cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2.5 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
                >
                  昨天
                </button>
                {mode === 'datetime' && (
                  <button
                    type="button"
                    onClick={() => {
                      const beforeY = addDaysToToday(-2);
                      setSelectedDate(beforeY);
                      setViewMonth(parseLocalDate(beforeY));
                    }}
                    className="cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2.5 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
                  >
                    前天
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {subView === 'year' && (
          <div className="mt-2 space-y-2.5">
            <div className="flex items-center justify-between p-1 select-none">
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
                <span className="font-mono text-xs font-semibold text-(--ink-solid)">
                  {yearPageStart} – {yearPageStart + 11}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <PaperIconButton
                  icon={CaretLeft}
                  size="sm"
                  onClick={handlePrevDecade}
                  title="上一页"
                  aria-label="上一页"
                />
                <PaperIconButton
                  icon={CaretRight}
                  size="sm"
                  onClick={handleNextDecade}
                  title="下一页"
                  aria-label="下一页"
                />
              </div>
            </div>

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
                    onClick={() => handleSelectYear(y)}
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
        )}

        {subView === 'month' && (
          <div className="mt-2 space-y-2.5">
            <div className="flex items-center justify-between p-1 select-none">
              <div className="flex items-center gap-1">
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
              <div className="flex items-center gap-1">
                <PaperIconButton
                  icon={CaretLeft}
                  size="sm"
                  onClick={handlePrevYear}
                  title="上一年"
                  aria-label="上一年"
                />
                <PaperIconButton
                  icon={CaretRight}
                  size="sm"
                  onClick={handleNextYear}
                  title="下一年"
                  aria-label="下一年"
                />
              </div>
            </div>

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
                    onClick={() => handleSelectMonth(idx)}
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
        )}

        {subView === 'calendar' && (
          <>
            {activeTab === 'date' ? (
              <div className="mt-1">
                <div className="flex items-center justify-between px-1 py-1.5 select-none">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSubView('year')}
                      className="group flex cursor-pointer items-center gap-0.5 rounded-(--radius-xs) px-1.5 py-0.5 font-mono text-xs font-semibold text-(--ink-solid) hover:bg-(--paper-sunken)"
                      title="点击选择年份"
                    >
                      <span>{viewMonth.format('YYYY年')}</span>
                      <CaretDown className="size-3 text-(--ink-tertiary) transition-transform group-hover:text-(--ink-primary)" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubView('month')}
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
                      onClick={handlePrevMonth}
                      title="上个月"
                      aria-label="上个月"
                    />
                    <PaperIconButton
                      icon={CaretRight}
                      size="sm"
                      onClick={handleNextMonth}
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
                    const isInRange =
                      mode === 'range' &&
                      range.start &&
                      range.end &&
                      dateStr > range.start &&
                      dateStr < range.end;

                    const isDisabled =
                      Boolean(minDate && dateStr < minDate) ||
                      Boolean(maxDate && dateStr > maxDate);

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelectDay(dateStr)}
                        className={cn(
                          'relative flex h-8 w-full cursor-pointer items-center justify-center font-mono text-xs transition-all duration-150',
                          !isCurrentMonth && 'text-(--ink-faint) opacity-40',
                          isCurrentMonth && 'text-(--ink-primary)',
                          isSelected &&
                            'rounded-(--radius-sm) bg-(--btn-primary-bg) font-bold text-(--btn-primary-fg) shadow-2xs',
                          isRangeStart &&
                            'rounded-l-(--radius-sm) bg-(--btn-primary-bg) font-bold text-(--btn-primary-fg) shadow-2xs',
                          isRangeEnd &&
                            'rounded-r-(--radius-sm) bg-(--btn-primary-bg) font-bold text-(--btn-primary-fg) shadow-2xs',
                          isRangeStart && isRangeEnd && 'rounded-(--radius-sm)',
                          isInRange && 'bg-(--paper-sunken) font-medium text-(--ink-solid)',
                          isDisabled && 'pointer-events-none opacity-20'
                        )}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <div className="flex flex-wrap items-center gap-1.5 border-b border-dashed border-(--rule-hairline)/60 pb-2">
                  <span className="font-mono text-[10px] text-(--ink-tertiary)">
                    快捷时间:
                  </span>
                  {['现在', '08:00', '12:00', '18:00', '20:00'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        if (preset === '现在') {
                          setSelectedTime(nowTime());
                        } else {
                          setSelectedTime(preset);
                        }
                      }}
                      className="cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 text-center font-mono text-[11px] text-(--ink-tertiary)">
                      小时
                    </div>
                    <div
                      ref={hourListRef}
                      className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1 select-none"
                    >
                      {COMMON_HOURS.map((h) => {
                        const [curH] = selectedTime.split(':');
                        const isActive = curH === h;
                        return (
                          <button
                            key={h}
                            type="button"
                            aria-label={`${h}时`}
                            data-selected={isActive}
                            onClick={() => {
                              const [, curM = '00'] = selectedTime.split(':');
                              setSelectedTime(`${h}:${curM}`);
                            }}
                            className={cn(
                              'flex h-7 shrink-0 cursor-pointer items-center justify-center rounded-(--radius-xs) font-mono text-xs transition-colors',
                              isActive
                                ? 'bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg)'
                                : 'text-(--ink-secondary) hover:bg-(--paper-sunken)'
                            )}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-center font-mono text-[11px] text-(--ink-tertiary)">
                      分钟
                    </div>
                    <div
                      ref={minuteListRef}
                      className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1 select-none"
                    >
                      {ALL_MINUTES.map((m) => {
                        const [, curM = '00'] = selectedTime.split(':');
                        const isActive = curM === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            aria-label={`${m}分`}
                            data-selected={isActive}
                            onClick={() => {
                              const [curH = '12'] = selectedTime.split(':');
                              setSelectedTime(`${curH}:${m}`);
                            }}
                            className={cn(
                              'flex h-7 shrink-0 cursor-pointer items-center justify-center rounded-(--radius-xs) font-mono text-xs transition-colors',
                              isActive
                                ? 'bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg)'
                                : 'text-(--ink-secondary) hover:bg-(--paper-sunken)'
                            )}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-4 flex items-center justify-end gap-2 border-t border-dashed border-(--rule-hairline)/60 pt-3">
          <PaperButton variant="ghost" size="sm" onClick={onClose}>
            取消
          </PaperButton>
          <PaperButton variant="primary" size="sm" onClick={handleConfirm}>
            确定
          </PaperButton>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaperDatePickerModal;
