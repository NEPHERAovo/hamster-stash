import React from 'react';
import {
  BasePlugin,
  type PluginManifest,
  type PluginContext,
  type Transaction,
  type CreateTransactionInput,
  getHostCategories,
  getHostTransactions,
} from '../../plugin-sdk';
import type { Item, ItemKind, OwnedItemTxExt } from './types';
import { getOwnedItemExt } from './types';
import { usePluginItemStore } from './store/usePluginItemStore';
import { ItemListSubPage } from './components/ItemListSubPage';
import { ItemDetailSubPage } from './components/ItemDetailSubPage';
import { ItemFormModal } from './components/ItemFormModal';
import { ItemMetaBarBadge, type ItemMetaBarBadgeProps } from './components/ItemMetaBarBadge';
import { ItemMetaTrayPanel, type ItemMetaTrayPanelProps } from './components/ItemMetaTrayPanel';
import { ItemRowBadge, type ItemRowBadgeProps } from './components/ItemRowBadge';

function validateOwnedItemRoleForType(txType: string | undefined, itemExt: OwnedItemTxExt | undefined): void {
  if (!itemExt || !txType) return;
  if (txType === 'expense' && (itemExt.itemRole === 'sell' || itemExt.itemRole === 'profit')) {
    throw new Error('支出记录不能关联为售出或收益');
  }
  if (
    txType === 'income' &&
    (itemExt.createNewItem || itemExt.itemRole === 'buy' || itemExt.itemRole === 'maintenance')
  ) {
    throw new Error('收入记录仅支持关联为售出或收益');
  }
}

async function createLinkedItemFromTx(params: {
  categoryId?: string;
  note?: string;
  date?: string;
  itemExt: OwnedItemTxExt;
}): Promise<OwnedItemTxExt> {
  const cat = getHostCategories().find((c) => c.id === params.categoryId);
  const itemName = params.note?.trim() || cat?.name || '新物品';
  const itemKind: ItemKind = params.itemExt.kind || 'physical';
  const defaultIcon = itemKind === 'subscription' ? 'credit-card' : 'box';
  const itemIcon = (params.itemExt as Record<string, unknown>).icon as string | undefined;
  const buyDate = params.date || new Date().toISOString().split('T')[0];

  const created = await usePluginItemStore.getState().createItem({
    name: itemName,
    icon: itemIcon || cat?.icon || defaultIcon,
    kind: itemKind,
    status: 'using',
    buyDate,
  });

  return {
    itemId: created.id,
    itemRole: 'buy',
    kind: itemKind,
  };
}

async function revertSoldIfNoSellLeft(itemId: string, excludeTxId: string): Promise<void> {
  const store = usePluginItemStore.getState();
  const target = store.items.find((i) => i.id === itemId);
  if (!target || target.status !== 'sold') return;

  const hasAnotherSell = getHostTransactions().some((t) => {
    if (t.id === excludeTxId || t.type !== 'income') return false;
    const ext = getOwnedItemExt(t.ext);
    return ext?.itemId === itemId && ext?.itemRole === 'sell';
  });

  if (!hasAnotherSell) {
    await store.changeStatus(itemId, 'using', undefined);
  }
}

function sanitizeOwnedItemExt(
  ext: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!ext || !ext['owned-items'] || typeof ext['owned-items'] !== 'object') return ext;
  const owned = { ...(ext['owned-items'] as Record<string, unknown>) };
  delete owned.isTrayOpen;
  delete owned.createNewItem;
  const nextExt = { ...ext };
  if (owned.itemId || Object.keys(owned).length > 0) {
    nextExt['owned-items'] = owned;
  } else {
    delete nextExt['owned-items'];
  }
  return Object.keys(nextExt).length > 0 ? nextExt : undefined;
}

export class OwnedItemsPlugin extends BasePlugin {
  private unsubscribeDataImported: (() => void) | null = null;

  readonly manifest: PluginManifest = {
    id: 'owned-items',
    name: '物品与订阅',
    version: '1.0.0',
    description: '记录实体物品与数字订阅服务，计算日均使用成本。',
    icon: 'package',
    defaultEnabled: false,
  };

  async onActivate(ctx: PluginContext): Promise<void> {
    const collection = ctx.storage.collection<Item>('items');
    const itemStore = usePluginItemStore.getState();
    itemStore.setCollection(collection);
    itemStore.setSettings(ctx.settings);
    await Promise.all([itemStore.loadItems(), itemStore.loadSortOption()]);

    this.unsubscribeDataImported = ctx.events.on('data:imported', () => {
      void usePluginItemStore.getState().loadItems();
    });

    ctx.ui.registerNavTab({
      id: 'items',
      label: '物品',
      icon: 'package',
      order: 25,
      component: ItemListSubPage,
    });

    ctx.ui.registerSlot('tx.modal.metaBar', (context) => React.createElement(ItemMetaBarBadge, { context: context as unknown as ItemMetaBarBadgeProps['context'] }), 100);

    ctx.ui.registerSlot('tx.modal.metaTray', (context) => React.createElement(ItemMetaTrayPanel, { context: context as unknown as ItemMetaTrayPanelProps['context'] }), 100);

    ctx.ui.registerSlot('tx.row.badges', (context) => React.createElement(ItemRowBadge, { context: context as unknown as ItemRowBadgeProps['context'] }), 100);

    ctx.ui.registerSubPage('item-list', ItemListSubPage as unknown as React.ComponentType<Record<string, unknown>>);
    ctx.ui.registerSubPage('item-detail', ItemDetailSubPage as unknown as React.ComponentType<Record<string, unknown>>);
    ctx.ui.registerModal('item-form', ItemFormModal as unknown as React.ComponentType<Record<string, unknown>>);

    ctx.middleware.use<{ input: CreateTransactionInput }, Transaction>('transaction:record', async (mCtx, next) => {
      const input = mCtx.payload.input;
      const itemExt = getOwnedItemExt(input?.ext);
      validateOwnedItemRoleForType(input?.type, itemExt);

      if (itemExt?.createNewItem && input) {
        if (!input.ext) input.ext = {};
        input.ext['owned-items'] = await createLinkedItemFromTx({
          categoryId: input.categoryId,
          note: input.note,
          date: input.date,
          itemExt,
        });
      }
      if (input && 'ext' in input) {
        input.ext = sanitizeOwnedItemExt(input.ext);
      }

      const result = await next();

      const finalItemExt = getOwnedItemExt(input?.ext);
      if (input?.type === 'income' && finalItemExt?.itemId && finalItemExt.itemRole === 'sell') {
        await usePluginItemStore.getState().changeStatus(finalItemExt.itemId, 'sold', input.date);
      }

      return result;
    });

    ctx.middleware.use<
      { id: string; patch: Partial<CreateTransactionInput>; previousTx?: Transaction },
      Transaction
    >('transaction:update', async (mCtx, next) => {
      const { id, patch, previousTx } = mCtx.payload;
      const nextType = patch.type || previousTx?.type;
      const nextExt = 'ext' in patch ? patch.ext : previousTx?.ext;
      const nextItemExt = getOwnedItemExt(nextExt);
      const oldItemExt = getOwnedItemExt(previousTx?.ext);

      validateOwnedItemRoleForType(nextType, nextItemExt);

      if (nextType === 'expense' && nextItemExt?.createNewItem) {
        if (!patch.ext) patch.ext = { ...(nextExt || {}) };
        patch.ext['owned-items'] = await createLinkedItemFromTx({
          categoryId: patch.categoryId || previousTx?.categoryId,
          note: 'note' in patch ? patch.note : previousTx?.note,
          date: patch.date || previousTx?.date,
          itemExt: nextItemExt,
        });
      }
      if ('ext' in patch) {
        patch.ext = sanitizeOwnedItemExt(patch.ext);
      }

      const result = await next();

      const resolvedNewExt = getOwnedItemExt(result?.ext || nextExt);
      if (
        oldItemExt?.itemId &&
        oldItemExt.itemRole === 'sell' &&
        (resolvedNewExt?.itemId !== oldItemExt.itemId || resolvedNewExt?.itemRole !== 'sell')
      ) {
        await revertSoldIfNoSellLeft(oldItemExt.itemId, id);
      }

      if (result?.type === 'income' && resolvedNewExt?.itemId && resolvedNewExt.itemRole === 'sell') {
        await usePluginItemStore.getState().changeStatus(resolvedNewExt.itemId, 'sold', result.date);
      }

      return result;
    });

    ctx.middleware.use<{ id: string; deletedTx?: Transaction }, void>('transaction:delete', async (mCtx, next) => {
      const { id, deletedTx } = mCtx.payload;
      await next();
      const deletedExt = getOwnedItemExt(deletedTx?.ext);
      if (deletedExt?.itemId && deletedExt.itemRole === 'sell') {
        await revertSoldIfNoSellLeft(deletedExt.itemId, id);
      }
    });
  }

  async onDeactivate(): Promise<void> {
    this.unsubscribeDataImported?.();
    this.unsubscribeDataImported = null;
  }
}

export default OwnedItemsPlugin;
