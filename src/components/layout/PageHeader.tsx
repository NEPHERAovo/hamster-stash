import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { cn } from '../../utils/cn';

export interface PageHeaderProps {
  title: string;
  metaPill?: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  showMonthStep?: boolean;
  centerTitle?: boolean;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  metaPill,
  subtitle,
  leftAction,
  rightAction,
  onPrevMonth,
  onNextMonth,
  showMonthStep = false,
  centerTitle = false,
  className,
}) => {
  const uiStyle = useThemeStore((s) => s.uiStyle);
  const isModern = uiStyle === 'modern';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 px-4.5 pt-2.5 pb-2 flex items-center justify-between h-14 select-none transition-colors duration-200',
        isModern
          ? 'bg-transparent border-b-0'
          : 'bg-(--paper-base)/85 backdrop-blur-md border-b border-(--rule-hairline)',
        className
      )}
    >
      {centerTitle ? (
        <>
          <div className="flex items-center min-w-[36px] justify-start">
            {leftAction}
          </div>
          <div className="text-center flex-1 px-2">
            {metaPill && (
              <div className="text-[9px] font-mono tracking-wider text-(--ink-tertiary) uppercase justify-center mb-0.5">
                <span>{metaPill}</span>
              </div>
            )}
            <h1
              className={cn(
                'text-lg sm:text-xl truncate text-(--ink-solid)',
                isModern
                  ? 'font-sans font-bold tracking-tight text-(--ink-primary)'
                  : 'font-semibold'
              )}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-[10px] font-mono text-(--ink-tertiary) mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center min-w-[36px] justify-end text-(--ink-secondary)">
            {rightAction}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 sm:gap-3">
            {leftAction}
            <div>
              {metaPill && (
                <div className="text-[9px] font-mono tracking-wider text-(--ink-tertiary) uppercase mb-0.5">
                  <span>{metaPill}</span>
                </div>
              )}
              <h1
                className={cn(
                  'leading-none',
                  isModern
                    ? 'font-sans font-bold text-xl sm:text-2xl text-(--ink-primary) tracking-tight'
                    : 'font-serif not-italic text-2xl sm:text-[28px] text-(--ink-solid) tracking-normal'
                )}
              >
                {title}
              </h1>
              {subtitle && (
                <p className="text-[10px] font-mono text-(--ink-tertiary) mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {showMonthStep && (
              <>
                <button
                  type="button"
                  onClick={onPrevMonth}
                  className={cn(
                    'w-7 h-7 flex items-center justify-center border border-(--rule-hairline) text-(--ink-secondary) hover:bg-(--paper-sunken) active:scale-95 transition-all cursor-pointer',
                    isModern
                      ? 'rounded-full bg-(--paper-sheet) backdrop-blur-md shadow-xs hover:text-(--ink-primary)'
                      : 'rounded-xs bg-(--paper-base)'
                  )}
                  title="上个月"
                  aria-label="上个月"
                >
                  <ChevronLeft className="w-3.5 h-3.5 stroke-2" />
                </button>
                <button
                  type="button"
                  onClick={onNextMonth}
                  className={cn(
                    'w-7 h-7 flex items-center justify-center border border-(--rule-hairline) text-(--ink-secondary) hover:bg-(--paper-sunken) active:scale-95 transition-all cursor-pointer',
                    isModern
                      ? 'rounded-full bg-(--paper-sheet) backdrop-blur-md shadow-xs hover:text-(--ink-primary)'
                      : 'rounded-xs bg-(--paper-base)'
                  )}
                  title="下个月"
                  aria-label="下个月"
                >
                  <ChevronRight className="w-3.5 h-3.5 stroke-2" />
                </button>
              </>
            )}
            {rightAction}
          </div>
        </>
      )}
    </header>
  );
};

export default PageHeader;
