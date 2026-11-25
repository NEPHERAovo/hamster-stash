import React from 'react';
import type { Transaction } from '../../../plugin-sdk';
import { cn } from '../../../plugin-sdk';
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

  const getRoleLabel = () => {
    const isSub = item.kind === 'subscription';
    if (itemRole === 'buy') return isSub ? '首订' : '购入';
    if (itemRole === 'maintenance') return isSub ? '续费' : '配件';
    if (itemRole === 'sell') return '售出';
    if (itemRole === 'profit') return '收益';
    return '物品';
  };

  const getColorClass = () => {
    if (itemRole === 'buy') return 'text-(--color-expense)';
    if (itemRole === 'sell' || itemRole === 'profit') return 'text-(--color-income)';
    return 'text-(--ink-secondary)';
  };

  const trimmed = item.name.trim();
  const truncated = trimmed.length > 6 ? `${trimmed.slice(0, 6)}…` : trimmed;

  return (
    <span className={cn('real-stamp px-1 py-0.5 text-[9px]', getColorClass())}>
      {`${getRoleLabel()}·${truncated}`}
    </span>
  );
};
