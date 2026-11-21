import React from 'react';
import type { Transaction } from '../../../types/transaction';
import type { Category } from '../../../types/category';
import type { Account } from '../../../types/account';
import { centsToYuan } from '../../../domain/finance/balanceCalculator';
import { CategoryBadge } from '../../ui/CategoryBadge';
import { PluginSlot } from '../../../plugin-sdk/components/PluginSlot';
import { formatRowDateTime, getBaseRowClass } from './rowHelpers';

export interface TransferTxRowProps {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  toAccount?: Account;
  isFresh?: boolean;
  isLastInGroup?: boolean;
  showDate?: boolean;
  onClick?: () => void;
}

export const TransferTxRow: React.FC<TransferTxRowProps> = ({
  transaction,
  category,
  account,
  toAccount,
  isFresh = false,
  isLastInGroup = false,
  showDate = false,
  onClick,
}) => {
  const title = transaction.note || '资金划转';
  const formattedAmount = centsToYuan(transaction.amount);
  const dateTimeLabel = formatRowDateTime(transaction.date, transaction.createdAt, showDate);

  const fromName = account?.name || '转出账户';
  const toName = toAccount?.name || '转入账户';

  return (
    <div
      onClick={onClick}
      className={getBaseRowClass(isFresh, isLastInGroup)}
      data-is-last={isLastInGroup ? 'true' : undefined}
    >
      <div className="mr-3 shrink-0">
        <CategoryBadge
          category={category}
          type="transfer"
          iconName="arrow-left-right"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] leading-tight font-medium text-(--ink-primary)">
            {title}
          </span>
          <span className="real-stamp px-1 py-0.5 text-[9px] text-(--cat-transit)">
            划转
          </span>
          <PluginSlot name="tx.row.badges" context={{ transaction, category, account }} />
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px] text-(--ink-tertiary)">
          <span>{dateTimeLabel}</span>
          <span>·</span>
          <span>{fromName}</span>
          <span>→</span>
          <span className="font-medium text-(--ink-secondary)">{toName}</span>
        </div>
      </div>

      <div className="ml-2.5 shrink-0 text-right">
        <span className="font-mono text-sm font-semibold tracking-tight text-(--cat-transit) tabular-nums">
          ⇄ {formattedAmount}
        </span>
      </div>
    </div>
  );
};
