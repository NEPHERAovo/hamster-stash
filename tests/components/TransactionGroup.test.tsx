import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TransactionGroup } from '../../src/components/ledger/TransactionGroup';
import { useThemeStore } from '../../src/stores/useThemeStore';
import type { Transaction } from '../../src/types/transaction';
import type { Category } from '../../src/types/category';
import type { Account } from '../../src/types/account';

describe('TransactionGroup component', () => {
  const mockCategories: Category[] = [
    { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: 'var(--cat-food)', sortOrder: 1, createdAt: '', updatedAt: '' },
    { id: 'cat_transit', name: '交通', type: 'expense', icon: 'train-front', color: 'var(--cat-transit)', sortOrder: 2, createdAt: '', updatedAt: '' },
  ];

  const mockAccounts: Account[] = [
    { id: 'acct_1', name: '招行卡', type: 'savings', balance: 500000, currency: 'CNY', icon: 'landmark', sortOrder: 1, createdAt: '', updatedAt: '' },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: 'tx_1',
      type: 'expense',
      amount: 28800,
      categoryId: 'cat_transit',
      accountId: 'acct_1',
      date: '2026-11-12',
      isReimbursable: true,
      createdAt: '2026-11-12T14:20:00Z',
      updatedAt: '2026-11-12T14:20:00Z',
      note: '客户拜访高铁票',
    },
    {
      id: 'tx_2',
      type: 'expense',
      amount: 3200,
      categoryId: 'cat_food',
      accountId: 'acct_1',
      date: '2026-11-12',
      createdAt: '2026-11-12T09:15:00Z',
      updatedAt: '2026-11-12T09:15:00Z',
      note: '耶加雪菲手冲咖啡',
    },
    {
      id: 'tx_3',
      type: 'expense',
      amount: 550,
      categoryId: 'cat_transit',
      accountId: 'acct_1',
      date: '2026-11-11',
      createdAt: '2026-11-11T08:30:00Z',
      updatedAt: '2026-11-11T08:30:00Z',
      note: '早高峰通勤',
    },
  ];

  it('renders transactions grouped by day with day summaries and eliminates last item bottom border', () => {
    const { container } = render(
      <TransactionGroup
        transactions={mockTransactions}
        categories={mockCategories}
        accounts={mockAccounts}
      />
    );

    const dividers = container.querySelectorAll('.day-divider');
    expect(dividers.length).toBe(2);

    const rows = container.querySelectorAll('.entry-row');
    expect(rows.length).toBe(3);

    expect(rows[1].getAttribute('data-is-last')).toBe('true');
    expect(rows[1].className).toContain('!border-b-0');

    expect(rows[2].getAttribute('data-is-last')).toBe('true');
    expect(rows[2].className).toContain('!border-b-0');
  });

  it('filters by reimbursable transactions when filter pill is clicked', () => {
    render(
      <TransactionGroup
        transactions={mockTransactions}
        categories={mockCategories}
        accounts={mockAccounts}
      />
    );

    expect(screen.getByText('客户拜访高铁票')).toBeInTheDocument();
    expect(screen.getByText('耶加雪菲手冲咖啡')).toBeInTheDocument();

    const reimbBtn = screen.getByRole('button', { name: '待报销' });
    fireEvent.click(reimbBtn);

    expect(screen.getByText('客户拜访高铁票')).toBeInTheDocument();
    expect(screen.queryByText('耶加雪菲手冲咖啡')).toBeNull();
  });

  it('invokes onSelectTransaction when clicking a transaction row', () => {
    const handleSelect = vi.fn();
    render(
      <TransactionGroup
        transactions={mockTransactions}
        categories={mockCategories}
        accounts={mockAccounts}
        onSelectTransaction={handleSelect}
      />
    );

    const firstItem = screen.getByText('客户拜访高铁票');
    fireEvent.click(firstItem);

    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tx_1', note: '客户拜访高铁票' })
    );
  });

  it('renders ticket loading skeleton when isLoading is true and transactions are empty', () => {
    const { container } = render(
      <TransactionGroup
        transactions={[]}
        categories={mockCategories}
        accounts={mockAccounts}
        isLoading={true}
      />
    );

    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
    expect(screen.queryByText('暂无流水记录')).toBeNull();
  });

  it('renders empty state when isLoading is false and transactions are empty', () => {
    render(
      <TransactionGroup
        transactions={[]}
        categories={mockCategories}
        accounts={mockAccounts}
        isLoading={false}
      />
    );

    expect(screen.getByText('暂无流水记录')).toBeInTheDocument();
  });

  it('applies contained styling with mx-0 when contained prop is set', () => {
    const { container } = render(
      <TransactionGroup
        transactions={mockTransactions}
        categories={mockCategories}
        accounts={mockAccounts}
        contained={true}
      />
    );

    const card = container.querySelector('#ledgerSurface > div');
    expect(card?.className).toContain('mx-0');
    expect(card?.className).not.toContain('mx-4');
  });

  it('displays full specific dates in group header when searching', () => {
    useThemeStore.setState({ uiStyle: 'paper' });
    render(
      <TransactionGroup
        transactions={mockTransactions}
        searchTransactions={mockTransactions}
        categories={mockCategories}
        accounts={mockAccounts}
      />
    );

    const input = screen.getByPlaceholderText('搜索备注、分类、账户...');
    fireEvent.change(input, { target: { value: '咖啡' } });

    expect(screen.getByText('耶加雪菲手冲咖啡')).toBeInTheDocument();
    expect(screen.getByText('2026.11.12')).toBeInTheDocument();
  });

  it('displays full specific dates in modern skin when searching', () => {
    useThemeStore.setState({ uiStyle: 'modern' });
    render(
      <TransactionGroup
        transactions={mockTransactions}
        searchTransactions={mockTransactions}
        categories={mockCategories}
        accounts={mockAccounts}
      />
    );

    const input = screen.getByPlaceholderText('搜索备注、分类、账户...');
    fireEvent.change(input, { target: { value: '咖啡' } });

    expect(screen.getByText('耶加雪菲手冲咖啡')).toBeInTheDocument();
    expect(screen.getByText('2026年11月12日')).toBeInTheDocument();
  });

  it('renders amortization stamp for installment transactions', () => {
    const amortizedTx: Transaction = {
      id: 'tx_amortize',
      type: 'expense',
      amount: 60000, // 600.00元
      categoryId: 'cat_food',
      accountId: 'acct_1',
      date: '2026-11-12',
      ext: { amortize: { enabled: true, months: 6 } },
      createdAt: '2026-11-12T10:00:00Z',
      updatedAt: '2026-11-12T10:00:00Z',
      note: '半年度健身卡',
    };

    render(
      <TransactionGroup
        transactions={[amortizedTx]}
        categories={mockCategories}
        accounts={mockAccounts}
      />
    );

    expect(screen.getByText('半年度健身卡')).toBeInTheDocument();
    expect(screen.getByText('分期 6期 · ¥100.00/月')).toBeInTheDocument();
  });

  it('keeps empty state stable without replaying entrance animation when switching filter tabs', () => {
    render(
      <TransactionGroup
        transactions={[]}
        categories={mockCategories}
        accounts={mockAccounts}
        isLoading={false}
      />
    );

    const emptyContainer = screen.getByText('暂无流水记录').closest('.bg-\\(--paper-sheet\\)');
    expect(emptyContainer).not.toBeNull();
    expect(emptyContainer?.classList.contains('filter-fade-enter')).toBe(false);

    const reimbursementBtn = screen.getByText('待报销');
    fireEvent.click(reimbursementBtn);

    const emptyAfterSwitch = screen.getByText('暂无流水记录').closest('.bg-\\(--paper-sheet\\)');
    expect(emptyAfterSwitch).toBe(emptyContainer);
  });
});
