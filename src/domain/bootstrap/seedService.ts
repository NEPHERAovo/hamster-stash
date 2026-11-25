import { isSandboxModeActive, STORES } from '../../core/db/schema';
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  getSandboxSeedData,
} from '../../core/db/defaultData';
import type { DataAdapter, StoredEntity } from '../../types/adapter';
import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import type { Transaction } from '../../types/transaction';

import type { AdapterResolver } from '../../core/plugin/PluginStorageManager';

const DEFAULT_SEED_TIMESTAMP = '1970-01-01T00:00:00.000Z';

export class SeedService {
  private adapterResolver: AdapterResolver;

  constructor(adapter: AdapterResolver) {
    this.adapterResolver = adapter;
  }

  private get adapter(): DataAdapter {
    return typeof this.adapterResolver === 'function'
      ? this.adapterResolver()
      : this.adapterResolver;
  }

  async ensureSeeded(): Promise<void> {
    const now = new Date().toISOString();
    const snapshot = await this.adapter.export({ includeTombstones: true });

    await this.seedCategories(snapshot.categories, now);
    await this.seedAccounts(snapshot.accounts);

    if (isSandboxModeActive() && snapshot.transactions.length === 0) {
      await this.seedSandboxData(snapshot.accounts, now);
    }
  }

  private async seedCategories(
    existingCategories: Array<Category & Partial<StoredEntity>>,
    now: string
  ): Promise<void> {
    if (existingCategories.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await this.adapter.create<Category>(STORES.CATEGORIES, {
          ...cat,
          createdAt: DEFAULT_SEED_TIMESTAMP,
          updatedAt: DEFAULT_SEED_TIMESTAMP,
        });
      }
      return;
    }

    const byId = new Map<string, Category & Partial<StoredEntity>>();
    for (const item of existingCategories) {
      byId.set(item.id, item);
    }

    for (const cat of DEFAULT_CATEGORIES) {
      const existing = byId.get(cat.id);
      if (!existing) {
        await this.adapter.create<Category>(STORES.CATEGORIES, {
          ...cat,
          isArchived: cat.isArchived ?? true,
          createdAt: DEFAULT_SEED_TIMESTAMP,
          updatedAt: DEFAULT_SEED_TIMESTAMP,
        });
      } else if (existing.isSystem && !existing.deletedAt) {
        const shouldUpdateName =
          Boolean(existing.name) &&
          typeof existing.name === 'string' &&
          existing.name !== cat.name &&
          existing.name.length > 2;
        if (shouldUpdateName) {
          await this.adapter.update<Category>(STORES.CATEGORIES, existing.id, {
            name: cat.name,
            updatedAt: now,
          });
        }
      }
    }
  }

  private async seedAccounts(existingAccounts: Account[]): Promise<void> {
    if (existingAccounts.length > 0) return;
    for (const acct of DEFAULT_ACCOUNTS) {
      await this.adapter.create<Account>(STORES.ACCOUNTS, {
        ...acct,
        createdAt: DEFAULT_SEED_TIMESTAMP,
        updatedAt: DEFAULT_SEED_TIMESTAMP,
      });
    }
  }

  private async seedSandboxData(existingAccounts: Account[], now: string): Promise<void> {
    const { sampleAccounts, sampleTransactions } = getSandboxSeedData(now);
    const existingAcctIds = new Set(existingAccounts.map((a) => a.id));

    for (const acct of sampleAccounts) {
      if (existingAcctIds.has(acct.id)) {
        const activeAcct = await this.adapter.read<Account>(STORES.ACCOUNTS, acct.id);
        if (activeAcct) {
          await this.adapter.update<Account>(STORES.ACCOUNTS, acct.id, acct);
        }
      } else {
        await this.adapter.create<Account>(STORES.ACCOUNTS, acct);
      }
    }

    for (const tx of sampleTransactions) {
      await this.adapter.create<Transaction>(STORES.TRANSACTIONS, tx);
    }
  }
}
