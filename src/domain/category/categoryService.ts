import { STORES } from '../../core/db/schema';
import type { CategoryRepository } from '../../core/repositories/CategoryRepository';
import type { TransactionRepository } from '../../core/repositories/TransactionRepository';
import type { Category } from '../../types/category';

export class CategoryService {
  private catRepo: CategoryRepository;
  private txRepo: TransactionRepository;

  constructor(catRepo: CategoryRepository, txRepo: TransactionRepository) {
    this.catRepo = catRepo;
    this.txRepo = txRepo;
  }

  async listCategories(): Promise<Category[]> {
    const categories = await this.catRepo.findAll();
    categories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return categories;
  }

  async createCategory(
    data: Partial<Category> & { name: string }
  ): Promise<Category> {
    const trimmed = data.name.trim();
    if (!trimmed) {
      throw new Error('分类名称不能为空');
    }

    const currentCats = await this.catRepo.findAll();
    const maxSort = currentCats.reduce(
      (max, c) => Math.max(max, c.sortOrder || 0),
      0
    );
    const catType = data.type || 'expense';
    const defaultColor =
      catType === 'income' ? 'var(--color-income)' : 'var(--cat-food)';
    const defaultIcon = catType === 'income' ? 'wallet' : 'shopping-cart';

    return this.catRepo.create({
      name: trimmed,
      type: catType,
      icon: data.icon || defaultIcon,
      color: data.color || defaultColor,
      colorClass: data.colorClass,
      sortOrder: data.sortOrder ?? maxSort + 1,
      isSystem: false,
      isArchived: false,
    });
  }

  async updateCategory(
    id: string,
    patch: Partial<Pick<Category, 'name' | 'icon' | 'isArchived' | 'sortOrder'>>
  ): Promise<Category> {
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

    return this.catRepo.update(id, updates);
  }

  async removeCategory(id: string): Promise<{ archived: boolean }> {
    return this.catRepo.runInTransaction(
      [STORES.CATEGORIES, STORES.TRANSACTIONS],
      async () => {
        const all = await this.catRepo.findAll();
        const target = all.find((c) => c.id === id);
        if (!target) {
          throw new Error('分类不存在');
        }

        const activeSameType = all.filter(
          (c) => c.type === target.type && !c.isArchived
        );
        if (!target.isArchived && activeSameType.length <= 1) {
          throw new Error('至少需保留一个可用分类');
        }

        const txs = await this.txRepo.findAll();
        const hasLinkedTransactions = txs.some((t) => t.categoryId === id);

        if (hasLinkedTransactions) {
          await this.catRepo.update(id, { isArchived: true });
          return { archived: true };
        }

        await this.catRepo.delete(id);
        return { archived: false };
      }
    );
  }

  async reorderCategories(orderedIds: string[]): Promise<Category[]> {
    await this.catRepo.runInTransaction([STORES.CATEGORIES], async () => {
      for (let index = 0; index < orderedIds.length; index++) {
        await this.catRepo.update(orderedIds[index], { sortOrder: index + 1 });
      }
    });
    return this.listCategories();
  }
}
