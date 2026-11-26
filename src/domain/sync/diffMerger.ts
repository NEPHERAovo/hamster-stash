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

export interface AutoAccountMergeEntry {
  id: string;
  localEntity?: Account;
  remoteEntity?: Account;
  winner?: Account;
  baselineFromRemote: boolean;
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
  autoAccounts: AutoAccountMergeEntry[];
  localSnapshot: ExportData;
  remoteSnapshot: ExportData;
  baseSnapshot: ExportData | null;
}

export const TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_SEED_TIME_MS = Date.parse('1970-01-01T00:00:00.000Z');

export function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeValue);
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
  if (a === undefined || b === undefined || a === null || b === null) return false;
  return JSON.stringify(canonicalizeValue(a)) === JSON.stringify(canonicalizeValue(b));
}

function getEntityTimestampMs(entity: StoredEntity | Record<string, unknown> | undefined): number {
  if (!entity) return 0;
  const rec = entity as { updatedAt?: string; createdAt?: string; deletedAt?: string };
  const raw = rec.updatedAt || rec.deletedAt || rec.createdAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? 0 : ms;
}

function isExpiredTombstone(entity: StoredEntity | undefined, nowMs: number): boolean {
  if (!entity?.deletedAt) return false;
  const ms = Date.parse(entity.deletedAt);
  return !Number.isNaN(ms) && nowMs - ms > TOMBSTONE_RETENTION_MS;
}

type SyncTx = Transaction & { deletedAt?: string };

function getOwnedItemId(tx: SyncTx | undefined): string | undefined {
  const owned = tx?.ext?.['owned-items'] as { itemId?: string } | undefined;
  return owned?.itemId || undefined;
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

function findCrossIdDuplicateTwin(remoteTx: SyncTx, localTxs: SyncTx[]): SyncTx | undefined {
  if (remoteTx.deletedAt || remoteTx.offsetTransactionId || remoteTx.relatedLoanId) return undefined;
  return localTxs.find((localTx) => {
    if (localTx.deletedAt || localTx.id === remoteTx.id) return false;
    if (!isSameCorePurchase(localTx, remoteTx)) return false;
    if ((localTx.note || '').trim() !== (remoteTx.note || '').trim()) return false;
    if (localTx.createdAt !== remoteTx.createdAt) return false;
    return getOwnedItemId(localTx) !== getOwnedItemId(remoteTx);
  });
}

function recommendTransactionResolution(loc: SyncTx, rem: SyncTx): SyncResolutionChoice {
  if (!loc.deletedAt && !rem.deletedAt && isSameCorePurchase(loc, rem)) {
    const locLinked = Boolean(getOwnedItemId(loc));
    const remLinked = Boolean(getOwnedItemId(rem));
    if (locLinked !== remLinked) return locLinked ? 'local' : 'remote';
  }
  return getEntityTimestampMs(loc) >= getEntityTimestampMs(rem) ? 'local' : 'remote';
}

function resolveEntityChangeKind(
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

function resolveSettingChangeKind(
  loc: unknown,
  rem: unknown,
  perspective: 'incoming' | 'push' | 'conflict'
): SyncChangeKind {
  if (perspective === 'incoming') {
    if (loc === undefined) return 'add';
    return rem === undefined ? 'delete' : 'modify';
  }
  if (perspective === 'push') {
    if (rem === undefined) return 'add';
    return loc === undefined ? 'delete' : 'modify';
  }
  return 'modify';
}

function routeThreeWayDiff(params: {
  collection: SyncEntityCollection;
  id: string;
  loc: unknown;
  rem: unknown;
  bas: unknown;
  hasBase: boolean;
  locEntity?: StoredEntity | Record<string, unknown>;
  remEntity?: StoredEntity | Record<string, unknown>;
  basEntity?: StoredEntity | Record<string, unknown>;
  getKind: (perspective: 'incoming' | 'push' | 'conflict') => SyncChangeKind;
  getRecommendedConflict: () => SyncResolutionChoice;
  isFreshSeedUpgrade?: boolean;
  incoming: SyncDiffItem[];
  conflict: SyncDiffItem[];
  push: SyncDiffItem[];
}): void {
  const {
    collection,
    id,
    loc,
    rem,
    bas,
    hasBase,
    locEntity,
    remEntity,
    basEntity,
    getKind,
    getRecommendedConflict,
    isFreshSeedUpgrade,
    incoming,
    conflict,
    push,
  } = params;

  const emit = (
    target: SyncDiffItem[],
    source: SyncDiffItem['source'],
    recommendedResolution: SyncResolutionChoice,
    reason: SyncConflictReason,
    baseVal?: StoredEntity | Record<string, unknown>
  ) => {
    target.push({
      key: `${collection}:${id}`,
      collection,
      id,
      kind: getKind(source),
      source,
      localEntity: locEntity,
      remoteEntity: remEntity,
      ...(baseVal !== undefined ? { baseEntity: baseVal } : {}),
      recommendedResolution,
      reason,
    });
  };

  if (hasBase) {
    const eqLB = areValuesCanonicallyEqual(loc, bas);
    const eqRB = areValuesCanonicallyEqual(rem, bas);
    if (eqLB && !eqRB) {
      emit(incoming, 'incoming', 'remote', 'remote_only', basEntity);
    } else if (!eqLB && eqRB) {
      emit(push, 'push', 'local', 'local_only', basEntity);
    } else {
      emit(conflict, 'conflict', getRecommendedConflict(), 'both_modified', basEntity);
    }
    return;
  }

  if (loc === undefined && rem !== undefined) {
    emit(incoming, 'incoming', 'remote', 'remote_only');
  } else if (loc !== undefined && rem === undefined) {
    emit(push, 'push', 'local', 'local_only');
  } else if (isFreshSeedUpgrade) {
    emit(incoming, 'incoming', 'remote', 'remote_only');
  } else {
    emit(conflict, 'conflict', getRecommendedConflict(), 'no_base_diverged');
  }
}

function classifyEntityCollection<T extends StoredEntity>(params: {
  collection: 'transactions' | 'accounts' | 'categories' | 'plugin_data';
  localList: T[];
  remoteList: T[];
  baseList: T[] | null;
  nowMs: number;
}) {
  const { collection, localList, remoteList, baseList, nowMs } = params;
  const localMap = new Map(localList.map((item) => [item.id, item]));
  const remoteMap = new Map(remoteList.map((item) => [item.id, item]));
  const baseMap = new Map((baseList || []).map((item) => [item.id, item]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys(), ...(baseList ? baseMap.keys() : [])]);

  const unchanged: T[] = [];
  const incoming: SyncDiffItem[] = [];
  const conflict: SyncDiffItem[] = [];
  const push: SyncDiffItem[] = [];
  const matchedTwinIds = new Set<string>();

  for (const id of allIds) {
    const loc = localMap.get(id);
    const rem = remoteMap.get(id);
    const bas = baseList ? baseMap.get(id) : undefined;

    if (areValuesCanonicallyEqual(loc, rem)) {
      if (loc && !isExpiredTombstone(loc, nowMs)) unchanged.push(loc);
      continue;
    }
    if (!loc && rem?.deletedAt) {
      if (!isExpiredTombstone(rem, nowMs)) unchanged.push(rem);
      continue;
    }
    if (loc?.deletedAt && !rem) {
      push.push({
        key: `${collection}:${id}`,
        collection,
        id,
        kind: 'delete',
        source: 'push',
        localEntity: loc,
        baseEntity: bas,
        recommendedResolution: 'local',
        reason: 'local_only',
      });
      continue;
    }

    if (collection === 'transactions' && !loc && rem) {
      const twin = findCrossIdDuplicateTwin(rem as unknown as SyncTx, localList as unknown as SyncTx[]);
      if (twin) {
        matchedTwinIds.add(twin.id);
        conflict.push({
          key: `${collection}:${id}`,
          collection,
          id,
          kind: 'modify',
          source: 'conflict',
          localEntity: twin as unknown as StoredEntity,
          remoteEntity: rem,
          baseEntity: bas,
          recommendedResolution: recommendTransactionResolution(twin, rem as unknown as SyncTx),
          reason: 'cross_id_duplicate',
        });
        continue;
      }
    }

    const locTime = getEntityTimestampMs(loc);
    const remTime = getEntityTimestampMs(rem);
    const isFreshSeedUpgrade =
      (collection === 'accounts' || collection === 'categories') &&
      locTime === DEFAULT_SEED_TIME_MS &&
      remTime > DEFAULT_SEED_TIME_MS;

    routeThreeWayDiff({
      collection,
      id,
      loc,
      rem,
      bas,
      hasBase: baseList !== null,
      locEntity: loc,
      remEntity: rem,
      basEntity: bas,
      getKind: (perspective) => resolveEntityChangeKind(loc, rem, perspective),
      getRecommendedConflict: () => {
        if (collection === 'transactions' && loc && rem) {
          return recommendTransactionResolution(loc as unknown as Transaction, rem as unknown as Transaction);
        }
        return locTime >= remTime ? 'local' : 'remote';
      },
      isFreshSeedUpgrade,
      incoming,
      conflict,
      push,
    });
  }

  return {
    unchanged,
    incoming,
    conflict,
    push: matchedTwinIds.size > 0 ? push.filter((item) => !matchedTwinIds.has(item.id)) : push,
  };
}

function classifyRecordSettings(params: {
  collection: 'settings' | 'plugin_settings';
  localMap: Record<string, unknown>;
  remoteMap: Record<string, unknown>;
  baseMap: Record<string, unknown> | null;
}) {
  const { collection, localMap, remoteMap, baseMap } = params;
  const allKeys = new Set([
    ...Object.keys(localMap),
    ...Object.keys(remoteMap),
    ...(baseMap ? Object.keys(baseMap) : []),
  ]);

  const unchanged: Record<string, unknown> = {};
  const incoming: SyncDiffItem[] = [];
  const conflict: SyncDiffItem[] = [];
  const push: SyncDiffItem[] = [];

  const asRecord = (val: unknown) =>
    typeof val === 'object' && val !== null ? (val as Record<string, unknown>) : undefined;

  for (const id of allKeys) {
    const loc = localMap[id];
    const rem = remoteMap[id];
    const bas = baseMap ? baseMap[id] : undefined;

    if (areValuesCanonicallyEqual(loc, rem)) {
      if (loc !== undefined) unchanged[id] = loc;
      continue;
    }

    const locEntity = asRecord(loc);
    const remEntity = asRecord(rem);
    const basEntity = asRecord(bas);

    routeThreeWayDiff({
      collection,
      id,
      loc,
      rem,
      bas,
      hasBase: baseMap !== null,
      locEntity,
      remEntity,
      basEntity,
      getKind: (perspective) => resolveSettingChangeKind(loc, rem, perspective),
      getRecommendedConflict: () =>
        baseMap !== null || getEntityTimestampMs(locEntity) >= getEntityTimestampMs(remEntity)
          ? 'local'
          : 'remote',
      incoming,
      conflict,
      push,
    });
  }

  return { unchanged, incoming, conflict, push };
}

type SyncAccount = Account & { deletedAt?: string };

function stripVolatileAccountFields(acct: SyncAccount | undefined): Record<string, unknown> | undefined {
  if (!acct) return undefined;
  const copy: Record<string, unknown> = { ...acct };
  delete copy.balance;
  delete copy.updatedAt;
  return copy;
}

function classifyAccountCollection(params: {
  localList: SyncAccount[];
  remoteList: SyncAccount[];
  baseList: SyncAccount[] | null;
  nowMs: number;
}): { unchanged: Account[]; autoAccounts: AutoAccountMergeEntry[] } {
  const { localList, remoteList, baseList, nowMs } = params;
  const localMap = new Map(localList.map((a) => [a.id, a]));
  const remoteMap = new Map(remoteList.map((a) => [a.id, a]));
  const baseMap = new Map((baseList || []).map((a) => [a.id, a]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys(), ...(baseList ? baseMap.keys() : [])]);

  const unchanged: Account[] = [];
  const autoAccounts: AutoAccountMergeEntry[] = [];

  for (const id of allIds) {
    const loc = localMap.get(id);
    const rem = remoteMap.get(id);
    const bas = baseList ? baseMap.get(id) : undefined;

    if (areValuesCanonicallyEqual(loc, rem)) {
      if (loc && !isExpiredTombstone(loc, nowMs)) unchanged.push(loc);
      continue;
    }
    if (!loc && rem?.deletedAt) {
      if (!isExpiredTombstone(rem, nowMs)) unchanged.push(rem);
      continue;
    }
    if (!loc && rem) {
      autoAccounts.push({ id, remoteEntity: rem, winner: rem, baselineFromRemote: true });
      continue;
    }
    if (loc && !rem) {
      autoAccounts.push({ id, localEntity: loc, winner: loc, baselineFromRemote: false });
      continue;
    }
    if (loc && rem) {
      const locTime = getEntityTimestampMs(loc);
      const remTime = getEntityTimestampMs(rem);
      if (locTime === DEFAULT_SEED_TIME_MS && remTime > DEFAULT_SEED_TIME_MS) {
        autoAccounts.push({ id, localEntity: loc, remoteEntity: rem, winner: rem, baselineFromRemote: true });
        continue;
      }
      const locMeta = stripVolatileAccountFields(loc);
      const remMeta = stripVolatileAccountFields(rem);
      if (areValuesCanonicallyEqual(locMeta, remMeta)) {
        unchanged.push(loc);
        continue;
      }
      const basMeta = stripVolatileAccountFields(bas);
      let pickRemote = remTime > locTime;
      if (baseList !== null) {
        const eqLB = areValuesCanonicallyEqual(locMeta, basMeta);
        const eqRB = areValuesCanonicallyEqual(remMeta, basMeta);
        if (eqLB && !eqRB) pickRemote = true;
        else if (!eqLB && eqRB) pickRemote = false;
      }
      const metaSource = pickRemote ? rem : loc;
      autoAccounts.push({
        id,
        localEntity: loc,
        remoteEntity: rem,
        winner: { ...metaSource, balance: pickRemote ? rem.balance : loc.balance },
        baselineFromRemote: pickRemote,
      });
    }
  }

  return { unchanged, autoAccounts };
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
  const acctRes = classifyAccountCollection({
    localList: (local.accounts || []) as SyncAccount[],
    remoteList: (remote.accounts || []) as SyncAccount[],
    baseList: base ? ((base.accounts || []) as SyncAccount[]) : null,
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
    ...catRes.incoming,
    ...pluginDataRes.incoming,
    ...settingsRes.incoming,
    ...pluginSettingsRes.incoming,
  ];
  const conflictItems = [
    ...txRes.conflict,
    ...catRes.conflict,
    ...pluginDataRes.conflict,
    ...settingsRes.conflict,
    ...pluginSettingsRes.conflict,
  ];
  const pushItems = [
    ...txRes.push,
    ...catRes.push,
    ...pluginDataRes.push,
    ...settingsRes.push,
    ...pluginSettingsRes.push,
  ];

  return {
    isStrictlyEqual:
      incomingItems.length === 0 &&
      conflictItems.length === 0 &&
      pushItems.length === 0 &&
      acctRes.autoAccounts.length === 0,
    requiresReview: incomingItems.length > 0 || conflictItems.length > 0,
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
    autoAccounts: acctRes.autoAccounts,
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
    const isOutflow =
      (tx.loanDirection === 'lend' && tx.loanRole === 'origin') ||
      (tx.loanDirection === 'borrow' && tx.loanRole === 'repayment');
    const isInflow =
      (tx.loanDirection === 'borrow' && tx.loanRole === 'origin') ||
      (tx.loanDirection === 'lend' && tx.loanRole === 'repayment');
    if (isOutflow) return [[tx.accountId, -tx.amount]];
    if (isInflow) return [[tx.accountId, tx.amount]];
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

function recordSideDiffStat(
  stats: DiffStats,
  side: 'Local' | 'Remote',
  hadBefore: boolean,
  winnerDeleted: boolean
): void {
  if (!hadBefore && !winnerDeleted) {
    if (side === 'Local') stats.addedLocal++;
    else stats.addedRemote++;
  } else if (hadBefore && winnerDeleted) {
    if (side === 'Local') stats.deletedLocal++;
    else stats.deletedRemote++;
  } else if (hadBefore && !winnerDeleted) {
    if (side === 'Local') stats.updatedLocal++;
    else stats.updatedRemote++;
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

  const txMap = new Map(plan.unchanged.transactions.map((t) => [t.id, t]));
  const acctMap = new Map(plan.unchanged.accounts.map((a) => [a.id, a]));
  const catMap = new Map(plan.unchanged.categories.map((c) => [c.id, c]));
  const pluginDataMap = new Map(plan.unchanged.pluginData.map((p) => [p.id, p]));
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
  for (const autoAcct of plan.autoAccounts) {
    if (autoAcct.baselineFromRemote) accountChoiceMap.set(autoAcct.id, 'remote');
    if (autoAcct.winner) acctMap.set(autoAcct.id, autoAcct.winner);

    const winDeleted = Boolean((autoAcct.winner as SyncAccount | undefined)?.deletedAt) || !autoAcct.winner;
    if (!areValuesCanonicallyEqual(autoAcct.winner, autoAcct.localEntity)) {
      changedLocal = true;
      recordSideDiffStat(
        stats,
        'Local',
        Boolean(autoAcct.localEntity) && !(autoAcct.localEntity as SyncAccount).deletedAt,
        winDeleted
      );
    }
    if (!areValuesCanonicallyEqual(autoAcct.winner, autoAcct.remoteEntity)) {
      changedRemote = true;
      recordSideDiffStat(
        stats,
        'Remote',
        Boolean(autoAcct.remoteEntity) && !(autoAcct.remoteEntity as SyncAccount).deletedAt,
        winDeleted
      );
    }
  }

  const resolvedTxItems: Array<{ item: SyncDiffItem; winner: Transaction | undefined }> = [];
  const isCounted = (col: SyncEntityCollection) =>
    col === 'transactions' || col === 'accounts' || col === 'categories';

  for (const item of [...plan.pushItems, ...plan.incomingItems, ...plan.conflictItems]) {
    const choice: SyncResolutionChoice = resolutions[item.key] || item.recommendedResolution;
    if (item.collection === 'accounts') accountChoiceMap.set(item.id, choice);

    if (item.reason === 'cross_id_duplicate' && item.collection === 'transactions') {
      const localTwin = item.localEntity as StoredEntity | undefined;
      const remoteTx = item.remoteEntity as StoredEntity | undefined;
      if (choice === 'local' && localTwin) {
        txMap.set(localTwin.id, localTwin as unknown as Transaction);
        if (remoteTx) {
          txMap.set(remoteTx.id, { ...remoteTx, deletedAt: nowIso, updatedAt: nowIso } as unknown as Transaction);
          changedRemote = true;
          stats.deletedRemote++;
        }
        resolvedTxItems.push({ item, winner: localTwin as unknown as Transaction });
      } else if (choice === 'remote' && remoteTx) {
        txMap.set(remoteTx.id, remoteTx as unknown as Transaction);
        changedLocal = true;
        stats.addedLocal++;
        if (localTwin) {
          txMap.set(localTwin.id, { ...localTwin, deletedAt: nowIso, updatedAt: nowIso } as unknown as Transaction);
          stats.deletedLocal++;
          changedRemote = true;
        }
        resolvedTxItems.push({ item, winner: remoteTx as unknown as Transaction });
      }
      continue;
    }

    const winner: StoredEntity | Record<string, unknown> | undefined =
      choice === 'local' ? item.localEntity : item.remoteEntity;
    const winnerDeleted = Boolean((winner as StoredEntity | undefined)?.deletedAt) || !winner;

    if (!areValuesCanonicallyEqual(winner, item.localEntity)) {
      changedLocal = true;
      if (isCounted(item.collection)) {
        recordSideDiffStat(
          stats,
          'Local',
          Boolean(item.localEntity) && !(item.localEntity as StoredEntity).deletedAt,
          winnerDeleted
        );
      }
    }
    if (!areValuesCanonicallyEqual(winner, item.remoteEntity)) {
      changedRemote = true;
      if (isCounted(item.collection)) {
        recordSideDiffStat(
          stats,
          'Remote',
          Boolean(item.remoteEntity) && !(item.remoteEntity as StoredEntity).deletedAt,
          winnerDeleted
        );
      }
    }

    if (item.collection === 'transactions') {
      const winnerTx = winner as Transaction | undefined;
      resolvedTxItems.push({ item, winner: winnerTx });
      if (winnerTx) txMap.set(item.id, winnerTx);
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
    const winEffects = getTransactionAccountEffects(winner);
    const locEffects = getTransactionAccountEffects(item.localEntity as Transaction | undefined);
    const remEffects = getTransactionAccountEffects(item.remoteEntity as Transaction | undefined);
    const affectedIds = new Set([
      ...winEffects.map(([a]) => a),
      ...locEffects.map(([a]) => a),
      ...remEffects.map(([a]) => a),
    ]);
    for (const acctId of affectedIds) {
      const baseline = accountChoiceMap.get(acctId) === 'remote' ? remEffects : locEffects;
      accumulateBalanceMap(accountDeltas, winEffects.filter(([a]) => a === acctId), 1);
      accumulateBalanceMap(accountDeltas, baseline.filter(([a]) => a === acctId), -1);
    }
  }

  const remoteAcctMap = new Map(((plan.remoteSnapshot.accounts || []) as SyncAccount[]).map((a) => [a.id, a]));
  const localAcctMap = new Map(((plan.localSnapshot.accounts || []) as SyncAccount[]).map((a) => [a.id, a]));
  for (const [acctId, delta] of accountDeltas.entries()) {
    if (!delta) continue;
    const acct = acctMap.get(acctId);
    if (!acct || (acct as StoredEntity).deletedAt) continue;
    const nextAcct: Account = { ...acct, balance: acct.balance + delta, updatedAt: nowIso };
    acctMap.set(acctId, nextAcct);
    if (localAcctMap.get(acctId)?.balance !== nextAcct.balance) changedLocal = true;
    if (remoteAcctMap.get(acctId)?.balance !== nextAcct.balance) changedRemote = true;
  }

  const filterRetained = <T extends StoredEntity>(list: T[]): T[] =>
    list.filter((entity) => !entity.deletedAt || (retainTombstones && !isExpiredTombstone(entity, nowMs)));

  return {
    merged: {
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
    },
    stats,
    changedLocal,
    changedRemote,
  };
}

export function mergeSyncPayloads(local: ExportData, remote: ExportData): DiffMergeResult {
  return resolveSyncPlan(buildThreeWaySyncPlan(local, remote, null), {}, { retainTombstones: false });
}
