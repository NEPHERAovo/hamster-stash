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

export type SyncEntityCollection =
  | 'transactions'
  | 'accounts'
  | 'categories'
  | 'plugin_data'
  | 'settings'
  | 'plugin_settings';

export type SyncChangeKind = 'add' | 'modify' | 'delete';
export type SyncResolutionChoice = 'local' | 'remote';
export type SyncConflictReason =
  | 'both_modified'
  | 'no_base_diverged'
  | 'remote_only'
  | 'local_only'
  | 'cross_id_duplicate';

export interface SyncDiffItem {
  key: string;
  collection: SyncEntityCollection;
  id: string;
  kind: SyncChangeKind;
  source: 'incoming' | 'conflict' | 'push';
  localEntity?: StoredEntity | Record<string, unknown>;
  remoteEntity?: StoredEntity | Record<string, unknown>;
  baseEntity?: StoredEntity | Record<string, unknown>;
  recommendedResolution: SyncResolutionChoice;
  reason: SyncConflictReason;
}

export interface SyncDiffPlan {
  isStrictlyEqual: boolean;
  requiresReview: boolean;
  incomingItems: SyncDiffItem[];
  conflictItems: SyncDiffItem[];
  pushItems: SyncDiffItem[];
  unchanged: {
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
    pluginData: StoredEntity[];
    settings: Record<string, unknown>;
    pluginSettings: Record<string, unknown>;
  };
  localSnapshot: ExportData;
  remoteSnapshot: ExportData;
  baseSnapshot: ExportData | null;
}

export const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_SEED_TIME_MS = Date.parse('1970-01-01T00:00:00.000Z');

export function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const val = record[key];
      if (val === undefined) continue;
      const cleanVal = canonicalizeValue(val);
      if (
        key === 'ext' &&
        typeof cleanVal === 'object' &&
        cleanVal !== null &&
        Object.keys(cleanVal as Record<string, unknown>).length === 0
      ) {
        continue;
      }
      normalized[key] = cleanVal;
    }
    return normalized;
  }
  return value;
}

export function areValuesCanonicallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  if (a === null || b === null) return false;
  return JSON.stringify(canonicalizeValue(a)) === JSON.stringify(canonicalizeValue(b));
}

function getEntityTimestampMs(entity: StoredEntity | Record<string, unknown> | undefined): number {
  if (!entity) return 0;
  const record = entity as { updatedAt?: string; createdAt?: string; deletedAt?: string };
  const raw = record.updatedAt || record.deletedAt || record.createdAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

function isExpiredTombstone(entity: StoredEntity | undefined, nowMs: number): boolean {
  if (!entity?.deletedAt) return false;
  const deletedMs = Date.parse(entity.deletedAt);
  if (Number.isNaN(deletedMs)) return false;
  return nowMs - deletedMs > TOMBSTONE_RETENTION_MS;
}

type SyncTx = Transaction & { deletedAt?: string };

function hasOwnedItemLink(tx: SyncTx | undefined): boolean {
  if (!tx?.ext) return false;
  const owned = tx.ext['owned-items'] as { itemId?: string } | undefined;
  return Boolean(owned?.itemId);
}

function isSameCorePurchase(a: SyncTx, b: SyncTx): boolean {
  return (
    a.type === b.type &&
    a.amount === b.amount &&
    a.date === b.date &&
    a.accountId === b.accountId &&
    a.categoryId === b.categoryId
  );
}

function findCrossIdDuplicateTwin(
  remoteTx: SyncTx,
  localTransactions: SyncTx[]
): SyncTx | undefined {
  if (remoteTx.deletedAt || remoteTx.offsetTransactionId || remoteTx.relatedLoanId) {
    return undefined;
  }
  return localTransactions.find((localTx) => {
    if (localTx.deletedAt || localTx.id === remoteTx.id) return false;
    if (!isSameCorePurchase(localTx, remoteTx)) return false;
    if ((localTx.note || '').trim() !== (remoteTx.note || '').trim()) return false;
    if (localTx.createdAt !== remoteTx.createdAt) return false;
    return hasOwnedItemLink(localTx) !== hasOwnedItemLink(remoteTx);
  });
}

function recommendTransactionResolution(loc: SyncTx, rem: SyncTx): SyncResolutionChoice {
  if (!loc.deletedAt && !rem.deletedAt && isSameCorePurchase(loc, rem)) {
    const locLinked = hasOwnedItemLink(loc);
    const remLinked = hasOwnedItemLink(rem);
    if (locLinked !== remLinked) {
      return locLinked ? 'local' : 'remote';
    }
  }
  return getEntityTimestampMs(loc) >= getEntityTimestampMs(rem) ? 'local' : 'remote';
}

function resolveChangeKind(
  loc: StoredEntity | undefined,
  rem: StoredEntity | undefined,
  perspective: 'incoming' | 'push' | 'conflict'
): SyncChangeKind {
  if (perspective === 'incoming') {
    if (rem?.deletedAt) return 'delete';
    if (!loc || loc.deletedAt) return 'add';
    return 'modify';
  }
  if (perspective === 'push') {
    if (loc?.deletedAt) return 'delete';
    if (!rem || rem.deletedAt) return 'add';
    return 'modify';
  }
  if (rem?.deletedAt || loc?.deletedAt) return 'delete';
  if (!loc && rem) return 'add';
  return 'modify';
}

function classifyEntityCollection<T extends StoredEntity>(params: {
  collection: 'transactions' | 'accounts' | 'categories' | 'plugin_data';
  localList: T[];
  remoteList: T[];
  baseList: T[] | null;
  nowMs: number;
}): {
  unchanged: T[];
  incoming: SyncDiffItem[];
  conflict: SyncDiffItem[];
  push: SyncDiffItem[];
} {
  const { collection, localList, remoteList, baseList, nowMs } = params;
  const localMap = new Map<string, T>(localList.map((item) => [item.id, item]));
  const remoteMap = new Map<string, T>(remoteList.map((item) => [item.id, item]));
  const baseMap = new Map<string, T>((baseList || []).map((item) => [item.id, item]));

  const allIds = new Set<string>([
    ...localMap.keys(),
    ...remoteMap.keys(),
    ...(baseList ? baseMap.keys() : []),
  ]);

  const unchanged: T[] = [];
  const incoming: SyncDiffItem[] = [];
  const conflict: SyncDiffItem[] = [];
  const push: SyncDiffItem[] = [];

  for (const id of allIds) {
    const loc = localMap.get(id);
    const rem = remoteMap.get(id);
    const bas = baseList ? baseMap.get(id) : undefined;
    const key = `${collection}:${id}`;

    if (areValuesCanonicallyEqual(loc, rem)) {
      if (loc && !isExpiredTombstone(loc, nowMs)) {
        unchanged.push(loc);
      }
      continue;
    }

    if (!loc && rem?.deletedAt) {
      if (!isExpiredTombstone(rem, nowMs)) {
        unchanged.push(rem);
      }
      continue;
    }

    if (loc?.deletedAt && !rem) {
      push.push({
        key,
        collection,
        id,
        kind: 'delete',
        source: 'push',
        localEntity: loc,
        remoteEntity: undefined,
        baseEntity: bas,
        recommendedResolution: 'local',
        reason: 'local_only',
      });
      continue;
    }

    if (collection === 'transactions' && !loc && rem) {
      const twin = findCrossIdDuplicateTwin(
        rem as unknown as SyncTx,
        localList as unknown as SyncTx[]
      );
      if (twin) {
        const rec: SyncResolutionChoice = hasOwnedItemLink(twin) ? 'local' : 'remote';
        conflict.push({
          key,
          collection,
          id,
          kind: 'add',
          source: 'conflict',
          localEntity: undefined,
          remoteEntity: rem,
          baseEntity: bas,
          recommendedResolution: rec,
          reason: 'cross_id_duplicate',
        });
        continue;
      }
    }

    if (baseList !== null) {
      const eqLB = areValuesCanonicallyEqual(loc, bas);
      const eqRB = areValuesCanonicallyEqual(rem, bas);

      if (eqLB && !eqRB) {
        incoming.push({
          key,
          collection,
          id,
          kind: resolveChangeKind(loc, rem, 'incoming'),
          source: 'incoming',
          localEntity: loc,
          remoteEntity: rem,
          baseEntity: bas,
          recommendedResolution: 'remote',
          reason: 'remote_only',
        });
      } else if (!eqLB && eqRB) {
        push.push({
          key,
          collection,
          id,
          kind: resolveChangeKind(loc, rem, 'push'),
          source: 'push',
          localEntity: loc,
          remoteEntity: rem,
          baseEntity: bas,
          recommendedResolution: 'local',
          reason: 'local_only',
        });
      } else {
        let recommended: SyncResolutionChoice =
          getEntityTimestampMs(loc) >= getEntityTimestampMs(rem) ? 'local' : 'remote';
        if (collection === 'transactions' && loc && rem) {
          recommended = recommendTransactionResolution(
            loc as unknown as Transaction,
            rem as unknown as Transaction
          );
        }
        conflict.push({
          key,
          collection,
          id,
          kind: resolveChangeKind(loc, rem, 'conflict'),
          source: 'conflict',
          localEntity: loc,
          remoteEntity: rem,
          baseEntity: bas,
          recommendedResolution: recommended,
          reason: 'both_modified',
        });
      }
      continue;
    }

    if (!loc && rem) {
      incoming.push({
        key,
        collection,
        id,
        kind: resolveChangeKind(loc, rem, 'incoming'),
        source: 'incoming',
        localEntity: undefined,
        remoteEntity: rem,
        recommendedResolution: 'remote',
        reason: 'remote_only',
      });
    } else if (loc && !rem) {
      push.push({
        key,
        collection,
        id,
        kind: resolveChangeKind(loc, rem, 'push'),
        source: 'push',
        localEntity: loc,
        remoteEntity: undefined,
        recommendedResolution: 'local',
        reason: 'local_only',
      });
    } else if (loc && rem) {
      const locTime = getEntityTimestampMs(loc);
      const remTime = getEntityTimestampMs(rem);
      const isFreshSeedUpgrade =
        (collection === 'accounts' || collection === 'categories') &&
        locTime === DEFAULT_SEED_TIME_MS &&
        remTime > DEFAULT_SEED_TIME_MS;

      if (isFreshSeedUpgrade) {
        incoming.push({
          key,
          collection,
          id,
          kind: resolveChangeKind(loc, rem, 'incoming'),
          source: 'incoming',
          localEntity: loc,
          remoteEntity: rem,
          recommendedResolution: 'remote',
          reason: 'remote_only',
        });
      } else {
        let recommended: SyncResolutionChoice = locTime >= remTime ? 'local' : 'remote';
        if (collection === 'transactions') {
          recommended = recommendTransactionResolution(
            loc as unknown as Transaction,
            rem as unknown as Transaction
          );
        }
        conflict.push({
          key,
          collection,
          id,
          kind: resolveChangeKind(loc, rem, 'conflict'),
          source: 'conflict',
          localEntity: loc,
          remoteEntity: rem,
          recommendedResolution: recommended,
          reason: 'no_base_diverged',
        });
      }
    }
  }

  return { unchanged, incoming, conflict, push };
}

function resolveRecordSettingKind(
  loc: unknown,
  rem: unknown,
  perspective: 'incoming' | 'push'
): SyncChangeKind {
  if (perspective === 'incoming') {
    if (loc === undefined) return 'add';
    if (rem === undefined) return 'delete';
    return 'modify';
  }
  if (rem === undefined) return 'add';
  if (loc === undefined) return 'delete';
  return 'modify';
}

function classifyRecordSettings(params: {
  collection: 'settings' | 'plugin_settings';
  localMap: Record<string, unknown>;
  remoteMap: Record<string, unknown>;
  baseMap: Record<string, unknown> | null;
}): {
  unchanged: Record<string, unknown>;
  incoming: SyncDiffItem[];
  conflict: SyncDiffItem[];
  push: SyncDiffItem[];
} {
  const { collection, localMap, remoteMap, baseMap } = params;
  const allKeys = new Set<string>([
    ...Object.keys(localMap),
    ...Object.keys(remoteMap),
    ...(baseMap ? Object.keys(baseMap) : []),
  ]);

  const unchanged: Record<string, unknown> = {};
  const incoming: SyncDiffItem[] = [];
  const conflict: SyncDiffItem[] = [];
  const push: SyncDiffItem[] = [];

  for (const id of allKeys) {
    const loc = localMap[id];
    const rem = remoteMap[id];
    const bas = baseMap ? baseMap[id] : undefined;
    const key = `${collection}:${id}`;

    if (areValuesCanonicallyEqual(loc, rem)) {
      if (loc !== undefined) {
        unchanged[id] = loc;
      }
      continue;
    }

    const locEntity =
      typeof loc === 'object' && loc !== null ? (loc as Record<string, unknown>) : undefined;
    const remEntity =
      typeof rem === 'object' && rem !== null ? (rem as Record<string, unknown>) : undefined;
    const basEntity =
      typeof bas === 'object' && bas !== null ? (bas as Record<string, unknown>) : undefined;

    if (baseMap !== null) {
      const eqLB = areValuesCanonicallyEqual(loc, bas);
      const eqRB = areValuesCanonicallyEqual(rem, bas);

      if (eqLB && !eqRB) {
        incoming.push({
          key,
          collection,
          id,
          kind: resolveRecordSettingKind(loc, rem, 'incoming'),
          source: 'incoming',
          localEntity: locEntity,
          remoteEntity: remEntity,
          baseEntity: basEntity,
          recommendedResolution: 'remote',
          reason: 'remote_only',
        });
      } else if (!eqLB && eqRB) {
        push.push({
          key,
          collection,
          id,
          kind: resolveRecordSettingKind(loc, rem, 'push'),
          source: 'push',
          localEntity: locEntity,
          remoteEntity: remEntity,
          baseEntity: basEntity,
          recommendedResolution: 'local',
          reason: 'local_only',
        });
      } else {
        conflict.push({
          key,
          collection,
          id,
          kind: 'modify',
          source: 'conflict',
          localEntity: locEntity,
          remoteEntity: remEntity,
          baseEntity: basEntity,
          recommendedResolution: 'local',
          reason: 'both_modified',
        });
      }
      continue;
    }

    if (loc === undefined && rem !== undefined) {
      incoming.push({
        key,
        collection,
        id,
        kind: 'add',
        source: 'incoming',
        localEntity: undefined,
        remoteEntity: remEntity,
        recommendedResolution: 'remote',
        reason: 'remote_only',
      });
    } else if (loc !== undefined && rem === undefined) {
      push.push({
        key,
        collection,
        id,
        kind: 'add',
        source: 'push',
        localEntity: locEntity,
        remoteEntity: undefined,
        recommendedResolution: 'local',
        reason: 'local_only',
      });
    } else {
      const locMs = getEntityTimestampMs(locEntity);
      const remMs = getEntityTimestampMs(remEntity);
      conflict.push({
        key,
        collection,
        id,
        kind: 'modify',
        source: 'conflict',
        localEntity: locEntity,
        remoteEntity: remEntity,
        recommendedResolution: locMs >= remMs ? 'local' : 'remote',
        reason: 'no_base_diverged',
      });
    }
  }

  return { unchanged, incoming, conflict, push };
}

export function buildThreeWaySyncPlan(
  local: ExportData,
  remote: ExportData,
  base: ExportData | null = null,
  nowMs: number = Date.now()
): SyncDiffPlan {
  const txRes = classifyEntityCollection<Transaction>({
    collection: 'transactions',
    localList: local.transactions || [],
    remoteList: remote.transactions || [],
    baseList: base ? base.transactions || [] : null,
    nowMs,
  });

  const acctRes = classifyEntityCollection<Account>({
    collection: 'accounts',
    localList: local.accounts || [],
    remoteList: remote.accounts || [],
    baseList: base ? base.accounts || [] : null,
    nowMs,
  });

  const catRes = classifyEntityCollection<Category>({
    collection: 'categories',
    localList: local.categories || [],
    remoteList: remote.categories || [],
    baseList: base ? base.categories || [] : null,
    nowMs,
  });

  const pluginDataRes = classifyEntityCollection<StoredEntity>({
    collection: 'plugin_data',
    localList: (local.plugins?.data as StoredEntity[]) || [],
    remoteList: (remote.plugins?.data as StoredEntity[]) || [],
    baseList: base ? (base.plugins?.data as StoredEntity[]) || [] : null,
    nowMs,
  });

  const settingsRes = classifyRecordSettings({
    collection: 'settings',
    localMap: local.settings || {},
    remoteMap: remote.settings || {},
    baseMap: base ? base.settings || {} : null,
  });

  const pluginSettingsRes = classifyRecordSettings({
    collection: 'plugin_settings',
    localMap: local.plugins?.settings || {},
    remoteMap: remote.plugins?.settings || {},
    baseMap: base ? base.plugins?.settings || {} : null,
  });

  const incomingItems = [
    ...txRes.incoming,
    ...acctRes.incoming,
    ...catRes.incoming,
    ...pluginDataRes.incoming,
    ...settingsRes.incoming,
    ...pluginSettingsRes.incoming,
  ];
  const conflictItems = [
    ...txRes.conflict,
    ...acctRes.conflict,
    ...catRes.conflict,
    ...pluginDataRes.conflict,
    ...settingsRes.conflict,
    ...pluginSettingsRes.conflict,
  ];
  const pushItems = [
    ...txRes.push,
    ...acctRes.push,
    ...catRes.push,
    ...pluginDataRes.push,
    ...settingsRes.push,
    ...pluginSettingsRes.push,
  ];

  const isStrictlyEqual =
    incomingItems.length === 0 && conflictItems.length === 0 && pushItems.length === 0;
  const requiresReview = incomingItems.length > 0 || conflictItems.length > 0;

  return {
    isStrictlyEqual,
    requiresReview,
    incomingItems,
    conflictItems,
    pushItems,
    unchanged: {
      transactions: txRes.unchanged,
      accounts: acctRes.unchanged,
      categories: catRes.unchanged,
      pluginData: pluginDataRes.unchanged,
      settings: settingsRes.unchanged,
      pluginSettings: pluginSettingsRes.unchanged,
    },
    localSnapshot: local,
    remoteSnapshot: remote,
    baseSnapshot: base,
  };
}

function getTransactionAccountEffects(tx: Transaction | undefined): Array<[string, number]> {
  if (!tx || (tx as StoredEntity).deletedAt) return [];
  if (tx.type === 'expense') return [[tx.accountId, -tx.amount]];
  if (tx.type === 'income') return [[tx.accountId, tx.amount]];
  if (tx.type === 'transfer') {
    const effects: Array<[string, number]> = [[tx.accountId, -tx.amount]];
    if (tx.toAccountId) effects.push([tx.toAccountId, tx.amount]);
    return effects;
  }
  if (tx.type === 'reconcile' && tx.reconcileDiff !== undefined) {
    return [[tx.accountId, tx.reconcileDiff]];
  }
  if (tx.type === 'loan') {
    if (tx.loanDirection === 'lend' && tx.loanRole === 'origin') {
      return [[tx.accountId, -tx.amount]];
    }
    if (tx.loanDirection === 'borrow' && tx.loanRole === 'origin') {
      return [[tx.accountId, tx.amount]];
    }
    if (tx.loanDirection === 'lend' && tx.loanRole === 'repayment') {
      return [[tx.accountId, tx.amount]];
    }
    if (tx.loanDirection === 'borrow' && tx.loanRole === 'repayment') {
      return [[tx.accountId, -tx.amount]];
    }
  }
  return [];
}

function accumulateBalanceMap(
  target: Map<string, number>,
  effects: Array<[string, number]>,
  sign: 1 | -1
): void {
  for (const [acctId, delta] of effects) {
    if (!acctId || !delta) continue;
    target.set(acctId, (target.get(acctId) || 0) + sign * delta);
  }
}

export function resolveSyncPlan(
  plan: SyncDiffPlan,
  resolutions: Record<string, SyncResolutionChoice> = {},
  options?: { retainTombstones?: boolean; nowIso?: string }
): DiffMergeResult {
  const retainTombstones = options?.retainTombstones ?? true;
  const nowIso = options?.nowIso || new Date().toISOString();
  const nowMs = Date.parse(nowIso);

  const txMap = new Map<string, Transaction>(
    plan.unchanged.transactions.map((t) => [t.id, t])
  );
  const acctMap = new Map<string, Account>(
    plan.unchanged.accounts.map((a) => [a.id, a])
  );
  const catMap = new Map<string, Category>(
    plan.unchanged.categories.map((c) => [c.id, c])
  );
  const pluginDataMap = new Map<string, StoredEntity>(
    plan.unchanged.pluginData.map((p) => [p.id, p])
  );
  const settingsMap: Record<string, unknown> = { ...plan.unchanged.settings };
  const pluginSettingsMap: Record<string, unknown> = { ...plan.unchanged.pluginSettings };

  const stats: DiffStats = {
    addedLocal: 0,
    updatedLocal: 0,
    deletedLocal: 0,
    addedRemote: 0,
    updatedRemote: 0,
    deletedRemote: 0,
  };

  let changedLocal = false;
  let changedRemote = false;

  const accountChoiceMap = new Map<string, SyncResolutionChoice>();
  const resolvedTxItems: Array<{
    item: SyncDiffItem;
    choice: SyncResolutionChoice;
    winner: Transaction | undefined;
  }> = [];

  const allDiffs = [...plan.pushItems, ...plan.incomingItems, ...plan.conflictItems];

  const isCountedCollection = (col: SyncEntityCollection) =>
    col === 'transactions' || col === 'accounts' || col === 'categories';

  for (const item of allDiffs) {
    const choice: SyncResolutionChoice = resolutions[item.key] || item.recommendedResolution;

    if (item.collection === 'accounts') {
      accountChoiceMap.set(item.id, choice);
    }

    let winner: StoredEntity | Record<string, unknown> | undefined =
      choice === 'local' ? item.localEntity : item.remoteEntity;

    if (item.reason === 'cross_id_duplicate' && choice === 'local' && item.remoteEntity) {
      winner = {
        ...(item.remoteEntity as StoredEntity),
        deletedAt: nowIso,
        updatedAt: nowIso,
      };
    }

    const equalToLocal = areValuesCanonicallyEqual(winner, item.localEntity);
    const equalToRemote = areValuesCanonicallyEqual(winner, item.remoteEntity);

    if (!equalToLocal) {
      changedLocal = true;
      if (isCountedCollection(item.collection)) {
        const winnerDeleted = Boolean((winner as StoredEntity | undefined)?.deletedAt) || !winner;
        const hadLocal = Boolean(item.localEntity) && !(item.localEntity as StoredEntity).deletedAt;
        if (!hadLocal && !winnerDeleted) stats.addedLocal++;
        else if (hadLocal && winnerDeleted) stats.deletedLocal++;
        else if (hadLocal && !winnerDeleted) stats.updatedLocal++;
      }
    }

    if (!equalToRemote) {
      changedRemote = true;
      if (isCountedCollection(item.collection)) {
        const winnerDeleted = Boolean((winner as StoredEntity | undefined)?.deletedAt) || !winner;
        const hadRemote =
          Boolean(item.remoteEntity) && !(item.remoteEntity as StoredEntity).deletedAt;
        if (!hadRemote && !winnerDeleted) stats.addedRemote++;
        else if (hadRemote && winnerDeleted) stats.deletedRemote++;
        else if (hadRemote && !winnerDeleted) stats.updatedRemote++;
      }
    }

    if (item.collection === 'transactions') {
      const winnerTx = winner as Transaction | undefined;
      resolvedTxItems.push({ item, choice, winner: winnerTx });
      if (winnerTx) {
        txMap.set(item.id, winnerTx);
      }
    } else if (item.collection === 'accounts' && winner) {
      acctMap.set(item.id, winner as Account);
    } else if (item.collection === 'categories' && winner) {
      catMap.set(item.id, winner as Category);
    } else if (item.collection === 'plugin_data' && winner) {
      pluginDataMap.set(item.id, winner as StoredEntity);
    } else if (item.collection === 'settings') {
      if (winner === undefined) delete settingsMap[item.id];
      else settingsMap[item.id] = winner;
    } else if (item.collection === 'plugin_settings') {
      if (winner === undefined) delete pluginSettingsMap[item.id];
      else pluginSettingsMap[item.id] = winner;
    }
  }

  const accountDeltas = new Map<string, number>();
  for (const { winner, item } of resolvedTxItems) {
    const localTx = item.localEntity as Transaction | undefined;
    const remoteTx = item.remoteEntity as Transaction | undefined;
    const winEffects = getTransactionAccountEffects(winner);
    const locEffects = getTransactionAccountEffects(localTx);
    const remEffects = getTransactionAccountEffects(remoteTx);

    const affectedAccountIds = new Set<string>([
      ...winEffects.map(([a]) => a),
      ...locEffects.map(([a]) => a),
      ...remEffects.map(([a]) => a),
    ]);

    for (const acctId of affectedAccountIds) {
      const acctPickedRemote = accountChoiceMap.get(acctId) === 'remote';
      const baselineEffects = acctPickedRemote ? remEffects : locEffects;
      const desiredForAcct = winEffects.filter(([a]) => a === acctId);
      const baselineForAcct = baselineEffects.filter(([a]) => a === acctId);
      accumulateBalanceMap(accountDeltas, desiredForAcct, 1);
      accumulateBalanceMap(accountDeltas, baselineForAcct, -1);
    }
  }

  for (const [acctId, delta] of accountDeltas.entries()) {
    if (!delta) continue;
    const acct = acctMap.get(acctId);
    if (!acct || (acct as StoredEntity).deletedAt) continue;
    acctMap.set(acctId, {
      ...acct,
      balance: acct.balance + delta,
      updatedAt: nowIso,
    });
    changedLocal = true;
    changedRemote = true;
  }

  const filterRetained = <T extends StoredEntity>(list: T[]): T[] =>
    list.filter((entity) => {
      if (!entity.deletedAt) return true;
      if (!retainTombstones) return false;
      return !isExpiredTombstone(entity, nowMs);
    });

  const merged: ExportData = {
    version: '4.0.0',
    exportedAt: nowIso,
    transactions: filterRetained(Array.from(txMap.values())),
    accounts: filterRetained(Array.from(acctMap.values())),
    categories: filterRetained(Array.from(catMap.values())),
    settings: settingsMap,
    plugins: {
      data: filterRetained(Array.from(pluginDataMap.values())),
      settings: pluginSettingsMap,
    },
  };

  return {
    merged,
    stats,
    changedLocal,
    changedRemote,
  };
}

export function mergeSyncPayloads(local: ExportData, remote: ExportData): DiffMergeResult {
  const plan = buildThreeWaySyncPlan(local, remote, null);
  return resolveSyncPlan(plan, {}, { retainTombstones: false });
}
