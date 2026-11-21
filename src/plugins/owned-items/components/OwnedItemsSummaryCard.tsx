import React, { useMemo } from 'react';
import { PackageIcon as Package, CaretRightIcon as ChevronRight } from '@phosphor-icons/react';
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
  const { openSubPage } = usePluginNavigation();

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
        'paper-card w-full rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) text-(--ink-solid)',
        'cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all select-none',
        'active:scale-0.995 hover:border-(--rule-strong)'
      )}
    >
      <div className="flex items-center justify-between border-b border-dashed border-(--rule-hairline) px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded-(--radius-sm) bg-(--paper-sunken) text-(--ink-secondary)">
            <Package className="stroke-1.8 size-3.5" />
          </div>
          <div>
            <div className="text-sm leading-tight font-semibold text-(--ink-solid)">
              物品
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="rounded-(--badge-radius) bg-(--paper-sunken) px-2 py-0.5 font-mono text-[11px] text-(--ink-secondary)">
            {summary.usingCount} 件在用
          </span>
          <ChevronRight className="size-3.5 text-(--ink-tertiary)" />
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-dashed divide-(--rule-hairline) bg-(--paper-sunken)/35 px-4 py-2.5">
        <div>
          <div className="font-mono text-[10px] text-(--ink-tertiary)">总投入</div>
          <div className="mt-0.5 font-mono text-base font-bold tracking-tight text-(--ink-solid) tabular-nums sm:text-lg">
            ¥{centsToYuan(summary.totalUsingNetCost)}
          </div>
        </div>

        <div className="pl-4">
          <div className="font-mono text-[10px] text-(--ink-tertiary)">日均成本</div>
          <div className="mt-0.5 font-mono text-base font-bold tracking-tight text-(--color-income) tabular-nums sm:text-lg">
            ¥{centsToYuan(summary.totalUsingDailyCost)}
            <span className="ml-0.5 text-[10px] font-normal text-(--ink-tertiary)">/天</span>
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-(--rule-hairline) px-4 py-2">
        {recentItems.length > 0 ? (
          <div className="divide-y divide-dashed divide-(--rule-hairline)/60">
            {recentItems.map((item) => {
              const metrics = computeItemMetrics(item, transactions);
              const IconComp = getCategoryIcon(item.icon);

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1.5 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-(--radius-sm) bg-(--paper-sunken) text-(--ink-secondary)">
                      <IconComp className="stroke-1.8 size-3.5" />
                    </div>
                    <div className="truncate">
                      <span className="truncate font-medium text-(--ink-primary)">
                        {item.name}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-(--ink-tertiary)">
                        {metrics.holdingDays}天
                      </span>
                    </div>
                  </div>

                  <div className="ml-2 shrink-0 font-mono text-[11px] font-semibold text-(--ink-secondary) tabular-nums">
                    ¥{centsToYuan(metrics.dailyCost)}/天
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-2 text-center text-xs text-(--ink-tertiary)">
            <span>暂无记录</span>
          </div>
        )}
      </div>
    </div>
  );
};
