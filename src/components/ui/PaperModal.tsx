import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import {
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
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [transitionMs, setTransitionMs] = useState(300);

  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragYRef = useRef(0);
  const velocityRef = useRef(new VelocityTracker(100));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setShouldRender(true);
      setDragY(0);
      dragYRef.current = 0;
      setIsDragging(false);
      setTransitionMs(300);
      let innerFrame = 0;
      const outerFrame = requestAnimationFrame(() => {
        innerFrame = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outerFrame);
        cancelAnimationFrame(innerFrame);
      };
    }

    setVisible(false);
    setIsDragging(false);
    setDragY(0);
    dragYRef.current = 0;
    const timer = window.setTimeout(() => {
      document.body.style.overflow = '';
      setShouldRender(false);
    }, transitionMs);
    return () => window.clearTimeout(timer);
  }, [isOpen, transitionMs]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !shouldRender || !isOpen) return;

    let tracking = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (scrollRef.current && scrollRef.current.contains(e.target as Node) && scrollRef.current.scrollTop > 0) {
        return;
      }
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      dragging = false;
      dragYRef.current = 0;
      velocityRef.current.reset(0, performance.now());
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1) return;
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
          setIsDragging(true);
        }
      }

      if (dragging) {
        e.preventDefault();
        const mappedY = deltaY >= 0 ? deltaY : rubberBand(deltaY, 72, 0.25);
        dragYRef.current = mappedY;
        velocityRef.current.push(mappedY, performance.now());
        setDragY(mappedY);
      }
    };

    const handleTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      setIsDragging(false);

      const height = Math.max(200, el.getBoundingClientRect().height);
      const vy = velocityRef.current.getVelocity(performance.now());
      const dist = dragYRef.current;

      if (shouldDismissGesture(dist, vy, Math.min(100, height * 0.22), 0.45)) {
        const duration = computeSettleDuration(height - dist, vy, 180, 290);
        setTransitionMs(duration);
        setVisible(false);
        setDragY(0);
        dragYRef.current = 0;
        onClose();
      } else {
        const duration = computeSettleDuration(dist, vy, 200, 310);
        setTransitionMs(duration);
        setDragY(0);
        dragYRef.current = 0;
      }
    };

    const handleTouchCancel = () => {
      if (!tracking) return;
      tracking = false;
      dragging = false;
      setIsDragging(false);
      setTransitionMs(240);
      setDragY(0);
      dragYRef.current = 0;
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
  }, [shouldRender, isOpen, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !shouldRender) return null;

  const dragProgress = Math.max(0, Math.min(1, dragY / 320));
  const backdropOpacity = visible ? 1 - dragProgress * 0.75 : 0;
  const sheetTransform = !visible
    ? 'translate3d(0, 100%, 0)'
    : dragY !== 0
      ? `translate3d(0, ${dragY}px, 0)`
      : 'translate3d(0, 0, 0)';

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center',
        visible ? 'pointer-events-auto' : 'pointer-events-none'
      )}
      style={{
        opacity: backdropOpacity,
        transition: isDragging ? 'none' : `opacity ${transitionMs}ms ease`,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        className={cn(
          'relative w-full max-w-full sm:max-w-lg md:max-w-xl max-h-[92vh] flex flex-col overflow-hidden will-change-transform',
          'bg-(--paper-sheet) paper-card border-t sm:border border-(--rule-hairline) shadow-2xl rounded-t-(--radius-lg) sm:rounded-b-(--radius-lg)',
          className
        )}
        style={{
          transform: sheetTransform,
          transition: isDragging ? 'none' : `transform ${transitionMs}ms ${SHEET_SPRING_EASE}`,
        }}
      >
        {showHandle && (
          <div
            className="py-2.5 flex items-center justify-center cursor-pointer select-none"
            onClick={onClose}
            title="关闭"
          >
            <div className="w-9 h-1 rounded-full bg-(--ink-tertiary)/30" />
          </div>
        )}

        {(title || subtitle || headerExtra) && (
          <div className="px-4 pt-3.5 pb-2.5 flex items-start justify-between shrink-0 border-b border-(--rule-hairline)/60">
            <div>
              {title && (
                <h3 className="text-base text-(--ink-primary) font-semibold">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-(--ink-tertiary) mt-0.5 font-mono">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {headerExtra}
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-(--ink-tertiary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) transition-colors cursor-pointer"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaperModal;
