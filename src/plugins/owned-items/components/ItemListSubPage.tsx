import React, { useState, useMemo } from 'react';
import { CaretLeft as ChevronLeft, Plus, Package } from '@phosphor-icons/react';
import {
  useHostTransactions,
  usePluginNavigation,
  centsToYuan,
  getCategoryIcon,
  cn,
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

type FilterTab = 'using' | 'idle' | 'sold' | 'all';
type KindTab = 'all' | 'physical' | 'subscription';

export const ItemListSubPage: React.FC<ItemListSubPageProps> = ({ onClose }) => {
  const items = usePluginItemStore((s) => s.items);
  const transactions = useHostTransactions();
  const { openSubPage, openModal } = usePluginNavigation();

  const [activeTab, setActiveTab] = useState<FilterTab>('using');
  const [kindFilter, setKindFilter] = useState<KindTab>('all');

  const overallSummary = useMemo(() => {
    const idleItems = items.filter((i) => i.status === 'idle');
    const soldItems = items.filter((i) => i.status === 'sold' || i.status === 'scrapped');

    const m = computeOverallItemMetrics(items, transactions);
    return {
      ...m,
      idleCount: idleItems.length,
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

      if (activeTab === 'all') return true;
      if (activeTab === 'sold') return i.status === 'sold' || i.status === 'scrapped';
      return i.status === activeTab;
    });
  }, [items, activeTab, kindFilter]);

  const getStatusStamp = (item: Item) => {
    const isSub = item.kind === 'subscription';
    switch (item.status) {
      case 'using':
        return (
          <span className="real-stamp text-(--color-income) -rotate-2 select-none text-[9px]">
            <span className="paper-title inline">{isSub ? 'ACTIVE' : 'USING'}</span>
            <span className="modern-title hidden">{isSub ? '在订' : '在用'}</span>
          </span>
        );
      case 'idle':
        return (
          <span className="real-stamp text-(--color-accent) rotate-1 select-none text-[9px]">
            <span className="paper-title inline">{isSub ? 'PAUSED' : 'IDLE'}</span>
            <span className="modern-title hidden">{isSub ? '暂停' : '闲置'}</span>
          </span>
        );
      case 'sold':
      case 'scrapped':
        return (
          <span className="real-stamp text-(--ink-tertiary) rotate-2 select-none text-[9px]">
            <span className="paper-title inline">{isSub ? 'CANCELED' : 'DISPOSED'}</span>
            <span className="modern-title hidden">{isSub ? '已退订' : '已处置'}</span>
          </span>
        );
    }
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
        <div className="sticky top-0 z-30 px-4.5 pt-[calc(0.25rem+var(--safe-top))] pb-1 bg-(--paper-base) border-b border-(--rule-hairline) flex items-center justify-between min-h-[calc(3rem+var(--safe-top))] box-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) flex items-center justify-center text-(--ink-secondary) hover:text-(--ink-solid) active:scale-95 transition-all cursor-pointer shadow-xs"
              aria-label="返回"
            >
              <ChevronLeft className="w-4 h-4 stroke-2" />
            </button>
            <div>
              <h1 className="font-serif not-italic text-2xl sm:text-[28px] text-(--ink-solid) leading-none mt-0.5">
                <span className="paper-title inline">Holdings</span>
                <span className="modern-title hidden">持有</span>
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openModal('item-form')}
            className="h-7 px-2.5 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) text-xs font-mono font-medium flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-2" />
            <span>新建</span>
          </button>
        </div>
      )}

      <div className={cn('px-4 space-y-3.5', onClose ? 'pt-3' : 'pt-2')}>
        <div className="tab-stagger-1 relative bg-(--paper-sheet) paper-summary-card text-(--ink-solid) rounded-(--radius-lg) border border-(--rule-hairline) shadow-xs paper-deckle-bottom pb-4">
          <div className="washi-tape absolute -top-2.5 left-1/2 -translate-x-1/2 shadow-2xs" />

          <div className="p-4 pt-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-medium text-(--ink-tertiary)">
                持有总览
              </span>
              <div className="flex items-center gap-2 text-[11px] font-mono text-(--ink-secondary)">
                <span>实体 {overallSummary.physicalCount || 0}</span>
                <span>·</span>
                <span>订阅 {overallSummary.subscriptionCount || 0}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-dashed divide-(--rule-hairline) pt-1">
              <div>
                <div className="text-[10px] font-mono text-(--ink-tertiary)">在持日均成本</div>
                <div className="font-mono text-xl sm:text-2xl font-bold text-(--color-income) tabular-nums mt-0.5">
                  ¥{centsToYuan(overallSummary.totalUsingDailyCost)}
                  <span className="text-xs font-normal text-(--ink-tertiary) ml-0.5">/天</span>
                </div>
              </div>

              <div className="pl-4">
                <div className="text-[10px] font-mono text-(--ink-tertiary)">在持总投入</div>
                <div className="font-mono text-xl sm:text-2xl font-bold text-(--ink-solid) tabular-nums mt-0.5">
                  ¥{centsToYuan(overallSummary.totalUsingNetCost)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="tab-stagger-2 w-full space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {[
                { key: 'all', label: '全部' },
                { key: 'physical', label: '实体物品' },
                { key: 'subscription', label: '数字订阅' },
              ].map((k) => (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => setKindFilter(k.key as KindTab)}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[11px] font-mono transition-all cursor-pointer border',
                    kindFilter === k.key
                      ? 'bg-(--toggle-active-bg) text-(--toggle-active-fg) border-(--rule-strong) font-medium shadow-xs'
                      : 'bg-(--paper-sunken) text-(--ink-tertiary) border-transparent hover:text-(--ink-secondary)'
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-5 px-1 border-b border-(--rule-hairline) font-mono text-xs">
            {[
              { key: 'using', label: `在用/在订 (${overallSummary.usingCount})` },
              { key: 'idle', label: `闲置/暂停 (${overallSummary.idleCount})` },
              { key: 'sold', label: `已退/处置 (${overallSummary.soldCount})` },
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
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-(--color-accent) rounded-full" />
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
                      'w-full bg-(--paper-sheet) paper-card text-(--ink-solid) rounded-(--radius-md) border border-(--rule-hairline)',
                      'shadow-xs p-3.5 cursor-pointer transition-all',
                      'hover:border-(--rule-strong) active:scale-[0.995] relative'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6.5 h-6.5 rounded-(--radius-sm) bg-(--paper-sunken) flex items-center justify-center shrink-0 text-(--ink-secondary)">
                          <IconComp className="w-4 h-4 stroke-[1.8]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-sm font-semibold text-(--ink-solid) truncate leading-snug">
                              {item.name}
                            </span>
                            {isSub && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-(--paper-sunken) text-(--ink-tertiary) border border-(--rule-hairline) font-mono">
                                {formatCycle(item.billingCycle) || '订阅'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-(--ink-tertiary) mt-0.5">
                            {isSub ? `${item.buyDate} 起订 · 订阅 ${metrics.holdingDays} 天` : `${item.buyDate} 购入 · 已持有 ${metrics.holdingDays} 天`}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pt-0.5">
                        {getStatusStamp(item)}
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
                          {item.status === 'sold' ? '处置回血 ' : '累计投入 '}
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
              <p>暂无符合条件的持有项</p>
              <button
                type="button"
                onClick={() => openModal('item-form')}
                className="text-(--color-accent) hover:underline font-mono inline-flex items-center text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-2 mr-0.5" />
                收录一件新持有
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
