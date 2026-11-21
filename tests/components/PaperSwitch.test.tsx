import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaperSwitch } from '../../src/components/ui/PaperSwitch';

describe('PaperSwitch Component', () => {
  it('renders switch with checked and unchecked states and handles click', () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <PaperSwitch checked={false} onChange={handleChange} aria-label="测试开关" />
    );

    const switchBtn = screen.getByRole('switch');
    expect(switchBtn).toHaveAttribute('aria-checked', 'false');
    expect(switchBtn).toHaveAttribute('title', '测试开关');

    fireEvent.click(switchBtn);
    expect(handleChange).toHaveBeenCalledWith(true);

    rerender(
      <PaperSwitch checked={true} onChange={handleChange} aria-label="测试开关" />
    );
    expect(switchBtn).toHaveAttribute('aria-checked', 'true');
  });

  it('does not trigger onChange when disabled', () => {
    const handleChange = vi.fn();
    render(
      <PaperSwitch checked={false} onChange={handleChange} disabled={true} aria-label="禁用开关" />
    );

    const switchBtn = screen.getByRole('switch');
    expect(switchBtn).toBeDisabled();
    fireEvent.click(switchBtn);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
