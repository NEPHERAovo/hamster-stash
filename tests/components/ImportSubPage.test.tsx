import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportSubPage } from '../../src/components/assets/ImportSubPage';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import { useAccountStore } from '../../src/stores/useAccountStore';
import { useLedgerStore } from '../../src/stores/useLedgerStore';
import type { Category } from '../../src/types/category';
import type { Account } from '../../src/types/account';

describe('ImportSubPage - Category Mapping', () => {
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
      id: 'cat_market',
      name: '超市',
      type: 'expense',
      icon: 'basket',
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
      id: 'cat_shop',
      name: '购物',
      type: 'expense',
      icon: 'shopping-cart',
      color: 'var(--cat-shop)',
      sortOrder: 4,
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

  const mockAccounts: Account[] = [
    {
      id: 'acct_1',
      name: '微信零钱',
      type: 'savings',
      balance: 100000,
      currency: 'CNY',
      icon: 'wallet',
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    },
  ];

  beforeEach(() => {
    useCategoryStore.setState({
      categories: mockCategories,
      loadCategories: vi.fn().mockResolvedValue(undefined),
      createCategory: vi.fn(),
    });
    useAccountStore.setState({
      accounts: mockAccounts,
      loadAccounts: vi.fn().mockResolvedValue(undefined),
      createAccount: vi.fn(),
    });
  });

  it('maps raw category to discrete category without merged option strings', async () => {
    const importSpy = vi.fn().mockResolvedValue({ importedCount: 1 });
    useLedgerStore.setState({ importTransactions: importSpy });

    const csvContent = `"日期","分类名称","收支","金额","账户","备注"\r\n"2026-11-20","外卖","支出","35.00","微信零钱","午餐"`;
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    render(<ImportSubPage onClose={vi.fn()} />);

    // Step 1: Upload file
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument();
    });

    // Step 1 -> Step 2
    fireEvent.click(screen.getByText(/下一步：确认字段/));

    // Step 2 -> Step 3
    fireEvent.click(screen.getByText(/下一步：分类匹配/));

    await waitFor(() => {
      expect(screen.getByText('外卖')).toBeInTheDocument();
    });

    // Verify combobox does NOT contain concatenated category text "餐饮超市交通购物"
    const comboboxes = screen.getAllByRole('combobox');
    const categorySelect = comboboxes[0];

    expect(categorySelect.textContent).not.toContain('餐饮超市交通购物');

    // Click combobox to open dropdown and inspect individual options
    fireEvent.click(categorySelect);

    expect(screen.getByRole('option', { name: '餐饮' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '超市' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '交通' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '购物' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '工资' })).toBeInTheDocument();

    // Select '购物'
    fireEvent.click(screen.getByRole('option', { name: '购物' }));
    expect(categorySelect.textContent).toContain('购物');

    // Step 3 -> Step 4
    fireEvent.click(screen.getByText(/下一步：确认导入/));

    // Step 4: Confirm import
    fireEvent.click(screen.getByRole('button', { name: /确认导入/ }));

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            categoryId: 'cat_shop',
            amount: 3500,
            type: 'expense',
          }),
        ]),
        true
      );
    });
  });

  it('renders dropdown listbox via portal outside the table container when expanding category selection', async () => {
    const csvContent = `"日期","分类名称","收支","金额"\r\n"2026-11-20","打车","支出","20.00"`;
    const file = new File([csvContent], 'small.csv', { type: 'text/csv' });

    const { container } = render(<ImportSubPage onClose={vi.fn()} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('small.csv')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/下一步：确认字段/));
    fireEvent.click(screen.getByText(/下一步：分类匹配/));

    await waitFor(() => {
      expect(screen.getByText('打车')).toBeInTheDocument();
    });

    const categorySelect = screen.getAllByRole('combobox')[0];
    fireEvent.click(categorySelect);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();

    // The listbox is rendered under document.body via portal and not inside the table card
    expect(listbox.parentElement).toBe(document.body);
    expect(container.contains(listbox)).toBe(false);
    expect(listbox.style.position).toBe('fixed');
  });
});
