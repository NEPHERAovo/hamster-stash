import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddTransactionModal } from '../../src/components/ledger/AddTransactionModal';
import { usePreferenceStore } from '../../src/stores/usePreferenceStore';
import { useAccountStore } from '../../src/stores/useAccountStore';
import { useCategoryStore } from '../../src/stores/useCategoryStore';
import { useLedgerStore } from '../../src/stores/useLedgerStore';
import type { Account } from '../../src/types/account';
import type { Category } from '../../src/types/category';

describe('AddTransactionModal - Amortization (分期支出)', () => {
  const mockAccount: Account = {
    id: 'acct_1',
    name: '招商银行',
    type: 'bank',
    balance: 500000,
    currency: 'CNY',
    icon: 'wallet',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  };

  const mockCategory: Category = {
    id: 'cat_rent',
    name: '房租',
    type: 'expense',
    icon: 'home',
    color: '#fff',
    sortOrder: 1,
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    useAccountStore.setState({ accounts: [mockAccount] });
    useCategoryStore.setState({ categories: [mockCategory] });
    usePreferenceStore.setState({ isAmortizationEnabled: false, isReimbursementEnabled: false });
  });

  it('分期支出开关关闭时，不展示分期微胶囊', () => {
    render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByText('分期')).not.toBeInTheDocument();
  });

  it('分期支出开关开启时，展示分期微胶囊并支持选择分期期数', async () => {
    usePreferenceStore.setState({ isAmortizationEnabled: true });
    const recordSpy = vi.fn().mockResolvedValue({ id: 'new_tx' });
    useLedgerStore.setState({ recordTransaction: recordSpy });

    render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

    const amortizeBtn = screen.getByText('分期');
    expect(amortizeBtn).toBeInTheDocument();

    // 点击分期胶囊，打开分期托盘
    fireEvent.click(amortizeBtn);

    expect(screen.getByText('3期')).toBeInTheDocument();
    expect(screen.getByText('6期')).toBeInTheDocument();
    expect(screen.getByText('12期')).toBeInTheDocument();
    expect(screen.getByText('24期')).toBeInTheDocument();
    expect(screen.getByText('36期')).toBeInTheDocument();
    expect(screen.getByText('自定义')).toBeInTheDocument();

    // 选择 6期
    fireEvent.click(screen.getByText('6期'));

    // 胶囊文本更新为 "分期: 6期"
    expect(screen.getByText('分期: 6期')).toBeInTheDocument();

    // 输入金额 6000
    fireEvent.click(screen.getByText('6'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('0'));

    // 点击完成保存
    const submitBtn = screen.getByText('完成');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense',
          amount: 600000,
          ext: expect.objectContaining({
            amortize: expect.objectContaining({
              enabled: true,
              months: 6,
            }),
          }),
        })
      );
    });
  });

  it('分期支出支持自定义期数', async () => {
    usePreferenceStore.setState({ isAmortizationEnabled: true });
    const recordSpy = vi.fn().mockResolvedValue({ id: 'new_tx' });
    useLedgerStore.setState({ recordTransaction: recordSpy });

    render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText('分期'));
    fireEvent.click(screen.getByText('自定义'));

    const customInput = screen.getByPlaceholderText('期数');
    fireEvent.change(customInput, { target: { value: '5' } });

    expect(screen.getByText('分期: 5期')).toBeInTheDocument();

    // 输入金额 5000
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('0'));
    fireEvent.click(screen.getByText('0'));

    fireEvent.click(screen.getByText('完成'));

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense',
          amount: 500000,
          ext: expect.objectContaining({
            amortize: expect.objectContaining({
              enabled: true,
              months: 5,
            }),
          }),
        })
      );
    });
  });

  it('renders quick-chips and passes subTag when selected', async () => {
    const categoryWithTags: Category = {
      id: 'cat_food',
      name: '餐饮',
      type: 'expense',
      icon: 'fork-knife',
      color: '#fff',
      subTags: ['三餐', '外卖', '水果'],
      sortOrder: 1,
      createdAt: '',
      updatedAt: '',
    };
    useCategoryStore.setState({ categories: [categoryWithTags] });

    const recordSpy = vi.fn().mockResolvedValue({ id: 'tx_with_subtag' });
    useLedgerStore.setState({ recordTransaction: recordSpy });

    render(<AddTransactionModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('三餐')).toBeInTheDocument();
    expect(screen.getByText('外卖')).toBeInTheDocument();
    expect(screen.getByText('水果')).toBeInTheDocument();

    fireEvent.click(screen.getByText('外卖'));

    fireEvent.click(screen.getByText('2'));
    fireEvent.click(screen.getByText('5'));
    fireEvent.click(screen.getByText('完成'));

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense',
          amount: 2500,
          subTag: '外卖',
        })
      );
    });
  });
});
