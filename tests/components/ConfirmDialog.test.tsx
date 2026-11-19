import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { confirmAction, useConfirmStore } from '../../src/stores/useConfirmStore';

describe('ConfirmDialog component and confirmAction store', () => {
  it('renders nothing initially when not open', () => {
    const { container } = render(<ConfirmDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('opens dialog with options and resolves true upon confirm', async () => {
    render(<ConfirmDialog />);

    let promiseResult: boolean | undefined;
    act(() => {
      confirmAction({
        title: '删除便签',
        message: '确定要删除这笔记录吗？',
        confirmText: '确认删除',
        isDestructive: true,
      }).then((res) => {
        promiseResult = res;
      });
    });

    expect(screen.getByText('删除便签')).toBeInTheDocument();
    expect(screen.getByText('确定要删除这笔记录吗？')).toBeInTheDocument();

    const confirmBtn = screen.getByText('确认删除');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(promiseResult).toBe(true);
    expect(useConfirmStore.getState().isOpen).toBe(false);
  });

  it('resolves false upon cancel click', async () => {
    render(<ConfirmDialog />);

    let promiseResult: boolean | undefined;
    act(() => {
      confirmAction({
        title: '删除账户',
        message: '确认删除该账户吗？',
      }).then((res) => {
        promiseResult = res;
      });
    });

    expect(screen.getByText('删除账户')).toBeInTheDocument();

    const cancelBtn = screen.getByText('取消');
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(promiseResult).toBe(false);
    expect(useConfirmStore.getState().isOpen).toBe(false);
  });

  it('resolves false upon pressing Escape key', async () => {
    render(<ConfirmDialog />);

    let promiseResult: boolean | undefined;
    act(() => {
      confirmAction('简要消息提示').then((res) => {
        promiseResult = res;
      });
    });

    expect(screen.getByText('简要消息提示')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    expect(promiseResult).toBe(false);
    expect(useConfirmStore.getState().isOpen).toBe(false);
  });
});
