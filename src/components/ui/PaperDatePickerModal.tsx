import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
const TIME_ITEM_HEIGHT = 32;

interface TimeWheelColumnProps {
  items: string[];
  selectedValue: string;
  onChange: (value: string) => void;
  labelSuffix: string;
}

const TimeWheelColumn: React.FC<TimeWheelColumnProps> = ({
  items,
  selectedValue,
  onChange,
  labelSuffix,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountRef = useRef(true);

  const selectedIndex = useMemo(() => {
    const idx = items.indexOf(selectedValue);
    return idx >= 0 ? idx : 0;
  }, [items, selectedValue]);

  const [activeIdx, setActiveIdx] = useState<number>(selectedIndex);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const targetTop = selectedIndex * TIME_ITEM_HEIGHT;

    if (isMountRef.current) {
      isMountRef.current = false;
      setActiveIdx(selectedIndex);
      container.scrollTop = targetTop;
      return;
    }

    setActiveIdx(selectedIndex);

    if (Math.abs(container.scrollTop - targetTop) > 16) {
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        container.scrollTop = targetTop;
      }
    }
  }, [selectedIndex]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const centerIdx = Math.max(
      0,
      Math.min(items.length - 1, Math.round(scrollTop / TIME_ITEM_HEIGHT))
    );
    if (centerIdx !== activeIdx) {
      setActiveIdx(centerIdx);
      const targetVal = items[centerIdx];
      if (targetVal && targetVal !== selectedValue) {
        onChange(targetVal);
      }
    }
  };

  const handleItemClick = (idx: number) => {
    const targetVal = items[idx];
    if (!targetVal) return;
    setActiveIdx(idx);
    onChange(targetVal);
    const container = containerRef.current;
    if (container) {
      const targetTop = idx * TIME_ITEM_HEIGHT;
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        container.scrollTop = targetTop;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-24 flex-1 snap-y snap-mandatory [scrollbar-width:none] overflow-y-auto overscroll-contain select-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="pointer-events-none h-8 shrink-0" aria-hidden="true" />
      {items.map((item, idx) => {
        const isSelected = idx === activeIdx;
        return (
          <button
            key={item}
            type="button"
            aria-label={`${item}${labelSuffix}`}
            data-selected={isSelected}
            onClick={() => handleItemClick(idx)}
            className={cn(
              'flex h-8 w-full cursor-pointer snap-center items-center justify-center font-mono text-sm',
              isSelected
                ? 'font-bold text-(--ink-solid)'
                : 'font-normal text-(--ink-tertiary)/60 hover:text-(--ink-primary)'
            )}
          >
            {item}
          </button>
        );
      })}
      <div className="pointer-events-none h-8 shrink-0" aria-hidden="true" />
    </div>
  );
};

function normalizeTimeString(rawTime?: string): string {
  if (!rawTime) return nowTime();
  const [h = '00', m = '00'] = rawTime.slice(0, 5).split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
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
      return normalizeTimeString(value.split(' ')[1]);
    }
    return nowTime();
  });

  const [range, setRange] = useState<DateRangeValue>(() => {
    if (rangeValue) return rangeValue;
    const today = todayDate();
    return { start: today, end: today };
  });

  const [isSelectingEnd, setIsSelectingEnd] = useState(false);

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
        if (parts[1]) {
          setSelectedTime(normalizeTimeString(parts[1]));
        } else {
          setSelectedTime(nowTime());
        }
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

    if (mode !== 'month') {
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

  if (!mounted || !isOpen) {
    return null;
  }

  const [rawH = '00', rawM = '00'] = selectedTime.split(':');
  const curH = rawH.padStart(2, '0');
  const curM = rawM.padStart(2, '0');

  const handleSelectHour = (newH: string) => {
    setSelectedTime((prev) => {
      const parts = prev.split(':');
      const minute = (parts[1] || '00').padStart(2, '0');
      return `${newH.padStart(2, '0')}:${minute}`;
    });
  };

  const handleSelectMinute = (newM: string) => {
    setSelectedTime((prev) => {
      const parts = prev.split(':');
      const hour = (parts[0] || '00').padStart(2, '0');
      return `${hour}:${newM.padStart(2, '0')}`;
    });
  };

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
        <div className="flex [scrollbar-width:none] items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => {
              setRange({ start: addDaysToToday(-6), end: todayDate() });
              setIsSelectingEnd(false);
            }}
            className="shrink-0 cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
          >
            最近7天
          </button>
          <button
            type="button"
            onClick={() => {
              setRange({ start: addDaysToToday(-29), end: todayDate() });
              setIsSelectingEnd(false);
            }}
            className="shrink-0 cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
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
            className="shrink-0 cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
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
            className="shrink-0 cursor-pointer rounded-(--badge-radius) bg-(--paper-sunken)/70 px-2 py-0.5 font-mono text-[11px] text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
          >
            上月
          </button>
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
              </>
            )}
            {subView === 'month' && (
              <>
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

        {subView === 'year' && (
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
          <div>
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
                      onClick={() => handleSelectDay(dateStr)}
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

            {mode === 'datetime' && (
              <div className="mt-3.5 border-t border-(--rule-hairline)/60 pt-2.5">
                <div className="flex [scrollbar-width:none] items-center gap-1 overflow-x-auto pb-2 select-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                      className={cn(
                        'shrink-0 cursor-pointer rounded-(--badge-radius) px-2.5 py-0.5 font-mono text-[11px] transition-colors',
                        preset !== '现在' && selectedTime === preset
                          ? 'bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg)'
                          : 'bg-(--paper-sunken)/70 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)'
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="relative flex h-24 w-full items-center overflow-hidden rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sunken)/30 select-none">
                  <div
                    className="pointer-events-none absolute inset-x-0 top-8 h-8 border-y border-dashed border-(--rule-hairline) bg-(--paper-sheet)/40"
                    aria-hidden="true"
                  />

                  <div
                    className="flex size-full items-center"
                    style={{
                      maskImage:
                        'linear-gradient(to bottom, transparent 0%, black 28%, black 72%, transparent 100%)',
                      WebkitMaskImage:
                        'linear-gradient(to bottom, transparent 0%, black 28%, black 72%, transparent 100%)',
                    }}
                  >
                    <TimeWheelColumn
                      items={COMMON_HOURS}
                      selectedValue={curH}
                      onChange={handleSelectHour}
                      labelSuffix="时"
                    />

                    <div className="flex h-full w-4 shrink-0 items-center justify-center font-mono text-sm font-bold text-(--ink-tertiary) select-none">
                      :
                    </div>

                    <TimeWheelColumn
                      items={ALL_MINUTES}
                      selectedValue={curM}
                      onChange={handleSelectMinute}
                      labelSuffix="分"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
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
