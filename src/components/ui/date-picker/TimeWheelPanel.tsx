import React, { useEffect, useMemo, useRef, useState } from 'react';
import { nowTime } from '../../../utils/date';
import { cn } from '../../../utils/cn';
import { ALL_MINUTES, COMMON_HOURS, TIME_ITEM_HEIGHT } from './datePickerUtils';

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
  const isUserScrollingRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedIndex = useMemo(() => {
    const idx = items.indexOf(selectedValue);
    return idx >= 0 ? idx : 0;
  }, [items, selectedValue]);

  const [activeIdx, setActiveIdx] = useState<number>(selectedIndex);

  useEffect(() => {
    return () => {
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const targetTop = selectedIndex * TIME_ITEM_HEIGHT;

    if (isMountRef.current) {
      isMountRef.current = false;
      setActiveIdx(selectedIndex);
      container.scrollTop = targetTop;
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = targetTop;
        }
      });
      return;
    }

    if (isUserScrollingRef.current) return;

    setActiveIdx(selectedIndex);

    if (Math.abs(container.scrollTop - targetTop) > 2) {
      isProgrammaticScrollRef.current = true;
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        container.scrollTop = targetTop;
        isProgrammaticScrollRef.current = false;
      }
    }
  }, [selectedIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScrollEnd = () => {
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
      isUserScrollingRef.current = false;
      isProgrammaticScrollRef.current = false;
      const finalIdx = Math.max(
        0,
        Math.min(items.length - 1, Math.round(container.scrollTop / TIME_ITEM_HEIGHT))
      );
      setActiveIdx(finalIdx);
      const finalVal = items[finalIdx];
      if (finalVal && finalVal !== selectedValue) {
        onChange(finalVal);
      }
    };

    container.addEventListener('scrollend', handleScrollEnd);
    return () => {
      container.removeEventListener('scrollend', handleScrollEnd);
    };
  }, [items, selectedValue, onChange]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!isProgrammaticScrollRef.current) {
      isUserScrollingRef.current = true;
    }

    if (scrollEndTimerRef.current) {
      clearTimeout(scrollEndTimerRef.current);
    }
    scrollEndTimerRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      isProgrammaticScrollRef.current = false;
      const c = containerRef.current;
      if (c) {
        const finalIdx = Math.max(
          0,
          Math.min(items.length - 1, Math.round(c.scrollTop / TIME_ITEM_HEIGHT))
        );
        setActiveIdx(finalIdx);
        const finalVal = items[finalIdx];
        if (finalVal && finalVal !== selectedValue) {
          onChange(finalVal);
        }
      }
    }, 120);

    if (isProgrammaticScrollRef.current) return;

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

  const handlePointerDown = () => {
    isProgrammaticScrollRef.current = false;
    isUserScrollingRef.current = true;
  };

  const handleWheel = () => {
    isProgrammaticScrollRef.current = false;
    isUserScrollingRef.current = true;
  };

  const handleItemClick = (idx: number) => {
    const targetVal = items[idx];
    if (!targetVal) return;
    isUserScrollingRef.current = false;
    isProgrammaticScrollRef.current = true;
    setActiveIdx(idx);
    onChange(targetVal);
    const container = containerRef.current;
    if (container) {
      const targetTop = idx * TIME_ITEM_HEIGHT;
      if (typeof container.scrollTo === 'function') {
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else {
        container.scrollTop = targetTop;
        isProgrammaticScrollRef.current = false;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      onPointerDown={handlePointerDown}
      onWheel={handleWheel}
      className="no-scrollbar h-24 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain select-none"
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
              'flex h-8 w-full cursor-pointer snap-center items-center justify-center font-mono transition-colors duration-100',
              isSelected
                ? 'text-base font-bold text-(--ink-solid)'
                : 'text-sm font-normal text-(--ink-tertiary)/60 hover:text-(--ink-primary)'
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

export interface TimeWheelPanelProps {
  selectedTime: string;
  onChangeTime: (nextTime: string) => void;
}

export const TimeWheelPanel: React.FC<TimeWheelPanelProps> = ({
  selectedTime,
  onChangeTime,
}) => {
  const [rawH = '00', rawM = '00'] = selectedTime.split(':');
  const curH = rawH.padStart(2, '0');
  const curM = rawM.padStart(2, '0');

  return (
    <div className="mt-3.5 border-t border-(--rule-hairline)/60 pt-2.5">
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto pb-2 select-none">
        {['现在', '08:00', '12:00', '18:00', '20:00'].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChangeTime(preset === '现在' ? nowTime() : preset)}
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
            onChange={(h) => onChangeTime(`${h.padStart(2, '0')}:${curM}`)}
            labelSuffix="时"
          />

          <div className="flex h-full w-4 shrink-0 items-center justify-center font-mono text-base font-bold text-(--ink-solid) select-none">
            :
          </div>

          <TimeWheelColumn
            items={ALL_MINUTES}
            selectedValue={curM}
            onChange={(m) => onChangeTime(`${curH}:${m.padStart(2, '0')}`)}
            labelSuffix="分"
          />
        </div>
      </div>
    </div>
  );
};
