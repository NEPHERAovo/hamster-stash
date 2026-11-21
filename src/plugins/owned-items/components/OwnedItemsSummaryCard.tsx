import React, { useMemo } from 'react';
import { Package, CaretRight as ChevronRight, Plus } from '@phosphor-icons/react';
import {
  useHostTransactions,
  usePluginNavigation,
  centsToYuan,
  getCategoryIcon,
  cn,
} from '../../../plugin-sdk';
import { usePluginItemStore } from '../store/usePluginItemStore';
import {
  computeItemMetrics,
  computeOverallItemMetrics,
} from '../domain/itemCalculator';

export const OwnedItemsSummaryCard: React.FC = () => {
  const items = usePluginItemStore((s) => s.items);
  const transactions = useHostTransactions();
  const { openSubPage, openModal } = usePluginNavigation();

  const summary = useMemo(() => {
    return computeOverallItemMetrics(items, transactions);
  }, [items, transactions]);

  const recentItems = useMemo(() => {
    const usingList = items.filter((i) => i.status === 'using');
    const displayList = usingList.length > 0 ? usingList : items;
    return displayList.slice(0, 2);
  }, [items]);

  return (
    <div
      onClick={() => openSubPage('item-list')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openSubPage('item-list');
        }
      }}
      className={cn(
        'w-full bg-(--paper-sheet) paper-card text-(--ink-solid) rounded-(--radius-md) border border-(--rule-hairline)',
        'shadow-[0_2px_8px_rgba(0,0,0,0.03)] cursor-pointer select-none transition-all',
        'hover:border-(--rule-strong) active:scale-[0.995]'
      )}
    >
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-dashed border-(--rule-hairline)">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-(--radius-sm) bg-(--paper-sunken) flex items-center justify-center text-(--ink-secondary)">
            <Package className="w-3.5 h-3.5 stroke-[1.8]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-(--ink-solid) leading-tight">
              物品
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-(--badge-radius) bg-(--paper-sunken) text-(--ink-secondary)">
            {summary.usingCount} 件在用
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-(--ink-tertiary)" />
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-dashed divide-(--rule-hairline) py-2.5 px-4 bg-(--paper-sunken)/35">
        <div>
          <div className="text-[10px] font-mono text-(--ink-tertiary)">总投入</div>
          <div className="font-mono text-base sm:text-lg font-bold tracking-tight text-(--ink-solid) tabular-nums mt-0.5">
            ¥{centsToYuan(summary.totalUsingNetCost)}
          </div>
        </div>

        <div className="pl-4">
          <div className="text-[10px] font-mono text-(--ink-tertiary)">日均成本</div>
          <div className="font-mono text-base sm:text-lg font-bold tracking-tight text-(--color-income) tabular-nums mt-0.5">
            ¥{centsToYuan(summary.totalUsingDailyCost)}
            <span className="text-[10px] font-normal text-(--ink-tertiary) ml-0.5">/天</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-dashed border-(--rule-hairline)">
        {recentItems.length > 0 ? (
          <div className="divide-y divide-dashed divide-(--rule-hairline)/60">
            {recentItems.map((item) => {
              const metrics = computeItemMetrics(item, transactions);
              const IconComp = getCategoryIcon(item.icon);

              return (
                <div
                  key={item.id}
                  className="py-1.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-(--radius-sm) bg-(--paper-sunken) flex items-center justify-center shrink-0 text-(--ink-secondary)">
                      <IconComp className="w-3.5 h-3.5 stroke-[1.8]" />
                    </div>
                    <div className="truncate">
                      <span className="font-medium text-(--ink-primary) truncate">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-mono text-(--ink-tertiary) ml-2">
                        {metrics.holdingDays}天
                      </span>
                    </div>
                  </div>

                  <div className="font-mono text-[11px] font-semibold text-(--ink-secondary) tabular-nums shrink-0 ml-2">
                    ¥{centsToYuan(metrics.dailyCost)}/天
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-2 text-center text-xs text-(--ink-tertiary) flex items-center justify-center gap-1.5">
            <span>暂无记录</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openModal('item-form');
              }}
              className="text-(--color-income) hover:underline font-mono inline-flex items-center text-[11px] cursor-pointer"
            >
              <Plus className="w-3 h-3 stroke-2 mr-0.5" />
              新建
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
