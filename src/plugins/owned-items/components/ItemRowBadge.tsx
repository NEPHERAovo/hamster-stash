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
    <div className="flex shrink-0 items-center gap-1">
      {itemRole === 'buy' && (
        <span className="rounded-xs bg-(--color-expense-bg) px-1 py-0.5 font-mono text-[9px] leading-none font-semibold text-(--color-expense)">
          购入
        </span>
      )}
      {itemRole === 'maintenance' && (
        <span className="rounded-xs bg-(--paper-sunken) px-1 py-0.5 font-mono text-[9px] leading-none text-(--ink-secondary)">
          保养
        </span>
      )}
      {itemRole === 'sell' && (
        <span className="rounded-xs bg-(--color-income-bg) px-1 py-0.5 font-mono text-[9px] leading-none font-semibold text-(--color-income)">
          回血
        </span>
      )}
      {item && (
        <span className="max-w-15 truncate font-mono text-[9px] leading-none text-(--ink-tertiary)">
          {item.name}
        </span>
      )}
    </div>
  );
};
