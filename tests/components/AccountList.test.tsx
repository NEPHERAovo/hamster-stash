import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountList } from '../../src/components/assets/AccountList';
import type { Account } from '../../src/types/account';

const mockAccounts: Account[] = [
  {
    id: 'acct-1',
    name: '微信钱包',
    type: 'ewallet',
    balance: 50000,
    icon: 'wallet',
    includeInNetWorth: true,
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: 'acct-2',
    name: '招商银行',
    type: 'bank',
    balance: 200000,
    icon: 'credit-card',
    includeInNetWorth: true,
    createdAt: 1000,
    updatedAt: 1000,
  },
];

describe('AccountList Component', () => {
  it('renders account rows and account count', () => {
    const handleSelect = vi.fn();
    render(<AccountList accounts={mockAccounts} onSelectAccount={handleSelect} />);

    expect(screen.getByText('共 2 笔')).toBeInTheDocument();
    expect(screen.getByText('微信钱包')).toBeInTheDocument();
    expect(screen.getByText('招商银行')).toBeInTheDocument();
  });

  it('triggers onSelectAccount when account row is clicked in multi-account state', () => {
    const handleSelect = vi.fn();
    render(<AccountList accounts={mockAccounts} onSelectAccount={handleSelect} />);

    const accountRow = screen.getByText('微信钱包');
    fireEvent.mouseDown(accountRow, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseUp(accountRow);
    fireEvent.click(accountRow);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(mockAccounts[0]);
  });
});
