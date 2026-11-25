import type { Transaction } from '../../../plugin-sdk';
import {
  type Item,
  type ItemMetrics,
  type ItemSortOption,
  type ItemStatus,
  type OverallItemMetrics,
  getOwnedItemExt,
} from '../types';

export function isItemDisposed(status: ItemStatus): boolean {
  return status === 'sold' || status === 'scrapped' || status === 'gifted';
}

function parseDateUtc(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function calculateHoldingDays(buyDate: string, endDate?: string): number {
  if (!buyDate) return 1;
  const startMs = parseDateUtc(buyDate);
  const endMs = endDate
    ? parseDateUtc(endDate)
    : (() => {
        const now = new Date();
        return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      })();

  const diffDays = Math.floor((endMs - startMs) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

function computeMetricsForTransactions(item: Item, itemTxs: Transaction[]): ItemMetrics {
  let grossCost = 0;
  let recoveredAmount = 0;

  for (const tx of itemTxs) {
    const role = getOwnedItemExt(tx.ext)?.itemRole;

    if (tx.type === 'income' && (role === 'sell' || role === 'profit' || !role)) {
      recoveredAmount += tx.amount;
    } else {
      grossCost += tx.amount;
    }
  }

  const isSubscription = item.kind === 'subscription';
  const effectiveRecovered = isSubscription ? 0 : recoveredAmount;
  const netCost = isSubscription ? grossCost : grossCost - effectiveRecovered;
  const holdingDays = calculateHoldingDays(item.buyDate, item.endDate);
  const dailyCost = Math.max(0, Math.round(netCost / holdingDays));

  let retentionRate: number | null = null;
  if (!isSubscription && grossCost > 0 && effectiveRecovered > 0) {
    retentionRate = Math.round((effectiveRecovered / grossCost) * 100);
  }

  return {
    grossCost,
    recoveredAmount: effectiveRecovered,
    netCost,
    holdingDays,
    dailyCost,
    retentionRate,
  };
}

export function computeItemMetrics(item: Item, transactions: Transaction[]): ItemMetrics {
  const itemTxs = transactions.filter((t) => getOwnedItemExt(t.ext)?.itemId === item.id);
  return computeMetricsForTransactions(item, itemTxs);
}

export function buildItemMetricsMap(
  items: Item[],
  transactions: Transaction[]
): Map<string, ItemMetrics> {
  const grouped = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const itemId = getOwnedItemExt(tx.ext)?.itemId;
    if (!itemId) continue;
    const list = grouped.get(itemId);
    if (list) {
      list.push(tx);
    } else {
      grouped.set(itemId, [tx]);
    }
  }

  const metricsMap = new Map<string, ItemMetrics>();
  for (const item of items) {
    metricsMap.set(item.id, computeMetricsForTransactions(item, grouped.get(item.id) || []));
  }
  return metricsMap;
}

function compareByDateDesc(a: Item, b: Item): number {
  const dateDiff = (b.buyDate || '').localeCompare(a.buyDate || '');
  if (dateDiff !== 0) return dateDiff;
  const createdDiff = (b.createdAt || '').localeCompare(a.createdAt || '');
  if (createdDiff !== 0) return createdDiff;
  return b.id.localeCompare(a.id);
}

export function sortItems(
  items: Item[],
  metricsMap: Map<string, ItemMetrics>,
  sortOption: ItemSortOption
): Item[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (sortOption === 'date-desc') {
      return compareByDateDesc(a, b);
    }
    if (sortOption === 'date-asc') {
      return -compareByDateDesc(a, b);
    }

    const metricsA = metricsMap.get(a.id);
    const metricsB = metricsMap.get(b.id);
    const valA = sortOption.startsWith('cost-')
      ? (metricsA?.grossCost ?? 0)
      : (metricsA?.dailyCost ?? 0);
    const valB = sortOption.startsWith('cost-')
      ? (metricsB?.grossCost ?? 0)
      : (metricsB?.dailyCost ?? 0);

    if (valA !== valB) {
      return sortOption.endsWith('-desc') ? valB - valA : valA - valB;
    }
    return compareByDateDesc(a, b);
  });
  return sorted;
}

export function computeOverallItemMetrics(
  items: Item[],
  transactions: Transaction[],
  metricsMap?: Map<string, ItemMetrics>
): OverallItemMetrics {
  const activeItems = items.filter((i) => !isItemDisposed(i.status));

  let totalUsingNetCost = 0;
  let totalUsingDailyCost = 0;
  let physicalCount = 0;
  let subscriptionCount = 0;

  for (const item of activeItems) {
    const m = metricsMap?.get(item.id) ?? computeItemMetrics(item, transactions);
    totalUsingNetCost += m.netCost;
    totalUsingDailyCost += m.dailyCost;
    if (item.kind === 'subscription') {
      subscriptionCount += 1;
    } else {
      physicalCount += 1;
    }
  }

  return {
    usingCount: activeItems.length,
    totalUsingNetCost,
    totalUsingDailyCost,
    physicalCount,
    subscriptionCount,
  };
}
