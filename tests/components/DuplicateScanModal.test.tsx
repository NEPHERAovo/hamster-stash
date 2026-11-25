import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { DuplicateScanModal } from '../../src/components/assets/DuplicateScanModal';
import { useLedgerStore } from '../../src/stores/useLedgerStore';
import type { Transaction } from '../../src/types/transaction';

describe('DuplicateScanModal', () => {
  const txUnlinked: Transaction = {
    id: 'tx_dup_1',
    type: 'expense',
    amount: 19900,
    accountId: 'acct_1',
    categoryId: 'cat_shop',
    date: '2026-11-24',
    note: 'Mouse',
    createdAt: '2026-11-24T10:00:00.000Z',
    updatedAt: '2026-11-24T10:00:00.000Z',
  };
  const txLinked: Transaction = {
    ...txUnlinked,
    id: 'tx_dup_2',
    note: '购入物品: Mouse',
    ext: { 'owned-items': { itemId: 'item_mouse', itemRole: 'buy', kind: 'physical' } },
    updatedAt: '2026-11-24T10:01:00.000Z',
  };

  let createdWatchers: Array<{
    onclose: (() => void) | null;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];

  beforeEach(() => {
    createdWatchers = [];
    class MockCloseWatcher {
      onclose: (() => void) | null = null;
      destroy = vi.fn();
      constructor() {
        createdWatchers.push(this);
      }
    }
    vi.stubGlobal('CloseWatcher', MockCloseWatcher);
  });

  it('pre-selects unlinked duplicate and deletes checked entries on confirm', async () => {
    const deleteSpy = vi.fn().mockResolvedValue(undefined);
    useLedgerStore.setState({
      allTransactions: [txUnlinked, txLinked],
      transactions: [txUnlinked, txLinked],
      deleteTransaction: deleteSpy,
    });
    const onClose = vi.fn();

    render(<DuplicateScanModal isOpen={true} onClose={onClose} />);

    expect(screen.getByText('发现 1 组疑似重复')).toBeInTheDocument();
    expect(screen.getByText('已勾选删除 1 笔')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /清理勾选 \(1\)/ }));
    });

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith('tx_dup_1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles CloseWatcher.onclose, Escape fallback, and watcher cleanup', () => {
    vi.useFakeTimers();
    useLedgerStore.setState({ allTransactions: [], transactions: [] });
    const onClose = vi.fn();

    const { unmount } = render(<DuplicateScanModal isOpen={true} onClose={onClose} />);
    const watcher = createdWatchers[createdWatchers.length - 1];

    act(() => {
      watcher.onclose?.();
      vi.advanceTimersByTime(300);
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(watcher.destroy).toHaveBeenCalled();

    vi.stubGlobal('CloseWatcher', undefined);
    const onEscape = vi.fn();
    render(<DuplicateScanModal isOpen={true} onClose={onEscape} />);

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
      vi.advanceTimersByTime(300);
    });
    expect(onEscape).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
