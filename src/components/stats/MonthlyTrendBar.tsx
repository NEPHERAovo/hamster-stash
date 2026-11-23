import React, { useState, useRef } from 'react';
import { CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight } from '@phosphor-icons/react';
import { PaperIconButton } from '../ui/PaperIconButton';
import { SegToggle } from '../ui/SegToggle';
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
  barColor?: string;
  dimension?: 'expense' | 'income' | 'balance';
  onDimensionChange?: (dim: 'expense' | 'income' | 'balance') => void;
}

export const MonthlyTrendBar: React.FC<MonthlyTrendBarProps> = ({
  title,
  trends,
  className,
  onStepPrev,
  onStepNext,
  canStepNext = false,
  barColor = 'var(--color-expense)',
  dimension,
  onDimensionChange,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(() => Math.max(0, trends.length - 1));
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  if (trends.length === 0) {
    return null;
  }

  const activeIdx = Math.min(Math.max(0, selectedIdx), trends.length - 1);

  const maxAmount = Math.max(...trends.map((t) => t.amount), 0);
  const minAmount = Math.min(...trends.map((t) => t.amount), 0);
  const hasNegative = minAmount < 0;

  const svgWidth = 360;
  const svgHeight = 144;
  const paddingLeft = 24;
  const paddingRight = 24;
  const paddingTop = 22;
  const paddingBottom = 26;

  const plotW = svgWidth - paddingLeft - paddingRight;
  const plotH = svgHeight - paddingTop - paddingBottom;
  
  const totalRange = hasNegative ? (maxAmount - minAmount) || 1 : maxAmount || 1;
  const baseY = hasNegative
    ? paddingTop + (maxAmount / totalRange) * (plotH - 6)
    : svgHeight - paddingBottom;

  const colW = plotW / trends.length;
  const barW = Math.min(20, Math.max(12, Math.round(colW * 0.38)));

  const pointsData = trends.map((t, idx) => {
    const cx = paddingLeft + (idx + 0.5) * colW;
    let barH = 2;
    let barY = baseY;
    let pointColor = barColor;

    if (hasNegative) {
      if (t.amount > 0) {
        barH = Math.max(3, Math.round((t.amount / totalRange) * (plotH - 6)));
        barY = baseY - barH;
        pointColor = 'var(--color-income)';
      } else if (t.amount < 0) {
        barH = Math.max(3, Math.round((Math.abs(t.amount) / totalRange) * (plotH - 6)));
        barY = baseY;
        pointColor = 'var(--color-expense)';
      }
    } else {
      const ratio = maxAmount > 0 ? t.amount / maxAmount : 0;
      barH = t.amount > 0 ? Math.max(4, Math.round(ratio * (plotH - 10))) : 2;
      barY = baseY - barH;
    }

    let cy = baseY;
    if (t.amount > 0) {
      cy = barY;
    } else if (t.amount < 0) {
      cy = barY + barH;
    }
    return { cx, cy, barX: cx - barW / 2, barY, barH, item: t, idx, pointColor };
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
        'paper-card w-full rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3.5 shadow-xs transition-all duration-200 select-none sm:p-4',
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 select-none">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold tracking-tight text-(--ink-primary)">
            {title}
          </span>
          {(onStepPrev || onStepNext) && (
            <div className="flex shrink-0 items-center gap-0.5">
              <PaperIconButton
                size="sm"
                icon={ChevronLeft}
                onClick={onStepPrev}
                title="上个月"
                aria-label="上个月"
              />
              <PaperIconButton
                size="sm"
                icon={ChevronRight}
                onClick={onStepNext}
                disabled={!canStepNext}
                title="下个月"
                aria-label="下个月"
              />
            </div>
          )}
        </div>

        {onDimensionChange && dimension && (
          <div className="shrink-0">
            <SegToggle
              options={[
                { value: 'expense', label: '支出' },
                { value: 'income', label: '收入' },
                { value: 'balance', label: '结余' },
              ]}
              value={dimension}
              onChange={(d) => onDimensionChange(d as 'expense' | 'income' | 'balance')}
              size="sm"
              fullWidth={false}
            />
          </div>
        )}
      </div>

      <div
        className="relative w-full touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-auto w-full overflow-visible select-none"
        >
          {/* Reference baseline and gridlines */}
          <line
            x1={paddingLeft - 6}
            y1={baseY}
            x2={svgWidth - paddingRight + 6}
            y2={baseY}
            stroke="var(--rule-hairline)"
            strokeWidth="1"
            strokeDasharray={hasNegative ? '3 3' : undefined}
          />
          {!hasNegative && (
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
          )}

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
                  fill={hasNegative ? p.pointColor : barColor}
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
                    'font-mono text-[9px] tabular-nums transition-colors',
                    isSelected ? 'fill-(--ink-solid) font-bold' : 'fill-(--ink-tertiary) font-normal'
                  )}
                >
                  {p.item.amount < 0
                    ? `-¥${centsToYuan(Math.abs(p.item.amount))}`
                    : `¥${centsToYuan(p.item.amount)}`}
                </text>
                <text
                  x={p.cx}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  className={cn(
                    'font-mono text-[11px] transition-colors',
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
