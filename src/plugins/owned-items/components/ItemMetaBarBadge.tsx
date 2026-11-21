import React from 'react';
import { PackageIcon as Package } from '@phosphor-icons/react';
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
  let displayText = '物品';
  if (isCreateNew) {
    displayText = '+ 新物品';
  } else if (selectedItem) {
    displayText = selectedItem.name;
  }

  let badgeTitle = '关联物品';
  if (isCreateNew) {
    badgeTitle = '将本笔支出记为新物品';
  } else if (selectedItem) {
    badgeTitle = `已关联物品: ${selectedItem.name}`;
  }

  return (
    <>
      <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>

      <button
        type="button"
        onClick={toggleTray}
        className={cn(
          'flex shrink-0 cursor-pointer items-center gap-1 rounded-(--btn-radius) px-2.5 py-1 font-mono text-xs transition-colors select-none',
          isActive || isTrayOpen
            ? 'bg-(--paper-sunken) font-semibold text-(--ink-solid) shadow-2xs'
            : 'bg-(--paper-sunken) text-(--ink-tertiary) hover:text-(--ink-secondary)'
        )}
        title={badgeTitle}
      >
        <Package className="stroke-1.8 size-3 shrink-0 opacity-75" />
        <span className="max-w-16 truncate">
          {displayText}
        </span>
        <span className="text-[9px] opacity-60">▾</span>
      </button>
    </>
  );
};
