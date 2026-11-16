import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BalanceSummaryCard } from '../../src/components/ledger/BalanceSummaryCard';
import type { MonthSummary } from '../../domain/finance/balanceCalculator';

describe('BalanceSummaryCard component', () => {
  it('renders positive net balance with SURPLUS stamp and clean label', () => {
    const surplusSummary: MonthSummary = {
      totalIncome: 1250000, // ¥12,500.00
      totalExpense: 32550,   // ¥325.50
      netBalance: 1217450,   // ¥12,174.50
      savingsRate: 0.97,
      dailyExpenseAvg: 1085,
    };

    render(<BalanceSummaryCard summary={surplusSummary} monthStr="2026-11" />);

    expect(screen.queryByText(/November Ledger/i)).toBeNull();

    expect(screen.getByText('本月结余')).toBeInTheDocument();

    const stamp = screen.getByText('盈余');
    expect(stamp).toBeInTheDocument();
    expect(stamp.className).toContain('stamp-income');

    const balances = screen.getAllByText(/12174\.50/);
    expect(balances.length).toBe(2);

    expect(screen.getByText('+12500.00')).toBeInTheDocument();
    expect(screen.getByText('325.50')).toBeInTheDocument();
  });

  it('renders deficit balance with 超支 stamp when netBalance is negative', () => {
    const deficitSummary: MonthSummary = {
      totalIncome: 100000,
      totalExpense: 300000,
      netBalance: -200000,
      savingsRate: 0,
      dailyExpenseAvg: 10000,
    };

    render(<BalanceSummaryCard summary={deficitSummary} monthStr="2026-11" />);

    const stamp = screen.getByText('超支');
    expect(stamp).toBeInTheDocument();
    expect(stamp.className).not.toContain('stamp-income');

    const balances = screen.getAllByText(/-2000\.00/);
    expect(balances.length).toBe(2);
  });
});
