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

export const CategoryDetailSubPage: React.FC<CategoryDetailSubPageProps> = ({
  data,
  categories,
  accounts,
  onSelectTransaction,
}) => {
  const { category, periodLabel, transactions, totalExpense, categoryPercentage } = data;

  return (
    <div className="p-4 space-y-3.5 pb-12">
      <div className="w-full p-4 bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-md) shadow-xs select-none space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <CategoryBadge category={category} size="md" />
            <span className="font-semibold text-base text-(--ink-solid) truncate">{category.name}</span>
          </div>
          <span className="font-mono text-xs text-(--ink-tertiary) shrink-0">{periodLabel}</span>
        </div>

        <div>
          <div className="text-[11px] text-(--ink-tertiary) mb-0.5">本期消费合计</div>
          <div className="font-mono text-2xl font-bold text-(--ink-solid) tabular-nums">
            ¥{centsToYuan(totalExpense)}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1 border-t border-(--rule-hairline)/60 text-xs text-(--ink-secondary)">
          <span>
            占比 <strong className="font-mono text-(--ink-solid)">{categoryPercentage}%</strong>
          </span>
          <span className="text-(--rule-hairline)">•</span>
          <span>
            共 <strong className="font-mono text-(--ink-solid)">{transactions.length}</strong> 笔
          </span>
        </div>
      </div>

      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between px-1 select-none">
          <span className="text-xs font-semibold text-(--ink-secondary)">分类明细</span>
          <span className="text-[11px] font-mono text-(--ink-tertiary)">
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
        />
      </div>
    </div>
  );
};

export default CategoryDetailSubPage;
