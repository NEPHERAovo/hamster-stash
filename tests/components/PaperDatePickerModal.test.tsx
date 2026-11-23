import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PaperDatePickerModal } from '../../src/components/ui/PaperDatePickerModal';
import { todayDate } from '../../src/utils/date';

describe('PaperDatePickerModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <PaperDatePickerModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders in date mode and selects date upon confirmation', () => {
    const handleChange = vi.fn();
    const handleClose = vi.fn();

    render(
      <PaperDatePickerModal
        isOpen={true}
        onClose={handleClose}
        mode="date"
        value="2026-11-15"
        onChange={handleChange}
      />
    );

    expect(screen.getByText('选择日期')).toBeInTheDocument();
    expect(screen.getByText('2026年11月')).toBeInTheDocument();

    // Click day 20
    const day20 = screen.getByRole('button', { name: '20' });
    fireEvent.click(day20);

    // Click confirm
    const confirmBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(confirmBtn);

    expect(handleChange).toHaveBeenCalledWith('2026-11-20');
    expect(handleClose).toHaveBeenCalled();
  });

  it('selects quick shortcuts in date mode (今天, 昨天)', () => {
    const handleChange = vi.fn();
    const handleClose = vi.fn();

    render(
      <PaperDatePickerModal
        isOpen={true}
        onClose={handleClose}
        mode="date"
        value="2026-11-01"
        onChange={handleChange}
      />
    );

    const todayBtn = screen.getByRole('button', { name: '今天' });
    fireEvent.click(todayBtn);

    const confirmBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(confirmBtn);

    expect(handleChange).toHaveBeenCalledWith(todayDate());
  });

  it('renders in range mode and selects start and end dates', () => {
    const handleRangeChange = vi.fn();
    const handleClose = vi.fn();

    render(
      <PaperDatePickerModal
        isOpen={true}
        onClose={handleClose}
        mode="range"
        rangeValue={{ start: '2026-11-05', end: '2026-11-10' }}
        onRangeChange={handleRangeChange}
      />
    );

    expect(screen.getByText('选择日期范围')).toBeInTheDocument();
    expect(screen.getByText('2026-11-05 至 2026-11-10')).toBeInTheDocument();

    // Click day 12 for start, day 18 for end
    const day12 = screen.getByRole('button', { name: '12' });
    fireEvent.click(day12);

    const day18 = screen.getByRole('button', { name: '18' });
    fireEvent.click(day18);

    const confirmBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(confirmBtn);

    expect(handleRangeChange).toHaveBeenCalledWith({
      start: '2026-11-12',
      end: '2026-11-18',
    });
  });

  it('applies range presets such as 最近7天 and 本月', () => {
    const handleRangeChange = vi.fn();
    const handleClose = vi.fn();

    render(
      <PaperDatePickerModal
        isOpen={true}
        onClose={handleClose}
        mode="range"
        rangeValue={{ start: '2026-11-01', end: '2026-11-05' }}
        onRangeChange={handleRangeChange}
      />
    );

    const last7DaysBtn = screen.getByRole('button', { name: '最近7天' });
    fireEvent.click(last7DaysBtn);

    const confirmBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(confirmBtn);

    expect(handleRangeChange).toHaveBeenCalled();
    const result = handleRangeChange.mock.calls[0][0];
    expect(result.end).toBe(todayDate());
  });

  it('renders in datetime mode and allows picking date and time', () => {
    const handleChange = vi.fn();
    const handleClose = vi.fn();

    render(
      <PaperDatePickerModal
        isOpen={true}
        onClose={handleClose}
        mode="datetime"
        value="2026-11-15 14:30"
        onChange={handleChange}
      />
    );

    expect(screen.getByText('选择日期与时间')).toBeInTheDocument();

    // Switch to time tab
    const timeTab = screen.getByRole('button', { name: /时间/ });
    fireEvent.click(timeTab);

    // Pick a preset time such as 18:00
    const preset18 = screen.getByRole('button', { name: '18:00' });
    fireEvent.click(preset18);

    // Confirm
    const confirmBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(confirmBtn);

    expect(handleChange).toHaveBeenCalledWith('2026-11-15 18:00');
  });

  it('closes on cancel button click and backdrop click', () => {
    const handleClose = vi.fn();

    render(
      <PaperDatePickerModal
        isOpen={true}
        onClose={handleClose}
        mode="date"
      />
    );

    const cancelBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Backdrop click
    const backdrop = screen.getByTestId('date-picker-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
