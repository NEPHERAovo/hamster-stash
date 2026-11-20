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
});
