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

const ACTION_WIDTH = 76;

const SwipeableAccountRow: React.FC<SwipeableAccountRowProps> = ({
  account,
  canDelete,
  onSelect,
  onDelete,
}) => {
  const [offset, setOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isHorizontalRef = useRef(false);
  const currentOffsetRef = useRef(0);

  const Icon = getCategoryIcon(account.icon || 'wallet');
  const isNegative = account.balance < 0;

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!canDelete) return;
    isDraggingRef.current = true;
    isHorizontalRef.current = false;
    startXRef.current = clientX - currentOffsetRef.current;
    startYRef.current = clientY;
  };

  const handleDragMove = (clientX: number, clientY: number, preventDefault?: () => void) => {
    if (!isDraggingRef.current) return;
    const rawDx = clientX - startXRef.current;
    const deltaY = Math.abs(clientY - startYRef.current);
    const deltaX = Math.abs(clientX - (startXRef.current + currentOffsetRef.current));

    if (!isHorizontalRef.current) {
      if (deltaY > deltaX && deltaY > 6) {
        isDraggingRef.current = false;
        return;
      }
      if (deltaX > 6) {
        isHorizontalRef.current = true;
        setIsSwiping(true);
      }
    }

    if (isHorizontalRef.current) {
      preventDefault?.();
      let newOffset = rawDx;
      if (newOffset > 0) {
        newOffset = 0;
      } else if (newOffset < -ACTION_WIDTH) {
        const overflow = -newOffset - ACTION_WIDTH;
        newOffset = -ACTION_WIDTH - Math.pow(overflow, 0.72);
      }
      currentOffsetRef.current = newOffset;
      setOffset(newOffset);
    }
  };

  const handleDragEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsSwiping(false);

    if (currentOffsetRef.current < -ACTION_WIDTH / 2) {
      currentOffsetRef.current = -ACTION_WIDTH;
      setOffset(-ACTION_WIDTH);
    } else {
      currentOffsetRef.current = 0;
      setOffset(0);
    }
  };

  const handleRowClick = () => {
    if (offset < 0) {
      currentOffsetRef.current = 0;
      setOffset(0);
    } else {
      onSelect();
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDelete) {
      toast.error('系统至少需保留一个资金账户');
      currentOffsetRef.current = 0;
      setOffset(0);
      return;
    }
    if (window.confirm(`确认删除账户「${account.name}」吗？`)) {
      onDelete?.();
    }
    currentOffsetRef.current = 0;
    setOffset(0);
  };

  const actionTranslate = Math.max(0, ACTION_WIDTH + offset);
  const actionOpacity = offset === 0 ? 0 : Math.min(1, Math.abs(offset) / 30);

  return (
    <div className="relative overflow-hidden border-b border-dashed border-(--rule-hairline)/60 last:border-b-0 bg-(--bg-surface)">
      {canDelete && (
        <div
          className={cn(
            'absolute inset-y-0 right-0 w-[76px] bg-(--color-expense) flex items-center justify-center z-0 overflow-hidden select-none',
            offset === 0 && 'pointer-events-none opacity-0'
          )}
          style={{
            transform: `translate3d(${actionTranslate}px, 0, 0)`,
            opacity: actionOpacity,
            transition: isSwiping ? 'none' : 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
          }}
        >
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
        onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY, () => e.cancelable && e.preventDefault())}
        onTouchEnd={handleDragEnd}
        onTouchCancel={handleDragEnd}
        onMouseDown={(e) => {
          if (e.button === 0) handleDragStart(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          if (isDraggingRef.current) handleDragMove(e.clientX, e.clientY, () => e.preventDefault());
        }}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: isSwiping ? 'none' : 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="relative z-10 bg-(--bg-surface) flex items-center justify-between px-3.5 py-2.5 cursor-pointer hover:bg-(--paper-hover) active:bg-(--paper-sunken) select-none will-change-transform"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0 pointer-events-none">
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

        <div className="shrink-0 text-right ml-2.5 pointer-events-none">
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
