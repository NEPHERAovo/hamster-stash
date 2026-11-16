import React from 'react';
import {
  BasePlugin,
  type PluginManifest,
  type PluginContext,
  type Transaction,
  type CreateTransactionInput,
  getHostCategories,
} from '../../plugin-sdk';
import type { Item } from './types';
import { usePluginItemStore } from './store/usePluginItemStore';
import { ItemListSubPage } from './components/ItemListSubPage';
import { ItemDetailSubPage } from './components/ItemDetailSubPage';
import { ItemFormModal } from './components/ItemFormModal';
import { ItemMetaBarBadge, type ItemMetaBarBadgeProps } from './components/ItemMetaBarBadge';
import { ItemMetaTrayPanel, type ItemMetaTrayPanelProps } from './components/ItemMetaTrayPanel';
import { ItemRowBadge, type ItemRowBadgeProps } from './components/ItemRowBadge';

export class OwnedItemsPlugin extends BasePlugin {
  readonly manifest: PluginManifest = {
    id: 'owned-items',
    name: '持有物品',
    version: '1.0.0',
    description: '追踪大件与数码物品生命周期、购入沉淀、配件维护与日均持有成本。',
    icon: 'package',
    defaultEnabled: true,
  };

  async onActivate(ctx: PluginContext): Promise<void> {
    const collection = ctx.storage.collection<Item>('items');
    usePluginItemStore.getState().setCollection(collection);
    await usePluginItemStore.getState().loadItems();

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
      const itemExt = mCtx.payload.input?.ext?.['owned-items'] as Record<string, unknown> | undefined;

      if (itemExt?.createNewItem) {
        const cat = getHostCategories().find((c) => c.id === mCtx.payload.input?.categoryId);
        const itemName = mCtx.payload.input?.note?.trim() || cat?.name || '新物品';
        const itemIcon = cat?.icon || 'box';
        const buyDate = mCtx.payload.input?.date || new Date().toISOString().split('T')[0];

        const created = await usePluginItemStore.getState().createItem({
          name: itemName,
          icon: itemIcon,
          status: 'using',
          buyDate,
        });

        if (!mCtx.payload.input.ext) {
          mCtx.payload.input.ext = {};
        }
        mCtx.payload.input.ext['owned-items'] = {
          itemId: created.id,
          itemRole: 'buy',
        };
      }

      const result = await next();

      const finalItemExt = mCtx.payload.input?.ext?.['owned-items'] as { itemId?: string; itemRole?: string } | undefined;
      if (finalItemExt?.itemId && finalItemExt?.itemRole === 'sell') {
        await usePluginItemStore.getState().changeStatus(
          finalItemExt.itemId,
          'sold',
          mCtx.payload.input.date
        );
      }

      return result;
    });
  }

  async onDeactivate(): Promise<void> {
  }
}

export default OwnedItemsPlugin;
