import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { getCategoryIcon, cn } from '../../../plugin-sdk';
import { usePluginItemStore } from '../store/usePluginItemStore';
import { getOwnedItemExt } from '../types';

export interface ItemMetaTrayPanelProps {
  context: {
    txType: 'expense' | 'income' | 'loan';
    dateStr: string;
    ext: Record<string, unknown>;
    setExtKey: (key: string, value: unknown) => void;
  };
}

export const ItemMetaTrayPanel: React.FC<ItemMetaTrayPanelProps> = ({ context }) => {
  const items = usePluginItemStore((s) => s.items);

  const itemExt = getOwnedItemExt(context.ext);
  const selectedItemId = itemExt?.itemId;
  const isCreateNew = Boolean(itemExt?.createNewItem);
  const isTrayOpen = Boolean(itemExt?.isTrayOpen);

  const availableItems = useMemo(() => {
    return items.filter((i) => i.status === 'using' || i.status === 'idle');
  }, [items]);

  if (!isTrayOpen || context.txType !== 'expense') return null;

  const handleClearAssociation = () => {
    context.setExtKey('owned-items', {
      ...(itemExt || {}),
      createNewItem: false,
      itemId: undefined,
      itemRole: undefined,
      isTrayOpen: false,
    });
  };

  const handleToggleCreateNew = () => {
    const nextCreateNew = !isCreateNew;
    context.setExtKey('owned-items', {
      ...(itemExt || {}),
      createNewItem: nextCreateNew,
      itemId: undefined,
      itemRole: nextCreateNew ? 'buy' : undefined,
      isTrayOpen: false,
    });
  };

  const handleSelectExistingItem = (itemId: string) => {
    context.setExtKey('owned-items', {
      ...(itemExt || {}),
      createNewItem: false,
      itemId,
      itemRole: 'maintenance',
      isTrayOpen: false,
    });
  };

  const hasActiveSelection = isCreateNew || Boolean(selectedItemId);

  return (
    <div className="pt-1.5 pb-0.5 border-t border-dashed border-(--rule-hairline)/60 space-y-1.5 select-none">
      <div className="flex items-center justify-between text-[11px] text-(--ink-tertiary)">
        <span>关联或新建持有物品</span>
        {hasActiveSelection && (
          <button
            type="button"
            onClick={handleClearAssociation}
            className="hover:text-(--color-expense) transition-colors cursor-pointer text-[11px]"
          >
            解除关联
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <button
          type="button"
          onClick={handleToggleCreateNew}
          className={cn(
            'w-full py-1.5 px-2.5 rounded-(--btn-radius) text-xs font-mono flex items-center justify-between transition-all cursor-pointer border',
            isCreateNew
              ? 'bg-(--color-income-bg) text-(--color-income) border-(--color-income) font-semibold shadow-2xs'
              : 'bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary) border-(--rule-hairline)'
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Plus className="w-3.5 h-3.5 stroke-2 shrink-0" />
            <span className="font-semibold">+ 将本笔支出记为新物品</span>
          </div>
          <span className="text-[10px] text-(--ink-tertiary)">
            {isCreateNew ? '已激活 ✓' : '保存时自动生成'}
          </span>
        </button>

        <div className="pt-1 border-t border-dotted border-(--rule-hairline)/60">
          <div className="text-[10px] font-mono text-(--ink-tertiary) mb-1">
            关联已有物品 (配件 / 保养)
          </div>
          <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
            {availableItems.length === 0 ? (
              <div className="col-span-3 text-[11px] text-(--ink-tertiary) py-2 text-center">
                暂无在用或闲置物品
              </div>
            ) : (
              availableItems.map((it) => {
                const ItemIcon = getCategoryIcon(it.icon);
                const isSelected = selectedItemId === it.id && !isCreateNew;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => handleSelectExistingItem(it.id)}
                    className={cn(
                      'px-2 py-1 text-xs font-mono rounded-(--radius-sm) flex items-center gap-1.5 text-left truncate transition-all cursor-pointer border',
                      isSelected
                        ? 'bg-(--paper-sunken) text-(--ink-solid) font-bold shadow-2xs border-(--rule-hairline) -rotate-1'
                        : 'text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-hover)/50 border-transparent'
                    )}
                  >
                    <ItemIcon className="w-3 h-3 shrink-0 opacity-70" />
                    <span className="truncate">{it.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
