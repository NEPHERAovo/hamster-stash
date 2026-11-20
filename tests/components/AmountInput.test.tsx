import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AmountInput } from '../../src/components/ui/AmountInput';

describe('AmountInput Component', () => {
  it('renders currency symbol and input element', () => {
    const handleChange = vi.fn();
    render(<AmountInput value="12.50" onChange={handleChange} />);

    expect(screen.getByText('¥')).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: '金额输入' });
    expect(input).toHaveValue('12.50');
  });

  it('filters out non-numeric characters and allows at most two decimals', () => {
    const handleChange = vi.fn();
    render(<AmountInput value="" onChange={handleChange} />);

    const input = screen.getByRole('textbox', { name: '金额输入' });
    fireEvent.change(input, { target: { value: '12.34' } });
    expect(handleChange).toHaveBeenCalledWith('12.34');

    handleChange.mockClear();
    fireEvent.change(input, { target: { value: '12.345' } });
    expect(handleChange).not.toHaveBeenCalled();

    handleChange.mockClear();
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('supports custom currency symbols and sizes', () => {
    const handleChange = vi.fn();
    render(
      <AmountInput
        value="100"
        onChange={handleChange}
        currencySymbol="$"
        size="lg"
        variant="surface"
      />
    );

    expect(screen.getByText('$')).toBeInTheDocument();
  });
});
