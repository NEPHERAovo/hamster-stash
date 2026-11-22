import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('catches render error and displays trace and recovery actions', () => {
    render(
      <RootErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RootErrorBoundary>
    );

    expect(screen.getByText('应用运行遇到异常')).toBeInTheDocument();
    expect(screen.getAllByText(/Test crash in child component/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '导出账单明细 (CSV)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出当前数据 (JSON)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除缓存并重载' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清空数据库并重置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制报错与Trace' })).toBeInTheDocument();
  });

  it('copies error trace to clipboard when button clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <RootErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RootErrorBoundary>
    );

    const copyBtn = screen.getByRole('button', { name: '复制报错与Trace' });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '已复制' })).toBeInTheDocument();
  });

  it('triggers emergency data export download', async () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;
    window.alert = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <RootErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RootErrorBoundary>
    );

    const exportBtn = screen.getByRole('button', { name: '导出当前数据 (JSON)' });
    await act(async () => {
      fireEvent.click(exportBtn);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it('triggers emergency CSV export download', async () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-csv-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;
    window.alert = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <RootErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </RootErrorBoundary>
    );

    const exportBtn = screen.getByRole('button', { name: '导出账单明细 (CSV)' });
    await act(async () => {
      fireEvent.click(exportBtn);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });
});
