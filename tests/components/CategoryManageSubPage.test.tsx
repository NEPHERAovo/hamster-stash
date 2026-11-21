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
      subTags: ['三餐', '外卖'],
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
      id: 'cat_archived_pet',
      name: '宠物',
      type: 'expense',
      icon: 'pet',
      color: 'var(--cat-food)',
      subTags: ['猫粮', '驱虫'],
      sortOrder: 9,
      isSystem: true,
      isArchived: true,
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

  it('opens edit modal when clicking category row and displays actions and capsule subtags', async () => {
    render(<CategoryManageSubPage />);

    const foodRow = screen.getByText('餐饮');
    fireEvent.click(foodRow);

    await waitFor(() => {
      expect(screen.getByText('编辑分类')).toBeDefined();
    });

    const nameInput = screen.getByDisplayValue('餐饮');
    expect(nameInput).toBeDefined();

    expect(screen.getByText('三餐')).toBeDefined();
    expect(screen.getByText('外卖')).toBeDefined();

    expect(screen.getByText(/彻底删除分类/)).toBeDefined();
    expect(screen.getByText(/停用此分类/)).toBeDefined();
  });

  it('allows adding and removing subcategory capsule tags in edit modal', async () => {
    const updateSpy = vi.fn();
    useCategoryStore.setState({
      updateCategory: updateSpy,
    });

    render(<CategoryManageSubPage />);

    fireEvent.click(screen.getByText('餐饮'));

    await waitFor(() => {
      expect(screen.getByText('编辑分类')).toBeDefined();
    });

    const removeButtons = screen.getAllByTitle('删除标签');
    expect(removeButtons.length).toBe(2);
    fireEvent.click(removeButtons[0]);

    expect(screen.getAllByTitle('删除标签').length).toBe(1);

    const subTagInput = screen.getByPlaceholderText('输入子分类名称...');
    fireEvent.change(subTagInput, { target: { value: '夜宵' } });
    fireEvent.click(screen.getByText('添加'));

    expect(screen.getAllByTitle('删除标签').length).toBe(2);

    const saveButton = screen.getByText('保存修改');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'cat_food',
        expect.objectContaining({
          subTags: ['外卖', '夜宵'],
        })
      );
    });
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

    fireEvent.dragStart(handles[0], { dataTransfer });
    fireEvent.dragEnter(handles[1]);
    fireEvent.drop(handles[1], { dataTransfer });

    await waitFor(() => {
      expect(reorderSpy).toHaveBeenCalled();
    });
  });

  it('renders swipe-to-reveal delete button behind category rows', () => {
    render(<CategoryManageSubPage />);

    const deleteButtons = screen.getAllByTitle('删除分类');
    expect(deleteButtons.length).toBe(4);
  });

  it('renders unarchived and archived sections with switches and toggles category active state', async () => {
    const updateSpy = vi.fn();
    useCategoryStore.setState({
      updateCategory: updateSpy,
    });

    render(<CategoryManageSubPage />);

    expect(screen.getByText('已启用')).toBeDefined();
    expect(screen.getByText('未启用')).toBeDefined();
    expect(screen.getByText('宠物')).toBeDefined();

    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBe(4);

    const activeSwitch = screen.getAllByTitle('点击停用')[0];
    fireEvent.click(activeSwitch);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('cat_food', { isArchived: true });
    });

    const inactiveSwitch = screen.getByTitle('点击启用');
    fireEvent.click(inactiveSwitch);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('cat_archived_pet', { isArchived: false });
    });
  });
});
