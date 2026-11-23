import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SubPageShell, SubPageBackButton } from '../../src/components/layout/SubPageShell';

describe('SubPageShell', () => {
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

  it('renders header, grid layer, and children when open', () => {
    const { container } = render(
      <SubPageShell
        isOpen={true}
        onClose={vi.fn()}
        header={<div data-testid="test-header">Header Title</div>}
      >
        <div data-testid="test-body">Body Content</div>
      </SubPageShell>
    );

    expect(screen.getByTestId('test-header')).toBeDefined();
    expect(screen.getByTestId('test-body')).toBeDefined();
    expect(screen.getByText('Header Title')).toBeDefined();
    expect(screen.getByText('Body Content')).toBeDefined();
    expect(container.querySelector('.grid-layer')).not.toBeNull();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <SubPageShell
        isOpen={false}
        onClose={vi.fn()}
        header={<div>Header</div>}
      >
        <div>Content</div>
      </SubPageShell>
    );

    expect(container.firstChild).toBeNull();
  });

  it('triggers smooth close when SubPageBackButton is clicked', () => {
    vi.useFakeTimers();
    const handleClose = vi.fn();

    render(
      <SubPageShell
        isOpen={true}
        onClose={handleClose}
        header={<SubPageBackButton label="Back" />}
      >
        <div>Content</div>
      </SubPageShell>
    );

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

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
      <SubPageShell
        isOpen={true}
        onClose={handleClose}
        header={<div>Header</div>}
      >
        <div>Content</div>
      </SubPageShell>
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

  it('triggers smooth close when pressing Escape key in fallback mode', () => {
    vi.useFakeTimers();
    const handleClose = vi.fn();

    render(
      <SubPageShell
        isOpen={true}
        onClose={handleClose}
        header={<div>Header</div>}
      >
        <div>Content</div>
      </SubPageShell>
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
