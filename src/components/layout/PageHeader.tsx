import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  return (
    <header
      className={cn(
        'sticky top-0 z-40 px-4.5 pt-2.5 pb-2 bg-(--paper-base)/85 backdrop-blur-md border-b border-(--rule-hairline) flex items-center justify-between h-14 select-none',
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
            <h1 className="font-semibold text-lg sm:text-xl truncate text-(--ink-solid)">
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
              <h1 className="font-serif not-italic text-2xl sm:text-[28px] text-(--ink-solid) leading-none tracking-normal">
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
                  className="w-7 h-7 flex items-center justify-center rounded-xs border border-(--rule-hairline) bg-(--paper-base) text-(--ink-secondary) hover:bg-(--paper-sunken) active:scale-95 transition-all cursor-pointer"
                  title="上个月"
                  aria-label="上个月"
                >
                  <ChevronLeft className="w-3.5 h-3.5 stroke-2" />
                </button>
                <button
                  type="button"
                  onClick={onNextMonth}
                  className="w-7 h-7 flex items-center justify-center rounded-xs border border-(--rule-hairline) bg-(--paper-base) text-(--ink-secondary) hover:bg-(--paper-sunken) active:scale-95 transition-all cursor-pointer"
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
