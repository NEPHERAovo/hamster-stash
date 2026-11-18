import React from 'react';
import { Package } from 'lucide-react';
import { cn } from '../../../plugin-sdk';
import { usePluginItemStore } from '../store/usePluginItemStore';
import { getOwnedItemExt } from '../types';

export interface ItemMetaBarBadgeProps {
  context: {
    txType: 'expense' | 'income' | 'loan';
    ext: Record<string, unknown>;
    setExtKey: (key: string, value: unknown) => void;
    closeOtherTrays: () => void;
  };
}

export const ItemMetaBarBadge: React.FC<ItemMetaBarBadgeProps> = ({ context }) => {
  const items = usePluginItemStore((s) => s.items);

  if (context.txType !== 'expense') return null;

  const itemExt = getOwnedItemExt(context.ext);
  const selectedItemId = itemExt?.itemId;
  const isCreateNew = Boolean(itemExt?.createNewItem);
  const isTrayOpen = Boolean(itemExt?.isTrayOpen);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const toggleTray = () => {
    context.closeOtherTrays();
    context.setExtKey('owned-items', {
      ...(itemExt || {}),
      isTrayOpen: !isTrayOpen,
    });
  };

  const isActive = isCreateNew || Boolean(selectedItem);
  const displayText = isCreateNew
    ? '+ 新物品'
    : selectedItem
    ? selectedItem.name
    : '物品';

  return (
    <>
      <span className="metadata-sep text-(--ink-faint) shrink-0 select-none">·</span>

      <button
        type="button"
        onClick={toggleTray}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1 rounded-(--btn-radius) transition-colors cursor-pointer select-none text-xs font-mono shrink-0',
          isActive || isTrayOpen
            ? 'bg-(--paper-sunken) text-(--ink-solid) font-semibold shadow-2xs'
            : 'bg-(--paper-sunken) text-(--ink-tertiary) hover:text-(--ink-secondary)'
        )}
        title={isCreateNew ? '将本笔支出记为新物品' : selectedItem ? `已关联物品: ${selectedItem.name}` : '关联持有物品'}
      >
        <Package className="w-3 h-3 stroke-[1.8] opacity-75 shrink-0" />
        <span className="max-w-[64px] truncate">
          {displayText}
        </span>
        <span className="text-[9px] opacity-60">▾</span>
      </button>
    </>
  );
};
