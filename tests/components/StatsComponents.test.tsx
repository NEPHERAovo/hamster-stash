import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DonutChart } from '../../src/components/stats/DonutChart';
import { CategoryLegend } from '../../src/components/stats/CategoryLegend';
import { MonthlyTrendBar } from '../../src/components/stats/MonthlyTrendBar';
import { SpendingRankList } from '../../src/components/stats/SpendingRankList';
import { CategoryBadge } from '../../src/components/ui/CategoryBadge';
import type { CategoryStatItem, TrendItem } from '../../src/domain/finance/periodStats';

describe('Modular Stats & UI Components', () => {
  const mockItems: CategoryStatItem[] = [
    {
      categoryId: 'cat_food',
      name: '餐饮',
      color: 'var(--cat-food)',
      amount: 42000,
      percentage: 60,
      dashLength: 196,
      dashOffset: 0,
    },
    {
      categoryId: 'cat_transit',
      name: '交通',
      color: 'var(--cat-transit)',
      amount: 28000,
      percentage: 40,
      dashLength: 130,
      dashOffset: 196,
    },
  ];

  const mockTrends: TrendItem[] = [
    { label: '09月', amount: 35000, percentage: 50 },
    { label: '10月', amount: 70000, percentage: 100 },
    { label: '11月', amount: 56000, percentage: 80 },
  ];

  it('renders DonutChart with total amount and SVG segments', () => {
    const { container } = render(
      <DonutChart items={mockItems} totalExpense={70000} circumference={326.7} />
    );

    expect(screen.getByText('总支出')).toBeInTheDocument();
    expect(screen.getByText('¥700.00')).toBeInTheDocument();

    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
  });

  it('renders CategoryLegend with category names and percentage numbers', () => {
    render(<CategoryLegend items={mockItems} />);

    expect(screen.getByText('餐饮')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('交通')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('renders MonthlyTrendBar with trend items and labels', () => {
    render(<MonthlyTrendBar title="月度支出趋势" trends={mockTrends} />);

    expect(screen.getByText('月度支出趋势')).toBeInTheDocument();
    expect(screen.getByText('09月')).toBeInTheDocument();
    expect(screen.getByText('10月')).toBeInTheDocument();
    expect(screen.getByText('11月')).toBeInTheDocument();
    expect(screen.getByText('¥700.00')).toBeInTheDocument();
  });

  it('renders SpendingRankList with stacked track and rank rows', () => {
    render(<SpendingRankList items={mockItems} totalExpense={70000} />);

    expect(screen.getByText('支出构成')).toBeInTheDocument();
    expect(screen.getByText('¥ 700.00')).toBeInTheDocument();
    expect(screen.getByText('¥420.00')).toBeInTheDocument();
    expect(screen.getByText('¥280.00')).toBeInTheDocument();
  });

  it('renders CategoryBadge cleanly with Lucide icon and low-saturation background', () => {
    const { container } = render(
      <CategoryBadge
        category={{
          id: 'cat_food',
          name: '餐饮',
          type: 'expense',
          icon: 'utensils',
          color: 'var(--cat-food)',
          sortOrder: 1,
          createdAt: '',
          updatedAt: '',
        }}
        type="expense"
      />
    );

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});
