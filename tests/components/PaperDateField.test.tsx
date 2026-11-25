import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaperDateField } from '../../src/components/ui/PaperDateField';

describe('PaperDateField', () => {
  it('renders value or placeholder and updates value on modal confirm', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PaperDateField value="" onChange={onChange} placeholder="选择日期" />
    );

    const trigger = screen.getByRole('button', { name: '选择日期' });
    expect(trigger).toBeInTheDocument();

    rerender(<PaperDateField value="2026-11-10" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '2026-11-10' }));

    expect(screen.getByText('2026年')).toBeInTheDocument();
    expect(screen.getByText('11月')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    fireEvent.click(screen.getByRole('button', { name: '确定' }));

    expect(onChange).toHaveBeenCalledWith('2026-11-15');
  });

  it('renders formatted date range in range mode', () => {
    const onRangeChange = vi.fn();
    render(
      <PaperDateField
        mode="range"
        rangeValue={{ start: '2026-11-01', end: '2026-11-20' }}
        onRangeChange={onRangeChange}
      />
    );

    expect(screen.getByRole('button', { name: '2026-11-01 至 2026-11-20' })).toBeInTheDocument();
  });
});
