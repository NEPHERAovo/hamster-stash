import { STORES } from '../../core/db/schema';
import type { TransactionRepository } from '../../core/repositories/TransactionRepository';
import type { AccountRepository } from '../../core/repositories/AccountRepository';
import type { CategoryRepository } from '../../core/repositories/CategoryRepository';
import type { SeedService } from '../bootstrap/seedService';
import { exportTransactionsToCsv } from '../import-export/csvMapper';
import { areValuesCanonicallyEqual } from '../sync/diffMerger';
import { normalizeDataIds } from './idNormalizer';
import type {
  AdapterResolver,
  DataAdapter,
  ExportData,
  ExportOptions,
  StoredEntity,
} from '../../types/adapter';
import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import type { Transaction } from '../../types/transaction';

const SNAPSHOT_VERSION = '4.0.0';

function filterActive<T extends StoredEntity>(
  items: T[],
  includeTombstones?: boolean
): T[] {
  return includeTombstones ? items : items.filter((item) => !item.deletedAt);
}

function toSettingsEntities(
  map: Record<string, unknown> | undefined,
  now: string
): StoredEntity[] {
  if (!map) return [];
  return Object.entries(map).map(([k, v]) => {
    const obj =
      typeof v === 'object' && v !== null
        ? (v as Record<string, unknown>)
        : {};
    return {
      createdAt: now,
      updatedAt: now,
      ...obj,
      id: k,
    } as StoredEntity;
  });
}

export interface DataLifecycleDeps {
  adapterResolver?: AdapterResolver;
  ensureReady?: () => Promise<void>;
  txRepo?: TransactionRepository;
  acctRepo?: AccountRepository;
  catRepo?: CategoryRepository;
  seedService?: SeedService;
  onDataImported?: () => void;
  resetActivePlugins?: () => Promise<void>;
}

export class DataLifecycleService {
  private deps: DataLifecycleDeps;

  constructor(deps: AdapterResolver | DataLifecycleDeps = {}) {
    if (typeof deps === 'function' || ('id' in deps && 'getAll' in deps)) {
      this.deps = { adapterResolver: deps };
    } else {
      this.deps = deps;
    }
  }

  configure(deps: DataLifecycleDeps): void {
    this.deps = { ...this.deps, ...deps };
  }

  private get adapter(): DataAdapter {
    const resolved =
      typeof this.deps.adapterResolver === 'function'
        ? this.deps.adapterResolver()
        : this.deps.adapterResolver;
    if (!resolved) {
      throw new Error('DataLifecycleService adapter is not configured.');
    }
    return resolved;
  }

  async exportData(options?: ExportOptions): Promise<ExportData> {
    if (this.deps.ensureReady) {
      await this.deps.ensureReady();
    }
    const [
      rawTxs,
      rawAccts,
      rawCats,
      settingsList,
      rawPluginData,
      pluginSettingsList,
    ] = await Promise.all([
      this.adapter.getAll<Transaction>(STORES.TRANSACTIONS),
      this.adapter.getAll<Account>(STORES.ACCOUNTS),
      this.adapter.getAll<Category>(STORES.CATEGORIES),
      this.adapter.getAll<StoredEntity>(STORES.SETTINGS),
      this.adapter.getAll<StoredEntity>(STORES.PLUGIN_DATA),
      this.adapter.getAll<StoredEntity>(STORES.PLUGIN_SETTINGS),
    ]);

    const includeTombstones = options?.includeTombstones;
    const transactions = filterActive(rawTxs, includeTombstones);
    const accounts = filterActive(rawAccts, includeTombstones);
    const categories = filterActive(rawCats, includeTombstones);
    const pluginData = filterActive(rawPluginData, includeTombstones);

    const settings: Record<string, unknown> = {};
    for (const s of settingsList) {
      if (s.id && !s.deletedAt) settings[s.id] = s;
    }

    const pluginSettings: Record<string, unknown> = {};
    for (const s of pluginSettingsList) {
      if (s.id && !s.deletedAt) pluginSettings[s.id] = s;
    }

    return {
      version: SNAPSHOT_VERSION,
      exportedAt: new Date().toISOString(),
      transactions,
      accounts,
      categories,
      settings,
      plugins: {
        data: pluginData,
        settings: pluginSettings,
      },
    };
  }

  async restoreData(data: ExportData): Promise<void> {
    if (this.deps.ensureReady) {
      await this.deps.ensureReady();
    }
    const now = new Date().toISOString();

    await this.adapter.replaceAll({
      [STORES.TRANSACTIONS]: (data.transactions || []) as StoredEntity[],
      [STORES.ACCOUNTS]: (data.accounts || []) as StoredEntity[],
      [STORES.CATEGORIES]: (data.categories || []) as StoredEntity[],
      [STORES.SETTINGS]: toSettingsEntities(data.settings, now),
      [STORES.PLUGIN_DATA]: (data.plugins?.data as StoredEntity[]) || [],
      [STORES.PLUGIN_SETTINGS]: toSettingsEntities(data.plugins?.settings, now),
    });
  }

  private async reconcileEntityStore(
    storeName: string,
    targetList: StoredEntity[],
    ignoredIds?: Set<string>
  ): Promise<{ writtenCount: number; removedCount: number }> {
    const currentList = await this.adapter.getAll<StoredEntity>(storeName);
    const currentMap = new Map(currentList.map((item) => [item.id, item]));
    const targetIds = new Set<string>();
    let writtenCount = 0;
    let removedCount = 0;

    for (const target of targetList) {
      if (ignoredIds?.has(target.id)) continue;
      targetIds.add(target.id);
      const existing = currentMap.get(target.id);
      if (!existing || !areValuesCanonicallyEqual(existing, target)) {
        await this.adapter.put(storeName, target);
        writtenCount++;
      }
    }

    for (const existingId of currentMap.keys()) {
      if (ignoredIds?.has(existingId)) continue;
      if (!targetIds.has(existingId)) {
        await this.adapter.remove(storeName, existingId);
        removedCount++;
      }
    }

    return { writtenCount, removedCount };
  }

  async normalizeStoredIdsIfNeeded(): Promise<boolean> {
    const [transactions, accounts, categories, pluginData] = await Promise.all([
      this.adapter.getAll<Transaction>(STORES.TRANSACTIONS),
      this.adapter.getAll<Account>(STORES.ACCOUNTS),
      this.adapter.getAll<Category>(STORES.CATEGORIES),
      this.adapter.getAll<StoredEntity>(STORES.PLUGIN_DATA),
    ]);

    const { data: normalized, changed } = normalizeDataIds({
      version: SNAPSHOT_VERSION,
      exportedAt: '',
      transactions,
      accounts,
      categories,
      settings: {},
      plugins: {
        data: pluginData,
        settings: {},
      },
    });

    if (!changed) return false;

    const targetStores = [
      STORES.TRANSACTIONS,
      STORES.ACCOUNTS,
      STORES.CATEGORIES,
      STORES.PLUGIN_DATA,
      STORES.SETTINGS,
    ];

    await this.adapter.runInTransaction(targetStores, async () => {
      await this.reconcileEntityStore(
        STORES.TRANSACTIONS,
        normalized.transactions as StoredEntity[]
      );
      await this.reconcileEntityStore(
        STORES.ACCOUNTS,
        normalized.accounts as StoredEntity[]
      );
      await this.reconcileEntityStore(
        STORES.CATEGORIES,
        normalized.categories as StoredEntity[]
      );
      await this.reconcileEntityStore(
        STORES.PLUGIN_DATA,
        (normalized.plugins?.data as StoredEntity[]) || []
      );
      await this.adapter.remove(STORES.SETTINGS, 'webdav_sync_base');
    });

    return true;
  }

  async applySyncChanges(
    data: ExportData,
    options?: { preserveSettingKeys?: Set<string> }
  ): Promise<{ writtenCount: number; removedCount: number }> {
    if (this.deps.ensureReady) {
      await this.deps.ensureReady();
    }
    const now = new Date().toISOString();
    const preserveSettingKeys = options?.preserveSettingKeys;
    const syncStores = [
      STORES.TRANSACTIONS,
      STORES.ACCOUNTS,
      STORES.CATEGORIES,
      STORES.SETTINGS,
      STORES.PLUGIN_DATA,
      STORES.PLUGIN_SETTINGS,
    ];

    let writtenCount = 0;
    let removedCount = 0;

    await this.adapter.runInTransaction(syncStores, async () => {
      const results = [
        await this.reconcileEntityStore(
          STORES.TRANSACTIONS,
          (data.transactions || []) as StoredEntity[]
        ),
        await this.reconcileEntityStore(
          STORES.ACCOUNTS,
          (data.accounts || []) as StoredEntity[]
        ),
        await this.reconcileEntityStore(
          STORES.CATEGORIES,
          (data.categories || []) as StoredEntity[]
        ),
        await this.reconcileEntityStore(
          STORES.SETTINGS,
          toSettingsEntities(data.settings, now),
          preserveSettingKeys
        ),
        await this.reconcileEntityStore(
          STORES.PLUGIN_DATA,
          (data.plugins?.data as StoredEntity[]) || []
        ),
        await this.reconcileEntityStore(
          STORES.PLUGIN_SETTINGS,
          toSettingsEntities(data.plugins?.settings, now)
        ),
      ];
      for (const r of results) {
        writtenCount += r.writtenCount;
        removedCount += r.removedCount;
      }
    });

    return { writtenCount, removedCount };
  }

  async restoreBackup(data: ExportData): Promise<void> {
    if (!Array.isArray(data.transactions) || !Array.isArray(data.accounts)) {
      throw new Error('无效的备份文件结构');
    }
    const { data: normalized } = normalizeDataIds(data);
    await this.restoreData(normalized);
    this.deps.onDataImported?.();
  }

  async exportCsvRange(params: {
    start: string | null;
    end: string | null;
  }): Promise<{ csvContent: string; exportedCount: number }> {
    if (this.deps.ensureReady) {
      await this.deps.ensureReady();
    }
    if (!this.deps.txRepo || !this.deps.catRepo || !this.deps.acctRepo) {
      throw new Error('DataLifecycleService repositories are not configured.');
    }

    const [txs, cats, accts] = await Promise.all([
      this.deps.txRepo.findAll({ orderBy: 'date', orderDirection: 'desc' }),
      this.deps.catRepo.findAll(),
      this.deps.acctRepo.findAll(),
    ]);

    const { start, end } = params;
    const filtered = txs.filter((t) => {
      if (start && t.date < start) return false;
      if (end && t.date > end) return false;
      return true;
    });

    return {
      csvContent: exportTransactionsToCsv(filtered, cats, accts),
      exportedCount: filtered.length,
    };
  }

  async clearAllData(): Promise<void> {
    if (this.deps.ensureReady) {
      await this.deps.ensureReady();
    }
    await this.adapter.clearAll();
    if (this.deps.seedService) {
      await this.deps.seedService.ensureSeeded();
    }
    if (this.deps.resetActivePlugins) {
      await this.deps.resetActivePlugins();
    }
  }
}

export const dataLifecycleService = new DataLifecycleService();
