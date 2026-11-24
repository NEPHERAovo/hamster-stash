import React from 'react';
import type { Category } from '../../types/category';
import type { Account } from '../../types/account';
import type { Transaction } from '../../types/transaction';
import { TransactionGroup } from '../ledger/TransactionGroup';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { CategoryBadge } from '../ui/CategoryBadge';
import type { CategoryDrilldownData } from './StatsView';

export interface CategoryDetailSubPageProps {
  data: CategoryDrilldownData;
  categories: Category[];
  accounts: Account[];
  onSelectTransaction?: (tx: Transaction) => void;
}

function getDiffColor(type: string, diff: number): string {
  if (diff === 0) return 'text-(--ink-tertiary)';
  if (type === 'income') {
    if (diff > 0) return 'text-(--color-income)';
    return 'text-(--color-expense)';
  }
  if (diff > 0) return 'text-(--color-expense)';
  return 'text-(--color-income)';
}

function formatDiffText(diff: number): string {
  if (diff > 0) return `+¥${centsToYuan(diff)}`;
  if (diff < 0) return `-¥${centsToYuan(Math.abs(diff))}`;
  return '= ¥0.00';
}

export const CategoryDetailSubPage: React.FC<CategoryDetailSubPageProps> = ({
  data,
  categories,
  accounts,
  onSelectTransaction,
}) => {
  const { category, periodLabel, transactions, totalExpense, categoryPercentage, previousAmount } = data;
  const diff = previousAmount !== undefined ? totalExpense - previousAmount : null;

  return (
    <div className="space-y-3.5 p-4 pb-12">
      <div className="paper-card w-full space-y-2.5 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-4 shadow-xs select-none">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <CategoryBadge category={category} size="md" />
            <span className="truncate text-base font-semibold text-(--ink-solid)">{category.name}</span>
          </div>
          <span className="shrink-0 font-mono text-xs text-(--ink-tertiary)">{periodLabel}</span>
        </div>

        <div>
          <div className="mb-0.5 text-[11px] text-(--ink-tertiary)">
            {category.type === 'income' ? '本期收入合计' : '本期消费合计'}
          </div>
          <div className="font-mono text-2xl font-bold text-(--ink-solid) tabular-nums">
            ¥{centsToYuan(totalExpense)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-(--rule-hairline)/60 pt-1 text-xs text-(--ink-secondary)">
          <span>
            占比 <strong className="font-mono text-(--ink-solid)">{categoryPercentage}%</strong>
          </span>
          <span className="text-(--rule-hairline)">•</span>
          <span>
            共 <strong className="font-mono text-(--ink-solid)">{transactions.length}</strong> 笔
          </span>
          {diff !== null && (
            <>
              <span className="text-(--rule-hairline)">•</span>
              <span className="font-mono text-[11px]">
                较上期{' '}
                <strong className={getDiffColor(category.type, diff)}>
                  {formatDiffText(diff)}
                </strong>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between px-1 select-none">
          <span className="text-xs font-semibold text-(--ink-secondary)">分类明细</span>
          <span className="font-mono text-[11px] text-(--ink-tertiary)">
            共 {transactions.length} 笔
          </span>
        </div>

        <TransactionGroup
          transactions={transactions}
          categories={categories}
          accounts={accounts}
          onSelectTransaction={onSelectTransaction}
          pageSize={20}
          contained
          showFullDate
        />
      </div>
    </div>
  );
};

export default CategoryDetailSubPage;
