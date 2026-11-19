import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { cn } from '../../utils/cn';

export interface TrendItem {
  label: string;
  amount: number;
  percentage: number;
}

export interface MonthlyTrendBarProps {
  title: string;
  trends: TrendItem[];
  className?: string;
  onStepPrev?: () => void;
  onStepNext?: () => void;
  canStepNext?: boolean;
}

export const MonthlyTrendBar: React.FC<MonthlyTrendBarProps> = ({
  title,
  trends,
  className,
  onStepPrev,
  onStepNext,
  canStepNext = false,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(() => Math.max(0, trends.length - 1));
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  if (trends.length === 0) {
    return null;
  }

  const activeIdx = Math.min(Math.max(0, selectedIdx), trends.length - 1);
  const activeItem = trends[activeIdx] || trends[trends.length - 1];

  const maxAmount = Math.max(...trends.map((t) => t.amount), 1);

  const svgWidth = 360;
  const svgHeight = 144;
  const paddingLeft = 24;
  const paddingRight = 24;
  const paddingTop = 22;
  const paddingBottom = 26;

  const plotW = svgWidth - paddingLeft - paddingRight;
  const plotH = svgHeight - paddingTop - paddingBottom;
  const baseY = svgHeight - paddingBottom;

  const colW = plotW / trends.length;
  const barW = Math.min(20, Math.max(12, Math.round(colW * 0.38)));

  const pointsData = trends.map((t, idx) => {
    const cx = paddingLeft + (idx + 0.5) * colW;
    const ratio = maxAmount > 0 ? t.amount / maxAmount : 0;
    const barH = t.amount > 0 ? Math.max(4, Math.round(ratio * (plotH - 10))) : 2;
    const barY = baseY - barH;
    const barX = cx - barW / 2;
    const cy = t.amount > 0 ? barY : baseY;
    return { cx, cy, barX, barY, barH, item: t, idx };
  });

  const polylinePoints = pointsData.map((p) => `${p.cx},${p.cy}`).join(' ');

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 35) {
      if (deltaX > 0) {
        onStepPrev?.();
      } else if (deltaX < 0 && canStepNext) {
        onStepNext?.();
      }
    }
  };

  return (
    <div
      className={cn(
        'w-full p-3.5 sm:p-4 bg-(--paper-sheet) paper-card border border-(--rule-hairline) select-none transition-all duration-200 rounded-(--radius-md) shadow-xs',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2 select-none">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-(--ink-primary) tracking-tight">
            {title}
          </span>
          {(onStepPrev || onStepNext) && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onStepPrev}
                className="w-5.5 h-5.5 flex items-center justify-center border border-(--rule-hairline) rounded-(--btn-radius) bg-(--paper-base) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 transition-all cursor-pointer font-mono shadow-2xs"
                title="上个月"
                aria-label="上个月"
              >
                <ChevronLeft className="w-3 h-3 stroke-2" />
              </button>
              <button
                type="button"
                onClick={onStepNext}
                disabled={!canStepNext}
                className={cn(
                  'w-5.5 h-5.5 flex items-center justify-center border border-(--rule-hairline) rounded-(--btn-radius) bg-(--paper-base) text-(--ink-secondary) font-mono shadow-2xs transition-all',
                  canStepNext
                    ? 'hover:text-(--ink-primary) hover:bg-(--paper-sunken) active:scale-95 cursor-pointer'
                    : 'opacity-35 cursor-not-allowed pointer-events-none'
                )}
                title="下个月"
                aria-label="下个月"
              >
                <ChevronRight className="w-3 h-3 stroke-2" />
              </button>
            </div>
          )}
        </div>
        {activeItem && (
          <div className="font-mono text-xs text-(--ink-secondary) flex items-center gap-1.5">
            <span className="text-(--ink-tertiary)">{activeItem.label}</span>
            <strong className="text-(--ink-solid) font-bold tabular-nums">
              ¥{centsToYuan(activeItem.amount)}
            </strong>
          </div>
        )}
      </div>

      <div
        className="w-full relative touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Reference baseline and gridlines */}
          <line
            x1={paddingLeft - 6}
            y1={baseY}
            x2={svgWidth - paddingRight + 6}
            y2={baseY}
            stroke="var(--rule-hairline)"
            strokeWidth="1"
          />
          <line
            x1={paddingLeft - 6}
            y1={baseY - (plotH - 10) * 0.5}
            x2={svgWidth - paddingRight + 6}
            y2={baseY - (plotH - 10) * 0.5}
            stroke="var(--rule-hairline)"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.5"
          />

          {/* Background sunken slots & vertical bars */}
          {pointsData.map((p) => {
            const isSelected = p.idx === activeIdx;
            return (
              <g key={`bar-${p.idx}`}>
                <rect
                  x={p.barX}
                  y={paddingTop}
                  width={barW}
                  height={plotH}
                  rx="4"
                  fill="var(--paper-sunken)"
                  opacity="0.5"
                />
                <rect
                  x={p.barX}
                  y={p.barY}
                  width={barW}
                  height={p.barH}
                  rx="4"
                  fill="var(--color-expense)"
                  opacity={isSelected ? 1 : 0.45}
                  className="transition-all duration-200"
                />
              </g>
            );
          })}

          {/* Polyline trend line overlay */}
          <polyline
            points={polylinePoints}
            fill="none"
            stroke="var(--ink-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.8"
          />

          {/* Points, halos and text amounts */}
          {pointsData.map((p) => {
            const isSelected = p.idx === activeIdx;
            return (
              <g key={`point-${p.idx}`}>
                {isSelected && (
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={7}
                    fill="none"
                    stroke="var(--ink-solid)"
                    strokeWidth="1"
                    opacity="0.4"
                  />
                )}
                <circle
                  cx={p.cx}
                  cy={p.cy}
                  r={isSelected ? 4 : 2.8}
                  fill="var(--paper-sheet)"
                  stroke={isSelected ? 'var(--ink-solid)' : 'var(--ink-secondary)'}
                  strokeWidth={isSelected ? 2.2 : 1.6}
                  className="transition-all duration-150"
                />
                <text
                  x={p.cx}
                  y={Math.max(12, p.cy - 6)}
                  textAnchor="middle"
                  className={cn(
                    'text-[9px] font-mono tabular-nums transition-colors',
                    isSelected ? 'fill-(--ink-solid) font-bold' : 'fill-(--ink-tertiary) font-normal'
                  )}
                >
                  ¥{centsToYuan(p.item.amount)}
                </text>
                <text
                  x={p.cx}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  className={cn(
                    'text-[11px] font-mono transition-colors',
                    isSelected ? 'fill-(--ink-solid) font-bold' : 'fill-(--ink-tertiary) font-normal'
                  )}
                >
                  {p.item.label}
                </text>
                {/* Transparent column tap hit-box */}
                <rect
                  x={paddingLeft + p.idx * colW}
                  y={0}
                  width={colW}
                  height={svgHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => setSelectedIdx(p.idx)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default MonthlyTrendBar;
