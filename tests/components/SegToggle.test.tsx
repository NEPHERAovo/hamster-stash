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

  it('renders optional count without parentheses using compact typography and distinct ink tone', () => {
    const handleChange = vi.fn();
    render(
      <SegToggle
        options={[
          { value: 'using', label: '在用', count: 12 },
          { value: 'sold', label: '已出', count: 105 },
          { value: 'all', label: '全部', count: 117 },
        ]}
        value="using"
        onChange={handleChange}
        size="xs"
      />
    );

    expect(screen.queryByText(/\(|\)|（|）/)).toBeNull();

    const activeBtn = screen.getByRole('button', { name: /在用/ });
    const inactiveBtn = screen.getByRole('button', { name: /已出/ });
    expect(activeBtn.className).toContain('px-1.5');

    const activeCount = screen.getByText('12');
    const inactiveCount = screen.getByText('105');

    expect(activeCount.className).toContain('text-[10px]');
    expect(activeCount.className).toContain('opacity-65');
    expect(inactiveCount.className).toContain('text-[10px]');
    expect(inactiveCount.className).toContain('opacity-70');

    fireEvent.click(inactiveBtn);
    expect(handleChange).toHaveBeenCalledWith('sold');
  });
});
