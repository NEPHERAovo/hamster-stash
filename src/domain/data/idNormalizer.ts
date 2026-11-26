import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import type { ExportData, StoredEntity } from '../../types/adapter';
import type { Transaction } from '../../types/transaction';
import { hashString8, hashString16 } from '../../utils/hash';

const CANONICAL_TX_PREFIX_RE = /^(?:tx|wx|ali|wealth|csv)_.+/;
const SAFE_ORDER_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function isCanonicalAccountId(id?: string): boolean {
  return Boolean(id && id.startsWith('acct_') && id.length > 5);
}

export function isCanonicalCategoryId(id?: string): boolean {
  return Boolean(id && id.startsWith('cat_') && id.length > 4);
}

export function isCanonicalTransactionId(id?: string): boolean {
  return Boolean(id && CANONICAL_TX_PREFIX_RE.test(id) && !id.startsWith('tx_imp_'));
}

function deriveIdFromImportMeta(meta: Record<string, unknown>): string | null {
  const source = typeof meta.source === 'string' ? meta.source.trim() : '';
  const orderId = typeof meta.orderId === 'string' ? meta.orderId.trim() : '';
  const kind = typeof meta.kind === 'string' ? meta.kind.trim() : '';
  if (!source) return null;

  if (kind === 'wealth_monthly' && orderId.startsWith('wealth:')) {
    const parts = orderId.split(':');
    const yearMonth = parts[1] || '';
    const accountName = parts.slice(2).join(':') || '理财账户';
    const shortSrc = source === 'wechat' ? 'wx' : 'ali';
    return `wealth_${shortSrc}_${yearMonth}_${hashString8(accountName.trim())}`;
  }

  if (orderId.startsWith('fp:')) {
    return `csv_${source}_${orderId.slice(3)}`;
  }

  if (!orderId) return null;

  let prefix = `csv_${source}`;
  if (source === 'wechat') prefix = 'wx';
  else if (source === 'alipay') prefix = 'ali';

  const suffix = SAFE_ORDER_ID_RE.test(orderId) ? orderId : hashString16(orderId);
  return `${prefix}_${suffix}`;
}

function allocateDeterministicId(
  prefix: string,
  basePayload: string,
  occurrenceMap: Map<string, number>,
  usedIds: Set<string>
): string {
  let nextId = '';
  do {
    const occurrence = occurrenceMap.get(basePayload) ?? 0;
    occurrenceMap.set(basePayload, occurrence + 1);
    nextId = `${prefix}_${hashString16(`${basePayload}|${occurrence}`)}`;
  } while (usedIds.has(nextId));
  usedIds.add(nextId);
  return nextId;
}

function buildCanonicalImportCandidate(
  candidate: string,
  usedIds: Set<string>,
  tx: Transaction,
  occurrenceMap: Map<string, number>
): string {
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate);
    return candidate;
  }
  const basePayload = [
    candidate,
    tx.date,
    String(tx.amount),
    tx.createdAt || '',
  ].join('|');
  return allocateDeterministicId('tx', basePayload, occurrenceMap, usedIds);
}

function stripImportMeta(ext: Record<string, unknown> | undefined): {
  nextExt: Record<string, unknown> | undefined;
  hadImportMeta: boolean;
  importMeta?: Record<string, unknown>;
} {
  if (!ext || typeof ext !== 'object' || !('importMeta' in ext)) {
    return { nextExt: ext, hadImportMeta: false };
  }
  const rawMeta = ext.importMeta;
  const rest = { ...ext };
  delete rest.importMeta;
  const nextExt = Object.keys(rest).length > 0 ? rest : undefined;
  const importMeta =
    rawMeta && typeof rawMeta === 'object' ? (rawMeta as Record<string, unknown>) : undefined;
  return { nextExt, hadImportMeta: true, importMeta };
}

export function normalizeDataIds(data: ExportData): { data: ExportData; changed: boolean } {
  let changed = false;

  const acctIdMap = new Map<string, string>();
  const usedAcctIds = new Set<string>();
  const acctOccurrence = new Map<string, number>();

  for (const acct of data.accounts || []) {
    if (isCanonicalAccountId(acct.id)) {
      usedAcctIds.add(acct.id);
    }
  }

  const normalizedAccounts: Account[] = (data.accounts || []).map((acct) => {
    if (isCanonicalAccountId(acct.id)) return acct;
    changed = true;
    const basePayload = [acct.name, acct.type, acct.currency || 'CNY'].join('|');
    const newId = allocateDeterministicId('acct', basePayload, acctOccurrence, usedAcctIds);
    if (acct.id) acctIdMap.set(acct.id, newId);
    return { ...acct, id: newId };
  });

  const catIdMap = new Map<string, string>();
  const usedCatIds = new Set<string>();
  const catOccurrence = new Map<string, number>();

  for (const cat of data.categories || []) {
    if (isCanonicalCategoryId(cat.id)) {
      usedCatIds.add(cat.id);
    }
  }

  const normalizedCategories: Category[] = (data.categories || []).map((cat) => {
    if (isCanonicalCategoryId(cat.id)) return cat;
    changed = true;
    const basePayload = [cat.name, cat.type].join('|');
    const newId = allocateDeterministicId('cat', basePayload, catOccurrence, usedCatIds);
    if (cat.id) catIdMap.set(cat.id, newId);
    return { ...cat, id: newId };
  });

  const txIdMap = new Map<string, string>();
  const usedTxIds = new Set<string>();
  const txOccurrence = new Map<string, number>();

  for (const tx of data.transactions || []) {
    if (isCanonicalTransactionId(tx.id)) {
      usedTxIds.add(tx.id);
    }
  }

  const normalizedTransactions: Transaction[] = (data.transactions || []).map((tx) => {
    const { nextExt, hadImportMeta, importMeta } = stripImportMeta(
      tx.ext as Record<string, unknown> | undefined
    );
    const idIsCanonical = isCanonicalTransactionId(tx.id);

    if (idIsCanonical && !hadImportMeta) {
      return tx;
    }

    changed = true;
    let newId = tx.id;

    if (!idIsCanonical) {
      const candidateFromMeta = importMeta ? deriveIdFromImportMeta(importMeta) : null;
      if (candidateFromMeta) {
        newId = buildCanonicalImportCandidate(candidateFromMeta, usedTxIds, tx, txOccurrence);
      } else {
        const basePayload = [
          tx.type,
          String(tx.amount),
          tx.date,
          tx.createdAt || '',
          tx.accountId,
          tx.categoryId,
          tx.note || '',
        ].join('|');
        newId = allocateDeterministicId('tx', basePayload, txOccurrence, usedTxIds);
      }
      if (tx.id) {
        txIdMap.set(tx.id, newId);
      }
    }

    const updatedTx: Transaction = { ...tx, id: newId };
    if (hadImportMeta) {
      if (nextExt) {
        updatedTx.ext = nextExt;
      } else {
        delete updatedTx.ext;
      }
    }
    return updatedTx;
  });

  const rawPluginData = (data.plugins?.data || []) as StoredEntity[];
  const usedPluginIds = new Set<string>();
  const pdOccurrence = new Map<string, number>();
  for (const entry of rawPluginData) {
    if (entry.id && String(entry.id).trim()) {
      usedPluginIds.add(entry.id);
    }
  }

  const normalizedPluginData: StoredEntity[] = rawPluginData.map((entry) => {
    if (entry.id && String(entry.id).trim()) return entry;
    changed = true;
    const basePayload = JSON.stringify(entry);
    const newId = allocateDeterministicId('pd', basePayload, pdOccurrence, usedPluginIds);
    return { ...entry, id: newId };
  });

  if (!changed) {
    return { data, changed: false };
  }

  const mappedAccounts =
    acctIdMap.size > 0
      ? normalizedAccounts.map((acct) => {
          const mappedRepay = acct.repaymentAccountId
            ? acctIdMap.get(acct.repaymentAccountId)
            : undefined;
          return mappedRepay ? { ...acct, repaymentAccountId: mappedRepay } : acct;
        })
      : normalizedAccounts;

  const mappedCategories =
    catIdMap.size > 0
      ? normalizedCategories.map((cat) => {
          const mappedParent = cat.parentId ? catIdMap.get(cat.parentId) : undefined;
          return mappedParent ? { ...cat, parentId: mappedParent } : cat;
        })
      : normalizedCategories;

  const needsTxFkRewrite = acctIdMap.size > 0 || catIdMap.size > 0 || txIdMap.size > 0;
  const mappedTransactions = needsTxFkRewrite
    ? normalizedTransactions.map((tx) => {
        const nextAccountId = acctIdMap.get(tx.accountId);
        const nextToAccountId = tx.toAccountId ? acctIdMap.get(tx.toAccountId) : undefined;
        const nextCategoryId = catIdMap.get(tx.categoryId);
        const nextOffsetId = tx.offsetTransactionId
          ? txIdMap.get(tx.offsetTransactionId)
          : undefined;
        const nextLoanId = tx.relatedLoanId ? txIdMap.get(tx.relatedLoanId) : undefined;

        if (
          !nextAccountId &&
          !nextToAccountId &&
          !nextCategoryId &&
          !nextOffsetId &&
          !nextLoanId
        ) {
          return tx;
        }

        return {
          ...tx,
          ...(nextAccountId ? { accountId: nextAccountId } : {}),
          ...(nextToAccountId ? { toAccountId: nextToAccountId } : {}),
          ...(nextCategoryId ? { categoryId: nextCategoryId } : {}),
          ...(nextOffsetId ? { offsetTransactionId: nextOffsetId } : {}),
          ...(nextLoanId ? { relatedLoanId: nextLoanId } : {}),
        };
      })
    : normalizedTransactions;

  return {
    changed: true,
    data: {
      ...data,
      accounts: mappedAccounts,
      categories: mappedCategories,
      transactions: mappedTransactions,
      plugins: data.plugins
        ? {
            ...data.plugins,
            data: normalizedPluginData,
          }
        : undefined,
    },
  };
}
