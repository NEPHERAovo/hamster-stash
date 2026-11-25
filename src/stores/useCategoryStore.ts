import { create } from 'zustand';
import type { Category, CategoryType } from '../types/category';
import { core } from '../core';

interface CategoryState {
  categories: Category[];
  loading: boolean;
  loadCategories: () => Promise<void>;
  getByType: (type: CategoryType) => Category[];
  createCategory: (data: Partial<Category> & { name: string }) => Promise<Category>;
  updateCategory: (
    id: string,
    patch: Partial<Pick<Category, 'name' | 'icon' | 'isArchived' | 'sortOrder'>>
  ) => Promise<Category>;
  removeCategory: (id: string) => Promise<{ archived: boolean }>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  loading: false,

  loadCategories: async () => {
    set({ loading: true });
    await core.init();
    const categories = await core.catService.listCategories();
    set({ categories, loading: false });
  },

  getByType: (type: CategoryType) => {
    return get()
      .categories.filter((c) => c.type === type && !c.isArchived)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  },

  createCategory: async (data: Partial<Category> & { name: string }) => {
    await core.init();
    const newCat = await core.catService.createCategory(data);
    await get().loadCategories();
    return newCat;
  },

  updateCategory: async (id, patch) => {
    await core.init();
    const updated = await core.catService.updateCategory(id, patch);
    await get().loadCategories();
    return updated;
  },

  removeCategory: async (id) => {
    await core.init();
    const result = await core.catService.removeCategory(id);
    await get().loadCategories();
    return result;
  },

  reorderCategories: async (orderedIds: string[]) => {
    await core.init();
    const currentCats = [...get().categories];
    const orderMap = new Map<string, number>();
    orderedIds.forEach((id, index) => {
      orderMap.set(id, index + 1);
    });

    const optimisticCats = currentCats
      .map((cat) => {
        const newOrder = orderMap.get(cat.id);
        return newOrder !== undefined ? { ...cat, sortOrder: newOrder } : cat;
      })
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    set({ categories: optimisticCats });

    const categories = await core.catService.reorderCategories(orderedIds);
    set({ categories });
  },
}));
