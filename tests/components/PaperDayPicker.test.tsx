import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaperDayPicker } from '../../src/components/ui/PaperDayPicker';

describe('PaperDayPicker Component', () => {
  it('renders title, clear button, and all 31 days with entrance animation', () => {
    const handleSelect = vi.fn();
    const handleClear = vi.fn();

    const { container } = render(
      <PaperDayPicker
        title="选择每月还款日"
        selectedDay={15}
        onSelectDay={handleSelect}
        onClear={handleClear}
      />
    );

    const root = container.firstElementChild;
    expect(root?.classList.contains('picker-fade-enter')).toBe(true);
    expect(screen.getByText('选择每月还款日 (1-31日)')).toBeInTheDocument();
    expect(screen.getByText('清除设置')).toBeInTheDocument();

    const day15 = screen.getByRole('button', { name: '15' });
    expect(day15).toBeInTheDocument();
    expect(day15.className).toContain('bg-(--btn-primary-bg)');

    const day1 = screen.getByRole('button', { name: '1' });
    expect(day1).toBeInTheDocument();
    expect(day1.className).toContain('bg-(--paper-sunken)');

    const day31 = screen.getByRole('button', { name: '31' });
    expect(day31).toBeInTheDocument();
  });

  it('triggers onSelectDay when a day is clicked and onClear when clear is clicked', () => {
    const handleSelect = vi.fn();
    const handleClear = vi.fn();

    render(
      <PaperDayPicker
        title="选择每月还款日"
        selectedDay={undefined}
        onSelectDay={handleSelect}
        onClear={handleClear}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '28' }));
    expect(handleSelect).toHaveBeenCalledWith(28);

    fireEvent.click(screen.getByText('清除设置'));
    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});
