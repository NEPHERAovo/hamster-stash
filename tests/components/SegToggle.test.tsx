import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegToggle } from '../../src/components/ui/SegToggle';

describe('SegToggle Component', () => {
  it('renders all options and handles selection change', () => {
    const handleChange = vi.fn();
    render(
      <SegToggle
        options={[
          { value: 'using', label: '在用 (1)' },
          { value: 'sold', label: '已出 (1)' },
          { value: 'all', label: '全部 (2)' },
        ]}
        value="using"
        onChange={handleChange}
      />
    );

    const usingBtn = screen.getByRole('button', { name: '在用 (1)' });
    const soldBtn = screen.getByRole('button', { name: '已出 (1)' });

    expect(usingBtn.className).toContain('bg-(--toggle-active-bg)');
    expect(usingBtn.className).toContain('font-medium');
    expect(usingBtn.className).toContain('tabular-nums');
    expect(soldBtn.className).toContain('font-medium');
    expect(soldBtn.className).toContain('tabular-nums');
    expect(usingBtn.className).not.toContain('font-semibold');

    fireEvent.click(soldBtn);
    expect(handleChange).toHaveBeenCalledWith('sold');
  });
});
