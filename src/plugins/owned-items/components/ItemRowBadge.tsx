import React from 'react';
import type { Transaction } from '../../../plugin-sdk';
import { usePluginItemStore } from '../store/usePluginItemStore';
import { getOwnedItemExt } from '../types';

export interface ItemRowBadgeProps {
  context: {
    transaction: Transaction;
  };
}

export const ItemRowBadge: React.FC<ItemRowBadgeProps> = ({ context }) => {
  const items = usePluginItemStore((s) => s.items);

  const tx = context.transaction;
  const extItem = getOwnedItemExt(tx.ext);
  const itemId = extItem?.itemId;
  const itemRole = extItem?.itemRole;

  if (!itemId) return null;

  const item = items.find((i) => i.id === itemId);
  if (!item) return null;

  return (
    <div className="flex items-center gap-1 shrink-0">
      {itemRole === 'buy' && (
        <span className="text-[9px] font-mono px-1 py-0.5 rounded-xs bg-(--color-expense-bg) text-(--color-expense) font-semibold leading-none">
          购入
        </span>
      )}
      {itemRole === 'maintenance' && (
        <span className="text-[9px] font-mono px-1 py-0.5 rounded-xs bg-(--paper-sunken) text-(--ink-secondary) leading-none">
          保养
        </span>
      )}
      {itemRole === 'sell' && (
        <span className="text-[9px] font-mono px-1 py-0.5 rounded-xs bg-(--color-income-bg) text-(--color-income) font-semibold leading-none">
          回血
        </span>
      )}
      {item && (
        <span className="text-[9px] font-mono text-(--ink-tertiary) leading-none max-w-[60px] truncate">
          {item.name}
        </span>
      )}
    </div>
  );
};
