import React, { useState, useMemo } from 'react';
import { PackageIcon as Package } from '@phosphor-icons/react';
import {
  useHostTransactions,
  usePluginNavigation,
  centsToYuan,
  cn,
  IconBadge,
  PaperCard,
  PaperSummaryCard,
  PaperSelect,
  type PaperSelectOption,
  SegToggle,
} from '../../../plugin-sdk';
import type { Item, ItemSortOption, ItemStatus } from '../types';
import { usePluginItemStore } from '../store/usePluginItemStore';
import {
  buildItemMetricsMap,
  computeItemMetrics,
  computeOverallItemMetrics,
  isItemDisposed,
  sortItems,
} from '../domain/itemCalculator';

type FilterTab = 'using' | 'sold' | 'all';
type KindTab = 'all' | 'physical' | 'subscription';

const SORT_OPTIONS: PaperSelectOption[] = [
  { value: 'date-desc', label: '按时间 · 从新到旧', shortLabel: '时间 ↓' },
  { value: 'date-asc', label: '按时间 · 从旧到新', shortLabel: '时间 ↑' },
  { value: 'cost-desc', label: '按费用 · 从高到低', shortLabel: '费用 ↓' },
  { value: 'cost-asc', label: '按费用 · 从低到高', shortLabel: '费用 ↑' },
  { value: 'daily-desc', label: '按日均 · 从高到低', shortLabel: '日均 ↓' },
  { value: 'daily-asc', label: '按日均 · 从低到高', shortLabel: '日均 ↑' },
];

export const ItemListSubPage: React.FC = () => {
  const items = usePluginItemStore((s) => s.items);
  const sortOption = usePluginItemStore((s) => s.sortOption);
  const setSortOption = usePluginItemStore((s) => s.setSortOption);
  const transactions = useHostTransactions();
  const { openSubPage } = usePluginNavigation();

  const [activeTab, setActiveTab] = useState<FilterTab>('using');
  const [kindFilter, setKindFilter] = useState<KindTab>('all');

  const metricsMap = useMemo(() => {
    return buildItemMetricsMap(items, transactions);
  }, [items, transactions]);

  const overallSummary = useMemo(() => {
    const soldItems = items.filter((i) => isItemDisposed(i.status));

    const m = computeOverallItemMetrics(items, transactions, metricsMap);
    return {
      ...m,
      soldCount: soldItems.length,
      totalCount: items.length,
    };
  }, [items, transactions, metricsMap]);

  const filteredItems = useMemo(() => {
    const filtered = items.filter((i) => {
      const matchKind =
        kindFilter === 'all' ||
        (kindFilter === 'physical' && (!i.kind || i.kind === 'physical')) ||
        (kindFilter === 'subscription' && i.kind === 'subscription');

      if (!matchKind) return false;

      if (activeTab === 'all') return true;
      if (activeTab === 'sold') return isItemDisposed(i.status);
      return !isItemDisposed(i.status);
    });
    return sortItems(filtered, metricsMap, sortOption);
  }, [items, activeTab, kindFilter, metricsMap, sortOption]);

  const getPhysicalStatusLabel = (status: ItemStatus): string => {
    if (status === 'idle') return '闲置';
    if (status === 'sold') return '已出';
    if (status === 'scrapped') return '报废';
    if (status === 'gifted') return '已赠';
    return '在用';
  };

  const getStatusStamp = (item: Item) => {
    const isSub = item.kind === 'subscription';
    const disposed = isItemDisposed(item.status);
    if (disposed) {
      return (
        <span className="real-stamp text-[9px] text-(--ink-tertiary) select-none">
          <span>{isSub ? '已退' : getPhysicalStatusLabel(item.status)}</span>
        </span>
      );
    }
    const label = isSub ? '在订' : getPhysicalStatusLabel(item.status);
    const colorClass = item.status === 'idle' ? 'text-(--ink-secondary)' : 'text-(--color-income)';
    return (
      <span className={cn('real-stamp text-[9px] select-none', colorClass)}>
        <span>{label}</span>
      </span>
    );
  };

  const formatCycle = (cycle?: string) => {
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
  };

  return (
    <div className="w-full pb-20 select-none">
      <div className="space-y-3.5 px-4 pt-2">
        <PaperSummaryCard className="tab-stagger-1 pb-4">
          <div className="space-y-3 p-4 pt-4.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-medium text-(--ink-tertiary)">
                总览
              </span>
              <div className="flex items-center gap-2 font-mono text-[11px] text-(--ink-secondary)">
                <span>物品 {overallSummary.physicalCount || 0}</span>
                <span>·</span>
                <span>订阅 {overallSummary.subscriptionCount || 0}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-dashed divide-(--rule-hairline) pt-1">
              <div>
                <div className="font-mono text-[10px] text-(--ink-tertiary)">日均成本</div>
                <div className="mt-0.5 font-mono text-xl font-bold text-(--color-income) tabular-nums sm:text-2xl">
                  ¥{centsToYuan(overallSummary.totalUsingDailyCost)}
                  <span className="ml-0.5 text-xs font-normal text-(--ink-tertiary)">/天</span>
                </div>
              </div>

              <div className="pl-4">
                <div className="font-mono text-[10px] text-(--ink-tertiary)">总投入</div>
                <div className="mt-0.5 font-mono text-xl font-bold text-(--ink-solid) tabular-nums sm:text-2xl">
                  ¥{centsToYuan(overallSummary.totalUsingNetCost)}
                </div>
              </div>
            </div>
          </div>
        </PaperSummaryCard>

        <div className="tab-stagger-2 w-full space-y-3">
          <div className="no-scrollbar flex items-center justify-between gap-1.5 overflow-x-auto border-b border-(--rule-hairline) pb-2.5">
            <SegToggle
              options={[
                { value: 'all', label: '全部' },
                { value: 'physical', label: '物品' },
                { value: 'subscription', label: '订阅' },
              ]}
              value={kindFilter}
              onChange={(val) => setKindFilter(val as KindTab)}
              size="xs"
              fullWidth={false}
            />

            <SegToggle
              options={[
                { value: 'using', label: '在用', count: overallSummary.usingCount },
                { value: 'sold', label: '已出', count: overallSummary.soldCount },
                { value: 'all', label: '全部', count: overallSummary.totalCount },
              ]}
              value={activeTab}
              onChange={(val) => setActiveTab(val as FilterTab)}
              size="xs"
              fullWidth={false}
            />

            <PaperSelect
              aria-label="排序方式"
              size="xs"
              variant="sunken"
              popupAlign="right"
              popupMinWidth={168}
              containerClassName="w-auto shrink-0"
              options={SORT_OPTIONS}
              value={sortOption}
              onChange={(_, val) => {
                if (val) setSortOption(val as ItemSortOption);
              }}
            />
          </div>

          {filteredItems.length > 0 ? (
            <div className="space-y-2.5">
              {filteredItems.map((item) => {
                const metrics = metricsMap.get(item.id) ?? computeItemMetrics(item, transactions);
                const isSub = item.kind === 'subscription';

                return (
                  <PaperCard
                    key={item.id}
                    rounded="md"
                    interactive
                    onClick={() => openSubPage('item-detail', { itemId: item.id })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openSubPage('item-detail', { itemId: item.id });
                      }
                    }}
                    className="active:scale-0.995 relative w-full p-3.5 shadow-xs hover:border-(--rule-strong)"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <IconBadge icon={item.icon} size="md" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate text-sm leading-snug font-semibold text-(--ink-solid)">
                              {item.name}
                            </span>
                            {isSub && (
                              <span className="py-0.2 rounded-full border border-(--rule-hairline) bg-(--paper-sunken) px-1.5 font-mono text-[9px] text-(--ink-tertiary)">
                                {formatCycle(item.billingCycle) || '订阅'}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-(--ink-tertiary)">
                            {isSub ? `${item.buyDate} 起订 · 订阅 ${metrics.holdingDays} 天` : `${item.buyDate} 购入 · 已使用 ${metrics.holdingDays} 天`}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pt-0.5">
                        {getStatusStamp(item)}
                      </div>
                    </div>

                    <div className="my-2.5 border-t border-dashed border-(--rule-hairline)" />

                    <div className="flex items-center justify-between font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-(--ink-tertiary)">日均成本 </span>
                        <span className="text-sm font-bold text-(--color-income) tabular-nums">
                          ¥{centsToYuan(metrics.dailyCost)}
                        </span>
                        <span className="text-[10px] text-(--ink-tertiary)">/天</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-(--ink-tertiary)">
                          {item.status === 'sold' ? '售出回款 ' : '累计投入 '}
                        </span>
                        <span className="font-bold text-(--ink-primary) tabular-nums">
                          ¥{centsToYuan(item.status === 'sold' ? metrics.recoveredAmount : metrics.grossCost)}
                        </span>
                        {item.status === 'sold' && metrics.retentionRate !== null && metrics.retentionRate > 0 && (
                          <span className="ml-1 text-[10px] font-semibold text-(--color-income)">
                            ({metrics.retentionRate}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </PaperCard>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 py-12 text-center text-xs text-(--ink-tertiary)">
              <Package className="stroke-1.2 mx-auto size-8 text-(--ink-tertiary) opacity-40" />
              <p>暂无记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
