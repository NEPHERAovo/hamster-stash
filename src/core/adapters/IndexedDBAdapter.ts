import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { DB_VERSION, STORES, getActiveDbName } from '../db/schema';
import type { DataAdapter, StoredEntity } from '../../types/adapter';

type ReadWriteTx = IDBPTransaction<unknown, string[], 'readwrite'>;

export class IndexedDBAdapter implements DataAdapter {
  readonly id = 'indexeddb';
  private db: IDBPDatabase | null = null;
  private dbName: string;
  private initPromise: Promise<void> | null = null;
  private txQueue: Promise<void> = Promise.resolve();
  private activeTx: ReadWriteTx | null = null;
  private activeTxStores = new Set<string>();

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

  private getActiveObjectStore(store: string) {
    if (!this.activeTx) return null;
    if (!this.activeTxStores.has(store)) {
      throw new Error(`Store ${store} is not included in active transaction.`);
    }
    return this.activeTx.objectStore(store);
  }

  async get<T extends StoredEntity>(store: string, id: string): Promise<T | null> {
    const activeStore = this.getActiveObjectStore(store);
    if (activeStore) {
      const item = await activeStore.get(id);
      return (item as T) ?? null;
    }
    const db = this.getDB();
    const item = await db.get(store, id);
    return (item as T) ?? null;
  }

  async getAll<T extends StoredEntity>(store: string): Promise<T[]> {
    const activeStore = this.getActiveObjectStore(store);
    if (activeStore) {
      return (await activeStore.getAll()) as T[];
    }
    const db = this.getDB();
    return (await db.getAll(store)) as T[];
  }

  async put<T extends StoredEntity>(store: string, entity: T): Promise<void> {
    const activeStore = this.getActiveObjectStore(store);
    if (activeStore) {
      await activeStore.put(entity);
      return;
    }
    const db = this.getDB();
    await db.put(store, entity);
  }

  async remove(store: string, id: string): Promise<void> {
    const activeStore = this.getActiveObjectStore(store);
    if (activeStore) {
      await activeStore.delete(id);
      return;
    }
    const db = this.getDB();
    await db.delete(store, id);
  }

  async clearStore(store: string): Promise<void> {
    const activeStore = this.getActiveObjectStore(store);
    if (activeStore) {
      await activeStore.clear();
      return;
    }
    const db = this.getDB();
    await db.clear(store);
  }

  async clearAll(): Promise<void> {
    const db = this.getDB();
    const storesToClear = Object.values(STORES);
    const tx = db.transaction(storesToClear, 'readwrite');
    for (const storeName of storesToClear) {
      await tx.objectStore(storeName).clear();
    }
    await tx.done;
  }

  async replaceAll(entries: Record<string, StoredEntity[]>): Promise<void> {
    const storeNames = Object.keys(entries);
    if (storeNames.length === 0) return;

    await this.runInTransaction(storeNames, async () => {
      for (const storeName of storeNames) {
        await this.clearStore(storeName);
        for (const item of entries[storeName]) {
          await this.put(storeName, item);
        }
      }
    });
  }

  async runInTransaction<T>(stores: string[], fn: () => Promise<T>): Promise<T> {
    if (this.activeTx) {
      throw new Error('Nested runInTransaction is not supported.');
    }

    const execute = async (): Promise<T> => {
      const db = this.getDB();
      const tx = db.transaction(stores, 'readwrite') as unknown as ReadWriteTx;
      this.activeTx = tx;
      this.activeTxStores = new Set(stores);
      try {
        const result = await fn();
        await tx.done;
        return result;
      } catch (err) {
        try {
          tx.abort();
        } catch {
          void 0;
        }
        throw err;
      } finally {
        this.activeTx = null;
        this.activeTxStores.clear();
      }
    };

    const nextRun = this.txQueue.then(execute, execute);
    this.txQueue = nextRun.then(
      () => undefined,
      () => undefined
    );
    return nextRun;
  }
}
