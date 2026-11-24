import React from 'react';
import { CaretLeftIcon as ChevronLeft, CaretRightIcon as ChevronRight } from '@phosphor-icons/react';
import { PaperIconButton } from '../ui/PaperIconButton';
import { PaperButton } from '../ui/PaperButton';
import { cn } from '../../utils/cn';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  metaPill?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  showMonthStep?: boolean;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  showBackToToday?: boolean;
  onBackToToday?: () => void;
  centerTitle?: boolean;
  onDoubleClick?: (e: React.MouseEvent<HTMLElement>) => void;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  metaPill,
  leftAction,
  rightAction,
  showMonthStep = false,
  onPrevMonth,
  onNextMonth,
  showBackToToday = false,
  onBackToToday,
  centerTitle = false,
  onDoubleClick,
  className,
}) => {
  const lastTapRef = React.useRef(0);

  const handleDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, select')) return;
    onDoubleClick?.(e);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, select')) return;
    const now = performance.now();
    if (now - lastTapRef.current < 300) {
      onDoubleClick?.(e as unknown as React.MouseEvent<HTMLElement>);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  return (
    <header
      onDoubleClick={handleDoubleClick}
      onTouchEnd={handleTouchEnd}
      className={cn(
        'sticky top-0 z-40 box-border flex min-h-[calc(3rem+var(--safe-top))] cursor-pointer items-center justify-between px-4.5 pt-[calc(0.25rem+var(--safe-top))] pb-1 transition-colors duration-200 select-none',
        'page-header-bar border-b border-(--rule-hairline) bg-(--paper-base)',
        className
      )}
    >
      {centerTitle ? (
        <>
          <div className="flex min-w-9 items-center justify-start">
            {leftAction}
          </div>
          <div className="flex-1 px-2 text-center">
            {metaPill && (
              <div className="mb-0.5 justify-center font-mono text-[9px] tracking-wider text-(--ink-tertiary) uppercase">
                <span>{metaPill}</span>
              </div>
            )}
            <h1 className="truncate text-lg font-semibold text-(--ink-solid) sm:text-xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 font-mono text-[10px] text-(--ink-tertiary)">{subtitle}</p>
            )}
          </div>
          <div className="flex min-w-9 items-center justify-end text-(--ink-secondary)">
            {rightAction}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 sm:gap-3">
            {leftAction}
            <div>
              {metaPill && (
                <div className="mb-0.5 font-mono text-[9px] tracking-wider text-(--ink-tertiary) uppercase">
                  <span>{metaPill}</span>
                </div>
              )}
              <h1 className="font-serif text-2xl leading-none tracking-tight text-(--ink-solid) not-italic sm:text-[28px]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 font-mono text-[10px] text-(--ink-tertiary)">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {showMonthStep && (
              <>
                {showBackToToday && onBackToToday && (
                  <PaperButton
                    variant="secondary"
                    size="compact"
                    onClick={onBackToToday}
                    title="回到本月"
                  >
                    本月
                  </PaperButton>
                )}
                <PaperIconButton
                  icon={ChevronLeft}
                  onClick={onPrevMonth}
                  title="上个月"
                  aria-label="上个月"
                />
                <PaperIconButton
                  icon={ChevronRight}
                  onClick={onNextMonth}
                  title="下个月"
                  aria-label="下个月"
                />
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
