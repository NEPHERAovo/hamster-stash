import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaperChip } from '../../src/components/ui/PaperChip';

describe('PaperChip Component', () => {
  it('renders unselected chip and handles click event', () => {
    const handleClick = vi.fn();
    render(<PaperChip onClick={handleClick}>全部流水</PaperChip>);

    const chip = screen.getByRole('button', { name: '全部流水' });
    expect(chip).toBeInTheDocument();
    expect(chip.className).toContain('bg-(--paper-sunken)');

    fireEvent.click(chip);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders selected active state with primary styling and handles disabled state', () => {
    const handleClick = vi.fn();
    const { rerender } = render(
      <PaperChip selected onClick={handleClick}>
        已选期数
      </PaperChip>
    );

    const chip = screen.getByRole('button', { name: '已选期数' });
    expect(chip.className).toContain('bg-(--btn-primary-bg)');
    expect(chip.className).toContain('text-(--btn-primary-fg)');

    rerender(
      <PaperChip disabled onClick={handleClick}>
        禁用选项
      </PaperChip>
    );

    const disabledChip = screen.getByRole('button', { name: '禁用选项' });
    expect(disabledChip).toBeDisabled();
    fireEvent.click(disabledChip);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
