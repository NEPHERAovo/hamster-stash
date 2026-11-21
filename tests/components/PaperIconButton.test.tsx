import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaretLeftIcon as ChevronLeft } from '@phosphor-icons/react';
import { PaperIconButton } from '../../src/components/ui/PaperIconButton';

describe('PaperIconButton Component', () => {
  it('renders icon button with default md size and triggers onClick', () => {
    const handleClick = vi.fn();
    render(
      <PaperIconButton
        icon={ChevronLeft}
        onClick={handleClick}
        aria-label="返回上一页"
      />
    );

    const btn = screen.getByRole('button', { name: '返回上一页' });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('size-7');

    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('supports size sm and lg and handles disabled state', () => {
    const handleClick = vi.fn();
    const { rerender } = render(
      <PaperIconButton
        icon={ChevronLeft}
        size="sm"
        disabled
        onClick={handleClick}
        aria-label="禁用按钮"
      />
    );

    const btn = screen.getByRole('button', { name: '禁用按钮' });
    expect(btn).toBeDisabled();
    expect(btn.className).toContain('size-6');

    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();

    rerender(
      <PaperIconButton
        icon={ChevronLeft}
        size="lg"
        aria-label="大按钮"
      />
    );

    expect(screen.getByRole('button', { name: '大按钮' }).className).toContain('size-8');
  });

  it('supports primary variant and rounded full', () => {
    render(
      <PaperIconButton
        icon={ChevronLeft}
        variant="primary"
        rounded="full"
        aria-label="主要浮动按钮"
      />
    );

    const btn = screen.getByRole('button', { name: '主要浮动按钮' });
    expect(btn.className).toContain('rounded-full');
    expect(btn.className).toContain('bg-(--btn-primary-bg)');
  });
});
