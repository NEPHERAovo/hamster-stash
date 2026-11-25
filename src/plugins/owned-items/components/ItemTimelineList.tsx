import React from 'react';
import { XIcon as X } from '@phosphor-icons/react';
import { centsToYuan, cn, PaperIconButton, type Transaction } from '../../../plugin-sdk';
import { getOwnedItemExt } from '../types';

export interface ItemTimelineListProps {
  isSub: boolean;
  transactions: Transaction[];
  onUnlinkTransaction: (tx: Transaction) => void;
}

export const ItemTimelineList: React.FC<ItemTimelineListProps> = ({
  isSub,
  transactions,
  onUnlinkTransaction,
}) => {
  const getRoleTag = (tx: Transaction) => {
    const role = getOwnedItemExt(tx.ext)?.itemRole;
    if (role === 'buy') {
      return (
        <span className="rounded-(--badge-radius) bg-(--paper-sunken) px-1.5 py-0.5 font-mono text-[9px] text-(--ink-secondary)">
          {isSub ? '首订' : '购入'}
        </span>
      );
    }
    if (role === 'maintenance') {
      return (
        <span className="rounded-(--badge-radius) bg-(--paper-sunken) px-1.5 py-0.5 font-mono text-[9px] text-(--ink-secondary)">
          {isSub ? '续费' : '配件'}
        </span>
      );
    }
    if (role === 'sell') {
      return (
        <span className="rounded-(--badge-radius) bg-(--color-income-bg) px-1.5 py-0.5 font-mono text-[9px] font-semibold text-(--color-income)">
          售出
        </span>
      );
    }
    if (role === 'profit') {
      return (
        <span className="rounded-(--badge-radius) bg-(--color-income-bg) px-1.5 py-0.5 font-mono text-[9px] font-semibold text-(--color-income)">
          收益
        </span>
      );
    }
    return (
      <span className="rounded-(--badge-radius) bg-(--paper-sunken) px-1.5 py-0.5 font-mono text-[9px] text-(--ink-tertiary)">
        关联
      </span>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 font-mono text-xs text-(--ink-tertiary)">
        <span>{isSub ? '扣费流水明细' : '关联流水'}</span>
        <span>共 {transactions.length} 笔</span>
      </div>

      {transactions.length > 0 ? (
        <div className="paper-card divide-y divide-dashed divide-(--rule-hairline)/60 overflow-hidden rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) shadow-xs">
          {transactions.map((tx) => {
            const isIncome = tx.type === 'income';
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 transition-colors hover:bg-(--paper-hover)/50"
              >
                <div className="mr-3 flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-(--ink-solid)">
                        {tx.note || (isIncome ? '售出收入' : '支出')}
                      </span>
                      {getRoleTag(tx)}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-(--ink-tertiary)">
                      {tx.date}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 text-right">
                  <span
                    className={cn(
                      'font-mono text-xs font-bold tabular-nums',
                      isIncome ? 'text-(--color-income)' : 'text-(--ink-solid)'
                    )}
                  >
                    {isIncome ? `+¥${centsToYuan(tx.amount)}` : `-¥${centsToYuan(tx.amount)}`}
                  </span>
                  <PaperIconButton
                    icon={X}
                    size="sm"
                    variant="ghost"
                    onClick={() => onUnlinkTransaction(tx)}
                    className="text-(--ink-faint) hover:text-(--color-expense)"
                    title="解除关联"
                    aria-label="解除关联"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="paper-card rounded-(--radius-md) border border-dashed border-(--rule-hairline) bg-(--paper-sheet) py-6 text-center font-mono text-xs text-(--ink-tertiary)">
          暂无关联记账流水
        </div>
      )}
    </div>
  );
};
