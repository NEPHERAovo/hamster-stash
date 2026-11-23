import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CaretLeftIcon as ChevronLeft } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { SubPageContext, useSubPage } from './SubPageContext';
import { PaperButton } from '../ui/PaperButton';
import { useCloseWatcher } from '../../hooks/useCloseWatcher';
import {
  GestureSmoother,
  SPRING_OUT_EASE,
  VelocityTracker,
  computeSettleDuration,
  rubberBand,
  shouldDismissGesture,
} from '../../utils/gesturePhysics';

export const SubPageBackButton: React.FC<{ label?: string }> = ({ label = '返回' }) => {
  const subPage = useSubPage();
  return (
    <PaperButton
      variant="nav"
      size="compact"
      leftIcon={<ChevronLeft className="size-4.5 stroke-2" />}
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const isClosingRef = useRef(false);
  const isTrackingRef = useRef(false);
  const isSwipingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentDeltaXRef = useRef(0);
  const smootherRef = useRef<GestureSmoother | null>(null);
  const velocityRef = useRef(new VelocityTracker(100));

  if (isOpen && !shouldRender) {
    setShouldRender(true);
  }

  const requestClose = useCallback(() => {
    const el = containerRef.current;
    if (!el || isClosingRef.current) return;
    isClosingRef.current = true;
    smootherRef.current?.stop();
    el.classList.remove('subpage-slide-in');
    el.style.transition = `transform 240ms ${SPRING_OUT_EASE}, box-shadow 240ms ease`;
    el.style.transform = 'translate3d(100%, 0, 0)';
    el.style.boxShadow = 'none';
    setTimeout(() => {
      onClose();
      setShouldRender(false);
      isClosingRef.current = false;
    }, 240);
  }, [onClose]);

  useCloseWatcher({
    isOpen: shouldRender && !isClosingRef.current,
    onClose: requestClose,
  });

  useEffect(() => {
    if (!isOpen && shouldRender && !isClosingRef.current) {
      const el = containerRef.current;
      if (!el) {
        setShouldRender(false);
        return;
      }
      isClosingRef.current = true;
      el.classList.remove('subpage-slide-in');
      el.style.transition = `transform 240ms ${SPRING_OUT_EASE}, box-shadow 240ms ease`;
      el.style.transform = 'translate3d(100%, 0, 0)';
      el.style.boxShadow = 'none';
      const timer = setTimeout(() => {
        setShouldRender(false);
        isClosingRef.current = false;
      }, 240);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !shouldRender) return;

    const smoother = new GestureSmoother((smoothedX) => {
      if (isClosingRef.current) return;
      const clampedX = Math.max(0, smoothedX);
      const width = Math.max(1, el.getBoundingClientRect().width);
      const progress = Math.max(0, Math.min(1, clampedX / width));
      const shadowAlpha = (0.12 * (1 - progress * 0.85)).toFixed(3);
      el.style.transform = `translate3d(${clampedX}px, 0, 0)`;
      el.style.boxShadow = `-8px 0 28px rgba(0,0,0,${shadowAlpha})`;
    }, 0, 26);
    smootherRef.current = smoother;

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
        if (el.classList.contains('subpage-slide-in')) {
          el.classList.remove('subpage-slide-in');
        }
        const currentX = getCurrentTranslateX();
        el.style.transition = 'none';
        el.style.transform = `translate3d(${currentX}px, 0, 0)`;

        startXRef.current = touch.clientX - currentX;
        startYRef.current = touch.clientY;
        currentDeltaXRef.current = currentX;
        smoother.reset(currentX);
        velocityRef.current.reset(currentX, performance.now());
        isTrackingRef.current = true;
        isSwipingRef.current = currentX > 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTrackingRef.current || e.touches.length !== 1 || isClosingRef.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;

      if (!isSwipingRef.current) {
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 6) {
          isTrackingRef.current = false;
          return;
        }
        if (deltaX > 6) {
          isSwipingRef.current = true;
          el.style.transition = 'none';
        }
      }

      if (isSwipingRef.current) {
        if (e.cancelable) {
          e.preventDefault();
        }
        const mappedX = deltaX >= 0 ? deltaX : rubberBand(deltaX, 60, 0.22);
        currentDeltaXRef.current = mappedX;
        velocityRef.current.push(mappedX, performance.now());
        smoother.setTarget(mappedX);
      }
    };

    const handleTouchEnd = () => {
      if (!isTrackingRef.current) return;
      isTrackingRef.current = false;

      if (!isSwipingRef.current || isClosingRef.current) return;
      isSwipingRef.current = false;

      smoother.stop();
      const width = Math.max(1, el.getBoundingClientRect().width);
      const velocity = velocityRef.current.getVelocity(performance.now());
      const dist = smoother.getCurrent();

      if (shouldDismissGesture(dist, velocity, Math.max(dismissThreshold, width * 0.25), 0.38)) {
        isClosingRef.current = true;
        const duration = computeSettleDuration(width - dist, velocity, 180, 280);
        el.style.transition = `transform ${duration}ms ${SPRING_OUT_EASE}, box-shadow ${duration}ms ease`;
        el.style.transform = 'translate3d(100%, 0, 0)';
        el.style.boxShadow = 'none';
        setTimeout(() => {
          onClose();
          setShouldRender(false);
          isClosingRef.current = false;
        }, duration);
      } else {
        const duration = computeSettleDuration(dist, velocity, 180, 280);
        el.style.transition = `transform ${duration}ms ${SPRING_OUT_EASE}, box-shadow ${duration}ms ease`;
        el.style.transform = 'translate3d(0, 0, 0)';
        el.style.boxShadow = '-8px 0 28px rgba(0,0,0,0.12)';
        smoother.reset(0);
      }
    };

    const handleTouchCancel = () => {
      if (!isTrackingRef.current) return;
      isTrackingRef.current = false;
      if (isClosingRef.current) return;
      isSwipingRef.current = false;

      smoother.stop();
      el.style.transition = `transform 240ms ${SPRING_OUT_EASE}, box-shadow 240ms ease`;
      el.style.transform = 'translate3d(0, 0, 0)';
      el.style.boxShadow = '-8px 0 28px rgba(0,0,0,0.12)';
      smoother.reset(0);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      smoother.stop();
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [shouldRender, edgeThreshold, dismissThreshold, onClose]);

  if (!shouldRender) return null;

  return (
    <SubPageContext.Provider value={{ requestClose }}>
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
        {header && <div className="relative z-1 shrink-0">{header}</div>}
        <div className="relative z-1 min-h-0 w-full flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </SubPageContext.Provider>
  );
};

export default SubPageShell;
