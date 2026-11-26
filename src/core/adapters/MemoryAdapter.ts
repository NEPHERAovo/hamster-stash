import type { DataAdapter, StoredEntity } from '../../types/adapter';

export class MemoryAdapter implements DataAdapter {
  readonly id = 'memory';
  private collections = new Map<string, Map<string, StoredEntity>>();
  private txQueue: Promise<void> = Promise.resolve();
  private inTransaction = false;
  private activeTxStores = new Set<string>();

  async initialize(): Promise<void> {}

  async destroy(): Promise<void> {
    this.collections.clear();
  }

  private assertStoreInTransaction(store: string): void {
    if (this.inTransaction && !this.activeTxStores.has(store)) {
      throw new Error(`Store ${store} is not included in active transaction.`);
    }
  }

  private getCollection(name: string): Map<string, StoredEntity> {
    let col = this.collections.get(name);
    if (!col) {
      col = new Map();
      this.collections.set(name, col);
    }
    return col;
  }

  async get<T extends StoredEntity>(store: string, id: string): Promise<T | null> {
    this.assertStoreInTransaction(store);
    const item = this.getCollection(store).get(id);
    if (!item) return null;
    return structuredClone(item) as T;
  }

  async getAll<T extends StoredEntity>(store: string): Promise<T[]> {
    this.assertStoreInTransaction(store);
    return Array.from(this.getCollection(store).values()).map(
      (item) => structuredClone(item) as T
    );
  }

  async put<T extends StoredEntity>(store: string, entity: T): Promise<void> {
    this.assertStoreInTransaction(store);
    this.getCollection(store).set(entity.id, structuredClone(entity));
  }

  async remove(store: string, id: string): Promise<void> {
    this.assertStoreInTransaction(store);
    this.getCollection(store).delete(id);
  }

  async clearStore(store: string): Promise<void> {
    this.assertStoreInTransaction(store);
    this.collections.get(store)?.clear();
  }

  async clearAll(): Promise<void> {
    this.collections.clear();
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
    if (this.inTransaction) {
      throw new Error('Nested runInTransaction is not supported.');
    }

    const execute = async (): Promise<T> => {
      this.inTransaction = true;
      this.activeTxStores = new Set(stores);
      const backups = new Map<string, Map<string, StoredEntity>>();
      for (const store of stores) {
        const existing = this.collections.get(store);
        if (existing) {
          const cloneMap = new Map<string, StoredEntity>();
          for (const [k, v] of existing.entries()) {
            cloneMap.set(k, structuredClone(v));
          }
          backups.set(store, cloneMap);
        }
      }

      try {
        return await fn();
      } catch (err) {
        for (const store of stores) {
          const backup = backups.get(store);
          if (backup) {
            this.collections.set(store, backup);
          } else {
            this.collections.delete(store);
          }
        }
        throw err;
      } finally {
        this.inTransaction = false;
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
