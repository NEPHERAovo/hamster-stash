export type ItemStatus = 'using' | 'idle' | 'sold' | 'gifted' | 'scrapped';

export type ItemKind = 'physical' | 'subscription';

export type SubscriptionCycle = 'monthly' | 'yearly' | 'weekly' | 'quarterly';

export type ItemRole = 'buy' | 'maintenance' | 'sell' | 'profit';

export interface Item {
  id: string;
  name: string;
  icon: string;
  kind?: ItemKind;
  status: ItemStatus;
  buyDate: string;
  endDate?: string;
  billingCycle?: SubscriptionCycle;
  renewalAmountCents?: number;
  nextRenewalDate?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemMetrics {
  grossCost: number;
  recoveredAmount: number;
  netCost: number;
  holdingDays: number;
  dailyCost: number;
  retentionRate: number | null;
}

export interface OverallItemMetrics {
  usingCount: number;
  totalUsingNetCost: number;
  totalUsingDailyCost: number;
  physicalCount?: number;
  subscriptionCount?: number;
}

export interface OwnedItemTxExt {
  itemId?: string;
  itemRole?: ItemRole;
  kind?: ItemKind;
  createNewItem?: boolean;
  isTrayOpen?: boolean;
}

export function getOwnedItemExt(ext?: Record<string, unknown>): OwnedItemTxExt | undefined {
  return ext?.['owned-items'] as OwnedItemTxExt | undefined;
}
