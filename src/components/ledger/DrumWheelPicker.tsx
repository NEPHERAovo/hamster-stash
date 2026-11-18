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
        'h-24 overflow-y-auto snap-y snap-mandatory select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
    >
      <div className="h-8 shrink-0 pointer-events-none" />

      {items.map((it, idx) => {
        const isSelected = it.value === selectedValue;
        return (
          <div
            key={it.value}
            onClick={() => handleClickItem(it.value, idx)}
            className={cn(
              'h-8 snap-center flex items-center justify-center cursor-pointer transition-all duration-150',
              isSelected
                ? 'font-mono font-bold text-xs text-(--ink-solid)'
                : 'font-mono text-[11px] text-(--ink-tertiary)/70 hover:text-(--ink-secondary)'
            )}
          >
            {it.label}
          </div>
        );
      })}

      <div className="h-8 shrink-0 pointer-events-none" />
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
    <div className="relative w-full h-24 my-1 select-none overflow-hidden">
      <div
        className="w-full h-full flex"
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

      <div className="absolute top-8 left-0 right-0 h-8 pointer-events-none border-t border-b border-dashed border-(--rule-hairline) flex items-center">
        <div className="w-1/2" />
        <div className="w-1/4 relative flex items-center justify-end">
          <span className="font-mono font-bold text-xs text-(--ink-tertiary) absolute -right-0.5 leading-none">
            :
          </span>
        </div>
        <div className="w-1/4" />
      </div>
    </div>
  );
};

export default DrumWheelPicker;
