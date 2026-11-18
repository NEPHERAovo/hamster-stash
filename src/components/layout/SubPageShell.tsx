import React, { useRef, useEffect, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { SubPageContext, useSubPage } from './SubPageContext';
import { cn } from '../../utils/cn';

export const SubPageBackButton: React.FC<{ label?: string }> = ({ label = '返回' }) => {
  const subPage = useSubPage();
  return (
    <button
      type="button"
      onClick={() => subPage?.requestClose()}
      className="flex items-center text-sm font-semibold text-(--ink-secondary) hover:text-(--ink-primary) cursor-pointer"
    >
      <ChevronLeft className="w-5 h-5 stroke-2" />
      <span>{label}</span>
    </button>
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
  edgeThreshold = 44,
  dismissThreshold = 80,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isClosingRef = useRef(false);
  const isTrackingRef = useRef(false);
  const isSwipingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const currentDeltaXRef = useRef(0);

  const requestClose = useCallback(() => {
    const el = containerRef.current;
    if (!el || isClosingRef.current) return;
    isClosingRef.current = true;
    el.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.transform = 'translate3d(100%, 0, 0)';
    setTimeout(() => {
      onClose();
      isClosingRef.current = false;
    }, 240);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const el = containerRef.current;
    if (!el) return;

    isClosingRef.current = false;
    el.style.transition = 'none';
    el.style.transform = 'translate3d(100%, 0, 0)';

    const animFrame = requestAnimationFrame(() => {
      el.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.transform = 'translate3d(0, 0, 0)';
    });

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [isOpen]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isOpen) return;

    const getCurrentTranslateX = (): number => {
      const transform = window.getComputedStyle(el).transform;
      if (!transform || transform === 'none') return 0;
      const matrixMatch = transform.match(/matrix.*\((.+)\)/);
      if (matrixMatch && matrixMatch[1]) {
        const parts = matrixMatch[1].split(',').map((p) => parseFloat(p.trim()));
        if (parts.length === 6 && Number.isFinite(parts[4])) {
          return parts[4];
        }
        if (parts.length === 16 && Number.isFinite(parts[12])) {
          return parts[12];
        }
      }
      return 0;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isClosingRef.current || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const rect = el.getBoundingClientRect();
      const relativeX = touch.clientX - rect.left;

      if (relativeX <= edgeThreshold) {
        const currentX = getCurrentTranslateX();
        el.style.transition = 'none';
        el.style.transform = `translate3d(${currentX}px, 0, 0)`;

        startXRef.current = touch.clientX - currentX;
        startYRef.current = touch.clientY;
        startTimeRef.current = performance.now();
        currentDeltaXRef.current = currentX;
        isTrackingRef.current = true;
        isSwipingRef.current = currentX > 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTrackingRef.current || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;

      if (!isSwipingRef.current) {
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
          isTrackingRef.current = false;
          return;
        }
        if (deltaX > 6) {
          isSwipingRef.current = true;
        }
      }

      if (isSwipingRef.current) {
        e.preventDefault();
        const clampedX = Math.max(0, deltaX);
        currentDeltaXRef.current = clampedX;
        el.style.transition = 'none';
        el.style.transform = `translate3d(${clampedX}px, 0, 0)`;
      }
    };

    const handleTouchEnd = () => {
      if (!isTrackingRef.current) return;
      isTrackingRef.current = false;

      if (!isSwipingRef.current) return;
      isSwipingRef.current = false;

      const duration = performance.now() - startTimeRef.current;
      const velocity = currentDeltaXRef.current / Math.max(1, duration);

      if (currentDeltaXRef.current > dismissThreshold || velocity > 0.35) {
        isClosingRef.current = true;
        el.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = 'translate3d(100%, 0, 0)';
        setTimeout(() => {
          onClose();
          isClosingRef.current = false;
        }, 220);
      } else {
        el.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = 'translate3d(0, 0, 0)';
      }
    };

    const handleTouchCancel = () => {
      if (!isTrackingRef.current) return;
      isTrackingRef.current = false;
      isSwipingRef.current = false;
      el.style.transition = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.transform = 'translate3d(0, 0, 0)';
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [isOpen, edgeThreshold, dismissThreshold, onClose]);

  if (!isOpen) return null;

  return (
    <SubPageContext.Provider value={{ requestClose }}>
      <div
        ref={containerRef}
        className={cn(
          'absolute inset-0 z-40 bg-(--paper-base) flex flex-col overflow-hidden will-change-transform',
          'shadow-[-8px_0_28px_rgba(0,0,0,0.12)]',
          className
        )}
      >
        <div className="grid-layer absolute! inset-0 z-0" aria-hidden="true" />
        <div className="relative z-1 shrink-0">{header}</div>
        <div className="relative z-1 flex-1 w-full min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </SubPageContext.Provider>
  );
};

export default SubPageShell;
