import React, { useMemo } from 'react';
import { PlusIcon as Plus } from '@phosphor-icons/react';
import { getCategoryIcon, PaperButton, PaperChip, SegToggle } from '../../../plugin-sdk';
import { usePluginItemStore } from '../store/usePluginItemStore';
import { getOwnedItemExt } from '../types';
import { isItemDisposed } from '../domain/itemCalculator';

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
  const incomeRole: 'sell' | 'profit' = itemExt?.itemRole === 'profit' ? 'profit' : 'sell';

  const physicalItems = useMemo(() => {
    return items.filter(
      (i) =>
        (!i.kind || i.kind === 'physical') &&
        (!isItemDisposed(i.status) || i.id === selectedItemId)
    );
  }, [items, selectedItemId]);

  const subscriptionItems = useMemo(() => {
    return items.filter(
      (i) =>
        i.kind === 'subscription' &&
        (!isItemDisposed(i.status) || i.id === selectedItemId)
    );
  }, [items, selectedItemId]);

  if (!isTrayOpen || context.txType === 'loan') return null;

  const handleClearAssociation = () => {
    context.setExtKey('owned-items', {
      ...(itemExt || {}),
      createNewItem: false,
      itemId: undefined,
      itemRole: undefined,
      kind: undefined,
      isTrayOpen: false,
    });
  };

  const handleToggleCreateNew = (kind: 'physical' | 'subscription' = 'physical') => {
    const nextCreateNew = !isCreateNew || itemExt?.kind !== kind;
    context.setExtKey('owned-items', {
      ...(itemExt || {}),
      createNewItem: nextCreateNew,
      itemId: undefined,
      itemRole: nextCreateNew ? 'buy' : undefined,
      kind: nextCreateNew ? kind : undefined,
      isTrayOpen: false,
    });
  };

  const handleSelectExistingItem = (itemId: string, kind: 'physical' | 'subscription' = 'physical') => {
    const nextRole = context.txType === 'income' ? incomeRole : 'maintenance';
    context.setExtKey('owned-items', {
      ...(itemExt || {}),
      createNewItem: false,
      itemId,
      itemRole: nextRole,
      kind,
      isTrayOpen: false,
    });
  };

  const handleSwitchIncomeRole = (nextRole: 'sell' | 'profit') => {
    context.setExtKey('owned-items', {
      ...(itemExt || {}),
      createNewItem: false,
      itemRole: nextRole,
    });
  };

  const hasActiveSelection = isCreateNew || Boolean(selectedItemId);

  if (context.txType === 'income') {
    return (
      <div className="space-y-1.5 border-t border-dashed border-(--rule-hairline)/60 pt-1.5 pb-0.5 select-none">
        <div className="flex items-center justify-between gap-2 text-[11px] text-(--ink-tertiary)">
          <SegToggle
            options={[
              { value: 'sell', label: '售出' },
              { value: 'profit', label: '收益' },
            ]}
            value={incomeRole}
            onChange={(val) => handleSwitchIncomeRole(val as 'sell' | 'profit')}
            size="sm"
            fullWidth={false}
          />
          {hasActiveSelection && (
            <PaperButton
              variant="danger-ghost"
              size="xs"
              onClick={handleClearAssociation}
            >
              解除关联
            </PaperButton>
          )}
        </div>

        <div className="space-y-1.5">
          {incomeRole === 'profit' && subscriptionItems.length > 0 && (
            <div className="border-t border-dotted border-(--rule-hairline)/60 pt-1">
              <div className="mb-1 font-mono text-[10px] text-(--ink-tertiary)">
                订阅
              </div>
              <div className="grid max-h-24 grid-cols-3 gap-1 overflow-y-auto">
                {subscriptionItems.map((it) => {
                  const ItemIcon = getCategoryIcon(it.icon);
                  const isSelected = selectedItemId === it.id;
                  return (
                    <PaperChip
                      key={it.id}
                      selected={isSelected}
                      variant="income"
                      leftIcon={<ItemIcon className="size-3 shrink-0 opacity-70" />}
                      onClick={() => handleSelectExistingItem(it.id, 'subscription')}
                      className="w-full min-w-0 justify-start px-2"
                      title={it.name}
                    >
                      {it.name}
                    </PaperChip>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-dotted border-(--rule-hairline)/60 pt-1">
            <div className="mb-1 font-mono text-[10px] text-(--ink-tertiary)">
              物品
            </div>
            <div className="grid max-h-28 grid-cols-3 gap-1 overflow-y-auto">
              {physicalItems.length === 0 ? (
                <div className="col-span-3 py-1.5 text-center text-[11px] text-(--ink-tertiary)">
                  暂无物品
                </div>
              ) : (
                physicalItems.map((it) => {
                  const ItemIcon = getCategoryIcon(it.icon);
                  const isSelected = selectedItemId === it.id;
                  return (
                    <PaperChip
                      key={it.id}
                      selected={isSelected}
                      variant="income"
                      leftIcon={<ItemIcon className="size-3 shrink-0 opacity-70" />}
                      onClick={() => handleSelectExistingItem(it.id, 'physical')}
                      className="w-full min-w-0 justify-start px-2"
                      title={it.name}
                    >
                      {it.name}
                    </PaperChip>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 border-t border-dashed border-(--rule-hairline)/60 pt-1.5 pb-0.5 select-none">
      <div className="flex items-center justify-between text-[11px] text-(--ink-tertiary)">
        <span>关联或新建物品</span>
        {hasActiveSelection && (
          <PaperButton
            variant="danger-ghost"
            size="xs"
            onClick={handleClearAssociation}
          >
            解除关联
          </PaperButton>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <PaperChip
            variant="income"
            selected={isCreateNew && (!itemExt?.kind || itemExt?.kind === 'physical')}
            leftIcon={<Plus className="size-3.5 shrink-0 stroke-2" />}
            onClick={() => handleToggleCreateNew('physical')}
            className="w-full min-w-0 justify-center"
          >
            记为新物品
          </PaperChip>

          <PaperChip
            variant="income"
            selected={isCreateNew && itemExt?.kind === 'subscription'}
            leftIcon={<Plus className="size-3.5 shrink-0 stroke-2" />}
            onClick={() => handleToggleCreateNew('subscription')}
            className="w-full min-w-0 justify-center"
          >
            记为新订阅
          </PaperChip>
        </div>

        {subscriptionItems.length > 0 && (
          <div className="border-t border-dotted border-(--rule-hairline)/60 pt-1">
            <div className="mb-1 font-mono text-[10px] text-(--ink-tertiary)">
              订阅
            </div>
            <div className="grid max-h-24 grid-cols-3 gap-1 overflow-y-auto">
              {subscriptionItems.map((it) => {
                const ItemIcon = getCategoryIcon(it.icon);
                const isSelected = selectedItemId === it.id && !isCreateNew;
                return (
                  <PaperChip
                    key={it.id}
                    selected={isSelected}
                    leftIcon={<ItemIcon className="size-3 shrink-0 opacity-70" />}
                    onClick={() => handleSelectExistingItem(it.id, 'subscription')}
                    className="w-full min-w-0 justify-start px-2"
                    title={it.name}
                  >
                    {it.name}
                  </PaperChip>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t border-dotted border-(--rule-hairline)/60 pt-1">
          <div className="mb-1 font-mono text-[10px] text-(--ink-tertiary)">
            物品
          </div>
          <div className="grid max-h-28 grid-cols-3 gap-1 overflow-y-auto">
            {physicalItems.length === 0 ? (
              <div className="col-span-3 py-1.5 text-center text-[11px] text-(--ink-tertiary)">
                暂无物品
              </div>
            ) : (
              physicalItems.map((it) => {
                const ItemIcon = getCategoryIcon(it.icon);
                const isSelected = selectedItemId === it.id && !isCreateNew;
                return (
                  <PaperChip
                    key={it.id}
                    selected={isSelected}
                    leftIcon={<ItemIcon className="size-3 shrink-0 opacity-70" />}
                    onClick={() => handleSelectExistingItem(it.id, 'physical')}
                    className="w-full min-w-0 justify-start px-2"
                    title={it.name}
                  >
                    {it.name}
                  </PaperChip>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
