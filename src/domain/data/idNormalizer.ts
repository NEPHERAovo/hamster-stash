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

function deriveIdFromImportMeta(meta: Record<string, unknown>): string | null {
  const source = typeof meta.source === 'string' ? meta.source.trim() : '';
  const orderId = typeof meta.orderId === 'string' ? meta.orderId.trim() : '';
  const kind = typeof meta.kind === 'string' ? meta.kind.trim() : '';
  if (!source) return null;

  if (kind === 'wealth_monthly' && orderId.startsWith('wealth:')) {
    const [, yearMonth = '', ...rest] = orderId.split(':');
    const shortSrc = source === 'wechat' ? 'wx' : 'ali';
    return `wealth_${shortSrc}_${yearMonth}_${hashString8(rest.join(':').trim() || '理财账户')}`;
  }
  if (orderId.startsWith('fp:')) return `csv_${source}_${orderId.slice(3)}`;
  if (!orderId) return null;

  let prefix = `csv_${source}`;
  if (source === 'wechat') prefix = 'wx';
  else if (source === 'alipay') prefix = 'ali';
  return `${prefix}_${SAFE_ORDER_ID_RE.test(orderId) ? orderId : hashString16(orderId)}`;
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
  const pluginRes = normalizeSimpleCollection<StoredEntity>(
    (data.plugins?.data || []) as StoredEntity[],
    (id) => Boolean(id && String(id).trim()),
    'pd',
    (entry) => JSON.stringify(entry)
  );

  const txIdMap = new Map<string, string>();
  const usedTxIds = new Set<string>();
  const txOccurrence = new Map<string, number>();
  for (const tx of data.transactions || []) {
    if (isCanonicalTransactionId(tx.id)) usedTxIds.add(tx.id);
  }

  let txChanged = false;
  const normalizedTxs = (data.transactions || []).map((tx) => {
    const rawExt = tx.ext as Record<string, unknown> | undefined;
    const hasMeta = Boolean(rawExt && typeof rawExt === 'object' && 'importMeta' in rawExt);
    const idValid = isCanonicalTransactionId(tx.id);
    if (idValid && !hasMeta) return tx;

    txChanged = true;
    let newId = tx.id;
    const metaObj =
      hasMeta && typeof rawExt?.importMeta === 'object' && rawExt.importMeta !== null
        ? (rawExt.importMeta as Record<string, unknown>)
        : undefined;

    if (!idValid) {
      const candidate = metaObj ? deriveIdFromImportMeta(metaObj) : null;
      if (candidate && !usedTxIds.has(candidate)) {
        usedTxIds.add(candidate);
        newId = candidate;
      } else {
        const base = candidate
          ? `${candidate}|${tx.date}|${tx.amount}|${tx.createdAt || ''}`
          : [tx.type, tx.amount, tx.date, tx.createdAt || '', tx.accountId, tx.categoryId, tx.note || ''].join('|');
        newId = allocateDeterministicId('tx', base, txOccurrence, usedTxIds);
      }
      if (tx.id) txIdMap.set(tx.id, newId);
    }

    const updated: Transaction = { ...tx, id: newId };
    if (hasMeta && rawExt) {
      const rest = { ...rawExt };
      delete rest.importMeta;
      if (Object.keys(rest).length > 0) updated.ext = rest;
      else delete updated.ext;
    }
    return updated;
  });

  if (!acctRes.changed && !catRes.changed && !pluginRes.changed && !txChanged) {
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
    acctRes.idMap.size || catRes.idMap.size || txIdMap.size
      ? normalizedTxs.map((tx) => ({
          ...tx,
          accountId: mapId(acctRes.idMap, tx.accountId)!,
          categoryId: mapId(catRes.idMap, tx.categoryId)!,
          ...(tx.toAccountId ? { toAccountId: mapId(acctRes.idMap, tx.toAccountId) } : {}),
          ...(tx.offsetTransactionId ? { offsetTransactionId: mapId(txIdMap, tx.offsetTransactionId) } : {}),
          ...(tx.relatedLoanId ? { relatedLoanId: mapId(txIdMap, tx.relatedLoanId) } : {}),
        }))
      : normalizedTxs;

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
