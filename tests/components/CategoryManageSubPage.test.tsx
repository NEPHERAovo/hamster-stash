import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CategoryManageSubPage } from '../../src/components/assets/CategoryManageSubPage';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import type { Category } from '../../src/types/category';

describe('CategoryManageSubPage', () => {
  const mockCategories: Category[] = [
    {
      id: 'cat_food',
      name: '餐饮',
      type: 'expense',
      icon: 'utensils',
      color: 'var(--cat-food)',
      sortOrder: 1,
      isSystem: true,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'cat_shop',
      name: '购物',
      type: 'expense',
      icon: 'shopping-cart',
      color: 'var(--cat-shop)',
      sortOrder: 2,
      isSystem: true,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'cat_transit',
      name: '交通',
      type: 'expense',
      icon: 'train-front',
      color: 'var(--cat-transit)',
      sortOrder: 3,
      isSystem: true,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'cat_salary',
      name: '工资',
      type: 'income',
      icon: 'wallet',
      color: 'var(--color-income)',
      sortOrder: 1,
      isSystem: true,
      isArchived: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  beforeEach(() => {
    useCategoryStore.setState({
      categories: [...mockCategories],
      loading: false,
      reorderCategories: vi.fn(async (orderedIds: string[]) => {
        const current = useCategoryStore.getState().categories;
        const idMap = new Map(orderedIds.map((id, idx) => [id, idx + 1]));
        const updated = current.map((c) => {
          const newOrder = idMap.get(c.id);
          return newOrder !== undefined ? { ...c, sortOrder: newOrder } : c;
        });
        updated.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        useCategoryStore.setState({ categories: updated });
      }),
      updateCategory: vi.fn(),
      createCategory: vi.fn(),
      removeCategory: vi.fn(),
    });
  });

  it('renders active categories sorted by sortOrder and includes drag handles', () => {
    render(<CategoryManageSubPage />);

    expect(screen.getByText('餐饮')).toBeDefined();
    expect(screen.getByText('购物')).toBeDefined();
    expect(screen.getByText('交通')).toBeDefined();

    const dragHandles = screen.getAllByTitle('拖拽排序');
    expect(dragHandles.length).toBe(3);
  });

  it('opens edit modal when clicking category row and displays delete category action in modal', async () => {
    render(<CategoryManageSubPage />);

    const foodRow = screen.getByText('餐饮');
    fireEvent.click(foodRow);

    await waitFor(() => {
      expect(screen.getByText('编辑分类')).toBeDefined();
    });

    const nameInput = screen.getByDisplayValue('餐饮');
    expect(nameInput).toBeDefined();

    expect(screen.getByText('删除分类')).toBeDefined();
  });

  it('reorders categories when HTML5 drag and drop occurs', async () => {
    const reorderSpy = vi.fn();
    useCategoryStore.setState({
      reorderCategories: reorderSpy,
    });

    render(<CategoryManageSubPage />);

    const handles = screen.getAllByTitle('拖拽排序');
    expect(handles.length).toBe(3);

    const dataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      setData: vi.fn(),
      getData: vi.fn(),
    };

    // Drag first item (index 0) over second item (index 1)
    fireEvent.dragStart(handles[0], { dataTransfer });
    fireEvent.dragEnter(handles[1]);
    fireEvent.drop(handles[1], { dataTransfer });

    await waitFor(() => {
      expect(reorderSpy).toHaveBeenCalled();
    });
  });

  it('renders swipe-to-reveal delete button behind each category row', () => {
    render(<CategoryManageSubPage />);

    const deleteButtons = screen.getAllByTitle('删除分类');
    expect(deleteButtons.length).toBe(3);
  });
});
