import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { XIcon as X } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import {
  GestureSmoother,
  SHEET_SPRING_EASE,
  VelocityTracker,
  computeSettleDuration,
  rubberBand,
  shouldDismissGesture,
} from '../../utils/gesturePhysics';

export interface PaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  showHandle?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const PaperModal: React.FC<PaperModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerExtra,
  showHandle = true,
  children,
  className,
}) => {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isClosingRef = useRef(false);
  const dragYRef = useRef(0);
  const smootherRef = useRef<GestureSmoother | null>(null);
  const velocityRef = useRef(new VelocityTracker(100));

  const closeWithAnimation = useCallback(
    (duration = 240) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      smootherRef.current?.stop();

      const el = sheetRef.current;
      const bd = backdropRef.current;
      if (el) {
        el.style.transition = `transform ${duration}ms ${SHEET_SPRING_EASE}`;
        el.style.transform = 'translate3d(0, 100%, 0)';
      }
      if (bd) {
        bd.style.transition = `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;
        bd.style.opacity = '0';
        bd.style.pointerEvents = 'none';
      }
      window.setTimeout(() => {
        document.body.style.overflow = '';
        onClose();
        setShouldRender(false);
        isClosingRef.current = false;
        dragYRef.current = 0;
        smootherRef.current?.reset(0);
      }, duration);
    },
    [onClose]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setShouldRender(true);
    } else if (shouldRender && !isClosingRef.current) {
      closeWithAnimation(240);
    }
  }, [isOpen, shouldRender, closeWithAnimation]);

  useEffect(() => {
    if (!shouldRender || !isOpen) return;

    const el = sheetRef.current;
    const bd = backdropRef.current;
    if (!el) return;

    isClosingRef.current = false;
    el.style.transition = 'none';
    el.style.transform = 'translate3d(0, 100%, 0)';
    if (bd) {
      bd.style.transition = 'none';
      bd.style.opacity = '0';
      bd.style.pointerEvents = 'auto';
    }
    void el.offsetHeight;

    const animFrame = requestAnimationFrame(() => {
      el.style.transition = `transform 280ms ${SHEET_SPRING_EASE}`;
      el.style.transform = 'translate3d(0, 0, 0)';
      if (bd) {
        bd.style.transition = 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)';
        bd.style.opacity = '1';
      }
    });

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [shouldRender, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeWithAnimation(240);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeWithAnimation]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !shouldRender || !isOpen) return;

    const smoother = new GestureSmoother(
      (smoothedY) => {
        if (isClosingRef.current) return;
        const clampedY = Math.max(0, smoothedY);
        el.style.transform = `translate3d(0, ${clampedY}px, 0)`;
        const bd = backdropRef.current;
        if (bd) {
          const height = el.getBoundingClientRect().height || 500;
          const progress = Math.max(0, Math.min(1, 1 - clampedY / (height * 1.2)));
          bd.style.opacity = String(progress);
        }
      },
      0,
      26
    );
    smootherRef.current = smoother;

    let tracking = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (isClosingRef.current || e.touches.length !== 1) return;
      if (scrollRef.current && scrollRef.current.contains(e.target as Node) && scrollRef.current.scrollTop > 0) {
        return;
      }
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      dragging = false;
      dragYRef.current = 0;
      smoother.reset(0);
      velocityRef.current.reset(0, performance.now());
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1 || isClosingRef.current) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (!dragging) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
          tracking = false;
          return;
        }
        if (deltaY > 8) {
          dragging = true;
          el.style.transition = 'none';
          if (backdropRef.current) backdropRef.current.style.transition = 'none';
        }
      }

      if (dragging) {
        e.preventDefault();
        const mappedY = deltaY >= 0 ? deltaY : rubberBand(deltaY, 72, 0.25);
        dragYRef.current = mappedY;
        velocityRef.current.push(mappedY, performance.now());
        smoother.setTarget(mappedY);
      }
    };

    const handleTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging || isClosingRef.current) return;
      dragging = false;

      smoother.stop();
      const height = Math.max(200, el.getBoundingClientRect().height);
      const vy = velocityRef.current.getVelocity(performance.now());
      const dist = smoother.getCurrent();

      if (shouldDismissGesture(dist, vy, Math.min(100, height * 0.22), 0.45)) {
        const duration = computeSettleDuration(height - dist, vy, 180, 280);
        closeWithAnimation(duration);
      } else {
        const duration = computeSettleDuration(dist, vy, 200, 300);
        el.style.transition = `transform ${duration}ms ${SHEET_SPRING_EASE}`;
        el.style.transform = 'translate3d(0, 0, 0)';
        const bd = backdropRef.current;
        if (bd) {
          bd.style.transition = `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;
          bd.style.opacity = '1';
        }
        dragYRef.current = 0;
        smoother.reset(0);
      }
    };

    const handleTouchCancel = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging || isClosingRef.current) return;
      dragging = false;

      smoother.stop();
      el.style.transition = `transform 240ms ${SHEET_SPRING_EASE}`;
      el.style.transform = 'translate3d(0, 0, 0)';
      const bd = backdropRef.current;
      if (bd) {
        bd.style.transition = 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)';
        bd.style.opacity = '1';
      }
      dragYRef.current = 0;
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
  }, [shouldRender, isOpen, closeWithAnimation]);

  if (!mounted || !shouldRender) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center select-none',
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      )}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] will-change-[opacity]"
        onClick={() => closeWithAnimation(240)}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        className={cn(
          'paper-modal-sheet relative flex max-h-[92vh] w-full max-w-full flex-col overflow-hidden will-change-transform sm:max-w-lg md:max-w-xl',
          'rounded-t-(--radius-lg) rounded-b-none border-t border-(--rule-hairline) bg-(--paper-sheet) shadow-2xl sm:rounded-b-(--radius-lg) sm:border',
          className
        )}
      >
        {showHandle && (
          <div
            className="flex cursor-pointer items-center justify-center py-2.5 select-none"
            onClick={() => closeWithAnimation(240)}
            title="关闭"
          >
            <div className="h-1 w-9 rounded-full bg-(--ink-tertiary)/30" />
          </div>
        )}

        {(title || subtitle || headerExtra) && (
          <div className="flex shrink-0 items-start justify-between border-b border-(--rule-hairline)/60 px-4 pt-3.5 pb-2.5">
            <div>
              {title && (
                <h3 className="text-base font-semibold text-(--ink-primary)">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="mt-0.5 font-mono text-xs text-(--ink-tertiary)">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {headerExtra}
              <button
                type="button"
                onClick={() => closeWithAnimation(240)}
                className="cursor-pointer rounded-full p-1 text-(--ink-tertiary) transition-colors hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
                title="关闭"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaperModal;
