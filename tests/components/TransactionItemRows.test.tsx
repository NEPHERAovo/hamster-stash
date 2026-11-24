import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionItem } from '../../src/components/ledger/TransactionItem';
import type { Transaction } from '../../src/types/transaction';
import type { Account } from '../../src/types/account';
import type { Category } from '../../src/types/category';

describe('TransactionItem Polymorphic Rows', () => {
  const mockAccountFrom: Account = {
    id: 'acct_1',
    name: '日常活钱',
    type: 'savings',
    balance: 100000,
    currency: 'CNY',
    icon: 'wallet',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  };

  const mockAccountTo: Account = {
    id: 'acct_2',
    name: '稳健理财',
    type: 'savings',
    balance: 200000,
    currency: 'CNY',
    icon: 'trending-up',
    sortOrder: 2,
    createdAt: '',
    updatedAt: '',
  };

  const mockCategory: Category = {
    id: 'cat_food',
    name: '餐饮',
    type: 'expense',
    icon: 'utensils',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  };

  it('renders standard expense row correctly', () => {
    const tx: Transaction = {
      id: 'tx_exp',
      type: 'expense',
      amount: 4500,
      categoryId: 'cat_food',
      accountId: 'acct_1',
      date: '2026-11-20',
      note: '午餐',
      createdAt: '2026-11-20T12:00:00Z',
      updatedAt: '2026-11-20T12:00:00Z',
    };

    render(
      <TransactionItem
        transaction={tx}
        category={mockCategory}
        account={mockAccountFrom}
      />
    );

    expect(screen.getByText('午餐')).toBeInTheDocument();
    expect(screen.getByText('-45.00')).toBeInTheDocument();
  });

  it('renders transfer row with From -> To account direction and transfer badge', () => {
    const tx: Transaction = {
      id: 'tx_transfer',
      type: 'transfer',
      amount: 500000,
      categoryId: 'cat_transfer',
      accountId: 'acct_1',
      toAccountId: 'acct_2',
      date: '2026-11-20',
      note: '定投理财',
      createdAt: '2026-11-20T14:00:00Z',
      updatedAt: '2026-11-20T14:00:00Z',
    };

    render(
      <TransactionItem
        transaction={tx}
        account={mockAccountFrom}
        toAccount={mockAccountTo}
      />
    );

    expect(screen.getByText('定投理财')).toBeInTheDocument();
    expect(screen.getByText('划转')).toBeInTheDocument();
    expect(screen.getByText('日常活钱')).toBeInTheDocument();
    expect(screen.getByText('稳健理财')).toBeInTheDocument();
    expect(screen.getByText('⇄ 5000.00')).toBeInTheDocument();
  });

  it('renders loan row with party and direction badge', () => {
    const tx: Transaction = {
      id: 'tx_loan',
      type: 'loan',
      amount: 100000,
      categoryId: 'cat_lend_out',
      accountId: 'acct_1',
      date: '2026-11-20',
      loanDirection: 'lend',
      loanRole: 'origin',
      loanParty: '张三',
      loanStatus: 'pending',
      createdAt: '2026-11-20T10:00:00Z',
      updatedAt: '2026-11-20T10:00:00Z',
    };

    render(
      <TransactionItem
        transaction={tx}
        account={mockAccountFrom}
      />
    );

    expect(screen.getByText('借出·张三')).toBeInTheDocument();
    expect(screen.getByText('-1000.00')).toBeInTheDocument();
  });

  it('triggers onClick when clicked', () => {
    const handleClick = vi.fn();
    const tx: Transaction = {
      id: 'tx_exp',
      type: 'expense',
      amount: 2000,
      categoryId: 'cat_food',
      accountId: 'acct_1',
      date: '2026-11-20',
      createdAt: '2026-11-20T12:00:00Z',
      updatedAt: '2026-11-20T12:00:00Z',
    };

    render(
      <TransactionItem
        transaction={tx}
        category={mockCategory}
        account={mockAccountFrom}
        onClick={handleClick}
      />
    );

    fireEvent.click(screen.getByText('-20.00'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders concise offset and installment badges on standard rows', () => {
    const amortizedTx: Transaction = {
      id: 'tx_amortized',
      type: 'expense',
      amount: 1200000,
      categoryId: 'cat_food',
      accountId: 'acct_1',
      date: '2026-11-20',
      note: '电脑采购',
      ext: { amortize: { enabled: true, months: 12 } },
      createdAt: '2026-11-20T12:00:00Z',
      updatedAt: '2026-11-20T12:00:00Z',
    };

    const { rerender } = render(
      <TransactionItem
        transaction={amortizedTx}
        category={mockCategory}
        account={mockAccountFrom}
      />
    );

    expect(screen.getByText('12期·共¥12000.00')).toBeInTheDocument();

    const offsetIncomeTx: Transaction = {
      id: 'tx_offset_in',
      type: 'income',
      amount: 5000,
      categoryId: 'cat_food',
      accountId: 'acct_1',
      date: '2026-11-20',
      note: '朋友转账',
      offsetTransactionId: 'tx_orig',
      createdAt: '2026-11-20T12:00:00Z',
      updatedAt: '2026-11-20T12:00:00Z',
    };

    rerender(
      <TransactionItem
        transaction={offsetIncomeTx}
        category={mockCategory}
        account={mockAccountFrom}
        offsetTargetNote="聚餐AA火锅很贵的一顿"
      />
    );

    expect(screen.getByText('抵扣·聚餐AA火锅…')).toBeInTheDocument();

    const offsetExpenseTx: Transaction = {
      id: 'tx_offset_exp',
      type: 'expense',
      amount: 10000,
      categoryId: 'cat_food',
      accountId: 'acct_1',
      date: '2026-11-20',
      note: '聚餐垫付',
      createdAt: '2026-11-20T12:00:00Z',
      updatedAt: '2026-11-20T12:00:00Z',
    };

    rerender(
      <TransactionItem
        transaction={offsetExpenseTx}
        category={mockCategory}
        account={mockAccountFrom}
        offsetAmount={10000}
      />
    );

    expect(screen.getByText('抵扣·全额')).toBeInTheDocument();
  });
});
