import type { AdapterResolver } from '../../types/adapter';
import type { Category, CategoryType } from '../../types/category';
import { STORES } from '../db/schema';
import { BaseRepository } from './BaseRepository';

export class CategoryRepository extends BaseRepository<Category> {
  constructor(adapterResolver: AdapterResolver) {
    super(adapterResolver, STORES.CATEGORIES, {
      useTombstone: true,
      defaultOrderBy: 'sortOrder',
      defaultOrderDirection: 'asc',
      idPrefix: 'cat',
    });
  }

  async findByType(type: CategoryType): Promise<Category[]> {
    const all = await this.findAll();
    return all.filter((cat) => cat.type === type && !cat.isArchived);
  }
}
