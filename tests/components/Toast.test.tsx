import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Toast } from '../../src/components/ui/Toast';
import { toast, useToastStore } from '../../src/stores/useToastStore';

describe('Toast Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ currentToast: null });
  });

  it('renders nothing when there is no active toast', () => {
    const { container } = render(<Toast />);
    expect(container.firstChild).toBeNull();
  });

  it('renders at top with notification text when toast is called', () => {
    render(<Toast />);

    act(() => {
      toast.success('已保存成功');
    });

    expect(screen.getByText('已保存成功')).toBeInTheDocument();
    const container = screen.getByText('已保存成功').closest('.fixed');
    expect(container?.className).toContain('top-0');
  });
});
