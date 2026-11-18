import React, { useState } from 'react';
import { Paperclip } from 'lucide-react';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import type { Account } from '../../types/account';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { CategoryBadge } from '../ui/CategoryBadge';
import { PluginSlot } from '../../plugin-sdk/components/PluginSlot';
import { PluginOverride } from '../../plugin-sdk/components/PluginOverride';
import { VoucherPreviewModal } from './VoucherPreviewModal';
import { cn } from '../../utils/cn';
import { dayjs, formatTime, parseLocalDate } from '../../utils/date';

export interface TransactionItemProps {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  toAccount?: Account;
  isFresh?: boolean;
  isLastInGroup?: boolean;
  showDate?: boolean;
  hideAccountName?: boolean;
  runningBalance?: string;
  offsetAmount?: number;
  offsetTargetNote?: string;
  onClick?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSaved?: (tx: Transaction) => void;
  onDeleted?: (id: string) => void;
}

export const TransactionItemBase: React.FC<TransactionItemProps> = ({
  transaction,
  category,
  account,
  toAccount,
  isFresh = false,
  isLastInGroup = false,
  showDate = false,
  hideAccountName = false,
  offsetAmount,
  offsetTargetNote,
  onClick,
  onToggleExpand,
}) => {
  const [isVoucherPreviewOpen, setIsVoucherPreviewOpen] = useState(false);

  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const isTransfer = transaction.type === 'transfer';
  const isReconcile = transaction.type === 'reconcile';
  const isLoan = transaction.type === 'loan';

  const title =
    transaction.note ||
    category?.name ||
    (isTransfer ? '转账' : isReconcile ? '平账' : isLoan ? '往来借贷' : '记账');

  const formattedAmount = centsToYuan(transaction.amount);
  const timeStr = formatTime(transaction.createdAt);
  const dateTimeLabel = (() => {
    const clock = timeStr || '12:00';
    if (!showDate || !transaction.date) return clock;
    const parsed = parseLocalDate(transaction.date);
    if (!parsed.isValid()) return `${transaction.date} ${clock}`;
    const isSameYear = parsed.year() === dayjs().year();
    return `${parsed.format(isSameYear ? 'MM-DD' : 'YYYY-MM-DD')} ${clock}`;
  })();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (onToggleExpand) {
      onToggleExpand();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'entry-row flex items-center justify-between px-3.5 py-2 relative cursor-pointer select-none transition-all duration-150',
        'border-b border-dashed border-(--rule-hairline)/60 hover:bg-(--paper-hover)/50 active:bg-(--paper-sunken)/40',
        isFresh && 'fresh-entry',
        isLastInGroup && '!border-b-0'
      )}
      data-is-last={isLastInGroup ? 'true' : undefined}
    >
      <div className="mr-3 shrink-0">
        <CategoryBadge
          category={category}
          type={transaction.type}
          iconName={category?.icon}
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-medium text-(--ink-primary) leading-tight truncate">
            {title}
          </span>
          {transaction.isReimbursable && (
            <span className="real-stamp text-[9px] px-1 py-0.5">
              {transaction.reimburseStatus === 'settled' ? '已报销' : '待报销'}
            </span>
          )}
          {isLoan && (
            <span className="real-stamp text-[9px] px-1 py-0.5">
              {transaction.loanDirection === 'lend' ? '借出' : '借入'}
            </span>
          )}
          {transaction.voucher && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsVoucherPreviewOpen(true);
              }}
              className="real-stamp stamp-voucher text-[9px] px-1 py-0.5 inline-flex items-center gap-0.5 cursor-pointer hover:opacity-100 active:scale-95 transition-transform"
              title="查看凭证"
            >
              <Paperclip className="w-2.5 h-2.5 shrink-0" />
              <span>凭证</span>
            </button>
          )}
          {isExpense && offsetAmount !== undefined && offsetAmount > 0 && (
            <span
              className={cn(
                'real-stamp text-[9px] px-1 py-0.5',
                offsetAmount >= transaction.amount ? 'text-(--color-income)' : 'text-(--color-expense)'
              )}
            >
              {offsetAmount >= transaction.amount
                ? '已全额抵扣'
                : `实付 ¥${centsToYuan(transaction.amount - offsetAmount)}`}
            </span>
          )}
          {isIncome && transaction.offsetTransactionId && (
            <span className="real-stamp text-[9px] px-1 py-0.5 text-(--color-income)">
              AA抵扣{offsetTargetNote ? ` · ${offsetTargetNote}` : ''}
            </span>
          )}
          <PluginSlot name="tx.row.badges" context={{ transaction, category, account }} />
        </div>

        <div className="flex items-center gap-1 text-[11px] text-(--ink-tertiary) font-mono">
          <span>{dateTimeLabel}</span>
          <span>·</span>
          <span>{category?.name || (isTransfer ? '转账' : isIncome ? '收入' : '支出')}</span>
          {!hideAccountName && (
            <>
              <span>·</span>
              <span>{account?.name || '未知账户'}</span>
            </>
          )}
          {isTransfer && toAccount && (
            <>
              <span>→</span>
              <span>{toAccount.name}</span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right ml-2.5">
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums tracking-tight',
            isIncome && 'text-(--color-income)',
            isExpense && 'text-(--color-expense)',
            isTransfer && 'text-(--cat-transit)'
          )}
        >
          {isIncome ? `+${formattedAmount}` : isExpense ? `-${formattedAmount}` : `⇄ ${formattedAmount}`}
        </span>
      </div>

      {isVoucherPreviewOpen && transaction.voucher && (
        <VoucherPreviewModal
          voucher={transaction.voucher}
          onClose={() => setIsVoucherPreviewOpen(false)}
        />
      )}
    </div>
  );
};

export const TransactionItem: React.FC<TransactionItemProps> = (props) => {
  return (
    <PluginOverride point="tx.row.item" fallback={TransactionItemBase} props={props} />
  );
};

export default TransactionItem;
