import { STORES } from '../../core/db/schema';
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

export class DataLifecycleService {
  private adapterResolver: AdapterResolver;

  constructor(adapterResolver: AdapterResolver) {
    this.adapterResolver = adapterResolver;
  }

  private get adapter(): DataAdapter {
    const resolved =
      typeof this.adapterResolver === 'function'
        ? this.adapterResolver()
        : this.adapterResolver;
    if (!resolved) {
      throw new Error('DataLifecycleService adapter is not configured.');
    }
    return resolved;
  }

  async exportData(options?: ExportOptions): Promise<ExportData> {
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
    const now = new Date().toISOString();

    const toSettingsEntities = (
      map: Record<string, unknown> | undefined
    ): StoredEntity[] => {
      if (!map) return [];
      return Object.entries(map).map(([k, v]) => {
        const obj = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
        return {
          createdAt: now,
          updatedAt: now,
          ...obj,
          id: k,
        } as StoredEntity;
      });
    };

    await this.adapter.replaceAll({
      [STORES.TRANSACTIONS]: (data.transactions || []) as StoredEntity[],
      [STORES.ACCOUNTS]: (data.accounts || []) as StoredEntity[],
      [STORES.CATEGORIES]: (data.categories || []) as StoredEntity[],
      [STORES.SETTINGS]: toSettingsEntities(data.settings),
      [STORES.PLUGIN_DATA]: ((data.plugins?.data as StoredEntity[]) || []),
      [STORES.PLUGIN_SETTINGS]: toSettingsEntities(data.plugins?.settings),
    });
  }
}
