import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChartPieIcon as PieChart } from '@phosphor-icons/react';
import { PaperEmptyState } from '../../src/components/ui/PaperEmptyState';

describe('PaperEmptyState Component', () => {
  it('renders dashed variant with title, description, and animation class when animate is true', () => {
    const { container } = render(
      <PaperEmptyState
        title="暂无流水记录"
        description="本月暂无收支明细"
        variant="dashed"
        animate
      />
    );

    expect(screen.getByText('暂无流水记录')).toBeInTheDocument();
    expect(screen.getByText('本月暂无收支明细')).toBeInTheDocument();
    expect(container.firstElementChild?.classList.contains('filter-fade-enter')).toBe(true);
  });

  it('renders card and plain variants cleanly', () => {
    const { rerender } = render(
      <PaperEmptyState
        icon={PieChart}
        title="本周期暂无支出记录"
        variant="card"
      />
    );

    expect(screen.getByText('本周期暂无支出记录')).toBeInTheDocument();

    rerender(
      <PaperEmptyState
        title="暂无可用账户"
        variant="plain"
      />
    );

    expect(screen.getByText('暂无可用账户')).toBeInTheDocument();
  });
});
