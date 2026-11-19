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
});
