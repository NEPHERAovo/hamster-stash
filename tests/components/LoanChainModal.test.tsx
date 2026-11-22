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

    expect(screen.getByText('暂无借贷与分期记录')).toBeInTheDocument();
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

    expect(screen.getByText(/借给 张三/)).toBeInTheDocument();
    expect(screen.getByText('+¥700.00')).toBeInTheDocument();
    expect(screen.getByText('待收资产')).toBeInTheDocument();

    const settleBtn = screen.getByText('一键结清');
    expect(settleBtn).toBeInTheDocument();

    await fireEvent.click(settleBtn);
    expect(settleLoanSpy).toHaveBeenCalledWith('tx_loan_1', 'acct_1');
  });

  it('renders pending installment details and triggers transaction selection', () => {
    const handleSelectTx = vi.fn();
    const mockInstallmentTx: Transaction = {
      id: 'tx_laptop_1',
      type: 'expense',
      amount: 1200000,
      categoryId: 'cat_shop',
      accountId: 'acct_1',
      date: '2026-06-01',
      note: 'MacBook Pro 分期',
      ext: { amortize: { enabled: true, months: 12 } },
      createdAt: '',
      updatedAt: '',
    };

    useLedgerStore.setState({
      settlementSummary: {
        lendPendingAmount: 0,
        reimbPendingAmount: 0,
        borrowPendingAmount: 0,
        installmentPendingAmount: 600000,
        netPendingAmount: -600000,
        pendingLoans: [],
        pendingReimbursements: [],
        pendingInstallments: [
          {
            transaction: mockInstallmentTx,
            totalAmount: 1200000,
            months: 12,
            startMonth: '2026-06',
            elapsedMonths: 6,
            remainingMonths: 6,
            monthlyAmount: 100000,
            remainingDebt: 600000,
          },
        ],
      },
      transactions: [mockInstallmentTx],
    });

    render(
      <LoanChainModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectTransaction={handleSelectTx}
      />
    );

    expect(screen.getByText('MacBook Pro 分期')).toBeInTheDocument();
    expect(screen.getByText('分期待还')).toBeInTheDocument();
    expect(screen.getByText('-¥6000.00')).toBeInTheDocument();
    expect(screen.getByText(/每月约 ¥1000\.00/)).toBeInTheDocument();

    const viewBtn = screen.getByText('查看流水');
    fireEvent.click(viewBtn);
    expect(handleSelectTx).toHaveBeenCalledWith(mockInstallmentTx);
  });

  it('filters items by tab category and handles reimbursement settlement', async () => {
    const settleReimbSpy = vi.fn();
    const mockReimbTx: Transaction = {
      id: 'tx_reimb_1',
      type: 'expense',
      amount: 48000,
      categoryId: 'cat_food',
      accountId: 'acct_1',
      date: '2026-11-05',
      note: '客户商务宴请',
      isReimbursable: true,
      voucher: { id: 'v1', name: 'invoice.pdf', size: '1.2MB' },
      createdAt: '',
      updatedAt: '',
    };

    useLedgerStore.setState({
      settlementSummary: {
        lendPendingAmount: 0,
        reimbPendingAmount: 48000,
        borrowPendingAmount: 0,
        installmentPendingAmount: 0,
        netPendingAmount: 48000,
        pendingLoans: [],
        pendingReimbursements: [mockReimbTx],
        pendingInstallments: [],
      },
      transactions: [mockReimbTx],
      settleReimbursement: settleReimbSpy,
    });

    render(<LoanChainModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('客户商务宴请')).toBeInTheDocument();
    expect(screen.getByText('待报销')).toBeInTheDocument();
    expect(screen.getByText('+¥480.00')).toBeInTheDocument();
    expect(screen.getByText(/📎 凭证已附/)).toBeInTheDocument();

    const reimbTab = screen.getByRole('button', { name: '报销' });
    fireEvent.click(reimbTab);
    expect(screen.getByText('客户商务宴请')).toBeInTheDocument();

    const loanTab = screen.getByRole('button', { name: '借贷' });
    fireEvent.click(loanTab);
    expect(screen.getByText('暂无未结借贷记录')).toBeInTheDocument();

    const allTab = screen.getByRole('button', { name: '全部' });
    fireEvent.click(allTab);

    const settleBtn = screen.getByText('报销到账');
    await fireEvent.click(settleBtn);
    expect(settleReimbSpy).toHaveBeenCalledWith('tx_reimb_1', 'acct_1');
  });
});
