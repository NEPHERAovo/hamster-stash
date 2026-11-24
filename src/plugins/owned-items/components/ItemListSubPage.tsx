import React, { useState, useMemo } from 'react';
import { CaretLeftIcon as ChevronLeft, PlusIcon as Plus, PackageIcon as Package } from '@phosphor-icons/react';
import {
  useHostTransactions,
  usePluginNavigation,
  centsToYuan,
  getCategoryIcon,
  cn,
  PaperIconButton,
  SegToggle,
} from '../../../plugin-sdk';
import type { Item } from '../types';
import { usePluginItemStore } from '../store/usePluginItemStore';
import {
  computeItemMetrics,
  computeOverallItemMetrics,
} from '../domain/itemCalculator';

export interface ItemListSubPageProps {
  onClose?: () => void;
  params?: Record<string, unknown>;
}

type FilterTab = 'using' | 'sold' | 'all';
type KindTab = 'all' | 'physical' | 'subscription';

export const ItemListSubPage: React.FC<ItemListSubPageProps> = ({ onClose }) => {
  const items = usePluginItemStore((s) => s.items);
  const transactions = useHostTransactions();
  const { openSubPage, openModal } = usePluginNavigation();

  const [activeTab, setActiveTab] = useState<FilterTab>('using');
  const [kindFilter, setKindFilter] = useState<KindTab>('all');

  const overallSummary = useMemo(() => {
    const soldItems = items.filter((i) => i.status === 'sold' || i.status === 'scrapped' || i.status === 'gifted');

    const m = computeOverallItemMetrics(items, transactions);
    return {
      ...m,
      soldCount: soldItems.length,
      totalCount: items.length,
    };
  }, [items, transactions]);

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      const matchKind =
        kindFilter === 'all' ||
        (kindFilter === 'physical' && (!i.kind || i.kind === 'physical')) ||
        (kindFilter === 'subscription' && i.kind === 'subscription');

      if (!matchKind) return false;

      const isEnded = i.status === 'sold' || i.status === 'scrapped' || i.status === 'gifted';
      if (activeTab === 'all') return true;
      if (activeTab === 'sold') return isEnded;
      return !isEnded;
    });
  }, [items, activeTab, kindFilter]);

  const getStatusStamp = (item: Item) => {
    const isSub = item.kind === 'subscription';
    if (item.status === 'sold') {
      return (
        <span className="real-stamp text-[9px] text-(--ink-tertiary) select-none">
          <span>{isSub ? '已退' : '已出'}</span>
        </span>
      );
    }
    if (item.status === 'gifted') {
      return (
        <span className="real-stamp text-[9px] text-(--color-income) select-none">
          <span>已转赠</span>
        </span>
      );
    }
    if (item.status === 'scrapped') {
      return (
        <span className="real-stamp text-[9px] text-(--color-expense) select-none">
          <span>已报废</span>
        </span>
      );
    }
    return (
      <span className="real-stamp text-[9px] text-(--color-income) select-none">
        <span>{isSub ? '在订' : '在用'}</span>
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
      {onClose && (
        <div className="sticky top-0 z-30 box-border flex min-h-[calc(3rem+var(--safe-top))] items-center justify-between border-b border-(--rule-hairline) bg-(--paper-base) px-4.5 pt-[calc(0.25rem+var(--safe-top))] pb-1">
          <div className="flex items-center gap-2">
            <PaperIconButton
              icon={ChevronLeft}
              size="md"
              variant="surface"
              onClick={onClose}
              aria-label="返回"
            />
            <div>
              <h1 className="mt-0.5 font-serif text-2xl leading-none text-(--ink-solid) not-italic sm:text-[28px]">
                <span className="paper-title inline">Items</span>
                <span className="modern-title hidden">物品</span>
              </h1>
            </div>
          </div>
        </div>
      )}

      <div className={cn('space-y-3.5 px-4', onClose ? 'pt-3' : 'pt-2')}>
        <div className="tab-stagger-1 paper-summary-card paper-deckle-bottom relative border border-(--rule-hairline) bg-(--paper-sheet) pb-4 text-(--ink-solid) shadow-xs">
          <div className="washi-tape absolute -top-2.5 left-1/2 -translate-x-1/2 shadow-2xs" />

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
        </div>

        <div className="tab-stagger-2 w-full space-y-3">
          <div className="no-scrollbar flex items-center justify-between gap-2 overflow-x-auto border-b border-(--rule-hairline) pb-2.5 font-mono text-xs">
            <SegToggle
              options={[
                { value: 'all', label: '全部' },
                { value: 'physical', label: '物品' },
                { value: 'subscription', label: '订阅' },
              ]}
              value={kindFilter}
              onChange={(val) => setKindFilter(val as KindTab)}
              size="sm"
              fullWidth={false}
            />

            <SegToggle
              options={[
                { value: 'using', label: `在用 (${overallSummary.usingCount})` },
                { value: 'sold', label: `已出 (${overallSummary.soldCount})` },
                { value: 'all', label: `全部 (${overallSummary.totalCount})` },
              ]}
              value={activeTab}
              onChange={(val) => setActiveTab(val as FilterTab)}
              size="sm"
              fullWidth={false}
            />
          </div>

          {filteredItems.length > 0 ? (
            <div className="space-y-2.5">
              {filteredItems.map((item) => {
                const metrics = computeItemMetrics(item, transactions);
                const IconComp = getCategoryIcon(item.icon);
                const isSub = item.kind === 'subscription';

                return (
                  <div
                    key={item.id}
                    onClick={() => openSubPage('item-detail', { itemId: item.id })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openSubPage('item-detail', { itemId: item.id });
                      }
                    }}
                    className={cn(
                      'paper-card w-full rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) text-(--ink-solid)',
                      'cursor-pointer p-3.5 shadow-xs transition-all',
                      'active:scale-0.995 relative hover:border-(--rule-strong)'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex size-6.5 shrink-0 items-center justify-center rounded-(--radius-sm) bg-(--paper-sunken) text-(--ink-secondary)">
                          <IconComp className="stroke-1.8 size-4" />
                        </div>
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
                  </div>
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

      {onClose && (
        <div className="fixed right-6 bottom-6 z-50">
          <PaperIconButton
            icon={Plus}
            size="lg"
            variant="primary"
            onClick={() => openModal('item-form')}
            title="新建物品"
            aria-label="新建物品"
          />
        </div>
      )}
    </div>
  );
};
