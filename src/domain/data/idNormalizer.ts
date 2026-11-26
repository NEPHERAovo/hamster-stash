import type { Account } from '../../types/account';
import type { Category } from '../../types/category';
import type { ExportData, StoredEntity } from '../../types/adapter';
import type { Transaction } from '../../types/transaction';
import { hashString16 } from '../../utils/hash';

const CANONICAL_TX_PREFIX_RE = /^(?:tx|wx|ali|wealth|csv)_.+/;

export function isCanonicalAccountId(id?: string): boolean {
  return Boolean(id && id.startsWith('acct_') && id.length > 5);
}

export function isCanonicalCategoryId(id?: string): boolean {
  return Boolean(id && id.startsWith('cat_') && id.length > 4);
}

export function isCanonicalTransactionId(id?: string): boolean {
  return Boolean(id && CANONICAL_TX_PREFIX_RE.test(id));
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

function normalizeSimpleCollection<T extends { id?: string }>(
  items: T[],
  isValid: (id?: string) => boolean,
  prefix: string,
  buildPayload: (item: T) => string
): { items: T[]; idMap: Map<string, string>; changed: boolean } {
  const usedIds = new Set<string>();
  const occurrenceMap = new Map<string, number>();
  const idMap = new Map<string, string>();
  let changed = false;

  for (const item of items) {
    if (isValid(item.id)) usedIds.add(item.id!);
  }

  const nextItems = items.map((item) => {
    if (isValid(item.id)) return item;
    changed = true;
    const newId = allocateDeterministicId(prefix, buildPayload(item), occurrenceMap, usedIds);
    if (item.id) idMap.set(item.id, newId);
    return { ...item, id: newId };
  });

  return { items: nextItems, idMap, changed };
}

export function normalizeDataIds(data: ExportData): { data: ExportData; changed: boolean } {
  const acctRes = normalizeSimpleCollection<Account>(
    data.accounts || [],
    isCanonicalAccountId,
    'acct',
    (a) => [a.name, a.type, a.currency || 'CNY'].join('|')
  );
  const catRes = normalizeSimpleCollection<Category>(
    data.categories || [],
    isCanonicalCategoryId,
    'cat',
    (c) => [c.name, c.type].join('|')
  );
  const txRes = normalizeSimpleCollection<Transaction>(
    data.transactions || [],
    isCanonicalTransactionId,
    'tx',
    (tx) => [tx.type, tx.amount, tx.date, tx.createdAt || '', tx.accountId, tx.categoryId, tx.note || ''].join('|')
  );
  const pluginRes = normalizeSimpleCollection<StoredEntity>(
    (data.plugins?.data || []) as StoredEntity[],
    (id) => Boolean(id && String(id).trim()),
    'pd',
    (entry) => JSON.stringify(entry)
  );

  if (!acctRes.changed && !catRes.changed && !txRes.changed && !pluginRes.changed) {
    return { data, changed: false };
  }

  const mapId = (map: Map<string, string>, id?: string) => (id ? map.get(id) ?? id : id);
  const mappedAccounts = acctRes.idMap.size
    ? acctRes.items.map((a) =>
        a.repaymentAccountId ? { ...a, repaymentAccountId: mapId(acctRes.idMap, a.repaymentAccountId) } : a
      )
    : acctRes.items;
  const mappedCategories = catRes.idMap.size
    ? catRes.items.map((c) => (c.parentId ? { ...c, parentId: mapId(catRes.idMap, c.parentId) } : c))
    : catRes.items;
  const mappedTxs =
    acctRes.idMap.size || catRes.idMap.size || txRes.idMap.size
      ? txRes.items.map((tx) => ({
          ...tx,
          accountId: mapId(acctRes.idMap, tx.accountId)!,
          categoryId: mapId(catRes.idMap, tx.categoryId)!,
          ...(tx.toAccountId ? { toAccountId: mapId(acctRes.idMap, tx.toAccountId) } : {}),
          ...(tx.offsetTransactionId ? { offsetTransactionId: mapId(txRes.idMap, tx.offsetTransactionId) } : {}),
          ...(tx.relatedLoanId ? { relatedLoanId: mapId(txRes.idMap, tx.relatedLoanId) } : {}),
        }))
      : txRes.items;

  return {
    changed: true,
    data: {
      ...data,
      accounts: mappedAccounts,
      categories: mappedCategories,
      transactions: mappedTxs,
      plugins: data.plugins ? { ...data.plugins, data: pluginRes.items } : undefined,
    },
  };
}
