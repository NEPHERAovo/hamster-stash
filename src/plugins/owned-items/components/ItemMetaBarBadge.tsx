import React from 'react';
import { PackageIcon as Package, CaretDownIcon as CaretDown } from '@phosphor-icons/react';
import { PaperChip } from '../../../plugin-sdk';
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

  if (context.txType === 'loan') return null;

  const itemExt = getOwnedItemExt(context.ext);
  const selectedItemId = itemExt?.itemId;
  const isCreateNew = context.txType === 'expense' && Boolean(itemExt?.createNewItem);
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
    displayText = itemExt?.kind === 'subscription' ? '+ 新订阅' : '+ 新物品';
  } else if (selectedItem) {
    if (context.txType === 'income' && itemExt?.itemRole === 'profit') {
      displayText = `收益·${selectedItem.name}`;
    } else if (context.txType === 'income' && itemExt?.itemRole === 'sell') {
      displayText = `售出·${selectedItem.name}`;
    } else {
      displayText = selectedItem.name;
    }
  }

  let badgeTitle = '关联物品';
  if (isCreateNew) {
    badgeTitle = itemExt?.kind === 'subscription' ? '将本笔支出记为新订阅' : '将本笔支出记为新物品';
  } else if (selectedItem) {
    badgeTitle = `已关联物品: ${selectedItem.name}`;
  }

  return (
    <>
      <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>

      <PaperChip
        selected={isActive || isTrayOpen}
        leftIcon={<Package className="stroke-1.8 size-3 shrink-0 opacity-75" />}
        rightIcon={<CaretDown className="size-3.5 shrink-0 opacity-70" weight="bold" />}
        onClick={toggleTray}
        title={badgeTitle}
        className="max-w-28 shrink-0"
      >
        <span className="max-w-20 truncate">{displayText}</span>
      </PaperChip>
    </>
  );
};
