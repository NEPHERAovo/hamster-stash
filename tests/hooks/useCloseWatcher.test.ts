import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCloseWatcher } from '../../src/hooks/useCloseWatcher';

describe('useCloseWatcher Hook (TDD)', () => {
  const originalCloseWatcher = window.CloseWatcher;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { CloseWatcher?: unknown }).CloseWatcher;
  });

  afterEach(() => {
    if (originalCloseWatcher) {
      window.CloseWatcher = originalCloseWatcher;
    } else {
      delete (window as unknown as { CloseWatcher?: unknown }).CloseWatcher;
    }
  });

  describe('Chromium / Android environment (CloseWatcher supported)', () => {
    let mockDestroy: ReturnType<typeof vi.fn>;
    let mockRequestClose: ReturnType<typeof vi.fn>;
    let createdWatcher: {
      onclose: (() => void) | null;
      oncancel: ((e: Event) => void) | null;
      destroy: typeof mockDestroy;
      requestClose: typeof mockRequestClose;
    } | null = null;

    beforeEach(() => {
      mockDestroy = vi.fn();
      mockRequestClose = vi.fn();
      createdWatcher = null;

      class MockCloseWatcher {
        onclose: (() => void) | null = null;
        oncancel: ((e: Event) => void) | null = null;
        destroy = mockDestroy;
        requestClose = mockRequestClose;

        constructor() {
          // eslint-disable-next-line @typescript-eslint/no-this-alias
          createdWatcher = this;
        }
      }

      window.CloseWatcher = MockCloseWatcher as unknown as typeof window.CloseWatcher;
    });

    it('does not instantiate CloseWatcher when isOpen is false', () => {
      const handleClose = vi.fn();
      renderHook(() => useCloseWatcher({ isOpen: false, onClose: handleClose }));

      expect(createdWatcher).toBeNull();
    });

    it('instantiates CloseWatcher when isOpen is true', () => {
      const handleClose = vi.fn();
      renderHook(() => useCloseWatcher({ isOpen: true, onClose: handleClose }));

      expect(createdWatcher).not.toBeNull();
      expect(mockDestroy).not.toHaveBeenCalled();
    });

    it('triggers onClose when CloseWatcher fires onclose event', () => {
      const handleClose = vi.fn();
      renderHook(() => useCloseWatcher({ isOpen: true, onClose: handleClose }));

      expect(createdWatcher).not.toBeNull();
      expect(handleClose).not.toHaveBeenCalled();

      createdWatcher?.onclose?.();

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('destroys CloseWatcher on unmount', () => {
      const handleClose = vi.fn();
      const { unmount } = renderHook(() =>
        useCloseWatcher({ isOpen: true, onClose: handleClose })
      );

      expect(mockDestroy).not.toHaveBeenCalled();
      unmount();
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('destroys CloseWatcher when isOpen transitions from true to false', () => {
      const handleClose = vi.fn();
      const { rerender } = renderHook(
        ({ isOpen }) => useCloseWatcher({ isOpen, onClose: handleClose }),
        { initialProps: { isOpen: true } }
      );

      expect(createdWatcher).not.toBeNull();
      expect(mockDestroy).not.toHaveBeenCalled();

      rerender({ isOpen: false });

      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('does not re-create CloseWatcher when only onClose reference changes', () => {
      let closeCount = 0;
      const { rerender } = renderHook(
        ({ fn }) => useCloseWatcher({ isOpen: true, onClose: fn }),
        { initialProps: { fn: () => { closeCount = 1; } } }
      );

      const firstInstance = createdWatcher;
      expect(firstInstance).not.toBeNull();

      rerender({ fn: () => { closeCount = 2; } });

      expect(createdWatcher).toBe(firstInstance);
      expect(mockDestroy).not.toHaveBeenCalled();

      createdWatcher?.onclose?.();
      expect(closeCount).toBe(2);
    });

    it('does not instantiate CloseWatcher when disabled is true', () => {
      const handleClose = vi.fn();
      renderHook(() =>
        useCloseWatcher({ isOpen: true, onClose: handleClose, disabled: true })
      );

      expect(createdWatcher).toBeNull();
    });
  });

  describe('iOS Safari / Legacy environment (CloseWatcher unsupported fallback)', () => {
    it('attaches keydown listener for Escape key when CloseWatcher is undefined', () => {
      const handleClose = vi.fn();
      renderHook(() => useCloseWatcher({ isOpen: true, onClose: handleClose }));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(handleClose).not.toHaveBeenCalled();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('cleans up keydown listener on unmount', () => {
      const handleClose = vi.fn();
      const { unmount } = renderHook(() =>
        useCloseWatcher({ isOpen: true, onClose: handleClose })
      );

      unmount();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not attach keydown listener when isOpen is false', () => {
      const handleClose = vi.fn();
      renderHook(() => useCloseWatcher({ isOpen: false, onClose: handleClose }));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(handleClose).not.toHaveBeenCalled();
    });
  });
});
