import React, { useMemo, useState } from 'react';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import { PaperButton } from '../ui/PaperButton';
import { PaperChip } from '../ui/PaperChip';
import { centsToYuan } from '../../domain/finance/balanceCalculator';

export interface OffsetTrayPanelProps {
  candidateExpenses?: Transaction[];
  recentExpenses?: Transaction[];
  categories: Category[];
  offsetTransactionId?: string;
  offsetSummaryMap: Map<string, number>;
  onSelectOffsetExpense: (tx: Transaction) => void;
  onClearOffsetExpense: () => void;
}

export const OffsetTrayPanel: React.FC<OffsetTrayPanelProps> = ({
  candidateExpenses,
  recentExpenses,
  categories,
  offsetTransactionId,
  offsetSummaryMap,
  onSelectOffsetExpense,
  onClearOffsetExpense,
}) => {
  const [filterCatId, setFilterCatId] = useState<string | null>(null);
  const expenses = useMemo(
    () => candidateExpenses ?? recentExpenses ?? [],
    [candidateExpenses, recentExpenses]
  );

  const availableCategories = useMemo(() => {
    const catIdSet = new Set(expenses.map((t) => t.categoryId));
    return categories.filter((c) => catIdSet.has(c.id));
  }, [expenses, categories]);

  const displayedExpenses = useMemo(() => {
    if (!filterCatId) return expenses;
    return expenses.filter((t) => t.categoryId === filterCatId);
  }, [expenses, filterCatId]);

  const showCategoryChips = availableCategories.length > 1 && expenses.length > 2;

  const renderHeader = () => {
    if (showCategoryChips) {
      return (
        <div className="flex items-center justify-between gap-1.5 pb-0.5">
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5">
            <PaperChip
              size="sm"
              selected={filterCatId === null}
              onClick={() => setFilterCatId(null)}
              className="shrink-0"
            >
              全部
            </PaperChip>
            {availableCategories.map((cat) => (
              <PaperChip
                key={cat.id}
                size="sm"
                selected={filterCatId === cat.id}
                onClick={() => setFilterCatId(cat.id)}
                className="max-w-28 shrink-0"
              >
                {cat.name}
              </PaperChip>
            ))}
          </div>

          {offsetTransactionId && (
            <PaperButton
              variant="danger-ghost"
              size="xs"
              className="shrink-0"
              onClick={onClearOffsetExpense}
            >
              取消抵扣
            </PaperButton>
          )}
        </div>
      );
    }

    if (offsetTransactionId) {
      return (
        <div className="flex items-center justify-end pb-0.5">
          <PaperButton
            variant="danger-ghost"
            size="xs"
            onClick={onClearOffsetExpense}
          >
            取消抵扣
          </PaperButton>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="picker-fade-enter space-y-1.5 border-t border-dashed border-(--rule-hairline)/60 pt-2 pb-1 font-mono text-xs select-none">
      {renderHeader()}

      {displayedExpenses.length === 0 ? (
        <div className="py-4 text-center text-xs text-(--ink-tertiary)">
          暂无待抵扣的支出
        </div>
      ) : (
        <div className="max-h-40 space-y-1 divide-y divide-dashed divide-(--rule-hairline)/40 overflow-y-auto pr-0.5">
          {displayedExpenses.map((exp) => {
            const alreadyOffset = offsetSummaryMap.get(exp.id) || 0;
            const remaining = Math.max(0, exp.amount - alreadyOffset);
            const isSelected = offsetTransactionId === exp.id;
            const cat = categories.find((c) => c.id === exp.categoryId);
            const isFullyOffset = remaining <= 0;

            return (
              <PaperButton
                key={exp.id}
                variant={isSelected ? 'sunken' : 'ghost'}
                size="compact"
                fullWidth
                onClick={() => onSelectOffsetExpense(exp)}
                className="h-auto justify-between rounded-[2px] px-2 py-1.5 text-left font-normal"
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-(--ink-primary)">
                      {exp.note || cat?.name || '支出'}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-(--ink-tertiary)">
                      {exp.date}
                    </span>
                    {exp.isReimbursable && (
                      <span className="shrink-0 rounded-xs bg-(--color-income-bg) px-1 py-0.5 text-[9px] font-medium text-(--color-income)">
                        待报销
                      </span>
                    )}
                    {isFullyOffset && (
                      <span className="shrink-0 rounded-xs bg-(--paper-sunken) px-1 py-0.5 text-[9px] text-(--ink-faint)">
                        已结清
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[10px] text-(--ink-faint)">
                    {cat?.name || '支出'}
                  </div>
                </div>

                <div className="shrink-0 text-right font-mono">
                  <div className="text-xs font-semibold text-(--ink-primary)">
                    待收 ¥{centsToYuan(remaining)}
                  </div>
                  <div className="text-[10px] text-(--ink-tertiary)">
                    原 ¥{centsToYuan(exp.amount)}
                  </div>
                </div>
              </PaperButton>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OffsetTrayPanel;
