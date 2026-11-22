import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RootErrorBoundary } from '../../src/components/ui/RootErrorBoundary';

const ThrowingComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test crash in child component');
  }
  return <div>正常的子组件内容</div>;
};

describe('RootErrorBoundary Component', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children normally when no error occurs', () => {
    render(
      <RootErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </RootErrorBoundary>
    );

    expect(screen.getByText('正常的子组件内容')).toBeInTheDocument();
  });

  it('catches render error and displays recovery UI', () => {
    render(
      <RootErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RootErrorBoundary>
    );

    expect(screen.getByText('应用运行遇到异常')).toBeInTheDocument();
    expect(screen.getByText('Test crash in child component')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清理新版本缓存并重试' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置本地所有数据' })).toBeInTheDocument();
  });

  it('handles reload button click', () => {
    const originalReload = window.location.reload;
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload: reloadMock },
    });

    render(
      <RootErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RootErrorBoundary>
    );

    const reloadBtn = screen.getByRole('button', { name: '重新加载' });
    fireEvent.click(reloadBtn);
    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload: originalReload },
    });
  });
});
