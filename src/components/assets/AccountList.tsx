import React from 'react';
import { Trash2 } from 'lucide-react';
import type { Account } from '../../types/account';
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
  onSelect: () => void;
  onDelete?: () => void;
}

const getAccountTypeLabel = (type: string) => {
  switch (type) {
    case 'ewallet':
      return '电子钱包';
    case 'bank':
      return '储蓄卡';
    case 'credit':
      return '信用卡';
    case 'cash':
      return '现金';
    case 'investment':
      return '投资理财';
    default:
      return '账户';
  }
};

const SwipeableAccountRow: React.FC<SwipeableAccountRowProps> = ({
  account,
  canDelete,
  onSelect,
  onDelete,
}) => {
  const Icon = getCategoryIcon(account.icon || 'wallet');
  const isNegative = account.balance < 0;

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
      action={{
        label: '删除',
        title: '删除账户',
        icon: <Trash2 className="w-4 h-4 stroke-2" />,
        onClick: handleDelete,
      }}
      onClick={onSelect}
      containerClassName="border-b border-dashed border-(--rule-hairline)/60 last:border-b-0"
      className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0 pointer-events-none">
        <div className="w-7 h-7 flex items-center justify-center text-(--ink-secondary) shrink-0 rounded-(--badge-radius) bg-(--paper-sunken)">
          <Icon className="w-3.5 h-3.5 stroke-[1.8]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-(--ink-primary) truncate">
            {account.name}
          </div>
          <div className="text-[10px] font-mono text-(--ink-tertiary) flex items-center gap-1">
            <span>{getAccountTypeLabel(account.type)}</span>
            {account.includeInNetWorth === false && (
              <span className="text-(--ink-faint)">· 不计净资产</span>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-right ml-2.5 pointer-events-none">
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            isNegative ? 'text-(--color-expense)' : 'text-(--ink-solid)'
          )}
        >
          ¥ {centsToYuan(account.balance)}
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

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-1 pb-1.5 select-none">
        <span className="text-xs font-mono text-(--ink-tertiary) uppercase tracking-wider">
          账户资产
        </span>
        <span className="text-[11px] font-mono text-(--ink-faint)">
          共 {accounts.length} 笔
        </span>
      </div>

      <div className="bg-(--paper-sheet) paper-card border border-(--rule-hairline) select-none transition-all duration-200 rounded-(--radius-md) overflow-hidden shadow-xs">
        {accounts.map((acct) => (
          <SwipeableAccountRow
            key={acct.id}
            account={acct}
            canDelete={canDelete}
            onSelect={() => onSelectAccount(acct)}
            onDelete={() => onDeleteAccount?.(acct)}
          />
        ))}
      </div>
    </div>
  );
};

export default AccountList;
