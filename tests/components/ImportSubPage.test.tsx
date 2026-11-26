import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportSubPage } from '../../src/components/settings/ImportSubPage';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import { useAccountStore } from '../../src/stores/useAccountStore';
import { useLedgerStore } from '../../src/stores/useLedgerStore';
import type { Category } from '../../src/types/category';
import type { Account } from '../../src/types/account';
import { buildMinimalWeChatXlsx, encodeGbkMockAlipayCsv } from '../helpers/billFixtures';

describe('ImportSubPage - Category Mapping & Bill Formats', () => {
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
    {
      id: 'cat_invest',
      name: '理财',
      type: 'income',
      icon: 'trending-up',
      color: 'var(--color-income)',
      sortOrder: 2,
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
      createAccount: vi.fn().mockImplementation(async (inp) => ({
        id: `acct_${inp.name}`,
        name: inp.name,
        type: inp.type,
        balance: 0,
        currency: 'CNY',
        icon: 'wallet',
        sortOrder: 2,
        createdAt: '',
        updatedAt: '',
      })),
    });
    useLedgerStore.setState({
      transactions: [],
      importTransactions: vi.fn().mockResolvedValue({ importedCount: 0 }),
    });
  });

  it('maps raw category to discrete category without merged option strings', async () => {
    const importSpy = vi.fn().mockResolvedValue({ importedCount: 1 });
    useLedgerStore.setState({ importTransactions: importSpy });

    const csvContent = `"日期","分类名称","收支","金额","账户","备注"\r\n"2026-11-20","外卖","支出","35.00","微信零钱","午餐"`;
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });

    render(<ImportSubPage onClose={vi.fn()} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/下一步：确认字段/));
    fireEvent.click(screen.getByText(/下一步：分类匹配/));

    await waitFor(() => {
      expect(screen.getByText('外卖')).toBeInTheDocument();
    });

    const comboboxes = screen.getAllByRole('combobox');
    const categorySelect = comboboxes[0];

    expect(categorySelect.textContent).not.toContain('餐饮超市交通购物');

    fireEvent.click(categorySelect);

    expect(screen.getByRole('option', { name: '餐饮' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '超市' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '交通' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '购物' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '工资' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: '购物' }));
    expect(categorySelect.textContent).toContain('购物');

    fireEvent.click(screen.getByText(/下一步：确认导入/));
    fireEvent.click(screen.getByRole('button', { name: /确认导入/ }));

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(/^csv_elephant_[0-9a-f]{16}$/),
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
    expect(listbox.parentElement).toBe(document.body);
    expect(container.contains(listbox)).toBe(false);
    expect(listbox.style.position).toBe('fixed');
  });

  it('renders full preset descriptions without truncation and supports wealth rollup and skipped inspection', async () => {
    const importSpy = vi.fn().mockResolvedValue({ importedCount: 2 });
    useLedgerStore.setState({ importTransactions: importSpy });

    const csvText = [
      '交易时间,交易分类,交易对方,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,备注,',
      '2026-11-08 12:30:00,餐饮美食,A,午,支出,10.50,花呗&碰一下立减,交易成功,ali_1,,',
      '2026-11-08 12:00:00,餐饮美食,B,午,支出,20.00,花呗,交易关闭,ali_2,,',
      '2026-11-08 06:00:00,投资理财,C,余额宝-收益发放,不计收支,2.99,余额宝,交易成功,ali_3,,',
      '2026-11-07 08:00:00,投资理财,C,余额宝-转入,不计收支,100.00,余额宝,交易成功,ali_4,,',
    ].join('\r\n');
    const gbkBytes = encodeGbkMockAlipayCsv(csvText);
    const file = new File([gbkBytes.buffer as ArrayBuffer], 'alipay_wealth.csv', {
      type: 'text/csv',
    });

    render(<ImportSubPage onClose={vi.fn()} />);

    const wechatDesc = screen.getByText('支持 .xlsx / .csv，自动归类并过滤全额退款');
    expect(wechatDesc).not.toHaveClass('truncate');

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('已识别：支付宝账单')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/下一步：确认字段/));
    expect(screen.getByText('理财日收益按月汇总入账')).toBeInTheDocument();
    expect(screen.getByText('跳过已导入的重复账单')).toBeInTheDocument();

    fireEvent.click(screen.getByText(/下一步：分类匹配/));
    expect(screen.getByText('关闭/退款 1 笔')).toBeInTheDocument();
    expect(screen.getByText('理财日收益 1 笔按月汇总')).toBeInTheDocument();
    const neutralTypeEl = screen.getByText((content, node) =>
      Boolean(node?.tagName === 'SPAN' && content.includes('不计收支') && node.textContent?.includes('(1笔)'))
    );
    expect(neutralTypeEl).toBeInTheDocument();

    fireEvent.click(screen.getByText(/下一步：确认导入/));

    await waitFor(() => {
      expect(screen.getByText('待导入 2 笔')).toBeInTheDocument();
      expect(screen.getByText('含理财月结 1 笔')).toBeInTheDocument();
      expect(screen.getByText('不计收支 1 笔')).toBeInTheDocument();
      expect(screen.getByText('关闭/退款 1 笔')).toBeInTheDocument();
      expect(screen.getByText('月度汇总')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /不计收支\/跳过/ }));
    expect(screen.getByText(/2026-11-07/)).toBeInTheDocument();
    expect(screen.getByText(/2026-11-08.*花呗.*交易关闭/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /确认导入 \(2 笔\)/ }));

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'ali_ali_1',
            type: 'expense',
            amount: 1050,
          }),
          expect.objectContaining({
            type: 'income',
            amount: 299,
            categoryId: 'cat_invest',
          }),
        ]),
        true
      );
    });
  });

  it('auto-detects Alipay GBK CSV, strips promo tags, skips closed/neutral rows, and creates credit account', async () => {
    const importSpy = vi.fn().mockResolvedValue({ importedCount: 1 });
    const createAccountSpy = vi.fn().mockResolvedValue({
      id: 'acct_huabei',
      name: '花呗',
      type: 'credit',
      balance: 0,
      currency: 'CNY',
      icon: 'credit-card',
      sortOrder: 2,
      createdAt: '',
      updatedAt: '',
    });
    useLedgerStore.setState({ importTransactions: importSpy });
    useAccountStore.setState({
      accounts: mockAccounts,
      loadAccounts: vi.fn().mockResolvedValue(undefined),
      createAccount: createAccountSpy,
    });

    const csvText = [
      '交易时间,交易分类,交易对方,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,备注,',
      '2026-11-08 12:30:00,餐饮美食,A,午,支出,10.50,花呗&碰一下立减,交易成功,ali_1,,',
      '2026-11-08 12:00:00,餐饮美食,B,午,支出,20.00,花呗,交易关闭,ali_2,,',
      '2026-11-08 06:00:00,投资理财,C,余,不计收支,2.99,余额宝,交易成功,ali_3,,',
    ].join('\r\n');
    const gbkBytes = encodeGbkMockAlipayCsv(csvText);
    const file = new File([gbkBytes.buffer as ArrayBuffer], 'alipay.csv', { type: 'text/csv' });

    render(<ImportSubPage onClose={vi.fn()} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('已识别：支付宝账单')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/下一步：确认字段/));
    expect(screen.getByText('过滤已关闭与全额退款')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/下一步：分类匹配/));
    fireEvent.click(screen.getByText(/下一步：确认导入/));

    await waitFor(() => {
      expect(screen.getByText('待导入 1 笔')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /确认导入 \(1 笔\)/ }));

    await waitFor(() => {
      expect(createAccountSpy).toHaveBeenCalledWith({
        name: '花呗',
        type: 'credit',
        initialBalance: 0,
      });
      expect(importSpy).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: 'ali_ali_1',
            type: 'expense',
            amount: 1050,
            categoryId: 'cat_food',
            accountId: 'acct_huabei',
          }),
        ],
        true
      );
    });
  });

  it('auto-detects WeChat XLSX, filters full refunds, and skips duplicate order IDs', async () => {
    const importSpy = vi.fn().mockResolvedValue({ importedCount: 0 });
    useLedgerStore.setState({
      transactions: [
        {
          id: 'wx_wx_order_1',
          type: 'expense',
          amount: 2850,
          categoryId: 'cat_food',
          accountId: 'acct_1',
          date: '2026-11-09',
          createdAt: '',
          updatedAt: '',
        },
      ],
      importTransactions: importSpy,
    });

    const xlsxBytes = buildMinimalWeChatXlsx();
    const file = new File([xlsxBytes.buffer as ArrayBuffer], 'wechat.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    render(<ImportSubPage onClose={vi.fn()} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('已识别：微信账单')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/下一步：确认字段/));
    fireEvent.click(screen.getByText(/下一步：分类匹配/));
    fireEvent.click(screen.getByText(/下一步：确认导入/));

    await waitFor(() => {
      expect(screen.getByText('待导入 0 笔')).toBeInTheDocument();
      expect(screen.getByText('重复 1 笔')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /确认导入 \(0 笔\)/ });
    expect(confirmBtn).toBeDisabled();
  });
});
