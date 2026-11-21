import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionKeypad } from '../../src/components/ledger/TransactionKeypad';

describe('TransactionKeypad', () => {
  it('triggers onDigit callback when number or dot buttons are clicked', () => {
    const handleDigit = vi.fn();
    render(
      <TransactionKeypad
        onDigit={handleDigit}
        onOperator={vi.fn()}
        onBackspace={vi.fn()}
        onClear={vi.fn()}
        onEqual={vi.fn()}
        onSubmit={vi.fn()}
        hasOperator={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: '.' }));

    expect(handleDigit).toHaveBeenCalledWith('7');
    expect(handleDigit).toHaveBeenCalledWith('8');
    expect(handleDigit).toHaveBeenCalledWith('.');
    expect(handleDigit).toHaveBeenCalledTimes(3);
  });

  it('triggers operator, backspace, and submit callbacks', () => {
    const handleOperator = vi.fn();
    const handleBackspace = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <TransactionKeypad
        onDigit={vi.fn()}
        onOperator={handleOperator}
        onBackspace={handleBackspace}
        onClear={vi.fn()}
        onEqual={vi.fn()}
        onSubmit={handleSubmit}
        hasOperator={false}
      />
    );

    fireEvent.click(screen.getByTitle('加法运算'));
    expect(handleOperator).toHaveBeenCalledWith('+');

    fireEvent.click(screen.getByTitle('减法运算'));
    expect(handleOperator).toHaveBeenCalledWith('-');

    fireEvent.click(screen.getByTitle('退格'));
    expect(handleBackspace).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    expect(handleSubmit).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByTitle('保存并继续记录下一笔'));
    expect(handleSubmit).toHaveBeenCalledWith(true);
  });

  it('renders equal button when hasOperator is true and clear button when editing', () => {
    const handleEqual = vi.fn();
    const handleClear = vi.fn();

    render(
      <TransactionKeypad
        onDigit={vi.fn()}
        onOperator={vi.fn()}
        onBackspace={vi.fn()}
        onClear={handleClear}
        onEqual={handleEqual}
        onSubmit={vi.fn()}
        hasOperator={true}
        isEditing={true}
      />
    );

    fireEvent.click(screen.getByTitle('计算结果'));
    expect(handleEqual).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle('清空重置'));
    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});
