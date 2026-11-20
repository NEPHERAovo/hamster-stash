import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransferModal } from '../../src/components/assets/TransferModal';
import type { Account } from '../../src/types/account';
import type { Transaction } from '../../src/types/transaction';
import { useConfirmStore } from '../../src/stores/useConfirmStore';

describe('TransferModal Component', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acct_1',
      name: '活期存款',
      type: 'cash',
      balance: 100000,
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'acct_2',
      name: '理财账户',
      type: 'investment',
      balance: 500000,
      currency: 'CNY',
      icon: 'trending-up',
      sortOrder: 2,
      createdAt: '',
      updatedAt: '',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with account options and amount input', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <TransferModal
        isOpen={true}
        onClose={handleClose}
        accounts={mockAccounts}
        onConfirm={handleConfirm}
      />
    );

    expect(screen.getByText('资金划转')).toBeInTheDocument();
    expect(screen.getAllByText(/活期存款/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/理财账户/)[0]).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '划转金额' })).toBeInTheDocument();
  });

  it('swaps from and to accounts when swap button is clicked', () => {
    render(
      <TransferModal
        isOpen={true}
        onClose={vi.fn()}
        accounts={mockAccounts}
        onConfirm={vi.fn()}
      />
    );

    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveValue('acct_1');
    expect(selects[1]).toHaveValue('acct_2');

    const swapBtn = screen.getByTitle('互换转出与转入账户');
    fireEvent.click(swapBtn);

    expect(selects[0]).toHaveValue('acct_2');
    expect(selects[1]).toHaveValue('acct_1');
  });

  it('calls onConfirm with converted amount in cents when submitted', async () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <TransferModal
        isOpen={true}
        onClose={handleClose}
        accounts={mockAccounts}
        onConfirm={handleConfirm}
      />
    );

    const amountInput = screen.getByRole('textbox', { name: '划转金额' });
    fireEvent.change(amountInput, { target: { value: '500.50' } });

    const submitBtn = screen.getByRole('button', { name: '确认划转' });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          fromAccountId: 'acct_1',
          toAccountId: 'acct_2',
          amountCents: 50050,
        })
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('renders editing mode with delete action', async () => {
    const existingTx: Transaction = {
      id: 'tx_transfer_1',
      type: 'transfer',
      amount: 20000,
      accountId: 'acct_1',
      toAccountId: 'acct_2',
      date: '2026-11-20',
      note: '月度定投',
      categoryId: 'cat_transfer',
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-20T10:00:00Z',
    };

    const handleDelete = vi.fn();

    render(
      <TransferModal
        isOpen={true}
        onClose={vi.fn()}
        accounts={mockAccounts}
        editingTransaction={existingTx}
        onConfirm={vi.fn()}
        onDelete={handleDelete}
      />
    );

    expect(screen.getByText('编辑资金划转')).toBeInTheDocument();
    expect(screen.getByDisplayValue('200.00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('月度定投')).toBeInTheDocument();

    const deleteBtn = screen.getByTitle('删除此笔划转');
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);

    const dialogState = useConfirmStore.getState();
    expect(dialogState.isOpen).toBe(true);

    dialogState.handleResolve(true);

    await waitFor(() => {
      expect(handleDelete).toHaveBeenCalledWith('tx_transfer_1');
    });
  });
});
