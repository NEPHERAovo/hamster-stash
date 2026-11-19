import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { PageHeader } from '../../src/components/layout/PageHeader';
import { BalanceSummaryCard } from '../../src/components/ledger/BalanceSummaryCard';
import { TransactionGroup } from '../../src/components/ledger/TransactionGroup';
import type { Transaction } from '../../src/types/transaction';
import type { Category } from '../../src/types/category';
import type { Account } from '../../src/types/account';

describe('Style & Invariant Contracts', () => {
  it('contract: PageHeader must NOT render obsolete meta-pill tags (GENERAL LEDGER etc)', () => {
    const { queryByText, container } = render(
      <PageHeader
        title="November 2026"
        showMonthStep={true}
      />
    );

    expect(queryByText(/GENERAL LEDGER/i)).toBeNull();
    expect(queryByText(/FOLIO NO/i)).toBeNull();
    expect(container.querySelector('.folio-meta-pill')).toBeNull();
  });

  it('contract: BalanceSummaryCard must NOT render redundant "${month} Ledger" title', () => {
    const summary = {
      totalIncome: 1500000,
      totalExpense: 32550,
      netBalance: 1467450,
      savingsRate: 0.97,
      dailyExpenseAvg: 1085,
    };

    const { queryByText } = render(
      <BalanceSummaryCard
        summary={summary}
        monthStr="2026-11"
      />
    );

    expect(queryByText(/November Ledger/i)).toBeNull();
    expect(queryByText(/11月 Ledger/i)).toBeNull();
    expect(queryByText('收入')).not.toBeNull();
    expect(queryByText('支出')).not.toBeNull();
    expect(queryByText('结余')).not.toBeNull();
  });

  it('contract: in TransactionGroup, the last transaction of each day must NOT have a bottom border', () => {
    const mockCategories: Category[] = [
      { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: 'var(--cat-food)', sortOrder: 1, createdAt: '', updatedAt: '' },
    ];
    const mockAccounts: Account[] = [
      { id: 'acct_1', name: '微信零钱', type: 'ewallet', balance: 10000, currency: 'CNY', icon: 'wallet', sortOrder: 1, createdAt: '', updatedAt: '' },
    ];
    const mockTxs: Transaction[] = [
      {
        id: 'tx_1',
        type: 'expense',
        amount: 3200,
        categoryId: 'cat_food',
        accountId: 'acct_1',
        date: '2026-11-12',
        createdAt: '2026-11-12T09:15:00Z',
        updatedAt: '2026-11-12T09:15:00Z',
      },
      {
        id: 'tx_2',
        type: 'expense',
        amount: 1500,
        categoryId: 'cat_food',
        accountId: 'acct_1',
        date: '2026-11-12',
        createdAt: '2026-11-12T12:30:00Z',
        updatedAt: '2026-11-12T12:30:00Z',
      },
    ];

    const { container } = render(
      <TransactionGroup
        transactions={mockTxs}
        categories={mockCategories}
        accounts={mockAccounts}
      />
    );

    const rows = container.querySelectorAll('.entry-row');
    expect(rows.length).toBe(2);

    const lastRow = rows[1];
    expect(
      lastRow.classList.contains('border-b-0') ||
      lastRow.classList.contains('last:border-b-0') ||
      lastRow.getAttribute('data-is-last') === 'true'
    ).toBe(true);
  });

  it('contract: index.css must NOT contain component-level business style selectors (Rule 9.3)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cssPath = path.resolve(__dirname, '../../src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    const bannedSelectors = [
      '.acct-row',
      '.set-row',
      '.tab-ears',
      '.cat-icon-badge',
      '.audit-filter-bar',
      '.stacked-bar-card',
      '.donut-chart',
      '.donut-row',
      '.acct-flow-grid',
      '.railway-ticket-card',
      '.slip-header',
      '.slip-line',
      '.receipt-stub {',
    ];

    for (const selector of bannedSelectors) {
      expect(cssContent.includes(selector)).toBe(false);
    }

    const lineCount = cssContent.split('\n').length;
    expect(lineCount).toBeLessThan(700);
  });
});
