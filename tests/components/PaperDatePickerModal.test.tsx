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

  it('renders in date mode with header quick shortcuts and selects date upon confirmation', () => {
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

    // Header has quick shortcuts instead of redundant title
    expect(screen.getByRole('button', { name: '今天' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '昨天' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前天' })).toBeInTheDocument();
    expect(screen.queryByText('选择日期与时间')).not.toBeInTheDocument();

    expect(screen.getByText('2026年')).toBeInTheDocument();
    expect(screen.getByText('11月')).toBeInTheDocument();

    // Click day 20
    const day20 = screen.getByRole('button', { name: '20' });
    fireEvent.click(day20);

    // Selected date must have inverted foreground color and must not collide with text-(--ink-primary)
    expect(day20.className).toContain('text-(--btn-primary-fg)');
    expect(day20.className).not.toContain('text-(--ink-primary)');

    // Buttons are standard full-width (flex-1) and cancel button has color and border (sunken)
    const cancelBtn = screen.getByRole('button', { name: '取消' });
    const confirmBtn = screen.getByRole('button', { name: '确定' });
    expect(cancelBtn.className).toContain('flex-1');
    expect(cancelBtn.className).toContain('bg-(--paper-sunken)');
    expect(cancelBtn.className).toContain('border-(--rule-hairline)');
    expect(confirmBtn.className).toContain('flex-1');

    fireEvent.click(confirmBtn);

    expect(handleChange).toHaveBeenCalledWith('2026-11-20');
    expect(handleClose).toHaveBeenCalled();
  });

  it('allows clicking year and month in header to switch views and select year/month', () => {
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

    // Click year header to open year selector
    const yearBtn = screen.getByTitle('点击选择年份');
    fireEvent.click(yearBtn);

    // Pick 2025
    const y2025 = screen.getByRole('button', { name: '2025' });
    fireEvent.click(y2025);

    // Should return to calendar with year 2025
    expect(screen.getByText('2025年')).toBeInTheDocument();

    // Click month header to open month selector
    const monthBtn = screen.getByTitle('点击选择月份');
    fireEvent.click(monthBtn);

    // Pick 3月
    const m3 = screen.getByRole('button', { name: '3月' });
    fireEvent.click(m3);

    // Should return to calendar with March 2025
    expect(screen.getByText('3月')).toBeInTheDocument();

    // Pick day 10
    const day10 = screen.getByRole('button', { name: '10' });
    fireEvent.click(day10);

    const confirmBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(confirmBtn);

    expect(handleChange).toHaveBeenCalledWith('2025-03-10');
  });

  it('renders in month mode and selects month directly', () => {
    const handleChange = vi.fn();
    const handleClose = vi.fn();

    render(
      <PaperDatePickerModal
        isOpen={true}
        onClose={handleClose}
        mode="month"
        value="2026-11"
        onChange={handleChange}
      />
    );

    expect(screen.getByText('选择月份')).toBeInTheDocument();
    expect(screen.getByText('2026年')).toBeInTheDocument();

    // Pick 8月
    const m8 = screen.getByRole('button', { name: '8月' });
    fireEvent.click(m8);

    const confirmBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(confirmBtn);

    expect(handleChange).toHaveBeenCalledWith('2026-08');
  });

  it('renders in year mode and selects year directly', () => {
    const handleChange = vi.fn();
    const handleClose = vi.fn();

    render(
      <PaperDatePickerModal
        isOpen={true}
        onClose={handleClose}
        mode="year"
        value="2026"
        onChange={handleChange}
      />
    );

    expect(screen.getByText('选择年份')).toBeInTheDocument();

    // Pick 2024
    const y2024 = screen.getByRole('button', { name: '2024' });
    fireEvent.click(y2024);

    const confirmBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(confirmBtn);

    expect(handleChange).toHaveBeenCalledWith('2024');
  });

  it('selects quick shortcuts in date mode (今天, 昨天, 前天)', () => {
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

    expect(screen.getByRole('button', { name: '最近7天' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '本月' })).toBeInTheDocument();

    const day12 = screen.getByRole('button', { name: '12' });
    fireEvent.click(day12);

    const day18 = screen.getByRole('button', { name: '18' });
    fireEvent.click(day18);

    expect(day18.className).toContain('text-(--btn-primary-fg)');
    expect(day18.className).not.toContain('text-(--ink-primary)');

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

  it('renders in datetime mode and allows picking date, time presets, and wheel items without title time badge', () => {
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

    // Redundant top title and data subtitle are removed
    expect(screen.queryByText('选择日期与时间')).not.toBeInTheDocument();

    // Check presets in datetime mode header
    expect(screen.getByRole('button', { name: '今天' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '昨天' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '前天' })).toBeInTheDocument();

    // Time presets are directly left-aligned without redundant "时间" title/icon
    expect(screen.queryByText('时间')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '现在' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '08:00' })).toBeInTheDocument();

    // Pick a preset time such as 18:00
    const preset18 = screen.getByRole('button', { name: '18:00' });
    fireEvent.click(preset18);

    // Confirm
    const confirmBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(confirmBtn);

    expect(handleChange).toHaveBeenCalledWith('2026-11-15 18:00');
  });

  it('allows selecting specific date, hour and minute directly on the sliding drum wheel', () => {
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

    // Pick day 18 directly on calendar
    const day18 = screen.getByRole('button', { name: '18' });
    fireEvent.click(day18);

    expect(day18.className).toContain('text-(--btn-primary-fg)');
    expect(day18.className).not.toContain('text-(--ink-primary)');

    // Select hour 09 and minute 37 directly on drum wheel column
    const h09 = screen.getByRole('button', { name: '09时' });
    fireEvent.click(h09);
    const m37 = screen.getByRole('button', { name: '37分' });
    fireEvent.click(m37);

    // Verify center highlight lens has identical top and bottom hairline borders without shadow
    const centerLens = document.querySelector('.border-y.border-dashed');
    expect(centerLens).toBeInTheDocument();
    expect(centerLens?.className).toContain('border-(--rule-hairline)');
    expect(centerLens?.className).not.toContain('shadow-2xs');

    const confirmBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(confirmBtn);

    expect(handleChange).toHaveBeenCalledWith('2026-11-18 09:37');
  });

  it('updates selected value continuously when scrolling drum wheel columns', () => {
    const handleChange = vi.fn();

    render(
      <PaperDatePickerModal
        isOpen={true}
        onClose={vi.fn()}
        mode="datetime"
        value="2026-11-15 14:30"
        onChange={handleChange}
      />
    );

    const h09 = screen.getByRole('button', { name: '09时' });
    const hourContainer = h09.closest('.overflow-y-auto');
    expect(hourContainer).toBeInTheDocument();

    // Scroll hour wheel to index 7 (07:00)
    fireEvent.scroll(hourContainer!, { target: { scrollTop: 7 * 32 } });

    const confirmBtn = screen.getByRole('button', { name: '确定' });
    fireEvent.click(confirmBtn);

    expect(handleChange).toHaveBeenCalledWith('2026-11-15 07:30');
  });

  it('allows returning from year or month subview back to calendar', () => {
    render(
      <PaperDatePickerModal
        isOpen={true}
        onClose={vi.fn()}
        mode="date"
        value="2026-11-15"
      />
    );

    // Go to month view
    const monthHeaderBtn = screen.getByTitle('点击选择月份');
    fireEvent.click(monthHeaderBtn);

    // Click return to calendar
    const returnToCalBtn = screen.getByTitle('返回日历');
    fireEvent.click(returnToCalBtn);
    expect(screen.getByText('2026年')).toBeInTheDocument();
    expect(screen.getByText('11月')).toBeInTheDocument();

    // Go to year view from calendar
    const yearHeaderBtn = screen.getByTitle('点击选择年份');
    fireEvent.click(yearHeaderBtn);

    // Click return
    const returnBtn = screen.getByTitle('返回');
    fireEvent.click(returnBtn);
    expect(screen.getByText('11月')).toBeInTheDocument();
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

    const backdrop = screen.getByTestId('date-picker-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
