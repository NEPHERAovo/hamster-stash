import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSheetDismissGesture } from '../../src/hooks/useSheetDismissGesture';

describe('useSheetDismissGesture', () => {
  const originalCloseWatcher = window.CloseWatcher;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    delete (window as unknown as { CloseWatcher?: unknown }).CloseWatcher;
    document.body.style.overflow = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = '';
    if (originalCloseWatcher) {
      window.CloseWatcher = originalCloseWatcher;
    } else {
      delete (window as unknown as { CloseWatcher?: unknown }).CloseWatcher;
    }
  });

  it('tracks shouldRender state and locks body scroll when enabled', () => {
    const onClose = vi.fn();
    const { result, rerender } = renderHook(
      ({ isOpen }) => useSheetDismissGesture({ isOpen, onClose, lockBodyScroll: true }),
      { initialProps: { isOpen: false } }
    );

    expect(result.current.shouldRender).toBe(false);
    expect(document.body.style.overflow).toBe('');

    rerender({ isOpen: true });
    expect(result.current.shouldRender).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('animates dismissal and triggers onClose and onAfterClose once after duration', () => {
    const onAfterClose = vi.fn();
    let isOpen = true;
    const onClose = vi.fn(() => {
      isOpen = false;
    });

    const { result, rerender } = renderHook(
      ({ open }) =>
        useSheetDismissGesture({
          isOpen: open,
          onClose,
          onAfterClose,
          lockBodyScroll: true,
        }),
      { initialProps: { open: isOpen } }
    );

    act(() => {
      result.current.closeWithAnimation(240);
    });

    expect(result.current.isClosingRef.current).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(240);
      rerender({ open: isOpen });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAfterClose).toHaveBeenCalledTimes(1);
    expect(result.current.shouldRender).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('triggers dismissal when Escape is pressed in fallback mode', () => {
    const onClose = vi.fn();
    renderHook(() => useSheetDismissGesture({ isOpen: true, onClose }));

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(240);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
