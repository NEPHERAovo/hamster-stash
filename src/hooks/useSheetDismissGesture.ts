import { useCallback, useEffect, useRef, useState } from 'react';
import { useCloseWatcher } from './useCloseWatcher';
import {
  GestureSmoother,
  SHEET_SPRING_EASE,
  VelocityTracker,
  computeSettleDuration,
  rubberBand,
  shouldDismissGesture,
} from '../utils/gesturePhysics';

export interface UseSheetDismissGestureOptions {
  isOpen: boolean;
  onClose: () => void;
  maxThreshold?: number;
  lockBodyScroll?: boolean;
  respectNoDragAttribute?: boolean;
  onAfterClose?: () => void;
}

export function useSheetDismissGesture({
  isOpen,
  onClose,
  maxThreshold = 100,
  lockBodyScroll = false,
  respectNoDragAttribute = true,
  onAfterClose,
}: UseSheetDismissGestureOptions) {
  const [shouldRender, setShouldRender] = useState(isOpen);

  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const isClosingRef = useRef(false);
  const dragYRef = useRef(0);
  const smootherRef = useRef<GestureSmoother | null>(null);
  const velocityRef = useRef(new VelocityTracker(100));
  const closeTimerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  const onAfterCloseRef = useRef(onAfterClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onAfterCloseRef.current = onAfterClose;
  }, [onAfterClose]);

  if (isOpen && !shouldRender) {
    setShouldRender(true);
  }

  const clearPendingCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeWithAnimation = useCallback(
    (duration = 240, notifyOnClose = true) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      smootherRef.current?.stop();
      clearPendingCloseTimer();

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

      closeTimerRef.current = window.setTimeout(() => {
        closeTimerRef.current = null;
        if (lockBodyScroll) {
          document.body.style.overflow = '';
        }
        if (notifyOnClose) {
          onCloseRef.current();
        }
        onAfterCloseRef.current?.();
        setShouldRender(false);
        isClosingRef.current = false;
        dragYRef.current = 0;
        smootherRef.current?.reset(0);
      }, duration);
    },
    [clearPendingCloseTimer, lockBodyScroll]
  );

  useEffect(() => {
    if (isOpen && lockBodyScroll) {
      document.body.style.overflow = 'hidden';
    } else if (!isOpen && shouldRender && !isClosingRef.current) {
      closeWithAnimation(240, false);
    }
  }, [isOpen, shouldRender, lockBodyScroll, closeWithAnimation]);

  useEffect(() => {
    if (!shouldRender || !isOpen) return;
    clearPendingCloseTimer();

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
  }, [shouldRender, isOpen, clearPendingCloseTimer]);

  useEffect(() => {
    return () => {
      clearPendingCloseTimer();
      if (lockBodyScroll) {
        document.body.style.overflow = '';
      }
    };
  }, [clearPendingCloseTimer, lockBodyScroll]);

  useCloseWatcher({
    isOpen: shouldRender && isOpen && !isClosingRef.current,
    onClose: () => closeWithAnimation(240),
  });

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

    const isInsideScrollable = (target: EventTarget | null): boolean => {
      let node = target as HTMLElement | null;
      while (node && node !== el) {
        if (respectNoDragAttribute && node.dataset?.sheetNoDrag === 'true') return true;
        const style = window.getComputedStyle(node);
        const canScrollY =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          node.scrollHeight > node.clientHeight + 1;
        if (canScrollY && node.scrollTop > 0) return true;
        node = node.parentElement;
      }
      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isClosingRef.current || e.touches.length !== 1) return;
      if (isInsideScrollable(e.target)) return;
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

    const resetPosition = (duration: number) => {
      el.style.transition = `transform ${duration}ms ${SHEET_SPRING_EASE}`;
      el.style.transform = 'translate3d(0, 0, 0)';
      const bd = backdropRef.current;
      if (bd) {
        bd.style.transition = `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;
        bd.style.opacity = '1';
      }
      dragYRef.current = 0;
      smoother.reset(0);
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

      if (shouldDismissGesture(dist, vy, Math.min(maxThreshold, height * 0.22), 0.45)) {
        const duration = computeSettleDuration(height - dist, vy, 180, 280);
        closeWithAnimation(duration);
      } else {
        const duration = computeSettleDuration(dist, vy, 200, 300);
        resetPosition(duration);
      }
    };

    const handleTouchCancel = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging || isClosingRef.current) return;
      dragging = false;

      smoother.stop();
      resetPosition(240);
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
  }, [shouldRender, isOpen, closeWithAnimation, maxThreshold, respectNoDragAttribute]);

  return {
    shouldRender,
    backdropRef,
    sheetRef,
    isClosingRef,
    closeWithAnimation,
  };
}
