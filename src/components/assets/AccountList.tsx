import React, { useMemo, useState } from 'react';
import { TrashIcon as Trash2 } from '@phosphor-icons/react';
import type { Account } from '../../types/account';
import { isCreditAccount } from '../../types/account';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { toast } from '../../stores/useToastStore';
import { confirmAction } from '../../stores/useConfirmStore';
import { SwipeableRow } from '../ui/SwipeableRow';
import { cn } from '../../utils/cn';

export interface AccountListProps {
  accounts: Account[];
  onSelectAccount: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
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

  const renderAccountMeta = () => {
    const items: React.ReactNode[] = [];
    if (account.note) {
      items.push(<span key="note">{account.note}</span>);
    }
    if (isCredit && account.repaymentDay) {
      items.push(
        <span key="repay" className="font-semibold text-(--color-accent)">
          {account.repaymentDay}日还款
        </span>
      );
    }
    if (availableCreditCents !== undefined) {
      items.push(
        <span key="avail">
          剩余 ¥{centsToYuan(availableCreditCents)}
        </span>
      );
    }
    if (account.includeInNetWorth === false) {
      items.push(
        <span key="networth" className="text-(--ink-faint)">
          不计净资产
        </span>
      );
    }

    return items.map((item, index) => (
      <React.Fragment key={index}>
        {index > 0 && <span>·</span>}
        {item}
      </React.Fragment>
    ));
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
          <div className="flex flex-wrap items-center gap-1 font-mono text-[10px] text-(--ink-tertiary)">
            {renderAccountMeta()}
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
  onSelectAccount,
  onDeleteAccount,
}) => {
  const canDelete = accounts.length > 1;
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);

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
    </div>
  );
};

export default AccountList;
