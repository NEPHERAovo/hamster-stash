import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { PaperModal } from '../../src/components/ui/PaperModal';

describe('PaperModal Component (TDD)', () => {
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

  it('renders title, handle, and content when isOpen is true', () => {
    render(
      <PaperModal isOpen={true} onClose={vi.fn()} title="测试弹窗">
        <div>弹窗内容测试</div>
      </PaperModal>
    );

    expect(screen.getByText('测试弹窗')).toBeInTheDocument();
    expect(screen.getByText('弹窗内容测试')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <PaperModal isOpen={false} onClose={vi.fn()} title="测试弹窗">
        <div>弹窗内容测试</div>
      </PaperModal>
    );

    expect(screen.queryByText('测试弹窗')).not.toBeInTheDocument();
  });

  it('triggers smooth close and calls onClose when clicking close button', () => {
    vi.useFakeTimers();
    const handleClose = vi.fn();

    render(
      <PaperModal isOpen={true} onClose={handleClose} title="测试弹窗">
        <div>内容</div>
      </PaperModal>
    );

    const closeBtn = screen.getByRole('button', { name: '关闭' });
    fireEvent.click(closeBtn);

    expect(handleClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('triggers smooth close on CloseWatcher onclose event (Android system back)', () => {
    vi.useFakeTimers();
    let watcherInstance: { onclose: (() => void) | null; destroy: () => void } | null = null;

    class MockCloseWatcher {
      onclose: (() => void) | null = null;
      destroy = vi.fn();
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        watcherInstance = this;
      }
    }
    window.CloseWatcher = MockCloseWatcher as unknown as typeof window.CloseWatcher;

    const handleClose = vi.fn();

    render(
      <PaperModal isOpen={true} onClose={handleClose} title="安卓测试">
        <div>内容</div>
      </PaperModal>
    );

    expect(watcherInstance).not.toBeNull();
    expect(handleClose).not.toHaveBeenCalled();

    act(() => {
      watcherInstance?.onclose?.();
    });

    expect(handleClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('triggers smooth close on Escape key in fallback mode', () => {
    vi.useFakeTimers();
    const handleClose = vi.fn();

    render(
      <PaperModal isOpen={true} onClose={handleClose} title="桌面测试">
        <div>内容</div>
      </PaperModal>
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(handleClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
