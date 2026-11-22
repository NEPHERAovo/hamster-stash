import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountList } from '../../src/components/assets/AccountList';
import type { Account } from '../../src/types/account';

const mockAccounts: Account[] = [
  {
    id: 'acct-1',
    name: '微信钱包',
    type: 'savings',
    balance: 50000,
    currency: 'CNY',
    sortOrder: 1,
    icon: 'wallet',
    includeInNetWorth: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'acct-2',
    name: '招商银行',
    note: '日常工资卡',
    type: 'savings',
    balance: 200000,
    currency: 'CNY',
    sortOrder: 2,
    icon: 'landmark',
    includeInNetWorth: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'acct-3',
    name: '招行信用卡',
    type: 'credit',
    balance: -150000,
    currency: 'CNY',
    sortOrder: 3,
    icon: 'credit-card',
    includeInNetWorth: true,
    creditLimit: 2000000,
    repaymentDay: 23,
    repaymentAccountId: 'acct-2',
    autoRepay: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

describe('AccountList Component', () => {
  it('renders savings and credit accounts with repayment day and available credit', () => {
    const handleSelect = vi.fn();
    render(<AccountList accounts={mockAccounts} onSelectAccount={handleSelect} />);

    expect(screen.getByText('储蓄账户')).toBeInTheDocument();
    expect(screen.getByText('信用账户')).toBeInTheDocument();
    expect(screen.getByText('微信钱包')).toBeInTheDocument();
    expect(screen.getByText('招商银行')).toBeInTheDocument();
    expect(screen.getByText('日常工资卡')).toBeInTheDocument();
    expect(screen.getByText('招行信用卡')).toBeInTheDocument();
    expect(screen.getByText('23日还款')).toBeInTheDocument();
    expect(screen.getByText('剩余 ¥18500.00')).toBeInTheDocument();
    expect(screen.getByText('-¥ 1500.00')).toBeInTheDocument();
  });

  it('triggers onSelectAccount when account row is clicked in multi-account state', () => {
    const handleSelect = vi.fn();
    render(<AccountList accounts={mockAccounts} onSelectAccount={handleSelect} />);

    const accountRow = screen.getByText('微信钱包');
    fireEvent.click(accountRow);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(mockAccounts[0]);
  });
});
