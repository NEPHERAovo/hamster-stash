import { openDB, type IDBPDatabase } from 'idb';
import { DB_VERSION, STORES, getActiveDbName } from '../db/schema';
import type {
  DataAdapter,
  ExportData,
  ExportOptions,
  QueryOptions,
  StoredEntity,
} from '../../types/adapter';
import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import type { Transaction } from '../../types/transaction';

const TOMBSTONE_COLLECTIONS = new Set<string>([
  STORES.TRANSACTIONS,
  STORES.ACCOUNTS,
  STORES.CATEGORIES,
  STORES.PLUGIN_DATA,
]);

export class IndexedDBAdapter implements DataAdapter {
  readonly id = 'indexeddb';
  private db: IDBPDatabase | null = null;
  private dbName: string;
  private initPromise: Promise<void> | null = null;

  constructor(dbName?: string) {
    this.dbName = dbName || getActiveDbName();
  }

  async initialize(): Promise<void> {
    if (this.db) return;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          const createDb = (name: string) =>
            openDB(name, DB_VERSION, {
              upgrade(db) {
                if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
                  const txStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
                  txStore.createIndex('by_date', 'date');
                  txStore.createIndex('by_account', 'accountId');
                  txStore.createIndex('by_category', 'categoryId');
                  txStore.createIndex('by_offset', 'offsetTransactionId');
                }
                if (!db.objectStoreNames.contains(STORES.ACCOUNTS)) {
                  const acctStore = db.createObjectStore(STORES.ACCOUNTS, { keyPath: 'id' });
                  acctStore.createIndex('by_sortOrder', 'sortOrder');
                }
                if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
                  const catStore = db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
                  catStore.createIndex('by_type', 'type');
                  catStore.createIndex('by_sortOrder', 'sortOrder');
                }
                if (!db.objectStoreNames.contains(STORES.PLUGIN_DATA)) {
                  const pDataStore = db.createObjectStore(STORES.PLUGIN_DATA, { keyPath: 'id' });
                  pDataStore.createIndex('by_plugin', 'pluginId');
                  pDataStore.createIndex('by_plugin_collection', ['pluginId', 'collection']);
                }
                if (!db.objectStoreNames.contains(STORES.PLUGIN_SETTINGS)) {
                  db.createObjectStore(STORES.PLUGIN_SETTINGS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.ATTACHMENTS)) {
                  db.createObjectStore(STORES.ATTACHMENTS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                  db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
                }
              },
              blocking: () => {
                this.db?.close();
                this.db = null;
              },
            });

          try {
            this.db = await createDb(this.dbName);
          } catch (err) {
            const isVersionError = Boolean(
              err &&
                ((err as { name?: string }).name === 'VersionError' ||
                  String(err).includes('VersionError'))
            );
            if (isVersionError) {
              const { deleteDB } = await import('idb');
              try {
                await deleteDB(this.dbName);
              } catch {
                void 0;
              }
              this.db = await createDb(this.dbName);
            } else {
              throw err;
            }
          }

        } finally {
          this.initPromise = null;
        }
      })();
    }
    await this.initPromise;
  }

  async destroy(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private getDB(): IDBPDatabase {
    if (!this.db) throw new Error('IndexedDBAdapter is not initialized. Call initialize() first.');
    return this.db;
  }

  async create<T extends StoredEntity>(
    collection: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  ): Promise<T> {
    const db = this.getDB();
    const now = new Date().toISOString();
    const createdAt = data.createdAt || now;
    const updatedAt = data.updatedAt || now;
    const id = data.id || `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const entity = {
      ...data,
      id,
      createdAt,
      updatedAt,
    } as unknown as T;
    delete (entity as StoredEntity).deletedAt;

    await db.put(collection, entity);
    return entity;
  }

  async read<T extends StoredEntity>(collection: string, id: string): Promise<T | null> {
    const db = this.getDB();
    const item = await db.get(collection, id);
    if (!item || (item as StoredEntity).deletedAt) return null;
    return item as T;
  }

  async update<T extends StoredEntity>(
    collection: string,
    id: string,
    data: Partial<Omit<T, 'id'>>
  ): Promise<T> {
    const db = this.getDB();
    const item = await db.get(collection, id);
    if (!item || (item as StoredEntity).deletedAt) {
      throw new Error(`Item ${id} not found in store ${collection}`);
    }

    const updated = {
      ...item,
      ...data,
      updatedAt: new Date().toISOString(),
    } as unknown as T;

    await db.put(collection, updated);
    return updated;
  }

  async delete(collection: string, id: string): Promise<void> {
    const db = this.getDB();
    if (!TOMBSTONE_COLLECTIONS.has(collection)) {
      await db.delete(collection, id);
      return;
    }
    const existing = (await db.get(collection, id)) as StoredEntity | undefined;
    if (!existing || existing.deletedAt) return;
    const now = new Date().toISOString();
    await db.put(collection, {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    });
  }

  async query<T extends StoredEntity>(
    collection: string,
    options?: QueryOptions
  ): Promise<T[]> {
    const db = this.getDB();
    let items = ((await db.getAll(collection)) as T[]).filter((item) => !item.deletedAt);

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

    return items;
  }

  async export(options?: ExportOptions): Promise<ExportData> {
    const db = this.getDB();
    const readCollection = async <T extends StoredEntity>(store: string): Promise<T[]> => {
      const all = (await db.getAll(store)) as T[];
      return options?.includeTombstones ? all : all.filter((item) => !item.deletedAt);
    };

    const txs = await readCollection<Transaction>(STORES.TRANSACTIONS);
    const accts = await readCollection<Account>(STORES.ACCOUNTS);
    const cats = await readCollection<Category>(STORES.CATEGORIES);
    const settingsList = await this.query<StoredEntity>(STORES.SETTINGS);
    const pluginData = await readCollection<StoredEntity>(STORES.PLUGIN_DATA);
    const pluginSettings = await this.query<StoredEntity>(STORES.PLUGIN_SETTINGS);

    const settingsMap: Record<string, unknown> = {};
    for (const s of settingsList) {
      if (s.id) settingsMap[s.id] = s;
    }

    const pluginSettingsMap: Record<string, unknown> = {};
    for (const s of pluginSettings) {
      if (s.id) pluginSettingsMap[s.id] = s;
    }

    return {
      version: '1.0.0',
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
    const db = this.getDB();
    const storesToLock = [
      STORES.TRANSACTIONS,
      STORES.ACCOUNTS,
      STORES.CATEGORIES,
      STORES.SETTINGS,
      STORES.PLUGIN_DATA,
      STORES.PLUGIN_SETTINGS,
    ];
    const tx = db.transaction(storesToLock, 'readwrite');

    await tx.objectStore(STORES.TRANSACTIONS).clear();
    await tx.objectStore(STORES.ACCOUNTS).clear();
    await tx.objectStore(STORES.CATEGORIES).clear();
    await tx.objectStore(STORES.SETTINGS).clear();
    await tx.objectStore(STORES.PLUGIN_DATA).clear();
    await tx.objectStore(STORES.PLUGIN_SETTINGS).clear();

    for (const t of data.transactions) await tx.objectStore(STORES.TRANSACTIONS).put(t);
    for (const a of data.accounts) await tx.objectStore(STORES.ACCOUNTS).put(a);
    for (const c of data.categories) await tx.objectStore(STORES.CATEGORIES).put(c);

    if (data.settings) {
      for (const [k, v] of Object.entries(data.settings)) {
        await tx.objectStore(STORES.SETTINGS).put({ id: k, ...(typeof v === 'object' && v !== null ? v : {}) });
      }
    }

    if (data.plugins?.data) {
      for (const d of data.plugins.data) await tx.objectStore(STORES.PLUGIN_DATA).put(d);
    }
    if (data.plugins?.settings) {
      for (const [k, v] of Object.entries(data.plugins.settings)) {
        await tx.objectStore(STORES.PLUGIN_SETTINGS).put({ id: k, ...(typeof v === 'object' && v !== null ? v : {}) });
      }
    }

    await tx.done;
  }

  async clearAll(): Promise<void> {
    const db = this.getDB();
    const storesToClear = [
      STORES.TRANSACTIONS,
      STORES.ACCOUNTS,
      STORES.CATEGORIES,
      STORES.SETTINGS,
      STORES.PLUGIN_DATA,
      STORES.PLUGIN_SETTINGS,
      STORES.ATTACHMENTS,
    ];
    const tx = db.transaction(storesToClear, 'readwrite');
    for (const storeName of storesToClear) {
      await tx.objectStore(storeName).clear();
    }
    await tx.done;
  }
}
