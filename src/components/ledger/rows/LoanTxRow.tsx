import React from 'react';
import type { Transaction } from '../../../types/transaction';
import type { Category } from '../../../types/category';
import type { Account } from '../../../types/account';
import { centsToYuan } from '../../../domain/finance/balanceCalculator';
import { CategoryBadge } from '../../ui/CategoryBadge';
import { PluginSlot } from '../../../plugin-sdk/components/PluginSlot';
import { cn } from '../../../utils/cn';
import { formatRowDateTime, getBaseRowClass } from './rowHelpers';

export interface LoanTxRowProps {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  isFresh?: boolean;
  isLastInGroup?: boolean;
  showDate?: boolean;
  hideAccountName?: boolean;
  onClick?: () => void;
}

export const LoanTxRow: React.FC<LoanTxRowProps> = ({
  transaction,
  category,
  account,
  isFresh = false,
  isLastInGroup = false,
  showDate = false,
  hideAccountName = false,
  onClick,
}) => {
  const isLend = transaction.loanDirection === 'lend';
  const isRepayment = transaction.loanRole === 'repayment';
  const getDefaultTitle = () => {
    if (isRepayment) {
      return isLend ? '收回借款' : '归还欠款';
    }
    return isLend ? '借出资金' : '向人借款';
  };
  const title = transaction.note || getDefaultTitle();

  const loanStatusLabels: Record<string, string> = {
    settled: '已结清',
    partially_repaid: '部分已还',
  };
  const statusLabel =
    (transaction.loanStatus && loanStatusLabels[transaction.loanStatus]) || '未结清';

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
          type="loan"
          iconName={category?.icon || 'hand-coins'}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] leading-tight font-medium text-(--ink-primary)">
            {title}
          </span>
          <span className="real-stamp px-1 py-0.5 text-[9px]">
            {isLend ? '借出' : '借入'}
          </span>
          {transaction.loanParty && (
            <span className="real-stamp px-1 py-0.5 text-[9px] text-(--color-accent)">
              {transaction.loanParty}
            </span>
          )}
          {transaction.loanStatus && (
            <span className="real-stamp px-1 py-0.5 text-[9px] text-(--ink-tertiary)">
              {statusLabel}
            </span>
          )}
          <PluginSlot name="tx.row.badges" context={{ transaction, category, account }} />
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px] text-(--ink-tertiary)">
          <span>{dateTimeLabel}</span>
          <span>·</span>
          <span>往来借贷</span>
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
            isLend ? 'text-(--color-expense)' : 'text-(--color-income)'
          )}
        >
          {isLend ? `-${formattedAmount}` : `+${formattedAmount}`}
        </span>
      </div>
    </div>
  );
};
