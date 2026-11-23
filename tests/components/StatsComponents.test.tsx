import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DonutChart } from '../../src/components/stats/DonutChart';
import { CategoryLegend } from '../../src/components/stats/CategoryLegend';
import { MonthlyTrendBar } from '../../src/components/stats/MonthlyTrendBar';
import { SpendingRankList } from '../../src/components/stats/SpendingRankList';
import { CategoryDetailSubPage } from '../../src/components/stats/CategoryDetailSubPage';
import { CategoryBadge } from '../../src/components/ui/CategoryBadge';
import { StatsView } from '../../src/components/stats/StatsView';
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
      <DonutChart items={mockItems} totalExpense={70000} circumference={326.7} periodKey="2026-11" />
    );

    expect(screen.getByText('总支出')).toBeInTheDocument();
    expect(screen.getByText('¥700.00')).toBeInTheDocument();

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains('donut-ring-spin')).toBe(true);

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

  it('renders MonthlyTrendBar with vertical combo chart and interactive selection', () => {
    const handleStepPrev = vi.fn();
    const handleStepNext = vi.fn();

    render(
      <MonthlyTrendBar
        title="月度支出趋势"
        trends={mockTrends}
        onStepPrev={handleStepPrev}
        onStepNext={handleStepNext}
        canStepNext={true}
      />
    );

    expect(screen.getByText('月度支出趋势')).toBeInTheDocument();
    expect(screen.getByText('09月')).toBeInTheDocument();
    expect(screen.getByText('10月')).toBeInTheDocument();
    expect(screen.getAllByText('11月').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('¥700.00')).toBeInTheDocument();

    const prevBtn = screen.getByTitle('上个月');
    const nextBtn = screen.getByTitle('下个月');
    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();

    fireEvent.click(prevBtn);
    expect(handleStepPrev).toHaveBeenCalledTimes(1);

    fireEvent.click(nextBtn);
    expect(handleStepNext).toHaveBeenCalledTimes(1);
  });

  it('renders SpendingRankList with category breakdown rows and triggers click', () => {
    const handleSelect = vi.fn();
    render(<SpendingRankList items={mockItems} totalExpense={70000} onSelectCategory={handleSelect} />);

    expect(screen.getByText('餐饮')).toBeInTheDocument();
    expect(screen.getByText('¥420.00')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('交通')).toBeInTheDocument();
    expect(screen.getByText('¥280.00')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();

    const foodBtn = screen.getByText('餐饮').closest('button');
    expect(foodBtn).not.toBeNull();
    fireEvent.click(foodBtn!);
    expect(handleSelect).toHaveBeenCalledWith('cat_food');
  });

  it('renders CategoryDetailSubPage with summary metrics and transactions', () => {
    render(
      <CategoryDetailSubPage
        data={{
          category: {
            id: 'cat_food',
            name: '餐饮',
            type: 'expense',
            icon: 'utensils',
            color: 'var(--cat-food)',
            sortOrder: 1,
            createdAt: '',
            updatedAt: '',
          },
          periodLabel: '2026年11月',
          transactions: [
            {
              id: 'tx_1',
              amount: 42000,
              type: 'expense',
              categoryId: 'cat_food',
              accountId: 'acct_1',
              date: '2026-11-05',
              time: '12:00',
              note: '午餐牛肉面',
              createdAt: '2026-11-05T12:00:00Z',
              updatedAt: '2026-11-05T12:00:00Z',
            },
          ],
          totalExpense: 42000,
          categoryPercentage: 60,
        }}
        categories={[
          {
            id: 'cat_food',
            name: '餐饮',
            type: 'expense',
            icon: 'utensils',
            color: 'var(--cat-food)',
            sortOrder: 1,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        accounts={[
          {
            id: 'acct_1',
            name: '现金',
            type: 'savings',
            balance: 100000,
            sortOrder: 1,
            createdAt: '',
            updatedAt: '',
          },
        ]}
      />
    );

    expect(screen.getByText('2026年11月')).toBeInTheDocument();
    expect(screen.getByText('¥420.00')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('午餐牛肉面')).toBeInTheDocument();
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

  it('renders StatsView with 支出构成 without italic font styling', () => {
    const mockTxs = [
      {
        id: 'tx_1',
        type: 'expense' as const,
        amount: 5000,
        categoryId: 'cat_food',
        accountId: 'acct_1',
        date: '2026-11-15',
        createdAt: '',
        updatedAt: '',
      },
    ];

    render(
      <StatsView
        allTransactions={mockTxs}
        categories={[
          {
            id: 'cat_food',
            name: '餐饮',
            type: 'expense',
            icon: 'utensils',
            color: 'var(--cat-food)',
            sortOrder: 1,
            createdAt: '',
            updatedAt: '',
          },
        ]}
        accounts={[
          {
            id: 'acct_1',
            name: '现金',
            type: 'savings',
            balance: 100000,
            sortOrder: 1,
            createdAt: '',
            updatedAt: '',
          },
        ]}
      />
    );

    const titleEl = screen.getByText('支出构成');
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.classList.contains('italic')).toBe(false);
  });

  it('renders SpendingRankList with MoM (环比) change and 新增 badge', () => {
    const itemsWithMom: CategoryStatItem[] = [
      {
        categoryId: 'c1',
        name: '餐饮',
        color: 'var(--cat-food)',
        amount: 32000,
        percentage: 60,
        dashLength: 196,
        dashOffset: 0,
        previousAmount: 20000,
        momRate: 60,
        isNew: false,
      },
      {
        categoryId: 'c2',
        name: '交通',
        color: 'var(--cat-transit)',
        amount: 15000,
        percentage: 30,
        dashLength: 90,
        dashOffset: 196,
        previousAmount: 0,
        momRate: null,
        isNew: true,
      },
      {
        categoryId: 'c3',
        name: '居家',
        color: 'var(--cat-home)',
        amount: 5000,
        percentage: 10,
        dashLength: 30,
        dashOffset: 286,
        previousAmount: 5000,
        momRate: 0,
        isNew: false,
      },
    ];

    render(<SpendingRankList items={itemsWithMom} totalExpense={52000} txType="expense" />);

    expect(screen.getByText('餐饮')).toBeInTheDocument();
    expect(screen.getByText('¥320.00')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('+¥120.00')).toBeInTheDocument();

    expect(screen.getByText('交通')).toBeInTheDocument();
    expect(screen.getByText('¥150.00')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('+¥150.00')).toBeInTheDocument();

    expect(screen.getByText('居家')).toBeInTheDocument();
    expect(screen.getByText('= ¥0.00')).toBeInTheDocument();
  });

  it('SpendingRankList truncates to Top 5 items and supports expand/collapse', () => {
    const sevenItems = Array.from({ length: 7 }, (_, i) => ({
      categoryId: `cat_${i + 1}`,
      name: `分类${i + 1}`,
      color: 'var(--cat-other)',
      amount: (7 - i) * 1000,
      percentage: 14,
      dashLength: 40,
      dashOffset: i * 40,
      previousAmount: 1000,
    }));

    render(<SpendingRankList items={sevenItems} totalExpense={28000} />);

    expect(screen.getByText('分类1')).toBeInTheDocument();
    expect(screen.getByText('分类5')).toBeInTheDocument();
    expect(screen.queryByText('分类6')).not.toBeInTheDocument();
    expect(screen.queryByText('分类7')).not.toBeInTheDocument();
    expect(screen.getByText('展开')).toBeInTheDocument();

    fireEvent.click(screen.getByText('展开'));
    expect(screen.getByText('分类6')).toBeInTheDocument();
    expect(screen.getByText('分类7')).toBeInTheDocument();
    expect(screen.getByText('收起')).toBeInTheDocument();

    fireEvent.click(screen.getByText('收起'));
    expect(screen.queryByText('分类6')).not.toBeInTheDocument();
    expect(screen.getByText('展开')).toBeInTheDocument();
  });

  it('StatsView switches dimensions smoothly inside separate chart cards', () => {
    const mockTxs = [
      {
        id: 'tx_exp',
        type: 'expense' as const,
        amount: 50000,
        categoryId: 'cat_food',
        accountId: 'acct_1',
        date: '2026-11-15',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'tx_inc',
        type: 'income' as const,
        amount: 120000,
        categoryId: 'cat_sal',
        accountId: 'acct_1',
        date: '2026-11-10',
        createdAt: '',
        updatedAt: '',
      },
    ];

    render(
      <StatsView
        allTransactions={mockTxs}
        categories={[
          { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: 'var(--cat-food)', sortOrder: 1, createdAt: '', updatedAt: '' },
          { id: 'cat_sal', name: '工资', type: 'income', icon: 'money', color: 'var(--cat-income)', sortOrder: 1, createdAt: '', updatedAt: '' },
        ]}
        accounts={[
          { id: 'acct_1', name: '招商银行', type: 'savings', balance: 500000, sortOrder: 1, createdAt: '', updatedAt: '' },
        ]}
      />
    );

    expect(screen.getByText('支出构成')).toBeInTheDocument();
    expect(screen.getByText('月度支出趋势')).toBeInTheDocument();
    expect(screen.getByText('总支出')).toBeInTheDocument();

    const incomeButtons = screen.getAllByRole('button', { name: '收入' });
    expect(incomeButtons.length).toBe(2);

    fireEvent.click(incomeButtons[0]);
    expect(screen.getByText('收入构成')).toBeInTheDocument();
    expect(screen.getByText('总收入')).toBeInTheDocument();
    expect(screen.getByText('月度支出趋势')).toBeInTheDocument();

    const balanceButtons = screen.getAllByRole('button', { name: '结余' });
    expect(balanceButtons.length).toBe(2);
    fireEvent.click(balanceButtons[1]);
    expect(screen.getByText('月度结余趋势')).toBeInTheDocument();
    expect(screen.getByText('收入构成')).toBeInTheDocument();

    fireEvent.click(balanceButtons[0]);
    expect(screen.getByText('收支对比')).toBeInTheDocument();
    expect(screen.getAllByText('净结余').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('结余储蓄率')).toBeInTheDocument();
    expect(screen.getAllByText('+¥1200.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('+¥500.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('+¥700.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('¥500.00')).toBeInTheDocument();
    expect(screen.getAllByText('¥700.00').length).toBeGreaterThanOrEqual(1);
  });

  it('renders category icon badge in SpendingRankList rows', () => {
    const itemsWithIcons: CategoryStatItem[] = [
      {
        categoryId: 'cat_food',
        name: '餐饮',
        icon: 'utensils',
        color: 'var(--cat-food)',
        amount: 30000,
        percentage: 100,
        dashLength: 326.7,
        dashOffset: 0,
        previousAmount: 20000,
      },
    ];

    const { container } = render(<SpendingRankList items={itemsWithIcons} txType="expense" />);
    expect(screen.getByText('餐饮')).toBeInTheDocument();
    expect(screen.getByText('¥300.00')).toBeInTheDocument();
    expect(screen.getByText('+¥100.00')).toBeInTheDocument();
    const badge = container.querySelector('.category-badge');
    expect(badge).not.toBeNull();
  });

  it('supports custom date range mode and opens date picker modal on center date click', () => {
    const mockTxs = [
      {
        id: 'tx_exp',
        type: 'expense' as const,
        amount: 50000,
        categoryId: 'cat_food',
        accountId: 'acct_1',
        date: '2026-11-15',
        createdAt: '',
        updatedAt: '',
      },
    ];

    render(
      <StatsView
        allTransactions={mockTxs}
        categories={[
          { id: 'cat_food', name: '餐饮', type: 'expense', icon: 'utensils', color: 'var(--cat-food)', sortOrder: 1, createdAt: '', updatedAt: '' },
        ]}
        accounts={[
          { id: 'acct_1', name: '招商银行', type: 'savings', balance: 500000, sortOrder: 1, createdAt: '', updatedAt: '' },
        ]}
      />
    );

    const customModeBtn = screen.getByRole('button', { name: '自定义' });
    fireEvent.click(customModeBtn);

    const centerDateBtn = screen.getByTitle('点击选择日期');
    expect(centerDateBtn).toBeInTheDocument();

    fireEvent.click(centerDateBtn);
    expect(screen.getByText('选择日期范围')).toBeInTheDocument();
  });
});
