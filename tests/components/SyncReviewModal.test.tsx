import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { SyncReviewModal } from '../../src/components/assets/SyncReviewModal';
import { buildThreeWaySyncPlan } from '../../src/domain/sync/diffMerger';
import type { ExportData } from '../../src/types/adapter';
import type { Transaction } from '../../src/types/transaction';

describe('SyncReviewModal', () => {
  const baseExport = (): ExportData => ({
    version: '4.0.0',
    exportedAt: '2026-11-25T10:00:00.000Z',
    transactions: [],
    accounts: [],
    categories: [],
    settings: {},
    plugins: { data: [], settings: {} },
  });

  const makePlan = () => {
    const localTx: Transaction = {
      id: 'tx_conflict_1',
      type: 'expense',
      amount: 12000,
      accountId: 'acct_1',
      categoryId: 'cat_shop',
      date: '2026-11-25',
      note: 'Keyboard Local',
      ext: { 'owned-items': { itemId: 'item_1', itemRole: 'buy', kind: 'physical' } },
      createdAt: '2026-11-25T08:00:00.000Z',
      updatedAt: '2026-11-25T09:00:00.000Z',
    };
    const remoteTxConflict: Transaction = {
      ...localTx,
      note: 'Keyboard Remote',
      ext: undefined,
      updatedAt: '2026-11-25T09:05:00.000Z',
    };
    const remoteAddedTx: Transaction = {
      id: 'tx_remote_add',
      type: 'income',
      amount: 50000,
      accountId: 'acct_1',
      categoryId: 'cat_salary',
      date: '2026-11-25',
      note: 'Bonus',
      createdAt: '2026-11-25T10:00:00.000Z',
      updatedAt: '2026-11-25T10:00:00.000Z',
    };

    const local = baseExport();
    local.transactions.push(localTx);
    const remote = baseExport();
    remote.transactions.push(remoteTxConflict, remoteAddedTx);

    return buildThreeWaySyncPlan(local, remote, null);
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

  it('allows switching conflict resolutions and submits selected choices', async () => {
    const plan = makePlan();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <SyncReviewModal
        isOpen={true}
        plan={plan}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('冲突 1')).toBeInTheDocument();
    expect(screen.getByText('云端下发 1')).toBeInTheDocument();

    const remoteButtons = screen.getAllByRole('button', { name: '采用云端' });
    expect(remoteButtons[0]).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(remoteButtons[0]);
    expect(remoteButtons[0]).toHaveAttribute('aria-pressed', 'true');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '确认合并' }));
    });

    expect(onConfirm).toHaveBeenCalledWith({
      'transactions:tx_conflict_1': 'remote',
      'transactions:tx_remote_add': 'remote',
    });
  });

  it('prevents dragging down inside the diff list from dismissing the modal', () => {
    const plan = makePlan();
    const onClose = vi.fn();

    render(
      <SyncReviewModal
        isOpen={true}
        plan={plan}
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );

    const listEl = document.querySelector('[data-sheet-no-drag="true"]') as HTMLElement;
    expect(listEl).toBeTruthy();

    fireEvent.touchStart(listEl, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(listEl, { touches: [{ clientX: 100, clientY: 320 }] });
    fireEvent.touchEnd(listEl);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes via CloseWatcher.onclose, Escape fallback, and destroys watcher on unmount', async () => {
    vi.useFakeTimers();
    const plan = makePlan();
    const onClose = vi.fn();

    const { unmount } = render(
      <SyncReviewModal
        isOpen={true}
        plan={plan}
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );

    expect(createdWatchers.length).toBeGreaterThanOrEqual(1);
    const watcher = createdWatchers[createdWatchers.length - 1];
    act(() => {
      watcher.onclose?.();
      vi.advanceTimersByTime(300);
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(watcher.destroy).toHaveBeenCalled();

    vi.stubGlobal('CloseWatcher', undefined);
    const onEscapeClose = vi.fn();
    render(
      <SyncReviewModal
        isOpen={true}
        plan={plan}
        onClose={onEscapeClose}
        onConfirm={vi.fn()}
      />
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
      vi.advanceTimersByTime(300);
    });
    expect(onEscapeClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
