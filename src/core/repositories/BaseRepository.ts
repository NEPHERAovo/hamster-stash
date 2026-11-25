import type {
  AdapterResolver,
  DataAdapter,
  QueryOptions,
  StoredEntity,
} from '../../types/adapter';

export interface RepositoryConfig {
  useTombstone?: boolean;
  defaultOrderBy?: string;
  defaultOrderDirection?: 'asc' | 'desc';
  idPrefix?: string;
}

export type CreateEntityInput<T extends StoredEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt'
> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

export class BaseRepository<T extends StoredEntity> {
  protected readonly adapterResolver: AdapterResolver;
  protected readonly storeName: string;
  protected readonly useTombstone: boolean;
  protected readonly defaultOrderBy?: string;
  protected readonly defaultOrderDirection: 'asc' | 'desc';
  protected readonly idPrefix: string;

  constructor(
    adapterResolver: AdapterResolver,
    storeName: string,
    config: RepositoryConfig = {}
  ) {
    this.adapterResolver = adapterResolver;
    this.storeName = storeName;
    this.useTombstone = config.useTombstone ?? true;
    this.defaultOrderBy = config.defaultOrderBy;
    this.defaultOrderDirection = config.defaultOrderDirection ?? 'asc';
    this.idPrefix = config.idPrefix ?? 'id';
  }

  protected get adapter(): DataAdapter {
    const resolved =
      typeof this.adapterResolver === 'function'
        ? this.adapterResolver()
        : this.adapterResolver;
    if (!resolved) {
      throw new Error(`Adapter is not configured for store ${this.storeName}`);
    }
    return resolved;
  }

  async findById(id: string): Promise<T | null> {
    const item = await this.adapter.get<T>(this.storeName, id);
    if (!item || (this.useTombstone && item.deletedAt)) {
      return null;
    }
    return item;
  }

  async getRawById(id: string): Promise<T | null> {
    return this.adapter.get<T>(this.storeName, id);
  }

  async findAllRaw(): Promise<T[]> {
    return this.adapter.getAll<T>(this.storeName);
  }

  async findAll(options?: QueryOptions): Promise<T[]> {
    const raw = await this.fetchAllForQuery();
    let items = this.useTombstone ? raw.filter((item) => !item.deletedAt) : raw;

    if (options?.filters) {
      const filterEntries = Object.entries(options.filters);
      items = items.filter((item) =>
        filterEntries.every(
          ([key, val]) => (item as Record<string, unknown>)[key] === val
        )
      );
    }

    const orderBy = options?.orderBy ?? this.defaultOrderBy;
    if (orderBy) {
      const orderDirection = options?.orderDirection ?? this.defaultOrderDirection;
      const order = orderDirection === 'desc' ? -1 : 1;
      items.sort((a, b) => {
        const rawA = (a as Record<string, unknown>)[orderBy];
        const rawB = (b as Record<string, unknown>)[orderBy];
        if (typeof rawA === 'number' && typeof rawB === 'number') {
          if (rawA !== rawB) return (rawA - rawB) * order;
        } else {
          const aVal = String(rawA ?? '');
          const bVal = String(rawB ?? '');
          if (aVal < bVal) return -1 * order;
          if (aVal > bVal) return 1 * order;
        }
        if (orderBy === 'date') {
          const aCreated = String((a as Record<string, unknown>).createdAt ?? '');
          const bCreated = String((b as Record<string, unknown>).createdAt ?? '');
          if (aCreated < bCreated) return -1 * order;
          if (aCreated > bCreated) return 1 * order;
        }
        return 0;
      });
    }

    if (options?.offset) {
      items = items.slice(options.offset);
    }

    if (options?.limit !== undefined) {
      items = items.slice(0, options.limit);
    }

    return items;
  }

  protected async fetchAllForQuery(): Promise<T[]> {
    return this.adapter.getAll<T>(this.storeName);
  }

  async create(data: CreateEntityInput<T>): Promise<T> {
    const now = new Date().toISOString();
    const createdAt = data.createdAt || now;
    const updatedAt = data.updatedAt || now;
    const id =
      data.id ||
      `${this.idPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const entity = {
      ...data,
      id,
      createdAt,
      updatedAt,
    } as unknown as T;
    delete entity.deletedAt;

    await this.adapter.put(this.storeName, entity);
    return entity;
  }

  async update(id: string, data: Partial<Omit<T, 'id'>>): Promise<T> {
    const item = await this.adapter.get<T>(this.storeName, id);
    if (!item || (this.useTombstone && item.deletedAt)) {
      throw new Error(`Item ${id} not found in store ${this.storeName}`);
    }

    const updated = {
      ...item,
      ...data,
      id,
      updatedAt: data.updatedAt ?? new Date().toISOString(),
    } as unknown as T;

    await this.adapter.put(this.storeName, updated);
    return updated;
  }

  async upsert(
    id: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ): Promise<T> {
    const existing = await this.adapter.get<T>(this.storeName, id);
    if (existing && (!this.useTombstone || !existing.deletedAt)) {
      return this.update(id, data as Partial<Omit<T, 'id'>>);
    }
    return this.create({
      ...data,
      id,
    } as CreateEntityInput<T>);
  }

  async delete(id: string): Promise<void> {
    if (!this.useTombstone) {
      await this.adapter.remove(this.storeName, id);
      return;
    }
    const existing = await this.adapter.get<T>(this.storeName, id);
    if (!existing || existing.deletedAt) return;
    const now = new Date().toISOString();
    await this.adapter.put(this.storeName, {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    });
  }

  async runInTransaction<R>(stores: string[], fn: () => Promise<R>): Promise<R> {
    return this.adapter.runInTransaction(stores, fn);
  }
}
