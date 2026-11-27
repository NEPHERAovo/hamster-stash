import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { WalletIcon } from '@phosphor-icons/react';
import { IconBadge } from '../../src/components/ui/IconBadge';
import { CategoryBadge } from '../../src/components/ui/CategoryBadge';

describe('IconBadge', () => {
  it('renders string icon names and component icons with consistent badge styling', () => {
    const { container: c1 } = render(<IconBadge icon="coffee" size="sm" tone="neutral" />);
    const badge1 = c1.firstElementChild as HTMLElement;
    expect(badge1.className).toContain('size-6');
    expect(badge1.className).toContain('rounded-(--badge-radius)');
    expect(badge1.querySelector('svg')).toHaveAttribute('width', '15');

    const { container: c2 } = render(<IconBadge icon={WalletIcon} size="lg" tone="income" />);
    const badge2 = c2.firstElementChild as HTMLElement;
    expect(badge2.className).toContain('size-9');
    expect(badge2.className).toContain('text-(--color-income)');
    expect(badge2.querySelector('svg')).toHaveAttribute('width', '20');
  });

  it('delegates CategoryBadge rendering through IconBadge', () => {
    const { container } = render(<CategoryBadge type="income" iconName="coins" size="md" />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.className).toContain('size-7.5');
    expect(badge.className).toContain('text-(--color-income)');
    expect(badge.querySelector('svg')).toHaveAttribute('width', '17');
  });
});
