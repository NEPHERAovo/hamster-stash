import { useEffect, useRef, type RefObject } from 'react';

export interface UseTabSwipeGestureOptions {
  currentTab: string;
  tabs: string[];
  onTabChange: (tab: string) => void;
  disabled?: boolean;
  targetRef?: RefObject<HTMLElement | null>;
  minDistance?: number;
  maxDuration?: number;
  edgeThreshold?: number;
}

export function useTabSwipeGesture(options: UseTabSwipeGestureOptions): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const el = optionsRef.current.targetRef?.current ?? window;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let isTracking = false;
    let isSwiping = false;

    const isInteractiveOrScrollable = (target: EventTarget | null): boolean => {
      let node = target as HTMLElement | null;
      const root = el === window ? document.body : el;
      while (node && node !== root && node !== document.body) {
        if (
          node.tagName === 'INPUT' ||
          node.tagName === 'TEXTAREA' ||
          node.tagName === 'SELECT' ||
          node.tagName === 'BUTTON' ||
          node.getAttribute('role') === 'button' ||
          node.getAttribute('role') === 'slider' ||
          node.getAttribute('role') === 'combobox' ||
          node.getAttribute('role') === 'listbox' ||
          node.dataset?.swipeable === 'true' ||
          node.dataset?.noTabSwipe === 'true'
        ) {
          return true;
        }

        const style = window.getComputedStyle(node);
        if (
          (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
          node.scrollWidth > node.clientWidth
        ) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (optionsRef.current.disabled) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const edgeThreshold = optionsRef.current.edgeThreshold ?? 24;

      if (
        touch.clientX < edgeThreshold ||
        touch.clientX > window.innerWidth - edgeThreshold
      ) {
        return;
      }

      if (isInteractiveOrScrollable(e.target)) {
        return;
      }

      startX = touch.clientX;
      startY = touch.clientY;
      startTime = performance.now();
      isTracking = true;
      isSwiping = false;
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
        if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
          isSwiping = true;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isTracking || !isSwiping) {
        isTracking = false;
        isSwiping = false;
        return;
      }
      isTracking = false;
      isSwiping = false;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const duration = performance.now() - startTime;

      const minDistance = optionsRef.current.minDistance ?? 48;
      const maxDuration = optionsRef.current.maxDuration ?? 500;

      if (
        Math.abs(deltaX) >= minDistance &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.5 &&
        duration <= maxDuration
      ) {
        const { currentTab, tabs, onTabChange } = optionsRef.current;
        const currentIndex = tabs.indexOf(currentTab);
        if (currentIndex === -1) return;

        if (deltaX < 0 && currentIndex < tabs.length - 1) {
          onTabChange(tabs[currentIndex + 1]);
        } else if (deltaX > 0 && currentIndex > 0) {
          onTabChange(tabs[currentIndex - 1]);
        }
      }
    };

    const target = el as EventTarget;
    target.addEventListener('touchstart', onTouchStart as EventListener, { passive: true });
    target.addEventListener('touchmove', onTouchMove as EventListener, { passive: true });
    target.addEventListener('touchend', onTouchEnd as EventListener, { passive: true });
    target.addEventListener('touchcancel', onTouchEnd as EventListener, { passive: true });

    return () => {
      target.removeEventListener('touchstart', onTouchStart as EventListener);
      target.removeEventListener('touchmove', onTouchMove as EventListener);
      target.removeEventListener('touchend', onTouchEnd as EventListener);
      target.removeEventListener('touchcancel', onTouchEnd as EventListener);
    };
  }, []);
}
