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
import { todayDate, addDaysToToday, combineLocalDateTimeToIso } from '../../src/utils/date';

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

  it('dynamically shrinks category container height when a tray is opened', () => {
    const { container } = render(
      <AddTransactionModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const categoryWrapper = container.querySelector('.category-grid')?.parentElement;
    expect(categoryWrapper).toBeInTheDocument();
    expect(categoryWrapper?.className).toContain('max-h-[38vh]');
    expect(categoryWrapper?.className).not.toContain('max-h-[16vh]');

    // Open account tray
    const acctChip = screen.getByText('招商银行');
    fireEvent.click(acctChip);

    // Category wrapper shrinks to 16vh
    expect(categoryWrapper?.className).toContain('max-h-[16vh]');
    expect(categoryWrapper?.className).not.toContain('max-h-[38vh]');
  });

  it('maintains fixed cell layout dimensions without border jumping between selected and unselected categories', () => {
    const expenseFood: Category = {
      id: 'cat_food',
      name: '餐饮',
      type: 'expense',
      icon: 'utensils',
      color: '#fff',
      sortOrder: 2,
      createdAt: '',
      updatedAt: '',
    };
    useCategoryStore.setState({ categories: [mockCategory, expenseFood] });

    render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

    const rentBtn = screen.getByText('房租').closest('button');
    const foodBtn = screen.getByText('餐饮').closest('button');

    expect(rentBtn).toBeInTheDocument();
    expect(foodBtn).toBeInTheDocument();

    expect(rentBtn?.className).toContain('bg-(--paper-sunken)');
    expect(foodBtn?.className).toContain('bg-transparent');
    expect(rentBtn?.className).toContain('px-1 py-2');
    expect(foodBtn?.className).toContain('px-1 py-2');

    fireEvent.click(foodBtn!);

    expect(foodBtn?.className).toContain('bg-(--paper-sunken)');
    expect(rentBtn?.className).toContain('bg-transparent');
    expect(foodBtn?.className).toContain('px-1 py-2');
    expect(rentBtn?.className).toContain('px-1 py-2');
  });

  describe('Time-based Frequent Category Prediction', () => {
    const expenseTransit: Category = {
      id: 'cat_transit',
      name: '交通',
      type: 'expense',
      icon: 'bus',
      color: '#fff',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    };
    const expenseFood: Category = {
      id: 'cat_food',
      name: '餐饮',
      type: 'expense',
      icon: 'fork-knife',
      color: '#fff',
      sortOrder: 2,
      createdAt: '',
      updatedAt: '',
    };
    const incomeSalary: Category = {
      id: 'cat_salary',
      name: '工资',
      type: 'income',
      icon: 'money',
      color: '#fff',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    };
    const incomePartTime: Category = {
      id: 'cat_parttime',
      name: '兼职',
      type: 'income',
      icon: 'laptop',
      color: '#fff',
      sortOrder: 2,
      createdAt: '',
      updatedAt: '',
    };

    beforeEach(() => {
      useCategoryStore.setState({
        categories: [expenseTransit, expenseFood, incomeSalary, incomePartTime],
      });
      useAccountStore.setState({ accounts: [mockAccount] });
      usePreferenceStore.setState({ isAmortizationEnabled: false, isReimbursementEnabled: false });
    });

    it('defaults to high-frequency category predicted for current time slot when creating a new transaction', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date(2026, 10, 24, 8, 20, 0));

      const morningDate = '2026-11-20';
      const noonDate = '2026-11-20';
      const historicalTxs: Transaction[] = [
        {
          id: 'tx_transit_1',
          type: 'expense',
          amount: 500,
          categoryId: 'cat_transit',
          accountId: 'acct_1',
          date: morningDate,
          createdAt: combineLocalDateTimeToIso(morningDate, '08:15'),
          updatedAt: combineLocalDateTimeToIso(morningDate, '08:15'),
        },
        {
          id: 'tx_transit_2',
          type: 'expense',
          amount: 600,
          categoryId: 'cat_transit',
          accountId: 'acct_1',
          date: morningDate,
          createdAt: combineLocalDateTimeToIso(morningDate, '08:25'),
          updatedAt: combineLocalDateTimeToIso(morningDate, '08:25'),
        },
        {
          id: 'tx_food_1',
          type: 'expense',
          amount: 3500,
          categoryId: 'cat_food',
          accountId: 'acct_1',
          date: noonDate,
          createdAt: combineLocalDateTimeToIso(noonDate, '12:30'),
          updatedAt: combineLocalDateTimeToIso(noonDate, '12:30'),
        },
        {
          id: 'tx_food_2',
          type: 'expense',
          amount: 4000,
          categoryId: 'cat_food',
          accountId: 'acct_1',
          date: noonDate,
          createdAt: combineLocalDateTimeToIso(noonDate, '12:45'),
          updatedAt: combineLocalDateTimeToIso(noonDate, '12:45'),
        },
      ];

      useLedgerStore.setState({ allTransactions: historicalTxs });
      const recordSpy = vi.fn().mockResolvedValue({ id: 'new_tx' });
      useLedgerStore.setState({ recordTransaction: recordSpy });

      try {
        render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

        fireEvent.click(screen.getByText('5'));
        fireEvent.click(screen.getByText('完成'));

        await waitFor(() => {
          expect(recordSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'expense',
              categoryId: 'cat_transit',
            })
          );
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('defaults to high-frequency income category when switching to income type', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date(2026, 10, 24, 20, 15, 0));

      const eveningDate = '2026-11-20';
      const morningDate = '2026-11-20';
      const historicalTxs: Transaction[] = [
        {
          id: 'tx_income_salary_1',
          type: 'income',
          amount: 1000000,
          categoryId: 'cat_salary',
          accountId: 'acct_1',
          date: morningDate,
          createdAt: combineLocalDateTimeToIso(morningDate, '10:00'),
          updatedAt: combineLocalDateTimeToIso(morningDate, '10:00'),
        },
        {
          id: 'tx_income_parttime_1',
          type: 'income',
          amount: 50000,
          categoryId: 'cat_parttime',
          accountId: 'acct_1',
          date: eveningDate,
          createdAt: combineLocalDateTimeToIso(eveningDate, '20:10'),
          updatedAt: combineLocalDateTimeToIso(eveningDate, '20:10'),
        },
      ];

      useLedgerStore.setState({ allTransactions: historicalTxs });
      const recordSpy = vi.fn().mockResolvedValue({ id: 'new_tx' });
      useLedgerStore.setState({ recordTransaction: recordSpy });

      try {
        render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

        fireEvent.click(screen.getByText('收入'));
        fireEvent.click(screen.getByText('5'));
        fireEvent.click(screen.getByText('完成'));

        await waitFor(() => {
          expect(recordSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              type: 'income',
              categoryId: 'cat_parttime',
            })
          );
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('retains existing transaction category when opening in edit mode', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(new Date(2026, 10, 24, 8, 20, 0));

      const historicalTxs: Transaction[] = [
        {
          id: 'tx_transit_1',
          type: 'expense',
          amount: 500,
          categoryId: 'cat_transit',
          accountId: 'acct_1',
          date: '2026-11-20',
          createdAt: combineLocalDateTimeToIso('2026-11-20', '08:15'),
          updatedAt: combineLocalDateTimeToIso('2026-11-20', '08:15'),
        },
      ];

      useLedgerStore.setState({ allTransactions: historicalTxs });
      const updateSpy = vi.fn().mockResolvedValue({ id: 'edit_tx' });
      useLedgerStore.setState({ updateTransaction: updateSpy });

      const editingTx: Transaction = {
        id: 'edit_tx',
        type: 'expense',
        amount: 2500,
        categoryId: 'cat_food',
        accountId: 'acct_1',
        date: '2026-11-20',
        createdAt: combineLocalDateTimeToIso('2026-11-20', '08:20'),
        updatedAt: combineLocalDateTimeToIso('2026-11-20', '08:20'),
      };

      try {
        render(<AddTransactionModal isOpen={true} onClose={vi.fn()} editingTransaction={editingTx} />);

        fireEvent.click(screen.getByText('保存'));

        await waitFor(() => {
          expect(updateSpy).toHaveBeenCalledWith(
            'edit_tx',
            expect.objectContaining({
              type: 'expense',
              categoryId: 'cat_food',
            })
          );
        });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Record Another ("再记一笔")', () => {
    it('clears amount and note but preserves date, time, and category when clicking 再记一笔', async () => {
      const recordSpy = vi.fn().mockImplementation(async (payload) => {
        useAccountStore.setState({ accounts: [{ ...mockAccount, balance: mockAccount.balance - payload.amount }] });
        return { id: 'new_tx', ...payload };
      });
      useLedgerStore.setState({ recordTransaction: recordSpy });

      render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByText('5'));
      fireEvent.click(screen.getByText('0'));

      const noteInput = screen.getByPlaceholderText('添加备注...');
      fireEvent.change(noteInput, { target: { value: '午餐咖啡' } });

      const continueBtn = screen.getByText('再记一笔');
      fireEvent.click(continueBtn);

      await waitFor(() => {
        expect(recordSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 5000,
            note: '午餐咖啡',
            categoryId: 'cat_rent',
          })
        );
      });

      expect(noteInput).toHaveValue('');
      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);

      fireEvent.click(screen.getByText('2'));
      fireEvent.click(screen.getByText('0'));
      fireEvent.click(continueBtn);

      await waitFor(() => {
        expect(recordSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 2000,
            note: undefined,
            categoryId: 'cat_rent',
          })
        );
      });
    });
  });

  describe('Keypad Dual Operators and Direct Submission', () => {
    it('supports clicking + / × to toggle between addition and multiplication and records directly on 完成', async () => {
      const recordSpy = vi.fn().mockResolvedValue({ id: 'new_tx' });
      useLedgerStore.setState({ recordTransaction: recordSpy });

      render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: '1' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));

      const addMulBtn = screen.getByTitle('加法与乘法运算');
      fireEvent.click(addMulBtn);
      fireEvent.click(addMulBtn);

      fireEvent.click(screen.getByRole('button', { name: '5' }));

      const submitBtn = screen.getByRole('button', { name: '完成' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(recordSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 5000,
            categoryId: 'cat_rent',
          })
        );
      });
    });

    it('supports clicking − / ÷ to toggle between subtraction and division', async () => {
      const recordSpy = vi.fn().mockResolvedValue({ id: 'new_tx' });
      useLedgerStore.setState({ recordTransaction: recordSpy });

      render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: '6' }));
      fireEvent.click(screen.getByRole('button', { name: '0' }));

      const subDivBtn = screen.getByTitle('减法与除法运算');
      fireEvent.click(subDivBtn);
      fireEvent.click(subDivBtn);

      fireEvent.click(screen.getByRole('button', { name: '3' }));

      const submitBtn = screen.getByRole('button', { name: '完成' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(recordSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 2000,
            categoryId: 'cat_rent',
          })
        );
      });
    });

    it('renders loan category options without flow hint subtitles to keep visual consistency', () => {
      render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

      const loanTabBtn = screen.getByRole('button', { name: '借贷' });
      fireEvent.click(loanTabBtn);

      expect(screen.getByText('借给他人')).toBeInTheDocument();
      expect(screen.getByText('向人借款')).toBeInTheDocument();
      expect(screen.getByText('收回还款')).toBeInTheDocument();
      expect(screen.getByText('偿还欠款')).toBeInTheDocument();

      expect(screen.queryByText('流出')).toBeNull();
      expect(screen.queryByText('流入')).toBeNull();
    });
  });
});
