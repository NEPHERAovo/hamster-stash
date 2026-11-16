import { create } from 'zustand';
import type { Category, CategoryType } from '../types/category';
import { core } from '../core';

interface CategoryState {
  categories: Category[];
  loading: boolean;
  loadCategories: () => Promise<void>;
  getByType: (type: CategoryType) => Category[];
  createCategory: (data: Partial<Category> & { name: string }) => Promise<Category>;
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
}));
