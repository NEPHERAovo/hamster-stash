import React, { useRef, useEffect, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { dayjs, parseLocalDate } from '../../utils/date';

export interface DrumWheelPickerProps {
  dateStr: string; // 'YYYY-MM-DD'
  timeStr: string; // 'HH:MM'
  onChangeDate: (date: string) => void;
  onChangeTime: (time: string) => void;
}

interface Item {
  label: string;
  value: string;
}

const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const generateDateItems = (selectedDate: string): Item[] => {
  const items: Item[] = [];
  const today = dayjs().startOf('day');
  const parsedSel = selectedDate ? parseLocalDate(selectedDate).startOf('day') : today;
  const sel = parsedSel.isValid() ? parsedSel : today;

  const minFromToday = today.subtract(45, 'day');
  const minFromSel = sel.subtract(15, 'day');
  const start = minFromSel.isBefore(minFromToday) ? minFromSel : minFromToday;

  const maxFromToday = today.add(15, 'day');
  const maxFromSel = sel.add(15, 'day');
  const end = maxFromSel.isAfter(maxFromToday) ? maxFromSel : maxFromToday;

  let cur = start;
  while (!cur.isAfter(end)) {
    const val = cur.format('YYYY-MM-DD');
    const week = WEEK_NAMES[cur.day()];
    items.push({ label: `${cur.format('MM-DD')} ${week}`, value: val });
    cur = cur.add(1, 'day');
  }
  return items;
};

const HOUR_ITEMS: Item[] = Array.from({ length: 24 }, (_, i) => {
  const val = String(i).padStart(2, '0');
  return { label: val, value: val };
});

const MINUTE_ITEMS: Item[] = Array.from({ length: 60 }, (_, i) => {
  const val = String(i).padStart(2, '0');
  return { label: val, value: val };
});

interface WheelColumnProps {
  items: Item[];
  selectedValue: string;
  onSelect: (value: string) => void;
  className?: string;
}

const WheelColumn: React.FC<WheelColumnProps> = ({
  items,
  selectedValue,
  onSelect,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef(false);

  useEffect(() => {
    const idx = items.findIndex((it) => it.value === selectedValue);
    if (idx !== -1 && containerRef.current) {
      const targetScroll = idx * 32;
      if (Math.abs(containerRef.current.scrollTop - targetScroll) > 1) {
        isProgrammaticScrollRef.current = true;
        containerRef.current.scrollTo({
          top: targetScroll,
          behavior: 'smooth',
        });
        const timer = window.setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 300);
        return () => window.clearTimeout(timer);
      }
    }
  }, [selectedValue, items]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScrollRef.current) return;
    const container = e.currentTarget;
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      const scrollTop = container.scrollTop;
      const idx = Math.round(scrollTop / 32);
      const clampedIdx = Math.max(0, Math.min(items.length - 1, idx));
      const target = items[clampedIdx];
      if (target && target.value !== selectedValue) {
        onSelect(target.value);
      }
    }, 60);
  };

  const handleClickItem = (val: string, index: number) => {
    onSelect(val);
    if (containerRef.current) {
      isProgrammaticScrollRef.current = true;
      containerRef.current.scrollTo({
        top: index * 32,
        behavior: 'smooth',
      });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 300);
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn(
        'h-24 snap-y snap-mandatory [scrollbar-width:none] overflow-y-auto select-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      <div className="pointer-events-none h-8 shrink-0" />

      {items.map((it, idx) => {
        const isSelected = it.value === selectedValue;
        return (
          <div
            key={it.value}
            onClick={() => handleClickItem(it.value, idx)}
            className={cn(
              'flex h-8 cursor-pointer snap-center items-center justify-center transition-all duration-150',
              isSelected
                ? 'font-mono text-xs font-bold text-(--ink-solid)'
                : 'font-mono text-[11px] text-(--ink-tertiary)/70 hover:text-(--ink-secondary)'
            )}
          >
            {it.label}
          </div>
        );
      })}

      <div className="pointer-events-none h-8 shrink-0" />
    </div>
  );
};

export const DrumWheelPicker: React.FC<DrumWheelPickerProps> = ({
  dateStr,
  timeStr,
  onChangeDate,
  onChangeTime,
}) => {
  const [curHour, curMinute] = useMemo(() => {
    const parts = (timeStr || '12:00').split(':');
    return [parts[0] || '12', parts[1] || '00'];
  }, [timeStr]);

  const dateItems = useMemo(() => generateDateItems(dateStr), [dateStr]);

  const handleSelectHour = (newHour: string) => {
    onChangeTime(`${newHour}:${curMinute}`);
  };

  const handleSelectMinute = (newMinute: string) => {
    onChangeTime(`${curHour}:${newMinute}`);
  };

  return (
    <div data-drum-wheel="true" className="relative my-1 h-24 w-full overflow-hidden select-none">
      <div
        className="flex size-full"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 28%, black 72%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 28%, black 72%, transparent 100%)',
        }}
      >
        <div className="w-1/2">
          <WheelColumn
            items={dateItems}
            selectedValue={dateStr}
            onSelect={onChangeDate}
          />
        </div>

        <div className="w-1/4">
          <WheelColumn
            items={HOUR_ITEMS}
            selectedValue={curHour}
            onSelect={handleSelectHour}
          />
        </div>

        <div className="w-1/4">
          <WheelColumn
            items={MINUTE_ITEMS}
            selectedValue={curMinute}
            onSelect={handleSelectMinute}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-8 flex h-8 items-center border-y border-dashed border-(--rule-hairline)">
        <div className="w-1/2" />
        <div className="relative flex w-1/4 items-center justify-end">
          <span className="absolute -right-0.5 font-mono text-xs leading-none font-bold text-(--ink-tertiary)">
            :
          </span>
        </div>
        <div className="w-1/4" />
      </div>
    </div>
  );
};

export default DrumWheelPicker;
