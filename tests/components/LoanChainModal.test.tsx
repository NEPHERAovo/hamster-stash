import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoanChainModal } from '../../src/components/assets/LoanChainModal';
import { useLedgerStore } from '../../src/stores/useLedgerStore';
import { useAccountStore } from '../../src/stores/useAccountStore';
import type { Transaction } from '../../src/types/transaction';
import type { Account } from '../../src/types/account';

describe('LoanChainModal', () => {
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

  const mockPendingLoan: Transaction = {
    id: 'tx_loan_1',
    type: 'loan',
    amount: 100000,
    repaidAmount: 30000,
    loanDirection: 'lend',
    loanRole: 'origin',
    loanParty: '张三',
    loanStatus: 'repaying',
    categoryId: 'cat_loan',
    accountId: 'acct_1',
    date: '2026-11-01',
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    useAccountStore.setState({
      accounts: [mockAccount],
    });
  });

  it('renders minimal empty state when no pending settlements exist', () => {
    useLedgerStore.setState({
      settlementSummary: {
        totalPendingLendCents: 0,
        totalPendingBorrowCents: 0,
        totalPendingReimbCents: 0,
        pendingLoans: [],
        pendingReimbursements: [],
      },
      transactions: [],
    });

    render(<LoanChainModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('暂无待收或待报销记录')).toBeInTheDocument();
    expect(screen.queryByText('所有借款与垫付已结清')).toBeNull();
  });

  it('renders pending loan details and triggers settlement', async () => {
    const settleLoanSpy = vi.fn();
    useLedgerStore.setState({
      settlementSummary: {
        totalPendingLendCents: 70000,
        totalPendingBorrowCents: 0,
        totalPendingReimbCents: 0,
        pendingLoans: [mockPendingLoan],
        pendingReimbursements: [],
      },
      transactions: [mockPendingLoan],
      settleLoanOrigin: settleLoanSpy,
    });

    render(<LoanChainModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/张三 · 借据/)).toBeInTheDocument();
    expect(screen.getAllByText('¥1000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('¥300.00')).toBeInTheDocument();
    expect(screen.getAllByText(/700\.00/).length).toBeGreaterThanOrEqual(1);

    const settleBtn = screen.getByText(/一键结清剩余/);
    expect(settleBtn).toBeInTheDocument();

    await fireEvent.click(settleBtn);
    expect(settleLoanSpy).toHaveBeenCalledWith('tx_loan_1', 'acct_1');
  });
});
