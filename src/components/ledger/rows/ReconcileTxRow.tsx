import React from 'react';
import type { Transaction } from '../../../types/transaction';
import type { Category } from '../../../types/category';
import type { Account } from '../../../types/account';
import { centsToYuan } from '../../../domain/finance/balanceCalculator';
import { CategoryBadge } from '../../ui/CategoryBadge';
import { PluginSlot } from '../../../plugin-sdk/components/PluginSlot';
import { cn } from '../../../utils/cn';
import { formatRowDateTime, getBaseRowClass } from './rowHelpers';

export interface ReconcileTxRowProps {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  isFresh?: boolean;
  isLastInGroup?: boolean;
  showDate?: boolean;
  hideAccountName?: boolean;
  onClick?: () => void;
}

export const ReconcileTxRow: React.FC<ReconcileTxRowProps> = ({
  transaction,
  category,
  account,
  isFresh = false,
  isLastInGroup = false,
  showDate = false,
  hideAccountName = false,
  onClick,
}) => {
  const title = transaction.note || '平账校准';
  const diff = transaction.reconcileDiff ?? transaction.amount;
  const isPositive = diff > 0;
  const isNegative = diff < 0;
  const formattedAmount = centsToYuan(Math.abs(diff));
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
          type="reconcile"
          iconName="scale"
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-medium text-(--ink-primary) leading-tight truncate">
            {title}
          </span>
          <span className="real-stamp text-[9px] px-1 py-0.5 text-(--ink-tertiary)">
            平账
          </span>
          <PluginSlot name="tx.row.badges" context={{ transaction, category, account }} />
        </div>

        <div className="flex items-center gap-1 text-[11px] text-(--ink-tertiary) font-mono">
          <span>{dateTimeLabel}</span>
          <span>·</span>
          <span>余额校准</span>
          {!hideAccountName && (
            <>
              <span>·</span>
              <span>{account?.name || '未知账户'}</span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right ml-2.5">
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums tracking-tight',
            isPositive && 'text-(--color-income)',
            isNegative && 'text-(--color-expense)',
            !isPositive && !isNegative && 'text-(--ink-tertiary)'
          )}
        >
          {isPositive ? `+${formattedAmount}` : isNegative ? `-${formattedAmount}` : formattedAmount}
        </span>
      </div>
    </div>
  );
};
