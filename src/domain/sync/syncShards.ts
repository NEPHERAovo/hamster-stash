import type { Account } from '../../types/account';
import type { ExportData, StoredEntity } from '../../types/adapter';
import type { Category } from '../../types/category';
import type { Transaction } from '../../types/transaction';
import { hashString16 } from '../../utils/hash';
import { canonicalizeValue } from './diffMerger';

export const SYNC_MANIFEST_VERSION = 2;
export const SYNC_MANIFEST_FILE = 'manifest.json';
export const SYNC_SETTINGS_FILE = 'settings.json';
export const SYNC_META_FILE = 'meta.json';

export interface SyncManifest {
  version: typeof SYNC_MANIFEST_VERSION;
  updatedAt: string;
  files: Record<string, string>;
}

export interface SettingsShard {
  settings: Record<string, unknown>;
  pluginSettings: Record<string, unknown>;
}

export interface MetaShard {
  accounts: Account[];
  categories: Category[];
  pluginData: StoredEntity[];
}

export interface SerializedSyncShards {
  shards: Map<string, string>;
  hashes: Record<string, string>;
}

export function getTransactionShardPath(tx: Pick<Transaction, 'date'>): string {
  if (tx.date && /^\d{4}/.test(tx.date)) {
    return `transactions/${tx.date.slice(0, 4)}.json`;
  }
  return 'transactions/unknown.json';
}

export function isValidSyncManifest(value: unknown): value is SyncManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (obj.version !== SYNC_MANIFEST_VERSION) return false;
  if (!obj.files || typeof obj.files !== 'object' || Array.isArray(obj.files)) return false;
  for (const val of Object.values(obj.files as Record<string, unknown>)) {
    if (typeof val !== 'string' || !val) return false;
  }
  return true;
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function stringifyCanonical(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value));
}

function groupTransactionsByShard(transactions: Transaction[]): Map<string, Transaction[]> {
  const grouped = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const path = getTransactionShardPath(tx);
    const list = grouped.get(path);
    if (list) {
      list.push(tx);
    } else {
      grouped.set(path, [tx]);
    }
  }
  for (const [path, list] of grouped.entries()) {
    grouped.set(path, sortById(list));
  }
  return grouped;
}

export function serializeExportDataToShards(data: ExportData): SerializedSyncShards {
  const shards = new Map<string, string>();
  const hashes: Record<string, string> = {};

  const putShard = (path: string, payload: unknown) => {
    const serialized = stringifyCanonical(payload);
    shards.set(path, serialized);
    hashes[path] = hashString16(serialized);
  };

  const settingsShard: SettingsShard = {
    settings: data.settings || {},
    pluginSettings: data.plugins?.settings || {},
  };
  putShard(SYNC_SETTINGS_FILE, settingsShard);

  const metaShard: MetaShard = {
    accounts: sortById(data.accounts || []),
    categories: sortById(data.categories || []),
    pluginData: sortById((data.plugins?.data as StoredEntity[]) || []),
  };
  putShard(SYNC_META_FILE, metaShard);

  const txGroups = groupTransactionsByShard(data.transactions || []);
  const sortedPaths = Array.from(txGroups.keys()).sort();
  for (const path of sortedPaths) {
    const list = txGroups.get(path);
    if (list && list.length > 0) {
      putShard(path, list);
    }
  }

  return { shards, hashes };
}

export function extractCachedShardsFromExport(data: ExportData): Map<string, unknown> {
  const cache = new Map<string, unknown>();

  const settingsShard: SettingsShard = {
    settings: data.settings || {},
    pluginSettings: data.plugins?.settings || {},
  };
  cache.set(SYNC_SETTINGS_FILE, settingsShard);

  const metaShard: MetaShard = {
    accounts: sortById(data.accounts || []),
    categories: sortById(data.categories || []),
    pluginData: sortById((data.plugins?.data as StoredEntity[]) || []),
  };
  cache.set(SYNC_META_FILE, metaShard);

  const txGroups = groupTransactionsByShard(data.transactions || []);
  for (const [path, list] of txGroups.entries()) {
    cache.set(path, list);
  }

  return cache;
}

export function assembleExportDataFromShards(
  settingsShard: Partial<SettingsShard> | undefined,
  metaShard: Partial<MetaShard> | undefined,
  txShards: Transaction[][]
): ExportData {
  return {
    version: '4.0.0',
    exportedAt: new Date().toISOString(),
    transactions: txShards.flat(),
    accounts: Array.isArray(metaShard?.accounts) ? metaShard.accounts : [],
    categories: Array.isArray(metaShard?.categories) ? metaShard.categories : [],
    settings: settingsShard?.settings || {},
    plugins: {
      data: Array.isArray(metaShard?.pluginData) ? metaShard.pluginData : [],
      settings: settingsShard?.pluginSettings || {},
    },
  };
}
