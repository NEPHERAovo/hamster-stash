import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateAccountModal } from '../../src/components/assets/CreateAccountModal';
import { AccountDetailSubPage } from '../../src/components/assets/AccountDetailSubPage';
import type { Account } from '../../src/types/account';

describe('Credit Account Features', () => {
  const mockDebitAccount: Account = {
    id: 'acct-debit',
    name: '招商银行储蓄卡',
    type: 'bank',
    accountCategory: 'savings',
    balance: 500000,
    currency: 'CNY',
    icon: 'landmark',
    sortOrder: 1,
    includeInNetWorth: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  const mockCreditAccount: Account = {
    id: 'acct-credit',
    name: '招行经典白金卡',
    type: 'credit',
    accountCategory: 'credit',
    balance: -280000,
    currency: 'CNY',
    icon: 'credit-card',
    sortOrder: 2,
    includeInNetWorth: true,
    creditLimit: 5000000,
    billDay: 7,
    repaymentDay: 25,
    repaymentAccountId: 'acct-debit',
    autoRepay: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  it('renders credit account options and submits repayment config in CreateAccountModal', async () => {
    const handleSubmit = vi.fn();
    const handleClose = vi.fn();

    render(
      <CreateAccountModal
        isOpen={true}
        onClose={handleClose}
        accounts={[mockDebitAccount]}
        onSubmit={handleSubmit}
      />
    );

    fireEvent.click(screen.getByText('信用账户'));

    expect(screen.getByText('账户类型')).toBeInTheDocument();
    expect(screen.getByText('账户标签')).toBeInTheDocument();
    expect(screen.getByText('信用卡')).toBeInTheDocument();
    expect(screen.getByText('每月还款日')).toBeInTheDocument();
    expect(screen.getByText('配置自动还款')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('例如：招行信用卡、花呗');
    fireEvent.change(nameInput, { target: { value: '广发信用卡' } });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '18' } });
    fireEvent.change(selects[1], { target: { value: '2' } });
    fireEvent.change(selects[2], { target: { value: 'acct-debit' } });

    const autoRepaySwitch = screen.getAllByRole('switch')[0];
    fireEvent.click(autoRepaySwitch);

    const submitBtn = screen.getByText('确认创建');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '广发信用卡',
          type: 'credit',
          accountCategory: 'credit',
          repaymentDay: 18,
          billDay: 2,
          repaymentAccountId: 'acct-debit',
          autoRepay: true,
        })
      );
    });
  });

  it('displays repayment day, auto repay status, and repayment account in AccountDetailSubPage', () => {
    const handleTransfer = vi.fn();
    render(
      <AccountDetailSubPage
        account={mockCreditAccount}
        transactions={[]}
        categories={[]}
        accounts={[mockDebitAccount, mockCreditAccount]}
        onOpenTransfer={handleTransfer}
      />
    );

    expect(screen.getByText('当前欠款')).toBeInTheDocument();
    expect(screen.getByText('-¥2800.00')).toBeInTheDocument();
    expect(screen.getByText('额度 ¥50000.00 · 剩余可用 ¥47200.00')).toBeInTheDocument();
    expect(screen.getByText('每月 25 日')).toBeInTheDocument();
    expect(screen.getByText('每月 7 日')).toBeInTheDocument();
    expect(screen.getByText('招商银行储蓄卡')).toBeInTheDocument();
    expect(screen.getByText('已开启')).toBeInTheDocument();
    expect(screen.getByText('账户还款')).toBeInTheDocument();
  });
});
