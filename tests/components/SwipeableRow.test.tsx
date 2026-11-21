import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwipeableRow } from '../../src/components/ui/SwipeableRow';

describe('SwipeableRow Component', () => {
  it('renders children and action button when action is provided', () => {
    const handleAction = vi.fn();
    const handleClick = vi.fn();

    render(
      <SwipeableRow
        action={{
          label: '删除',
          title: '删除项目',
          onClick: handleAction,
        }}
        onClick={handleClick}
      >
        <div>测试行内容</div>
      </SwipeableRow>
    );

    expect(screen.getByText('测试行内容')).toBeInTheDocument();
    expect(screen.getByTitle('删除项目')).toBeInTheDocument();
  });

  it('triggers onClick callback when row is clicked without active swipe', () => {
    const handleClick = vi.fn();

    render(
      <SwipeableRow onClick={handleClick}>
        <div>点击测试内容</div>
      </SwipeableRow>
    );

    fireEvent.click(screen.getByText('点击测试内容'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('triggers onClick callback on mouse pointer sequence when action is present', () => {
    const handleClick = vi.fn();

    render(
      <SwipeableRow
        action={{
          label: '删除',
          title: '删除账户',
          onClick: vi.fn(),
        }}
        onClick={handleClick}
      >
        <div>账户点击测试</div>
      </SwipeableRow>
    );

    const row = screen.getByText('账户点击测试');
    fireEvent.mouseDown(row, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.mouseUp(row);
    fireEvent.click(row);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('triggers onClick callback on touch sequence when action is present', () => {
    const handleClick = vi.fn();

    render(
      <SwipeableRow
        action={{
          label: '删除',
          title: '删除账户',
          onClick: vi.fn(),
        }}
        onClick={handleClick}
      >
        <div>触屏点击测试</div>
      </SwipeableRow>
    );

    const row = screen.getByText('触屏点击测试');
    fireEvent.touchStart(row, { touches: [{ clientX: 150, clientY: 120 }] });
    fireEvent.touchEnd(row);
    fireEvent.click(row);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClick when a horizontal swipe gesture occurs', () => {
    const handleClick = vi.fn();

    render(
      <SwipeableRow
        action={{
          label: '删除',
          title: '删除账户',
          onClick: vi.fn(),
        }}
        onClick={handleClick}
      >
        <div>侧滑测试</div>
      </SwipeableRow>
    );

    const row = screen.getByText('侧滑测试');
    fireEvent.touchStart(row, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(row, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(row);
    fireEvent.click(row);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('triggers action callback when action button is clicked', () => {
    const handleAction = vi.fn();

    render(
      <SwipeableRow
        action={{
          label: '移除',
          title: '移除按钮',
          onClick: handleAction,
        }}
      >
        <div>操作测试内容</div>
      </SwipeableRow>
    );

    fireEvent.click(screen.getByTitle('移除按钮'));
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('updates position when controlled isOpen prop changes', () => {
    const handleOpenChange = vi.fn();
    const { rerender } = render(
      <SwipeableRow
        isOpen={false}
        actionWidth={80}
        onOpenChange={handleOpenChange}
        action={{
          label: '删除',
          title: '删除按钮',
          onClick: vi.fn(),
        }}
      >
        <div>受控内容</div>
      </SwipeableRow>
    );

    const content = screen.getByText('受控内容').parentElement;
    expect(content?.style.transform).toBe('translate3d(0px, 0px, 0px)');

    rerender(
      <SwipeableRow
        isOpen={true}
        actionWidth={80}
        onOpenChange={handleOpenChange}
        action={{
          label: '删除',
          title: '删除按钮',
          onClick: vi.fn(),
        }}
      >
        <div>受控内容</div>
      </SwipeableRow>
    );

    expect(content?.style.transform).toBe('translate3d(-80px, 0px, 0px)');
  });
});
