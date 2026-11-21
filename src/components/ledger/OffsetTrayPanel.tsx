import React from 'react';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { cn } from '../../utils/cn';

export interface OffsetTrayPanelProps {
  recentExpenses: Transaction[];
  categories: Category[];
  offsetTransactionId?: string;
  offsetSummaryMap: Map<string, number>;
  onSelectOffsetExpense: (tx: Transaction) => void;
  onClearOffsetExpense: () => void;
}

export const OffsetTrayPanel: React.FC<OffsetTrayPanelProps> = ({
  recentExpenses,
  categories,
  offsetTransactionId,
  offsetSummaryMap,
  onSelectOffsetExpense,
  onClearOffsetExpense,
}) => {
  return (
    <div className="space-y-1.5 border-t border-dashed border-(--rule-hairline)/60 pt-2 pb-1 font-mono text-xs select-none">
      <div className="flex items-center justify-between px-0.5 text-[11px] text-(--ink-tertiary)">
        <span>选择要抵扣的原支出流水:</span>
        {offsetTransactionId && (
          <button
            type="button"
            onClick={onClearOffsetExpense}
            className="cursor-pointer text-(--color-expense) hover:underline"
          >
            取消抵扣 (独立收入)
          </button>
        )}
      </div>

      {recentExpenses.length === 0 ? (
        <div className="py-4 text-center text-xs text-(--ink-tertiary)">
          暂无可选的支出记录
        </div>
      ) : (
        <div className="max-h-40 space-y-1 divide-y divide-dashed divide-(--rule-hairline)/40 overflow-y-auto pr-0.5">
          {recentExpenses.map((exp) => {
            const alreadyOffset = offsetSummaryMap.get(exp.id) || 0;
            const remaining = Math.max(0, exp.amount - alreadyOffset);
            const isSelected = offsetTransactionId === exp.id;
            const cat = categories.find((c) => c.id === exp.categoryId);
            const isFullyOffset = remaining <= 0;

            return (
              <button
                key={exp.id}
                type="button"
                onClick={() => onSelectOffsetExpense(exp)}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between rounded-[2px] px-2 py-1.5 text-left transition-all',
                  isSelected
                    ? 'bg-(--paper-sunken) shadow-2xs'
                    : 'hover:bg-(--paper-hover)/50'
                )}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-(--ink-primary)">
                      {exp.note || cat?.name || '支出'}
                    </span>
                    <span className="text-[10px] text-(--ink-tertiary)">{exp.date}</span>
                    {isFullyOffset && (
                      <span className="rounded-xs bg-(--color-income-bg) px-1 text-[9px] text-(--color-income)">
                        已全额分摊
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[10px] text-(--ink-faint)">
                    {cat?.name || '支出'} · 原金额 ¥{centsToYuan(exp.amount)}
                  </div>
                </div>

                <div className="shrink-0 text-right font-mono">
                  <div className="text-xs text-(--ink-secondary)">
                    待冲减: <span className="font-semibold text-(--ink-primary)">¥{centsToYuan(remaining)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OffsetTrayPanel;
