import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { OffsetTrayPanel } from '../../src/components/ledger/OffsetTrayPanel';
import type { Transaction } from '../../src/types/transaction';
import type { Category } from '../../src/types/category';

describe('OffsetTrayPanel Component (TDD)', () => {
  const mockCategories: Category[] = [
    {
      id: 'cat_food',
      name: '餐饮',
      type: 'expense',
      icon: 'fork-knife',
      color: '#ff6b6b',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'cat_play',
      name: '娱乐',
      type: 'expense',
      icon: 'game-controller',
      color: '#4ecdc4',
      sortOrder: 2,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'cat_travel',
      name: '差旅',
      type: 'expense',
      icon: 'airplane',
      color: '#45b7d1',
      sortOrder: 3,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const mockExpenses: Transaction[] = [
    {
      id: 'tx_dinner',
      type: 'expense',
      amount: 18000,
      categoryId: 'cat_food',
      accountId: 'acct_1',
      date: '2026-11-20',
      note: '聚餐火锅',
      createdAt: '2026-11-20T18:00:00.000Z',
      updatedAt: '2026-11-20T18:00:00.000Z',
    },
    {
      id: 'tx_movie',
      type: 'expense',
      amount: 10000,
      categoryId: 'cat_play',
      accountId: 'acct_1',
      date: '2026-11-21',
      note: '看电影门票',
      createdAt: '2026-11-21T14:00:00.000Z',
      updatedAt: '2026-11-21T14:00:00.000Z',
    },
    {
      id: 'tx_flight',
      type: 'expense',
      amount: 85000,
      categoryId: 'cat_travel',
      accountId: 'acct_1',
      date: '2026-10-15',
      note: '出差机票',
      isReimbursable: true,
      createdAt: '2026-10-15T09:00:00.000Z',
      updatedAt: '2026-10-15T09:00:00.000Z',
    },
  ];

  const mockOffsetSummaryMap = new Map<string, number>([
    ['tx_dinner', 6000], // 180 - 60 = 120 left
  ]);

  it('renders empty message when no candidates available', () => {
    render(
      <OffsetTrayPanel
        candidateExpenses={[]}
        categories={mockCategories}
        offsetSummaryMap={new Map()}
        onSelectOffsetExpense={vi.fn()}
        onClearOffsetExpense={vi.fn()}
      />
    );

    expect(screen.getByText('暂无待抵扣的支出')).toBeInTheDocument();
  });

  it('renders candidate expenses with remaining amount, original amount, and reimbursable tag', () => {
    render(
      <OffsetTrayPanel
        candidateExpenses={mockExpenses}
        categories={mockCategories}
        offsetSummaryMap={mockOffsetSummaryMap}
        onSelectOffsetExpense={vi.fn()}
        onClearOffsetExpense={vi.fn()}
      />
    );

    expect(screen.getByText('聚餐火锅')).toBeInTheDocument();
    expect(screen.getByText('看电影门票')).toBeInTheDocument();
    expect(screen.getByText('出差机票')).toBeInTheDocument();

    expect(screen.getByText('待收 ¥120.00')).toBeInTheDocument();
    expect(screen.getByText('原 ¥180.00')).toBeInTheDocument();
    expect(screen.getByText('待报销')).toBeInTheDocument();
  });

  it('calls onSelectOffsetExpense when an expense is clicked', () => {
    const handleSelect = vi.fn();
    render(
      <OffsetTrayPanel
        candidateExpenses={mockExpenses}
        categories={mockCategories}
        offsetSummaryMap={mockOffsetSummaryMap}
        onSelectOffsetExpense={handleSelect}
        onClearOffsetExpense={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('聚餐火锅'));
    expect(handleSelect).toHaveBeenCalledWith(mockExpenses[0]);
  });

  it('renders clear button when offsetTransactionId is set and triggers onClearOffsetExpense', () => {
    const handleClear = vi.fn();
    render(
      <OffsetTrayPanel
        candidateExpenses={mockExpenses}
        categories={mockCategories}
        offsetTransactionId="tx_dinner"
        offsetSummaryMap={mockOffsetSummaryMap}
        onSelectOffsetExpense={vi.fn()}
        onClearOffsetExpense={handleClear}
      />
    );

    const clearBtn = screen.getByText('取消抵扣');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('renders pure category chips when candidates span > 1 category and count > 2, and filters list on click', () => {
    render(
      <OffsetTrayPanel
        candidateExpenses={mockExpenses}
        categories={mockCategories}
        offsetSummaryMap={mockOffsetSummaryMap}
        onSelectOffsetExpense={vi.fn()}
        onClearOffsetExpense={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '全部' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '餐饮' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '娱乐' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '差旅' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '餐饮' }));

    expect(screen.getByText('聚餐火锅')).toBeInTheDocument();
    expect(screen.queryByText('看电影门票')).not.toBeInTheDocument();
    expect(screen.queryByText('出差机票')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    expect(screen.getByText('看电影门票')).toBeInTheDocument();
  });

  it('omits category filter chips when candidates count is <= 2', () => {
    render(
      <OffsetTrayPanel
        candidateExpenses={mockExpenses.slice(0, 2)}
        categories={mockCategories}
        offsetSummaryMap={mockOffsetSummaryMap}
        onSelectOffsetExpense={vi.fn()}
        onClearOffsetExpense={vi.fn()}
      />
    );

    expect(screen.queryByText('全部')).not.toBeInTheDocument();
    expect(screen.getByText('聚餐火锅')).toBeInTheDocument();
    expect(screen.getByText('看电影门票')).toBeInTheDocument();
  });
});
