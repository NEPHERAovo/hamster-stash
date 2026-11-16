export type ItemStatus = 'using' | 'idle' | 'sold' | 'scrapped';

export type ItemRole = 'buy' | 'maintenance' | 'sell';

export interface Item {
  id: string;
  name: string;
  icon: string;
  status: ItemStatus;
  buyDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (售出或报废日期)
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemMetrics {
  grossCost: number; // 购入+维护累计支出 (分)
  recoveredAmount: number; // 售出回血收入 (分)
  netCost: number; // 净持有成本 = grossCost - recoveredAmount (分)
  holdingDays: number; // 持有天数 (>= 1)
  dailyCost: number; // 日均持有成本 = netCost / holdingDays (分/天)
  retentionRate: number | null; // 保值率百分比: (recoveredAmount / grossCost) * 100
}

export interface OverallItemMetrics {
  usingCount: number;
  totalUsingNetCost: number; // 在用物品总投入 (分)
  totalUsingDailyCost: number; // 在用物品总日均 (分/天)
}

export interface OwnedItemTxExt {
  itemId?: string;
  itemRole?: ItemRole;
  createNewItem?: boolean;
  isTrayOpen?: boolean;
}

export function getOwnedItemExt(ext?: Record<string, unknown>): OwnedItemTxExt | undefined {
  return ext?.['owned-items'] as OwnedItemTxExt | undefined;
}
