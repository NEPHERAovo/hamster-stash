import React, { useState, useMemo } from 'react';
import { ChevronLeft, Plus, Package } from 'lucide-react';
import {
  useHostTransactions,
  usePluginNavigation,
  centsToYuan,
  getCategoryIcon,
  cn,
} from '../../../plugin-sdk';
import type { ItemStatus } from '../types';
import { usePluginItemStore } from '../store/usePluginItemStore';
import {
  computeItemMetrics,
  computeOverallItemMetrics,
} from '../domain/itemCalculator';

export interface ItemListSubPageProps {
  onClose?: () => void;
  params?: Record<string, unknown>;
}

type FilterTab = 'using' | 'idle' | 'sold' | 'all';

export const ItemListSubPage: React.FC<ItemListSubPageProps> = ({ onClose }) => {
  const items = usePluginItemStore((s) => s.items);
  const transactions = useHostTransactions();
  const { openSubPage, openModal } = usePluginNavigation();

  const [activeTab, setActiveTab] = useState<FilterTab>('using');

  const overallSummary = useMemo(() => {
    const idleItems = items.filter((i) => i.status === 'idle');
    const soldItems = items.filter((i) => i.status === 'sold');

    const m = computeOverallItemMetrics(items, transactions);
    return {
      ...m,
      idleCount: idleItems.length,
      soldCount: soldItems.length,
      totalCount: items.length,
    };
  }, [items, transactions]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return items;
    return items.filter((i) => i.status === activeTab);
  }, [items, activeTab]);

  const getStatusStamp = (status: ItemStatus) => {
    switch (status) {
      case 'using':
        return (
          <span className="real-stamp text-(--color-income) -rotate-2 select-none text-[9px]">
            USING
          </span>
        );
      case 'idle':
        return (
          <span className="real-stamp text-(--color-accent) rotate-1 select-none text-[9px]">
            IDLE
          </span>
        );
      case 'sold':
        return (
          <span className="real-stamp text-(--stamp-red) -rotate-3 select-none text-[9px]">
            SOLD
          </span>
        );
      case 'scrapped':
        return (
          <span className="real-stamp text-(--ink-primary) rotate-2 select-none text-[9px]">
            SCRAP
          </span>
        );
    }
  };

  return (
    <div className="w-full pb-20 animate-fade-in select-none">
      {onClose && (
        <div className="sticky top-0 z-30 px-4.5 pt-2.5 pb-2 bg-(--paper-base)/90 backdrop-blur-md border-b border-(--rule-hairline) flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-[2px] bg-(--paper-sheet) border border-(--rule-hairline) flex items-center justify-center text-(--ink-secondary) hover:text-(--ink-solid) active:scale-95 transition-all cursor-pointer shadow-2xs"
              aria-label="返回"
            >
              <ChevronLeft className="w-4 h-4 stroke-2" />
            </button>
            <div>
              <h1 className="font-serif not-italic text-2xl sm:text-[28px] text-(--ink-solid) leading-none mt-0.5">
                Owned Items
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openModal('item-form')}
            className="h-7 px-2.5 rounded-[2px] bg-(--paper-sheet) border border-(--rule-hairline) text-xs font-mono font-medium text-(--ink-solid) flex items-center gap-1 hover:border-(--rule-strong) active:scale-95 transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-2" />
            <span>新建</span>
          </button>
        </div>
      )}

      <div className={cn('px-4 space-y-3.5', onClose ? 'pt-3' : 'pt-2')}>
        <div className="relative bg-(--paper-sheet) text-(--ink-solid) rounded-t-[2px] border border-(--rule-hairline) shadow-[0_4px_16px_rgba(0,0,0,0.04)] paper-deckle-bottom pb-4">
          <div className="washi-tape absolute -top-2.5 left-1/2 -translate-x-1/2 shadow-2xs" />

          <div className="p-4 pt-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-(--ink-tertiary)">
                物品总览
              </span>
              <span className="text-[11px] font-mono text-(--ink-secondary)">
                共 {items.length} 件
              </span>
            </div>

            <div className="grid grid-cols-2 divide-x divide-dashed divide-(--rule-hairline) pt-1">
              <div>
                <div className="text-[10px] font-mono text-(--ink-tertiary)">在用日均成本</div>
                <div className="font-mono text-xl sm:text-2xl font-bold text-(--color-income) tabular-nums mt-0.5">
                  ¥{centsToYuan(overallSummary.totalUsingDailyCost)}
                  <span className="text-xs font-normal text-(--ink-tertiary) ml-0.5">/天</span>
                </div>
              </div>

              <div className="pl-4">
                <div className="text-[10px] font-mono text-(--ink-tertiary)">在用净投入</div>
                <div className="font-mono text-xl sm:text-2xl font-bold text-(--ink-solid) tabular-nums mt-0.5">
                  ¥{centsToYuan(overallSummary.totalUsingNetCost)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 px-1 pt-1 border-b border-(--rule-hairline) font-mono text-xs">
          {[
            { key: 'using', label: `在用 (${overallSummary.usingCount})` },
            { key: 'idle', label: `闲置 (${overallSummary.idleCount})` },
            { key: 'sold', label: `已售出 (${overallSummary.soldCount})` },
            { key: 'all', label: `全部 (${overallSummary.totalCount})` },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as FilterTab)}
                className={cn(
                  'pb-2 transition-all relative cursor-pointer select-none',
                  isActive
                    ? 'text-(--ink-solid) font-bold'
                    : 'text-(--ink-tertiary) hover:text-(--ink-secondary)'
                )}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-(--ink-solid)" />
                )}
              </button>
            );
          })}
        </div>

        {filteredItems.length > 0 ? (
          <div className="space-y-2.5">
            {filteredItems.map((item) => {
              const metrics = computeItemMetrics(item, transactions);
              const IconComp = getCategoryIcon(item.icon);

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
                    'w-full bg-(--paper-sheet) text-(--ink-solid) rounded-[2px] border border-(--rule-hairline)',
                    'shadow-[0_2px_8px_rgba(0,0,0,0.03)] p-3.5 cursor-pointer transition-all',
                    'hover:border-(--rule-strong) active:scale-[0.995] relative'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6.5 h-6.5 rounded-[2px] bg-(--paper-sunken) flex items-center justify-center shrink-0 text-(--ink-secondary)">
                        <IconComp className="w-4 h-4 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-(--ink-solid) truncate leading-snug">
                          {item.name}
                        </div>
                        <div className="text-[10px] font-mono text-(--ink-tertiary) mt-0.5">
                          {item.buyDate} 购入 · 已持有 {metrics.holdingDays} 天
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      {getStatusStamp(item.status)}
                    </div>
                  </div>

                  <div className="my-2.5 border-t border-dashed border-(--rule-hairline)" />

                  <div className="flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-(--ink-tertiary)">日均成本 </span>
                      <span className="font-bold text-sm text-(--color-income) tabular-nums">
                        ¥{centsToYuan(metrics.dailyCost)}
                      </span>
                      <span className="text-[10px] text-(--ink-tertiary)">/天</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-(--ink-tertiary)">
                        {item.status === 'sold' ? '售出回血 ' : '累计投入 '}
                      </span>
                      <span className="font-bold text-(--ink-primary) tabular-nums">
                        ¥{centsToYuan(item.status === 'sold' ? metrics.recoveredAmount : metrics.grossCost)}
                      </span>
                      {item.status === 'sold' && metrics.retentionRate !== null && metrics.retentionRate > 0 && (
                        <span className="text-[10px] text-(--color-income) ml-1 font-semibold">
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
          <div className="py-12 text-center text-xs text-(--ink-tertiary) space-y-2">
            <Package className="w-8 h-8 stroke-[1.2] mx-auto opacity-40 text-(--ink-tertiary)" />
            <p>该分类下暂无持有物品</p>
            <button
              type="button"
              onClick={() => openModal('item-form')}
              className="text-(--color-income) hover:underline font-mono inline-flex items-center text-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-2 mr-0.5" />
              收录一件新物品
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
