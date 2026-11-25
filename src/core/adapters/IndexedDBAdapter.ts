import { openDB, type IDBPDatabase } from 'idb';
import { DB_VERSION, STORES, getActiveDbName, isSandboxModeActive } from '../db/schema';
import { DEFAULT_ACCOUNTS, DEFAULT_CATEGORIES, getSandboxSeedData } from '../db/defaultData';
import type {
  DataAdapter,
  ExportData,
  QueryOptions,
  StoredEntity,
} from '../../types/adapter';
import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import type { Transaction } from '../../types/transaction';

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

          await this.seedDefaultsIfEmpty();
        } finally {
          this.initPromise = null;
        }
      })();
    }
    await this.initPromise;
  }

  private async seedDefaultsIfEmpty(): Promise<void> {
    if (!this.db) return;

    const now = new Date().toISOString();
    const catCount = await this.db.count(STORES.CATEGORIES);
    if (catCount === 0) {
      const tx = this.db.transaction(STORES.CATEGORIES, 'readwrite');
      for (const cat of DEFAULT_CATEGORIES) {
        await tx.store.put({
          ...cat,
          createdAt: now,
          updatedAt: now,
        });
      }
      await tx.done;
    } else {
      const tx = this.db.transaction(STORES.CATEGORIES, 'readwrite');
      for (const cat of DEFAULT_CATEGORIES) {
        const existing = await tx.store.get(cat.id);
        if (!existing) {
          await tx.store.put({
            ...cat,
            isArchived: cat.isArchived ?? true,
            createdAt: now,
            updatedAt: now,
          });
        } else if (existing.isSystem) {
          const shouldUpdateName =
            existing.name &&
            typeof existing.name === 'string' &&
            existing.name !== cat.name &&
            existing.name.length > 2;
          if (shouldUpdateName) {
            await tx.store.put({
              ...existing,
              name: cat.name,
              updatedAt: now,
            });
          }
        }
      }
      await tx.done;
    }

    const acctCount = await this.db.count(STORES.ACCOUNTS);
    if (acctCount === 0) {
      const tx = this.db.transaction(STORES.ACCOUNTS, 'readwrite');
      for (const acct of DEFAULT_ACCOUNTS) {
        await tx.store.put({
          ...acct,
          createdAt: now,
          updatedAt: now,
        });
      }
      await tx.done;
    }

    if (isSandboxModeActive()) {
      const txCount = await this.db.count(STORES.TRANSACTIONS);
      if (txCount === 0) {
        const tx = this.db.transaction([STORES.ACCOUNTS, STORES.TRANSACTIONS], 'readwrite');
        const acctStore = tx.objectStore(STORES.ACCOUNTS);
        const txStore = tx.objectStore(STORES.TRANSACTIONS);

        const { sampleAccounts, sampleTransactions } = getSandboxSeedData(now);
        for (const acct of sampleAccounts) {
          await acctStore.put(acct);
        }
        for (const t of sampleTransactions) {
          await txStore.put(t);
        }

        await tx.done;
      }
    }
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
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string }
  ): Promise<T> {
    const db = this.getDB();
    const now = new Date().toISOString();
    const createdAt = data.createdAt || now;
    const id = data.id || `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const entity = {
      ...data,
      id,
      createdAt,
      updatedAt: now,
    } as unknown as T;

    await db.put(collection, entity);
    return entity;
  }

  async read<T extends StoredEntity>(collection: string, id: string): Promise<T | null> {
    const db = this.getDB();
    const item = await db.get(collection, id);
    return item ? (item as T) : null;
  }

  async update<T extends StoredEntity>(
    collection: string,
    id: string,
    data: Partial<Omit<T, 'id'>>
  ): Promise<T> {
    const db = this.getDB();
    const item = await db.get(collection, id);
    if (!item) {
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
    await db.delete(collection, id);
  }

  async query<T extends StoredEntity>(
    collection: string,
    options?: QueryOptions
  ): Promise<T[]> {
    const db = this.getDB();
    let items = (await db.getAll(collection)) as T[];

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

  async export(): Promise<ExportData> {
    const txs = await this.query<Transaction>(STORES.TRANSACTIONS);
    const accts = await this.query<Account>(STORES.ACCOUNTS);
    const cats = await this.query<Category>(STORES.CATEGORIES);
    const settingsList = await this.query<StoredEntity>(STORES.SETTINGS);
    const pluginData = await this.query<StoredEntity>(STORES.PLUGIN_DATA);
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
    await this.seedDefaultsIfEmpty();
  }
}
