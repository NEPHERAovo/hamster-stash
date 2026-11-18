import type { ExportData, StoredEntity } from '../../types/adapter';
import type { Transaction } from '../../types/transaction';
import type { Account } from '../../types/account';
import type { Category } from '../../types/category';

export interface DiffStats {
  addedLocal: number;
  updatedLocal: number;
  deletedLocal: number;
  addedRemote: number;
  updatedRemote: number;
  deletedRemote: number;
}

export interface DiffMergeResult {
  merged: ExportData;
  stats: DiffStats;
  changedLocal: boolean;
  changedRemote: boolean;
}

function mergeCollection<T extends StoredEntity>(
  localList: T[],
  remoteList: T[]
): {
  merged: T[];
  addedLocal: number;
  updatedLocal: number;
  deletedLocal: number;
  addedRemote: number;
  updatedRemote: number;
  deletedRemote: number;
  changedLocal: boolean;
  changedRemote: boolean;
} {
  const localMap = new Map<string, T>(localList.map((item) => [item.id, item]));
  const remoteMap = new Map<string, T>(remoteList.map((item) => [item.id, item]));
  const allIds = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);

  const merged: T[] = [];
  let addedLocal = 0;
  let updatedLocal = 0;
  let deletedLocal = 0;
  let addedRemote = 0;
  let updatedRemote = 0;
  let deletedRemote = 0;
  let changedLocal = false;
  let changedRemote = false;

  for (const id of allIds) {
    const loc = localMap.get(id);
    const rem = remoteMap.get(id);

    if (loc && !rem) {
      if (loc.deletedAt) {
        changedRemote = true;
      } else {
        merged.push(loc);
        addedRemote++;
        changedRemote = true;
      }
    } else if (!loc && rem) {
      if (rem.deletedAt) {
        changedLocal = true;
      } else {
        merged.push(rem);
        addedLocal++;
        changedLocal = true;
      }
    } else if (loc && rem) {
      const locTime = new Date(loc.updatedAt || loc.createdAt || 0).getTime();
      const remTime = new Date(rem.updatedAt || rem.createdAt || 0).getTime();

      if (remTime > locTime) {
        if (rem.deletedAt) {
          deletedLocal++;
          changedLocal = true;
        } else {
          merged.push(rem);
          updatedLocal++;
          changedLocal = true;
        }
      } else if (locTime > remTime) {
        if (loc.deletedAt) {
          deletedRemote++;
          changedRemote = true;
        } else {
          merged.push(loc);
          updatedRemote++;
          changedRemote = true;
        }
      } else {
        if (!loc.deletedAt && !rem.deletedAt) {
          merged.push(loc);
        }
      }
    }
  }

  return {
    merged,
    addedLocal,
    updatedLocal,
    deletedLocal,
    addedRemote,
    updatedRemote,
    deletedRemote,
    changedLocal,
    changedRemote,
  };
}

export function mergeSyncPayloads(local: ExportData, remote: ExportData): DiffMergeResult {
  const txRes = mergeCollection<Transaction>(local.transactions || [], remote.transactions || []);
  const acctRes = mergeCollection<Account>(local.accounts || [], remote.accounts || []);
  const catRes = mergeCollection<Category>(local.categories || [], remote.categories || []);

  const mergedSettings: Record<string, unknown> = {
    ...(remote.settings || {}),
    ...(local.settings || {}),
  };

  const localPluginData = (local.plugins?.data as StoredEntity[]) || [];
  const remotePluginData = (remote.plugins?.data as StoredEntity[]) || [];
  const pluginDataRes = mergeCollection<StoredEntity>(localPluginData, remotePluginData);

  const mergedPluginSettings: Record<string, unknown> = {
    ...(remote.plugins?.settings || {}),
    ...(local.plugins?.settings || {}),
  };

  const stats: DiffStats = {
    addedLocal: txRes.addedLocal + acctRes.addedLocal + catRes.addedLocal,
    updatedLocal: txRes.updatedLocal + acctRes.updatedLocal + catRes.updatedLocal,
    deletedLocal: txRes.deletedLocal + acctRes.deletedLocal + catRes.deletedLocal,
    addedRemote: txRes.addedRemote + acctRes.addedRemote + catRes.addedRemote,
    updatedRemote: txRes.updatedRemote + acctRes.updatedRemote + catRes.updatedRemote,
    deletedRemote: txRes.deletedRemote + acctRes.deletedRemote + catRes.deletedRemote,
  };

  const changedLocal =
    txRes.changedLocal ||
    acctRes.changedLocal ||
    catRes.changedLocal ||
    pluginDataRes.changedLocal;

  const changedRemote =
    txRes.changedRemote ||
    acctRes.changedRemote ||
    catRes.changedRemote ||
    pluginDataRes.changedRemote;

  const merged: ExportData = {
    version: '4.0.0',
    exportedAt: new Date().toISOString(),
    transactions: txRes.merged,
    accounts: acctRes.merged,
    categories: catRes.merged,
    settings: mergedSettings,
    plugins: {
      data: pluginDataRes.merged,
      settings: mergedPluginSettings,
    },
  };

  return {
    merged,
    stats,
    changedLocal,
    changedRemote,
  };
}
