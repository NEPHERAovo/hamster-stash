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
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  loading: false,

  loadCategories: async () => {
    set({ loading: true });
    await core.init();
    const categories = await core.catRepo.findAll();
    set({ categories, loading: false });
  },

  getByType: (type: CategoryType) => {
    return get().categories.filter((c) => c.type === type && !c.isArchived);
  },

  createCategory: async (data: Partial<Category> & { name: string }) => {
    await core.init();
    const currentCats = get().categories;
    const maxSort = currentCats.reduce((max, c) => Math.max(max, c.sortOrder || 0), 0);
    const catType = data.type || 'expense';

    const defaultColor = catType === 'income' ? 'var(--color-income)' : 'var(--cat-food)';
    const defaultIcon = catType === 'income' ? 'wallet' : 'shopping-cart';

    const newCat = await core.catRepo.create({
      name: data.name.trim(),
      type: catType,
      icon: data.icon || defaultIcon,
      color: data.color || defaultColor,
      colorClass: data.colorClass,
      sortOrder: data.sortOrder ?? maxSort + 1,
      isSystem: false,
      isArchived: false,
    });

    await get().loadCategories();
    return newCat;
  },

  updateCategory: async (id, patch) => {
    await core.init();
    const updates: Partial<Omit<Category, 'id' | 'createdAt'>> = {};
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) {
        throw new Error('分类名称不能为空');
      }
      updates.name = trimmed;
    }
    if (patch.icon !== undefined) updates.icon = patch.icon;
    if (patch.isArchived !== undefined) updates.isArchived = patch.isArchived;
    if (patch.sortOrder !== undefined) updates.sortOrder = patch.sortOrder;

    const updated = await core.catRepo.update(id, updates);
    await get().loadCategories();
    return updated;
  },

  removeCategory: async (id) => {
    await core.init();
    const all = await core.catRepo.findAll();
    const target = all.find((c) => c.id === id);
    if (!target) {
      throw new Error('分类不存在');
    }

    const activeSameType = all.filter((c) => c.type === target.type && !c.isArchived);
    if (!target.isArchived && activeSameType.length <= 1) {
      throw new Error('至少需保留一个可用分类');
    }

    const txs = await core.txRepo.findAll();
    const hasLinkedTransactions = txs.some((t) => t.categoryId === id);

    if (target.isSystem || hasLinkedTransactions) {
      await core.catRepo.update(id, { isArchived: true });
      await get().loadCategories();
      return { archived: true };
    }

    await core.catRepo.delete(id);
    await get().loadCategories();
    return { archived: false };
  },
}));
