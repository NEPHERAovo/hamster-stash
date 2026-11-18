import { useRef, useEffect, type RefObject } from 'react';

export interface UseSwipeBackOptions {
  onClose?: () => void;
  edgeThreshold?: number;
  dismissThreshold?: number;
  disabled?: boolean;
}

export function useSwipeBack<T extends HTMLElement = HTMLDivElement>(
  options: UseSwipeBackOptions
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let isTracking = false;
    let isSwiping = false;
    let currentDeltaX = 0;
    let startTime = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (optionsRef.current.disabled) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const rect = el.getBoundingClientRect();
      const edge = optionsRef.current.edgeThreshold ?? 40;

      if (touch.clientX - rect.left <= edge) {
        startX = touch.clientX;
        startY = touch.clientY;
        startTime = performance.now();
        isTracking = true;
        isSwiping = false;
        currentDeltaX = 0;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isTracking || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (!isSwiping) {
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
          isTracking = false;
          return;
        }
        if (deltaX > 8) {
          isSwiping = true;
        }
      }

      if (isSwiping && deltaX > 0) {
        e.preventDefault();
        currentDeltaX = deltaX;
        el.style.transform = `translate3d(${deltaX}px, 0, 0)`;
        el.style.transition = 'none';
      }
    };

    const onTouchEnd = () => {
      if (!isTracking) return;
      isTracking = false;

      if (!isSwiping) return;
      isSwiping = false;

      const duration = performance.now() - startTime;
      const velocity = currentDeltaX / Math.max(1, duration);
      const threshold = optionsRef.current.dismissThreshold ?? 90;

      if (currentDeltaX > threshold || velocity > 0.35) {
        el.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = 'translate3d(100%, 0, 0)';
        setTimeout(() => {
          optionsRef.current.onClose?.();
        }, 220);
      } else {
        el.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = 'translate3d(0, 0, 0)';
      }
    };

    const onTouchCancel = () => {
      if (!isTracking) return;
      isTracking = false;
      isSwiping = false;
      el.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.transform = 'translate3d(0, 0, 0)';
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
    };
  }, []);

  return containerRef;
}
