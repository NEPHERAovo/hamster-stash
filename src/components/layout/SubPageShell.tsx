import React, { useRef, useCallback } from 'react';
import { CaretLeftIcon as ChevronLeft } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { SubPageContext, useSubPage } from './SubPageContext';
import { PaperButton } from '../ui/PaperButton';
import { useEdgeSwipeGesture } from '../../hooks/useEdgeSwipeGesture';

export const SubPageBackButton: React.FC<{ label?: string }> = ({ label = '返回' }) => {
  const subPage = useSubPage();
  return (
    <PaperButton
      variant="nav"
      size="flush"
      leftIcon={<ChevronLeft className="-ml-1 size-4.5 stroke-2" />}
      onClick={() => subPage?.requestClose()}
    >
      {label}
    </PaperButton>
  );
};

export interface SubPageShellProps {
  isOpen: boolean;
  onClose: () => void;
  header: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  edgeThreshold?: number;
  dismissThreshold?: number;
}

export const SubPageShell: React.FC<SubPageShellProps> = ({
  isOpen,
  onClose,
  header,
  children,
  className,
  edgeThreshold = 36,
  dismissThreshold = 80,
}) => {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastHeaderTapRef = useRef(0);
  const { containerRef, shouldRender, requestClose } = useEdgeSwipeGesture({
    isOpen,
    onClose,
    edgeThreshold,
    dismissThreshold,
  });

  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!shouldRender) return null;

  const handleHeaderDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, select')) return;
    scrollToTop();
  };

  const handleHeaderTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, select')) return;
    const now = performance.now();
    if (now - lastHeaderTapRef.current < 300) {
      scrollToTop();
      lastHeaderTapRef.current = 0;
    } else {
      lastHeaderTapRef.current = now;
    }
  };

  return (
    <SubPageContext.Provider value={{ requestClose, scrollToTop }}>
      <div
        ref={containerRef}
        onAnimationEnd={(e) => {
          if (e.animationName === 'subpageSlideIn' && containerRef.current) {
            containerRef.current.classList.remove('subpage-slide-in');
            containerRef.current.style.transform = 'translate3d(0, 0, 0)';
          }
        }}
        className={cn(
          'subpage-slide-in absolute inset-0 z-40 flex touch-pan-y flex-col overflow-hidden bg-(--paper-base) will-change-transform',
          'shadow-[-8px_0_28px_rgba(0,0,0,0.12)]',
          className
        )}
      >
        <div className="grid-layer absolute! inset-0 z-0" aria-hidden="true" />
        {header && (
          <div
            className="relative z-1 shrink-0 cursor-pointer select-none"
            onDoubleClick={handleHeaderDoubleClick}
            onTouchEnd={handleHeaderTouchEnd}
          >
            {header}
          </div>
        )}
        <div
          ref={contentRef}
          className="relative z-1 min-h-0 w-full flex-1 overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
      </div>
    </SubPageContext.Provider>
  );
};

export default SubPageShell;
