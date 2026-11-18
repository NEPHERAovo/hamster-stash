import React, { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import type { Account } from '../../types/account';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { toast } from '../../stores/useToastStore';
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
  const [offset, setOffset] = useState(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isSwipingRef = useRef(false);

  const Icon = getCategoryIcon(account.icon || 'wallet');
  const isNegative = account.balance < 0;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canDelete) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canDelete) return;
    const diffX = e.touches[0].clientX - startXRef.current;
    const diffY = e.touches[0].clientY - startYRef.current;

    if (!isSwipingRef.current) {
      if (Math.abs(diffY) > Math.abs(diffX)) return;
      if (Math.abs(diffX) > 6) {
        isSwipingRef.current = true;
      }
    }

    if (isSwipingRef.current) {
      const newOffset = Math.min(0, Math.max(-72, diffX));
      setOffset(newOffset);
    }
  };

  const handleTouchEnd = () => {
    if (!isSwipingRef.current) return;
    isSwipingRef.current = false;
    if (offset < -36) {
      setOffset(-72);
    } else {
      setOffset(0);
    }
  };

  const handleRowClick = () => {
    if (offset < 0) {
      setOffset(0);
    } else {
      onSelect();
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDelete) {
      toast.error('系统至少需保留一个资金账户');
      setOffset(0);
      return;
    }
    if (window.confirm(`确认删除账户「${account.name}」吗？`)) {
      onDelete?.();
    }
    setOffset(0);
  };

  return (
    <div className="relative overflow-hidden border-b border-dashed border-(--rule-hairline)/60 last:border-b-0">
      {canDelete && (
        <div className="absolute inset-y-0 right-0 w-[72px] bg-(--color-expense) flex items-center justify-center z-0">
          <button
            type="button"
            onClick={handleDeleteClick}
            className="w-full h-full flex flex-col items-center justify-center text-white text-[11px] font-semibold gap-0.5 cursor-pointer active:opacity-85"
            title="删除账户"
          >
            <Trash2 className="w-4 h-4 stroke-2" />
            <span>删除</span>
          </button>
        </div>
      )}

      <div
        onClick={handleRowClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        className="relative z-10 bg-(--paper-sheet) flex items-center justify-between px-3.5 py-2.5 cursor-pointer transition-transform duration-150 ease-out hover:bg-(--paper-hover)/50 active:bg-(--paper-sunken)/40"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-7 h-7 flex items-center justify-center text-(--ink-secondary) shrink-0 rounded-(--badge-radius) bg-(--paper-sunken)">
            <Icon className="w-3.5 h-3.5 stroke-[1.8]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-(--ink-primary) truncate">
              {account.name}
            </div>
            <div className="text-[10px] font-mono text-(--ink-tertiary)">
              {getAccountTypeLabel(account.type)}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right ml-2.5">
          <span
            className={cn(
              'font-mono text-sm font-semibold tabular-nums',
              isNegative ? 'text-(--color-expense)' : 'text-(--ink-solid)'
            )}
          >
            ¥ {centsToYuan(account.balance)}
          </span>
          <div className="text-[10px] font-mono text-(--ink-tertiary)">
            {account.currency}
          </div>
        </div>
      </div>
    </div>
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
