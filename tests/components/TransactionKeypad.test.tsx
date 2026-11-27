import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TransactionKeypad } from '../../src/components/ledger/TransactionKeypad';

describe('TransactionKeypad', () => {
  it('triggers onDigit callback with telephone layout (1-2-3 top, 7-8-9 bottom) and h-13 sizing', () => {
    const handleDigit = vi.fn();
    render(
      <TransactionKeypad
        onDigit={handleDigit}
        onOperator={vi.fn()}
        onBackspace={vi.fn()}
        onClear={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const btn1 = screen.getByRole('button', { name: '1' });
    const btn2 = screen.getByRole('button', { name: '2' });
    const btnDot = screen.getByRole('button', { name: '.' });

    expect(btn1.className).toContain('h-13');
    expect(btn2.className).toContain('h-13');

    fireEvent.click(btn1);
    fireEvent.click(btn2);
    fireEvent.click(btnDot);

    expect(handleDigit).toHaveBeenCalledWith('1');
    expect(handleDigit).toHaveBeenCalledWith('2');
    expect(handleDigit).toHaveBeenCalledWith('.');
    expect(handleDigit).toHaveBeenCalledTimes(3);
  });

  it('triggers dual operators (+ / × and − / ÷), backspace, and submit callbacks', () => {
    const handleOperator = vi.fn();
    const handleBackspace = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <TransactionKeypad
        onDigit={vi.fn()}
        onOperator={handleOperator}
        onBackspace={handleBackspace}
        onClear={vi.fn()}
        onSubmit={handleSubmit}
        hasOperator={false}
      />
    );

    fireEvent.click(screen.getByTitle('加法与乘法运算'));
    expect(handleOperator).toHaveBeenCalledWith('add-mul');

    fireEvent.click(screen.getByTitle('减法与除法运算'));
    expect(handleOperator).toHaveBeenCalledWith('sub-div');

    fireEvent.click(screen.getByTitle('退格'));
    expect(handleBackspace).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    expect(handleSubmit).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByTitle('保存并继续记录下一笔'));
    expect(handleSubmit).toHaveBeenCalledWith(true);
  });

  it('never displays equal button even when hasOperator is true, submitting directly', () => {
    const handleSubmit = vi.fn();
    const handleClear = vi.fn();

    render(
      <TransactionKeypad
        onDigit={vi.fn()}
        onOperator={vi.fn()}
        onBackspace={vi.fn()}
        onClear={handleClear}
        onSubmit={handleSubmit}
        hasOperator={true}
        isEditing={true}
      />
    );

    // No equal button should be rendered
    expect(screen.queryByTitle('计算结果')).not.toBeInTheDocument();
    expect(screen.queryByText('=')).not.toBeInTheDocument();

    // Editing mode displays 保存 and C
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(handleSubmit).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByTitle('清空重置'));
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('places 再记一笔 before 退格 in the grid and clears on long-press without triggering backspace', () => {
    vi.useFakeTimers();
    const handleBackspace = vi.fn();
    const handleClear = vi.fn();

    render(
      <TransactionKeypad
        onDigit={vi.fn()}
        onOperator={vi.fn()}
        onBackspace={handleBackspace}
        onClear={handleClear}
        onSubmit={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    const continueBtn = screen.getByTitle('保存并继续记录下一笔');
    const deleteBtn = screen.getByTitle('退格');
    expect(buttons.indexOf(continueBtn)).toBeLessThan(buttons.indexOf(deleteBtn));

    fireEvent.pointerDown(deleteBtn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(deleteBtn);
    fireEvent.click(deleteBtn);

    expect(handleClear).toHaveBeenCalledTimes(1);
    expect(handleBackspace).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
