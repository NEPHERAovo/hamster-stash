import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTabSwipeGesture } from '../../src/hooks/useTabSwipeGesture';

function createTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>, target?: EventTarget) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: touches,
  });
  Object.defineProperty(event, 'changedTouches', {
    value: touches,
  });
  if (target) {
    Object.defineProperty(event, 'target', {
      value: target,
    });
  }
  return event;
}

describe('useTabSwipeGesture Hook', () => {
  const tabs = ['ledger', 'stats', 'items', 'assets'];
  let onTabChange: ReturnType<typeof vi.fn>;
  let container: HTMLDivElement;

  beforeEach(() => {
    onTabChange = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('switches to next tab when swiping left with sufficient distance and velocity', () => {
    renderHook(() =>
      useTabSwipeGesture({
        currentTab: 'ledger',
        tabs,
        onTabChange,
        targetRef: { current: container },
      })
    );

    // Touch start at x=150, y=200
    container.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 150, clientY: 200 }]));
    // Touch move to x=100, y=202 (deltaX = -50)
    container.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 100, clientY: 202 }]));
    // Touch end at x=80, y=203 (total deltaX = -70)
    container.dispatchEvent(createTouchEvent('touchend', [{ clientX: 80, clientY: 203 }]));

    expect(onTabChange).toHaveBeenCalledWith('stats');
  });

  it('switches to previous tab when swiping right with sufficient distance and velocity', () => {
    renderHook(() =>
      useTabSwipeGesture({
        currentTab: 'stats',
        tabs,
        onTabChange,
        targetRef: { current: container },
      })
    );

    container.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }]));
    container.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 140, clientY: 201 }]));
    container.dispatchEvent(createTouchEvent('touchend', [{ clientX: 180, clientY: 202 }]));

    expect(onTabChange).toHaveBeenCalledWith('ledger');
  });

  it('does not switch past the last tab when swiping left', () => {
    renderHook(() =>
      useTabSwipeGesture({
        currentTab: 'assets',
        tabs,
        onTabChange,
        targetRef: { current: container },
      })
    );

    container.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 200, clientY: 200 }]));
    container.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 140, clientY: 200 }]));
    container.dispatchEvent(createTouchEvent('touchend', [{ clientX: 100, clientY: 200 }]));

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('does not switch before the first tab when swiping right', () => {
    renderHook(() =>
      useTabSwipeGesture({
        currentTab: 'ledger',
        tabs,
        onTabChange,
        targetRef: { current: container },
      })
    );

    container.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }]));
    container.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 160, clientY: 200 }]));
    container.dispatchEvent(createTouchEvent('touchend', [{ clientX: 200, clientY: 200 }]));

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('does not trigger when disabled is true', () => {
    renderHook(() =>
      useTabSwipeGesture({
        currentTab: 'ledger',
        tabs,
        onTabChange,
        disabled: true,
        targetRef: { current: container },
      })
    );

    container.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 200, clientY: 200 }]));
    container.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 100, clientY: 200 }]));
    container.dispatchEvent(createTouchEvent('touchend', [{ clientX: 100, clientY: 200 }]));

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('cancels tracking when gesture is vertical-dominant', () => {
    renderHook(() =>
      useTabSwipeGesture({
        currentTab: 'ledger',
        tabs,
        onTabChange,
        targetRef: { current: container },
      })
    );

    container.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 150, clientY: 100 }]));
    // Strong vertical movement
    container.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 145, clientY: 180 }]));
    container.dispatchEvent(createTouchEvent('touchend', [{ clientX: 80, clientY: 220 }]));

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('ignores touches starting in the screen edge zone', () => {
    renderHook(() =>
      useTabSwipeGesture({
        currentTab: 'ledger',
        tabs,
        onTabChange,
        targetRef: { current: container },
        edgeThreshold: 30,
      })
    );

    // Touch start in edge zone (x = 10 < 30)
    container.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 10, clientY: 200 }]));
    container.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 80, clientY: 200 }]));
    container.dispatchEvent(createTouchEvent('touchend', [{ clientX: 120, clientY: 200 }]));

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('ignores touches inside data-swipeable elements', () => {
    const swipeableRow = document.createElement('div');
    swipeableRow.setAttribute('data-swipeable', 'true');
    container.appendChild(swipeableRow);

    renderHook(() =>
      useTabSwipeGesture({
        currentTab: 'ledger',
        tabs,
        onTabChange,
        targetRef: { current: container },
      })
    );

    swipeableRow.dispatchEvent(createTouchEvent('touchstart', [{ clientX: 150, clientY: 200 }], swipeableRow));
    swipeableRow.dispatchEvent(createTouchEvent('touchmove', [{ clientX: 80, clientY: 200 }], swipeableRow));
    swipeableRow.dispatchEvent(createTouchEvent('touchend', [{ clientX: 80, clientY: 200 }], swipeableRow));

    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('cleans up event listeners on unmount', () => {
    const removeSpy = vi.spyOn(container, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useTabSwipeGesture({
        currentTab: 'ledger',
        tabs,
        onTabChange,
        targetRef: { current: container },
      })
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('touchcancel', expect.any(Function));
  });
});
