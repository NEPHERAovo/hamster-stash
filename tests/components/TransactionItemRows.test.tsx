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
    type: 'cash',
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
    type: 'investment',
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

  it('renders subTag pill when transaction has subTag', () => {
    const tx: Transaction = {
      id: 'tx_exp_subtag',
      type: 'expense',
      amount: 3200,
      categoryId: 'cat_food',
      accountId: 'acct_1',
      date: '2026-11-20',
      note: '肯德基',
      subTag: '外卖',
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

    expect(screen.getByText('肯德基')).toBeInTheDocument();
    expect(screen.getByText('外卖')).toBeInTheDocument();
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

    expect(screen.getByText('借出')).toBeInTheDocument();
    expect(screen.getByText('张三')).toBeInTheDocument();
    expect(screen.getByText('未结清')).toBeInTheDocument();
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
});
