import type { DataAdapter } from '../../types/adapter';
import type { Category, CategoryType } from '../../types/category';
import { STORES } from '../db/schema';

export class CategoryRepository {
  private adapter: DataAdapter;

  constructor(adapter: DataAdapter) {
    this.adapter = adapter;
  }

  async findById(id: string): Promise<Category | null> {
    return this.adapter.read<Category>(STORES.CATEGORIES, id);
  }

  async findAll(): Promise<Category[]> {
    return this.adapter.query<Category>(STORES.CATEGORIES, {
      orderBy: 'sortOrder',
      orderDirection: 'asc',
    });
  }

  async findByType(type: CategoryType): Promise<Category[]> {
    const all = await this.findAll();
    return all.filter((cat) => cat.type === type && !cat.isArchived);
  }

  async create(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Category> {
    return this.adapter.create<Category>(STORES.CATEGORIES, data);
  }

  async update(id: string, data: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<Category> {
    return this.adapter.update<Category>(STORES.CATEGORIES, id, data);
  }

  async delete(id: string): Promise<void> {
    return this.adapter.delete(STORES.CATEGORIES, id);
  }
}
