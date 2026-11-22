import React, { useMemo, useState } from 'react';
import { TrashIcon as Trash2 } from '@phosphor-icons/react';
import type { Account } from '../../types/account';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import { isCreditAccount } from '../../types/account';
import { centsToYuan, buildOffsetMap } from '../../domain/finance/balanceCalculator';
import { computePendingInstallments } from '../../domain/finance/amortization';
import { currentYearMonth } from '../../utils/date';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { toast } from '../../stores/useToastStore';
import { confirmAction } from '../../stores/useConfirmStore';
import { SwipeableRow } from '../ui/SwipeableRow';
import { cn } from '../../utils/cn';

export interface AccountListProps {
  accounts: Account[];
  allTransactions?: Transaction[];
  categories?: Category[];
  onSelectAccount: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
  onSelectTransaction?: (transaction: Transaction) => void;
  onAddAccount?: () => void;
}

interface SwipeableAccountRowProps {
  account: Account;
  canDelete: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: () => void;
  onDelete?: () => void;
}

const SwipeableAccountRow: React.FC<SwipeableAccountRowProps> = ({
  account,
  canDelete,
  isOpen,
  onOpenChange,
  onSelect,
  onDelete,
}) => {
  const isCredit = isCreditAccount(account);
  const Icon = getCategoryIcon(account.icon || (isCredit ? 'credit-card' : 'wallet'));
  const isNegative = account.balance < 0;
  const availableCreditCents =
    isCredit && account.creditLimit !== undefined
      ? Math.max(0, account.creditLimit + account.balance)
      : undefined;

  const handleDelete = async () => {
    if (!canDelete) {
      toast.error('系统至少需保留一个资金账户');
      return;
    }
    const confirmed = await confirmAction({
      title: '删除账户',
      message: `确认删除账户「${account.name}」吗？`,
      confirmText: '确认删除',
      isDestructive: true,
    });
    if (confirmed) {
      onDelete?.();
    }
  };

  return (
    <SwipeableRow
      enabled={canDelete}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      action={{
        label: '删除',
        title: '删除账户',
        icon: <Trash2 className="size-4 stroke-2" />,
        onClick: handleDelete,
      }}
      onClick={onSelect}
      containerClassName="border-b border-dashed border-(--rule-hairline)/60 last:border-b-0"
      className="flex cursor-pointer items-center justify-between px-3.5 py-2.5 hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
    >
      <div className="pointer-events-none mr-2 flex min-w-0 flex-1 items-center gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
          <Icon className="stroke-1.8 size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-(--ink-primary)">
            {account.name}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-(--ink-tertiary)">
            {account.note && <span>{account.note}</span>}
            {isCredit && account.repaymentDay && (
              <span className="font-semibold text-(--color-accent)">
                每月{account.repaymentDay}日还款
              </span>
            )}
            {availableCreditCents !== undefined && (
              <span>剩余可用 ¥{centsToYuan(availableCreditCents)}</span>
            )}
            {account.includeInNetWorth === false && (
              <span className="text-(--ink-faint)">不计净资产</span>
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none shrink-0 text-right">
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            isNegative ? 'text-(--color-expense)' : 'text-(--ink-solid)'
          )}
        >
          {isNegative ? `-¥ ${centsToYuan(Math.abs(account.balance))}` : `¥ ${centsToYuan(account.balance)}`}
        </span>
      </div>
    </SwipeableRow>
  );
};

export const AccountList: React.FC<AccountListProps> = ({
  accounts,
  allTransactions = [],
  categories = [],
  onSelectAccount,
  onDeleteAccount,
  onSelectTransaction,
}) => {
  const canDelete = accounts.length > 1;
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);

  const pendingInstallments = useMemo(() => {
    if (!allTransactions || allTransactions.length === 0) {
      return { totalRemainingDebt: 0, installments: [] };
    }
    const offsetMap = buildOffsetMap(allTransactions);
    return computePendingInstallments(allTransactions, currentYearMonth(), offsetMap);
  }, [allTransactions]);

  const savingsAccounts = useMemo(
    () => accounts.filter((a) => !isCreditAccount(a)),
    [accounts]
  );
  const creditAccounts = useMemo(
    () => accounts.filter((a) => isCreditAccount(a)),
    [accounts]
  );

  const savingsTotal = useMemo(
    () => savingsAccounts.reduce((sum, a) => sum + (a.includeInNetWorth === false ? 0 : a.balance), 0),
    [savingsAccounts]
  );

  const creditDebtTotal = useMemo(
    () => creditAccounts.reduce((sum, a) => sum + (a.includeInNetWorth === false ? 0 : Math.min(0, a.balance)), 0),
    [creditAccounts]
  );

  const handleDeleteAccount = (acct: Account) => {
    if (openAccountId === acct.id) {
      setOpenAccountId(null);
    }
    onDeleteAccount?.(acct);
  };

  return (
    <div className="w-full space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1 select-none">
          <span className="font-mono text-xs tracking-wider text-(--ink-tertiary) uppercase">
            储蓄账户
          </span>
          <span className="font-mono text-[11px] text-(--ink-faint)">
            共 {savingsAccounts.length} 项 · 合计 ¥{centsToYuan(savingsTotal)}
          </span>
        </div>

        <div className="paper-card overflow-hidden rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) shadow-xs transition-all duration-200 select-none">
          {savingsAccounts.length === 0 ? (
            <div className="py-6 text-center text-xs text-(--ink-tertiary)">
              暂无储蓄账户
            </div>
          ) : (
            savingsAccounts.map((acct) => (
              <SwipeableAccountRow
                key={acct.id}
                account={acct}
                canDelete={canDelete}
                isOpen={openAccountId === acct.id}
                onOpenChange={(open) => setOpenAccountId(open ? acct.id : null)}
                onSelect={() => onSelectAccount(acct)}
                onDelete={() => handleDeleteAccount(acct)}
              />
            ))
          )}
        </div>
      </div>

      {creditAccounts.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1 select-none">
            <span className="font-mono text-xs tracking-wider text-(--ink-tertiary) uppercase">
              信用账户
            </span>
            <span className="font-mono text-[11px] text-(--ink-faint)">
              共 {creditAccounts.length} 项 · 欠款 ¥{centsToYuan(Math.abs(creditDebtTotal))}
            </span>
          </div>

          <div className="paper-card overflow-hidden rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) shadow-xs transition-all duration-200 select-none">
            {creditAccounts.map((acct) => (
              <SwipeableAccountRow
                key={acct.id}
                account={acct}
                canDelete={canDelete}
                isOpen={openAccountId === acct.id}
                onOpenChange={(open) => setOpenAccountId(open ? acct.id : null)}
                onSelect={() => onSelectAccount(acct)}
                onDelete={() => handleDeleteAccount(acct)}
              />
            ))}
          </div>
        </div>
      )}

      {pendingInstallments.installments.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1 select-none">
            <span className="font-mono text-xs tracking-wider text-(--ink-tertiary) uppercase">
              待还分期
            </span>
            <span className="font-mono text-[11px] text-(--ink-faint)">
              共 {pendingInstallments.installments.length} 项 · 待还 ¥{centsToYuan(pendingInstallments.totalRemainingDebt)}
            </span>
          </div>

          <div className="paper-card overflow-hidden rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) shadow-xs transition-all duration-200 select-none">
            {pendingInstallments.installments.map((inst) => {
              const cat = categories.find((c) => c.id === inst.transaction.categoryId);
              const Icon = getCategoryIcon(cat?.icon || 'credit-card');
              return (
                <div
                  key={inst.transaction.id}
                  onClick={() => onSelectTransaction?.(inst.transaction)}
                  className="flex cursor-pointer items-center justify-between border-b border-dashed border-(--rule-hairline)/60 px-3.5 py-2.5 last:border-b-0 hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
                >
                  <div className="mr-2 flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
                      <Icon className="stroke-1.8 size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-(--ink-primary)">
                        {inst.transaction.note || cat?.name || '分期支出'}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] text-(--ink-tertiary)">
                        <span className="font-semibold text-(--color-accent)">
                          剩余 {inst.remainingMonths}/{inst.months} 期
                        </span>
                        <span>每月约 ¥{centsToYuan(inst.monthlyAmount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-semibold text-(--color-expense) tabular-nums">
                      -¥ {centsToYuan(inst.remainingDebt)}
                    </div>
                    <div className="font-mono text-[10px] text-(--ink-faint)">
                      总计 ¥{centsToYuan(inst.totalAmount)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountList;
