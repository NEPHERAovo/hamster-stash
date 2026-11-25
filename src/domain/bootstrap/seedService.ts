import { isSandboxModeActive } from '../../core/db/schema';
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  getSandboxSeedData,
} from '../../core/db/defaultData';
import { AccountRepository } from '../../core/repositories/AccountRepository';
import { CategoryRepository } from '../../core/repositories/CategoryRepository';
import { TransactionRepository } from '../../core/repositories/TransactionRepository';
import type { AdapterResolver, StoredEntity } from '../../types/adapter';
import type { Category } from '../../types/category';

const DEFAULT_SEED_TIMESTAMP = '1970-01-01T00:00:00.000Z';

export class SeedService {
  private catRepo: CategoryRepository;
  private acctRepo: AccountRepository;
  private txRepo: TransactionRepository;

  constructor(adapterResolver: AdapterResolver) {
    this.catRepo = new CategoryRepository(adapterResolver);
    this.acctRepo = new AccountRepository(adapterResolver);
    this.txRepo = new TransactionRepository(adapterResolver);
  }

  async ensureSeeded(): Promise<void> {
    const now = new Date().toISOString();
    const [existingCats, existingAccts, existingTxs] = await Promise.all([
      this.catRepo.findAllRaw(),
      this.acctRepo.findAllRaw(),
      isSandboxModeActive() ? this.txRepo.findAllRaw() : Promise.resolve([]),
    ]);

    await this.seedCategories(existingCats, now);
    await this.seedAccounts(existingAccts.length);

    if (isSandboxModeActive() && existingTxs.length === 0) {
      await this.seedSandboxData(
        new Set(existingAccts.map((a) => a.id)),
        now
      );
    }
  }

  private async seedCategories(
    existingCategories: Array<Category & Partial<StoredEntity>>,
    now: string
  ): Promise<void> {
    if (existingCategories.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await this.catRepo.create({
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
        await this.catRepo.create({
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
          await this.catRepo.update(existing.id, {
            name: cat.name,
            updatedAt: now,
          });
        }
      }
    }
  }

  private async seedAccounts(existingCount: number): Promise<void> {
    if (existingCount > 0) return;
    for (const acct of DEFAULT_ACCOUNTS) {
      await this.acctRepo.create({
        ...acct,
        createdAt: DEFAULT_SEED_TIMESTAMP,
        updatedAt: DEFAULT_SEED_TIMESTAMP,
      });
    }
  }

  private async seedSandboxData(existingAcctIds: Set<string>, now: string): Promise<void> {
    const { sampleAccounts, sampleTransactions } = getSandboxSeedData(now);

    for (const acct of sampleAccounts) {
      if (existingAcctIds.has(acct.id)) {
        const activeAcct = await this.acctRepo.findById(acct.id);
        if (activeAcct) {
          await this.acctRepo.update(acct.id, acct);
        }
      } else {
        await this.acctRepo.create(acct);
      }
    }

    for (const tx of sampleTransactions) {
      await this.txRepo.create(tx);
    }
  }
}
