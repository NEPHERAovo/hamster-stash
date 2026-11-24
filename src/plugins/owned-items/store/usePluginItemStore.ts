import { create } from 'zustand';
import type { PluginCollection } from '../../../plugin-sdk';
import type { Item, ItemStatus, ItemKind, SubscriptionCycle } from '../types';

let itemCollection: PluginCollection<Item> | null = null;

interface PluginItemState {
  items: Item[];
  loading: boolean;
  setCollection: (col: PluginCollection<Item>) => void;
  loadItems: () => Promise<void>;
  createItem: (input: {
    name: string;
    icon: string;
    kind?: ItemKind;
    status?: ItemStatus;
    buyDate: string;
    billingCycle?: SubscriptionCycle;
    renewalAmountCents?: number;
    nextRenewalDate?: string;
    note?: string;
  }) => Promise<Item>;
  updateItem: (id: string, patch: Partial<Omit<Item, 'id' | 'createdAt'>>) => Promise<Item>;
  deleteItem: (id: string) => Promise<void>;
  changeStatus: (id: string, status: ItemStatus, endDate?: string) => Promise<Item>;
}

export const usePluginItemStore = create<PluginItemState>((set, get) => ({
  items: [],
  loading: false,

  setCollection: (col) => {
    itemCollection = col;
  },

  loadItems: async () => {
    if (!itemCollection) return;
    set({ loading: true });
    try {
      const items = await itemCollection.findAll();
      items.sort((a, b) => b.buyDate.localeCompare(a.buyDate));
      set({ items, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createItem: async (input) => {
    if (!itemCollection) throw new Error('存储尚未初始化');
    const now = new Date().toISOString();
    const item: Item = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: input.name.trim(),
      icon: input.icon || (input.kind === 'subscription' ? 'credit-card' : 'box'),
      kind: input.kind || 'physical',
      status: input.status || 'using',
      buyDate: input.buyDate,
      billingCycle: input.billingCycle,
      renewalAmountCents: input.renewalAmountCents,
      nextRenewalDate: input.nextRenewalDate,
      note: input.note?.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await itemCollection.create(item);
    await get().loadItems();
    return item;
  },

  updateItem: async (id, patch) => {
    if (!itemCollection) throw new Error('存储尚未初始化');
    const updated = await itemCollection.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    await get().loadItems();
    return updated;
  },

  deleteItem: async (id) => {
    if (!itemCollection) throw new Error('存储尚未初始化');
    await itemCollection.delete(id);
    await get().loadItems();
  },

  changeStatus: async (id, status, endDate) => {
    const patch: Partial<Item> = { status };
    if (status === 'sold' || status === 'scrapped' || status === 'gifted') {
      patch.endDate = endDate || new Date().toISOString().split('T')[0];
    } else {
      patch.endDate = undefined;
    }
    return get().updateItem(id, patch);
  },
}));
