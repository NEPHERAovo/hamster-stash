import React, { useState } from 'react';
import { PaperclipIcon as Paperclip } from '@phosphor-icons/react';
import type { Transaction } from '../../../types/transaction';
import type { Category } from '../../../types/category';
import type { Account } from '../../../types/account';
import { centsToYuan } from '../../../domain/finance/balanceCalculator';
import { getAmortizeConfig } from '../../../domain/finance/amortization';
import { CategoryBadge } from '../../ui/CategoryBadge';
import { PluginSlot } from '../../../plugin-sdk/components/PluginSlot';
import { VoucherPreviewModal } from '../VoucherPreviewModal';
import { cn } from '../../../utils/cn';
import { formatRowDateTime, getBaseRowClass } from './rowHelpers';

export interface StandardTxRowProps {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  isFresh?: boolean;
  isLastInGroup?: boolean;
  showDate?: boolean;
  hideAccountName?: boolean;
  offsetAmount?: number;
  offsetTargetNote?: string;
  onClick?: () => void;
}

export const StandardTxRow: React.FC<StandardTxRowProps> = ({
  transaction,
  category,
  account,
  isFresh = false,
  isLastInGroup = false,
  showDate = false,
  hideAccountName = false,
  offsetAmount,
  offsetTargetNote,
  onClick,
}) => {
  const [isVoucherPreviewOpen, setIsVoucherPreviewOpen] = useState(false);

  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const amortizeConfig = getAmortizeConfig(transaction);

  const title = transaction.note || category?.name || (isIncome ? '收入' : '支出');
  const formattedAmount = centsToYuan(transaction.amount);
  const dateTimeLabel = formatRowDateTime(transaction.date, transaction.createdAt, showDate);

  return (
    <div
      onClick={onClick}
      className={getBaseRowClass(isFresh, isLastInGroup)}
      data-is-last={isLastInGroup ? 'true' : undefined}
    >
      <div className="mr-3 shrink-0">
        <CategoryBadge
          category={category}
          type={transaction.type}
          iconName={category?.icon}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] leading-tight font-medium text-(--ink-primary)">
            {title}
          </span>
          {transaction.isReimbursable && (
            <span className="real-stamp px-1 py-0.5 text-[9px]">
              {transaction.reimburseStatus === 'settled' ? '已报销' : '待报销'}
            </span>
          )}
          {transaction.voucher && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsVoucherPreviewOpen(true);
              }}
              className="real-stamp stamp-voucher inline-flex cursor-pointer items-center gap-0.5 px-1 py-0.5 text-[9px] transition-transform hover:opacity-100 active:scale-95"
              title="查看凭证"
            >
              <Paperclip className="size-2.5 shrink-0" />
              <span>凭证</span>
            </button>
          )}
          {isExpense && offsetAmount !== undefined && offsetAmount > 0 && (
            <span
              className={cn(
                'real-stamp px-1 py-0.5 text-[9px]',
                offsetAmount >= transaction.amount ? 'text-(--color-income)' : 'text-(--color-expense)'
              )}
            >
              {offsetAmount >= transaction.amount
                ? '已全额抵扣'
                : `实付 ¥${centsToYuan(transaction.amount - offsetAmount)}`}
            </span>
          )}
          {isExpense && amortizeConfig && (
            <span className="real-stamp px-1 py-0.5 text-[9px] text-(--ink-secondary)">
              分期 {amortizeConfig.months}期 · ¥{centsToYuan(Math.floor(transaction.amount / amortizeConfig.months))}/月
            </span>
          )}
          {isIncome && transaction.offsetTransactionId && (
            <span className="real-stamp px-1 py-0.5 text-[9px] text-(--color-income)">
              AA抵扣{offsetTargetNote ? ` · ${offsetTargetNote}` : ''}
            </span>
          )}
          <PluginSlot name="tx.row.badges" context={{ transaction, category, account }} />
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px] text-(--ink-tertiary)">
          <span>{dateTimeLabel}</span>
          <span>·</span>
          <span>{category?.name || (isIncome ? '收入' : '支出')}</span>
          {!hideAccountName && (
            <>
              <span>·</span>
              <span>{account?.name || '未知账户'}</span>
            </>
          )}
        </div>
      </div>

      <div className="ml-2.5 shrink-0 text-right">
        <span
          className={cn(
            'font-mono text-sm font-semibold tracking-tight tabular-nums',
            isIncome ? 'text-(--color-income)' : 'text-(--color-expense)'
          )}
        >
          {isIncome ? `+${formattedAmount}` : `-${formattedAmount}`}
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
