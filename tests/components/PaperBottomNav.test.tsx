import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PaperBottomNav } from '../../src/components/layout/PaperBottomNav';

describe('PaperBottomNav component', () => {
  it('renders all builtin navigation tabs', () => {
    const handleTabChange = vi.fn();
    render(<PaperBottomNav currentTab="ledger" onTabChange={handleTabChange} />);

    expect(screen.getByText('账本')).toBeInTheDocument();
    expect(screen.getByText('统计')).toBeInTheDocument();
    expect(screen.getByText('资产')).toBeInTheDocument();
  });

  it('renders perforated vertical dashed divider lines between tabs', () => {
    const { container } = render(<PaperBottomNav currentTab="ledger" onTabChange={vi.fn()} />);

    const dividers = container.querySelectorAll('.border-dashed');
    expect(dividers.length).toBe(2);
  });

  it('invokes onTabChange when clicking a tab button', () => {
    const handleTabChange = vi.fn();
    render(<PaperBottomNav currentTab="ledger" onTabChange={handleTabChange} />);

    fireEvent.click(screen.getByText('统计'));
    expect(handleTabChange).toHaveBeenCalledWith('stats');
  });

  it('renders add button with dynamic title based on currentTab', () => {
    const handleAdd = vi.fn();
    const { rerender } = render(
      <PaperBottomNav
        currentTab="ledger"
        onTabChange={vi.fn()}
        showAddButton={true}
        onAddClick={handleAdd}
      />
    );
    expect(screen.getByTitle('记账')).toBeInTheDocument();

    rerender(
      <PaperBottomNav
        currentTab="items"
        onTabChange={vi.fn()}
        showAddButton={true}
        onAddClick={handleAdd}
      />
    );
    expect(screen.getByTitle('新建物品')).toBeInTheDocument();

    rerender(
      <PaperBottomNav
        currentTab="assets"
        onTabChange={vi.fn()}
        showAddButton={true}
        onAddClick={handleAdd}
      />
    );
    expect(screen.getByTitle('新建账户')).toBeInTheDocument();
  });

  it('renders persistent sliding accent indicator bar for active tab', () => {
    const { rerender } = render(<PaperBottomNav currentTab="ledger" onTabChange={vi.fn()} />);
    const bar = screen.getByTestId('paper-nav-active-bar');
    expect(bar).toBeInTheDocument();
    expect(bar.style.left).toBe('0%');

    rerender(<PaperBottomNav currentTab="stats" onTabChange={vi.fn()} />);
    expect(screen.getByTestId('paper-nav-active-bar')).toBeInTheDocument();
  });
});
