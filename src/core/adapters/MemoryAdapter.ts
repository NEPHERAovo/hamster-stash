import type {
  DataAdapter,
  ExportData,
  QueryOptions,
  StoredEntity,
} from '../../types/adapter';
import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import type { Transaction } from '../../types/transaction';

export class MemoryAdapter implements DataAdapter {
  readonly id = 'memory';
  private collections = new Map<string, Map<string, StoredEntity>>();

  async initialize(): Promise<void> {}

  async destroy(): Promise<void> {
    this.collections.clear();
  }

  private getCollection(name: string): Map<string, StoredEntity> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return this.collections.get(name)!;
  }

  async create<T extends StoredEntity>(
    collection: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string }
  ): Promise<T> {
    const col = this.getCollection(collection);
    const now = new Date().toISOString();
    const createdAt = data.createdAt || now;
    const id = data.id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const entity = {
      ...data,
      id,
      createdAt,
      updatedAt: now,
    } as unknown as T;

    col.set(id, entity);
    return entity;
  }

  async read<T extends StoredEntity>(collection: string, id: string): Promise<T | null> {
    const col = this.getCollection(collection);
    const item = col.get(id);
    return item ? (structuredClone(item) as T) : null;
  }

  async update<T extends StoredEntity>(
    collection: string,
    id: string,
    data: Partial<Omit<T, 'id'>>
  ): Promise<T> {
    const col = this.getCollection(collection);
    const item = col.get(id);
    if (!item) {
      throw new Error(`Item ${id} not found in collection ${collection}`);
    }

    const updated = {
      ...item,
      ...data,
      updatedAt: new Date().toISOString(),
    } as unknown as T;

    col.set(id, updated);
    return structuredClone(updated) as T;
  }

  async delete(collection: string, id: string): Promise<void> {
    const col = this.getCollection(collection);
    col.delete(id);
  }

  async query<T extends StoredEntity>(
    collection: string,
    options?: QueryOptions
  ): Promise<T[]> {
    const col = this.getCollection(collection);
    let items = Array.from(col.values()) as unknown as T[];

    if (options?.filters) {
      items = items.filter((item) => {
        return Object.entries(options.filters!).every(([key, val]) => {
          return (item as Record<string, unknown>)[key] === val;
        });
      });
    }

    if (options?.orderBy) {
      const order = options.orderDirection === 'desc' ? -1 : 1;
      items.sort((a, b) => {
        const aVal = String((a as Record<string, unknown>)[options.orderBy!] ?? '');
        const bVal = String((b as Record<string, unknown>)[options.orderBy!] ?? '');
        if (aVal < bVal) return -1 * order;
        if (aVal > bVal) return 1 * order;
        if (options.orderBy === 'date') {
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

    if (options?.limit) {
      items = items.slice(0, options.limit);
    }

    return items.map((i) => structuredClone(i));
  }

  async export(): Promise<ExportData> {
    const txs = await this.query<Transaction>('transactions');
    const accts = await this.query<Account>('accounts');
    const cats = await this.query<Category>('categories');
    const settingsList = await this.query<StoredEntity>('settings');
    const pluginData = await this.query<StoredEntity>('plugin_data');
    const pluginSettings = await this.query<StoredEntity>('plugin_settings');

    const settingsMap: Record<string, unknown> = {};
    for (const s of settingsList) {
      if (s.id) settingsMap[s.id] = s;
    }

    const pluginSettingsMap: Record<string, unknown> = {};
    for (const s of pluginSettings) {
      if (s.id) pluginSettingsMap[s.id] = s;
    }

    return {
      version: '4.0.0',
      exportedAt: new Date().toISOString(),
      transactions: txs,
      accounts: accts,
      categories: cats,
      settings: settingsMap,
      plugins: {
        data: pluginData,
        settings: pluginSettingsMap,
      },
    };
  }

  async import(data: ExportData): Promise<void> {
    const txCol = this.getCollection('transactions');
    const acctCol = this.getCollection('accounts');
    const catCol = this.getCollection('categories');
    const setCol = this.getCollection('settings');
    const pDataCol = this.getCollection('plugin_data');
    const pSetCol = this.getCollection('plugin_settings');

    txCol.clear();
    acctCol.clear();
    catCol.clear();
    setCol.clear();
    pDataCol.clear();
    pSetCol.clear();

    for (const t of data.transactions) txCol.set(t.id, t);
    for (const a of data.accounts) acctCol.set(a.id, a);
    for (const c of data.categories) catCol.set(c.id, c);

    if (data.settings) {
      const now = new Date().toISOString();
      for (const [k, v] of Object.entries(data.settings)) {
        setCol.set(k, { id: k, createdAt: now, updatedAt: now, ...(typeof v === 'object' && v !== null ? v : {}) });
      }
    }

    if (data.plugins?.data) {
      for (const d of (data.plugins.data as StoredEntity[])) pDataCol.set(d.id, d);
    }
    if (data.plugins?.settings) {
      const now = new Date().toISOString();
      for (const [k, v] of Object.entries(data.plugins.settings)) {
        pSetCol.set(k, { id: k, createdAt: now, updatedAt: now, ...(typeof v === 'object' && v !== null ? v : {}) });
      }
    }
  }

  async clearAll(): Promise<void> {
    this.collections.clear();
  }
}
