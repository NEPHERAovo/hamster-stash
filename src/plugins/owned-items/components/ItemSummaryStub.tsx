import React from 'react';
import { centsToYuan, getCategoryIcon, cn } from '../../../plugin-sdk';
import { isItemDisposed } from '../domain/itemCalculator';
import type { Item, ItemMetrics, ItemStatus } from '../types';

export interface ItemSummaryStubProps {
  item: Item;
  isSub: boolean;
  metrics: ItemMetrics;
  transactionCount: number;
}

function getPhysicalStatusLabel(status: ItemStatus): string {
  if (status === 'idle') return '闲置';
  if (status === 'sold') return '已出';
  if (status === 'scrapped') return '报废';
  if (status === 'gifted') return '已赠';
  return '在用';
}

function resolveStatusLabel(isSub: boolean, disposed: boolean, status: ItemStatus): string {
  if (isSub) {
    return disposed ? '已退' : '在订';
  }
  return getPhysicalStatusLabel(status);
}

function resolveStampColorClass(disposed: boolean, status: ItemStatus): string {
  if (disposed) return 'text-(--ink-tertiary)';
  if (status === 'idle') return 'text-(--ink-secondary)';
  return 'text-(--color-income)';
}

function resolveRecoveredTitle(status: ItemStatus): string {
  if (status === 'gifted') return '已赠';
  if (status === 'scrapped') return '报废';
  return '回款收益';
}

function formatCycle(cycle?: string): string {
  switch (cycle) {
    case 'monthly':
      return '按月';
    case 'yearly':
      return '按年';
    case 'quarterly':
      return '按季';
    case 'weekly':
      return '按周';
    default:
      return '';
  }
}

export const ItemSummaryStub: React.FC<ItemSummaryStubProps> = ({
  item,
  isSub,
  metrics,
  transactionCount,
}) => {
  const ItemIcon = getCategoryIcon(item.icon);
  const disposed = isItemDisposed(item.status);
  const statusLabel = resolveStatusLabel(isSub, disposed, item.status);
  const stampColorClass = resolveStampColorClass(disposed, item.status);
  const recoveredTitle = resolveRecoveredTitle(item.status);

  return (
    <div className="paper-summary-card paper-deckle-bottom relative border border-(--rule-hairline) bg-(--paper-sheet) pb-4 text-(--ink-solid) shadow-xs">
      <div className="washi-tape absolute -top-2.5 left-1/2 -translate-x-1/2 shadow-2xs" />

      <div className="space-y-3.5 p-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-(--radius-sm) bg-(--paper-sunken) text-(--ink-solid) shadow-2xs">
              <ItemIcon className="stroke-1.8 size-4.5" />
            </div>
            <div>
              <h2 className="text-base leading-snug font-bold text-(--ink-solid)">
                {item.name}
              </h2>
              <div className="mt-0.5 font-mono text-[10px] text-(--ink-tertiary)">
                {isSub
                  ? `${item.buyDate} 起订 · 订阅 ${metrics.holdingDays} 天`
                  : `${item.buyDate} 购入 · 已使用 ${metrics.holdingDays} 天`}
                {isSub && item.nextRenewalDate && ` · 下期 ${item.nextRenewalDate}`}
              </div>
            </div>
          </div>

          <div>
            <span className={cn('real-stamp text-[9px] select-none', stampColorClass)}>
              <span>{statusLabel}</span>
            </span>
          </div>
        </div>

        <div className="border-t border-dashed border-(--rule-hairline) pt-2">
          <div className="font-mono text-[10px] text-(--ink-tertiary)">日均成本</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="font-mono text-3xl font-bold tracking-tight text-(--color-income) tabular-nums sm:text-4xl">
              ¥{centsToYuan(metrics.dailyCost)}
            </span>
            <span className="font-mono text-xs text-(--ink-tertiary)">/天</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 border-t border-dashed border-(--rule-hairline) pt-2 text-center">
          <div>
            <div className="font-mono text-[9px] text-(--ink-tertiary)">
              {isSub ? '累计支出' : '累计投入'}
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-(--ink-solid) tabular-nums">
              ¥{centsToYuan(metrics.grossCost)}
            </div>
          </div>

          {isSub ? (
            <div>
              <div className="font-mono text-[9px] text-(--ink-tertiary)">续费周期</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-(--ink-primary)">
                {formatCycle(item.billingCycle) || '按月'}
              </div>
            </div>
          ) : (
            <div>
              <div className="font-mono text-[9px] text-(--ink-tertiary)">{recoveredTitle}</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-(--color-income) tabular-nums">
                ¥{centsToYuan(metrics.recoveredAmount)}
              </div>
            </div>
          )}

          {isSub ? (
            <div>
              <div className="font-mono text-[9px] text-(--ink-tertiary)">续费金额</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-(--ink-solid) tabular-nums">
                {item.renewalAmountCents ? `¥${centsToYuan(item.renewalAmountCents)}` : '-'}
              </div>
            </div>
          ) : (
            <div>
              <div className="font-mono text-[9px] text-(--ink-tertiary)">净支出</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-(--ink-solid) tabular-nums">
                ¥{centsToYuan(metrics.netCost)}
              </div>
            </div>
          )}

          {isSub ? (
            <div>
              <div className="font-mono text-[9px] text-(--ink-tertiary)">扣费笔数</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-(--color-income) tabular-nums">
                {transactionCount}笔
              </div>
            </div>
          ) : (
            <div>
              <div className="font-mono text-[9px] text-(--ink-tertiary)">保值率</div>
              <div className="mt-0.5 font-mono text-xs font-bold text-(--color-income) tabular-nums">
                {metrics.recoveredAmount > 0 && metrics.retentionRate !== null
                  ? `${metrics.retentionRate}%`
                  : '-'}
              </div>
            </div>
          )}
        </div>

        {item.note && (
          <div className="border-t border-dashed border-(--rule-hairline)/70 pt-2 text-[11px] text-(--ink-secondary) italic">
            “{item.note}”
          </div>
        )}
      </div>
    </div>
  );
};
