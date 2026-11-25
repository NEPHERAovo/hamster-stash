import { create } from 'zustand';
import type { PluginCollection, PluginContext } from '../../../plugin-sdk';
import type { Item, ItemStatus, ItemKind, ItemSortOption, SubscriptionCycle } from '../types';

const VALID_SORT_OPTIONS: readonly ItemSortOption[] = [
  'date-desc',
  'date-asc',
  'cost-desc',
  'cost-asc',
  'daily-desc',
  'daily-asc',
];

let itemCollection: PluginCollection<Item> | null = null;
let pluginSettings: PluginContext['settings'] | null = null;

interface PluginItemState {
  items: Item[];
  loading: boolean;
  sortOption: ItemSortOption;
  setCollection: (col: PluginCollection<Item>) => void;
  setSettings: (settings: PluginContext['settings']) => void;
  loadSortOption: () => Promise<void>;
  setSortOption: (sortOption: ItemSortOption) => void;
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
  sortOption: 'date-desc',

  setCollection: (col) => {
    itemCollection = col;
  },

  setSettings: (settings) => {
    pluginSettings = settings;
  },

  loadSortOption: async () => {
    if (!pluginSettings) return;
    try {
      const saved = await pluginSettings.get<string>('sortOption', 'date-desc');
      if (VALID_SORT_OPTIONS.includes(saved as ItemSortOption)) {
        set({ sortOption: saved as ItemSortOption });
      }
    } catch {
      void 0;
    }
  },

  setSortOption: (sortOption) => {
    set({ sortOption });
    void pluginSettings?.set('sortOption', sortOption);
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
    if (status === 'sold' || status === 'scrapped' || status === 'gifted' || status === 'idle') {
      patch.endDate = endDate || new Date().toISOString().split('T')[0];
    } else {
      patch.endDate = undefined;
    }
    return get().updateItem(id, patch);
  },
}));
