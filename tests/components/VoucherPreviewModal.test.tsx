import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { VoucherPreviewModal } from '../../src/components/ledger/VoucherPreviewModal';
import type { VoucherAttachment } from '../../src/types/transaction';

describe('VoucherPreviewModal (TDD)', () => {
  const originalCloseWatcher = window.CloseWatcher;

  const mockVoucher: VoucherAttachment = {
    attachmentId: 'att_1',
    name: 'receipt_01.jpg',
    size: '128 KB',
    mimeType: 'image/jpeg',
    fileUrl: 'data:image/jpeg;base64,mockdata',
  };

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

  it('renders voucher details when voucher is provided', () => {
    render(<VoucherPreviewModal voucher={mockVoucher} onClose={vi.fn()} />);

    expect(screen.getByText('receipt_01.jpg')).toBeInTheDocument();
    expect(screen.getByText('128 KB')).toBeInTheDocument();
  });

  it('does not render when voucher is null', () => {
    const { container } = render(<VoucherPreviewModal voucher={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('triggers onClose when CloseWatcher onclose event fires (Android system back)', () => {
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
    render(<VoucherPreviewModal voucher={mockVoucher} onClose={handleClose} />);

    expect(watcherInstance).not.toBeNull();
    expect(handleClose).not.toHaveBeenCalled();

    act(() => {
      watcherInstance?.onclose?.();
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when pressing Escape key in fallback mode', () => {
    const handleClose = vi.fn();
    render(<VoucherPreviewModal voucher={mockVoucher} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
