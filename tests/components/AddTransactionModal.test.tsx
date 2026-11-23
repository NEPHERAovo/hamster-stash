import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AddTransactionModal } from '../../src/components/ledger/AddTransactionModal';
import { usePreferenceStore } from '../../src/stores/usePreferenceStore';
import { useAccountStore } from '../../src/stores/useAccountStore';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import { useLedgerStore } from '../../src/stores/useLedgerStore';
import type { Account } from '../../src/types/account';
import type { Category } from '../../src/types/category';
import type { Transaction } from '../../src/types/transaction';
import { todayDate, addDaysToToday } from '../../src/utils/date';

describe('AddTransactionModal - Amortization (分期支出)', () => {
  const mockAccount: Account = {
    id: 'acct_1',
    name: '招商银行',
    type: 'savings',
    balance: 500000,
    currency: 'CNY',
    icon: 'wallet',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  };

  const mockCategory: Category = {
    id: 'cat_rent',
    name: '房租',
    type: 'expense',
    icon: 'home',
    color: '#fff',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    useAccountStore.setState({ accounts: [mockAccount] });
    useCategoryStore.setState({ categories: [mockCategory] });
    usePreferenceStore.setState({ isAmortizationEnabled: false, isReimbursementEnabled: false });
  });

  it('分期支出开关关闭时，不展示分期微胶囊', () => {
    render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByText('分期')).not.toBeInTheDocument();
  });

  it('分期支出开关开启时，展示分期微胶囊并支持选择分期期数', async () => {
    usePreferenceStore.setState({ isAmortizationEnabled: true });
    const recordSpy = vi.fn().mockResolvedValue({ id: 'new_tx' });
    useLedgerStore.setState({ recordTransaction: recordSpy });

    render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

    const amortizeBtn = screen.getByText('分期');
    expect(amortizeBtn).toBeInTheDocument();

    fireEvent.click(amortizeBtn);

    expect(screen.getByText('3期')).toBeInTheDocument();
    expect(screen.getByText('6期')).toBeInTheDocument();
    expect(screen.getByText('12期')).toBeInTheDocument();
    expect(screen.getByText('24期')).toBeInTheDocument();
    expect(screen.getByText('36期')).toBeInTheDocument();
    expect(screen.getByText('自定义')).toBeInTheDocument();

    fireEvent.click(screen.getByText('6期'));

    expect(screen.getByText('分期: 6期')).toBeInTheDocument();

    fireEvent.click(screen.getByText('6'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('0'));

    const submitBtn = screen.getByText('完成');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense',
          amount: 600000,
          ext: expect.objectContaining({
            amortize: expect.objectContaining({
              enabled: true,
              months: 6,
            }),
          }),
        })
      );
    });
  });

  it('分期支出支持自定义期数', async () => {
    usePreferenceStore.setState({ isAmortizationEnabled: true });
    const recordSpy = vi.fn().mockResolvedValue({ id: 'new_tx' });
    useLedgerStore.setState({ recordTransaction: recordSpy });

    render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('分期'));
    fireEvent.click(screen.getByText('自定义'));

    const customInput = screen.getByPlaceholderText('期数');
    fireEvent.change(customInput, { target: { value: '5' } });

    expect(screen.getByText('分期: 5期')).toBeInTheDocument();

    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('0'));

    fireEvent.click(screen.getByText('完成'));

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense',
          amount: 500000,
          ext: expect.objectContaining({
            amortize: expect.objectContaining({
              enabled: true,
              months: 5,
            }),
          }),
        })
      );
    });
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
    const origCloseWatcher = window.CloseWatcher;
    window.CloseWatcher = MockCloseWatcher as unknown as typeof window.CloseWatcher;

    try {
      const handleClose = vi.fn();
      render(<AddTransactionModal isOpen={true} onClose={handleClose} />);

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
    } finally {
      if (origCloseWatcher) {
        window.CloseWatcher = origCloseWatcher;
      } else {
        delete (window as unknown as { CloseWatcher?: unknown }).CloseWatcher;
      }
      vi.useRealTimers();
    }
  });

  it('filters offset candidates for income based on record date [-30d, +30d] and long-cycle reimbursables', async () => {
    const today = todayDate();
    const mockTxs: Transaction[] = [
      {
        id: 'tx_old_reimb',
        type: 'expense',
        amount: 80000,
        categoryId: 'cat_rent',
        accountId: 'acct_1',
        date: addDaysToToday(-75), // 75 days before today
        note: '远期出差机酒',
        isReimbursable: true,
        createdAt: `${addDaysToToday(-75)}T00:00:00.000Z`,
        updatedAt: `${addDaysToToday(-75)}T00:00:00.000Z`,
      },
      {
        id: 'tx_near_meal',
        type: 'expense',
        amount: 15000,
        categoryId: 'cat_rent',
        accountId: 'acct_1',
        date: addDaysToToday(-5), // 5 days before today (within 30d)
        note: '周末聚餐',
        createdAt: `${addDaysToToday(-5)}T00:00:00.000Z`,
        updatedAt: `${addDaysToToday(-5)}T00:00:00.000Z`,
      },
      {
        id: 'tx_far_routine',
        type: 'expense',
        amount: 20000,
        categoryId: 'cat_rent',
        accountId: 'acct_1',
        date: addDaysToToday(-61), // 61 days before today (outside 30d, non-reimbursable)
        note: '旧日用采购',
        createdAt: `${addDaysToToday(-61)}T00:00:00.000Z`,
        updatedAt: `${addDaysToToday(-61)}T00:00:00.000Z`,
      },
      {
        id: 'tx_fully_offset',
        type: 'expense',
        amount: 10000,
        categoryId: 'cat_rent',
        accountId: 'acct_1',
        date: addDaysToToday(-3),
        note: '已平账聚餐',
        createdAt: `${addDaysToToday(-3)}T00:00:00.000Z`,
        updatedAt: `${addDaysToToday(-3)}T00:00:00.000Z`,
      },
      {
        id: 'tx_offsetting_income',
        type: 'income',
        amount: 10000,
        categoryId: 'cat_rent',
        accountId: 'acct_1',
        offsetTransactionId: 'tx_fully_offset',
        date: today,
        createdAt: `${today}T00:00:00.000Z`,
        updatedAt: `${today}T00:00:00.000Z`,
      },
    ];

    useLedgerStore.setState({ allTransactions: mockTxs });

    render(
      <AddTransactionModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Switch to income
    fireEvent.click(screen.getByText('收入'));

    // Open offset tray
    const offsetChip = screen.getByText('抵扣支出');
    fireEvent.click(offsetChip);

    // Reimbursable expense from 75 days ago should be visible
    expect(screen.getByText('远期出差机酒')).toBeInTheDocument();
    // Near routine meal (5 days ago) should be visible
    expect(screen.getByText('周末聚餐')).toBeInTheDocument();
    // Far routine expense (>30 days ago, non-reimbursable) should be filtered out
    expect(screen.queryByText('旧日用采购')).not.toBeInTheDocument();
    // Fully offset expense should be filtered out
    expect(screen.queryByText('已平账聚餐')).not.toBeInTheDocument();

    // Selecting the reimbursable expense should auto-fill remaining amount and note
    fireEvent.click(screen.getByText('远期出差机酒'));

    // The display expression should be 800.00 (80000 cents = 800 yuan)
    expect(screen.getByText('800.00')).toBeInTheDocument();
    expect(screen.getByText('抵扣 · 远期出差机酒')).toBeInTheDocument();
  });
});
