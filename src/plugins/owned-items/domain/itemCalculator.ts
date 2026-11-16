import type { Transaction } from '../../../plugin-sdk';
import { type Item, type ItemMetrics, type OverallItemMetrics, getOwnedItemExt } from '../types';

/**
 * 解析 YYYY-MM-DD 为 UTC 毫秒时间戳（消除时区偏差）
 */
function parseDateUtc(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * 计算持有天数（闭区间，买入当天计为 1 天）
 */
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

/**
 * 计算单件物品的财务度量指标
 */
export function computeItemMetrics(item: Item, transactions: Transaction[]): ItemMetrics {
  const itemTxs = transactions.filter((t) => {
    return getOwnedItemExt(t.ext)?.itemId === item.id;
  });

  let grossCost = 0;
  let recoveredAmount = 0;

  for (const tx of itemTxs) {
    const role = getOwnedItemExt(tx.ext)?.itemRole;

    if (role === 'sell' || tx.type === 'income') {
      recoveredAmount += tx.amount;
    } else {
      grossCost += tx.amount;
    }
  }

  const netCost = grossCost - recoveredAmount;
  const holdingDays = calculateHoldingDays(item.buyDate, item.endDate);
  const dailyCost = Math.round(netCost / holdingDays);

  let retentionRate: number | null = null;
  if (grossCost > 0 && recoveredAmount > 0) {
    retentionRate = Math.round((recoveredAmount / grossCost) * 100);
  }

  return {
    grossCost,
    recoveredAmount,
    netCost,
    holdingDays,
    dailyCost,
    retentionRate,
  };
}

/**
 * 计算所有在用物品的宏观汇总指标
 */
export function computeOverallItemMetrics(
  items: Item[],
  transactions: Transaction[]
): OverallItemMetrics {
  const usingItems = items.filter((i) => i.status === 'using');

  let totalUsingNetCost = 0;
  let totalUsingDailyCost = 0;

  for (const item of usingItems) {
    const m = computeItemMetrics(item, transactions);
    totalUsingNetCost += m.netCost;
    totalUsingDailyCost += m.dailyCost;
  }

  return {
    usingCount: usingItems.length,
    totalUsingNetCost,
    totalUsingDailyCost,
  };
}
