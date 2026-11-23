import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CaretLeftIcon as CaretLeft,
  CaretRightIcon as CaretRight,
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

export type DatePickerMode = 'date' | 'datetime' | 'range';

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

const COMMON_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const COMMON_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function getDefaultTitle(mode: DatePickerMode, customTitle?: string): string {
  if (customTitle) return customTitle;
  if (mode === 'range') return '选择日期范围';
  if (mode === 'datetime') return '选择日期与时间';
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
    const val = value ? value.split(' ')[0] : todayDate();
    const parsed = parseLocalDate(val);
    return parsed.isValid() ? parsed : dayjs();
  }, [mode, rangeValue, value]);

  const [viewMonth, setViewMonth] = useState<Dayjs>(initialDate);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (mode === 'range') return rangeValue?.start || todayDate();
    return value ? value.split(' ')[0] || todayDate() : todayDate();
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'range' && rangeValue) {
        setRange(rangeValue);
        const p = parseLocalDate(rangeValue.start);
        if (p.isValid()) setViewMonth(p);
        setIsSelectingEnd(false);
      } else if (value) {
        const parts = value.split(' ');
        setSelectedDate(parts[0] || todayDate());
        if (parts[1]) setSelectedTime(parts[1]);
        const p = parseLocalDate(parts[0] || todayDate());
        if (p.isValid()) setViewMonth(p);
      } else {
        setSelectedDate(todayDate());
        setSelectedTime(nowTime());
        setViewMonth(dayjs());
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

  const handleConfirm = () => {
    if (mode === 'range') {
      onRangeChange?.(range);
    } else if (mode === 'datetime') {
      onChange?.(`${selectedDate} ${selectedTime}`);
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
              {mode === 'datetime' && (
                <span>
                  {selectedDate} {selectedTime}
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

          {mode === 'date' && (
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
            </>
          )}
        </div>

        {activeTab === 'date' ? (
          <div className="mt-1">
            <div className="flex items-center justify-between px-1 py-1.5 select-none">
              <span className="font-mono text-xs font-semibold text-(--ink-solid)">
                {viewMonth.format('YYYY年M月')}
              </span>
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
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1 select-none">
                  {COMMON_HOURS.map((h) => {
                    const [curH] = selectedTime.split(':');
                    const isActive = curH === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          const [, curM = '00'] = selectedTime.split(':');
                          setSelectedTime(`${h}:${curM}`);
                        }}
                        className={cn(
                          'flex h-7 cursor-pointer items-center justify-center rounded-(--radius-xs) font-mono text-xs transition-colors',
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
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1 select-none">
                  {COMMON_MINUTES.map((m) => {
                    const [, curM] = selectedTime.split(':');
                    const isActive = curM === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          const [curH = '12'] = selectedTime.split(':');
                          setSelectedTime(`${curH}:${m}`);
                        }}
                        className={cn(
                          'flex h-7 cursor-pointer items-center justify-center rounded-(--radius-xs) font-mono text-xs transition-colors',
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
