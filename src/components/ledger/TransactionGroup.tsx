import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import type { Account } from '../../types/account';
import { PaperTransactionGroup } from './PaperTransactionGroup';
import { ModernTransactionGroup } from './ModernTransactionGroup';
import { SegToggle } from '../ui/SegToggle';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { cn } from '../../utils/cn';

export interface TransactionGroupProps {
  transactions: Transaction[];
  searchTransactions?: Transaction[];
  categories: Category[];
  accounts: Account[];
  onSelectTransaction?: (tx: Transaction) => void;
  pageSize?: number;
  freshTxId?: string | null;
  contained?: boolean;
  isLoading?: boolean;
}

export const TransactionGroup: React.FC<TransactionGroupProps> = ({
  transactions,
  searchTransactions,
  categories,
  accounts,
  onSelectTransaction,
  pageSize = 15,
  freshTxId: externalFreshTxId,
  contained = false,
  isLoading,
}) => {
  const isInitialLoaded = useLedgerStore((s) => s.isInitialLoaded);
  const effectiveLoading = isLoading !== undefined ? isLoading : !isInitialLoaded;
  const uiStyle = useThemeStore((s) => s.uiStyle);
  const majorThresholdYuan = usePreferenceStore((s) => s.majorThresholdYuan);
  const isReimbursementEnabled = usePreferenceStore((s) => s.isReimbursementEnabled);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const acctMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const allTxs = useLedgerStore((s) => s.allTransactions);
  const dataSource = allTxs.length > 0 ? allTxs : transactions;

  const { offsetMap, expenseNoteMap } = useMemo(() => {
    const oMap = new Map<string, number>();
    const nMap = new Map<string, string>();
    for (const t of dataSource) {
      if (t.type === 'expense') {
        nMap.set(t.id, t.note || catMap.get(t.categoryId)?.name || '支出');
      } else if (t.type === 'income' && t.offsetTransactionId) {
        oMap.set(t.offsetTransactionId, (oMap.get(t.offsetTransactionId) || 0) + t.amount);
      }
    }
    return { offsetMap: oMap, expenseNoteMap: nMap };
  }, [dataSource, catMap]);

  const [filter, setFilter] = useState<'all' | 'reimbursable' | 'major'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [localFreshTxId, setLocalFreshTxId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const isSearching = searchQuery.trim().length > 0;
  const scopeKey = `${isSearching ? 'search' : transactions.length}:${transactions[0]?.id || ''}:${filter}:${searchQuery.trim()}`;
  const [pagination, setPagination] = useState<{ key: string; count: number }>({
    key: scopeKey,
    count: pageSize,
  });
  const visibleGroupCount = pagination.key === scopeKey ? pagination.count : pageSize;

  const activeFreshId = externalFreshTxId || localFreshTxId;

  useEffect(() => {
    if (activeFreshId) {
      const timer = setTimeout(() => {
        setLocalFreshTxId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [activeFreshId]);

  const effectiveFilter = !isReimbursementEnabled && filter === 'reimbursable' ? 'all' : filter;

  const filterOptions = useMemo(() => {
    if (!isReimbursementEnabled) {
      return [
        { value: 'all', label: '全部' },
        { value: 'major', label: '大额' },
      ];
    }
    return [
      { value: 'all', label: '全部' },
      { value: 'reimbursable', label: '待报销' },
      { value: 'major', label: '大额' },
    ];
  }, [isReimbursementEnabled]);

  const filteredTransactions = useMemo(() => {
    const trimmedQuery = searchQuery.trim();
    let list = trimmedQuery && searchTransactions ? searchTransactions : transactions;
    if (effectiveFilter === 'reimbursable') {
      list = list.filter((t) => t.isReimbursable);
    } else if (effectiveFilter === 'major') {
      const majorThresholdCents = Math.round(majorThresholdYuan * 100);
      list = list.filter((t) => t.amount >= majorThresholdCents);
    }

    if (trimmedQuery) {
      const q = trimmedQuery.toLowerCase();
      list = list.filter((t) => {
        const noteMatch = t.note?.toLowerCase().includes(q);
        const cat = catMap.get(t.categoryId);
        const catMatch = cat?.name.toLowerCase().includes(q);
        const acct = acctMap.get(t.accountId);
        const acctMatch = acct?.name.toLowerCase().includes(q);
        const amtMatch = centsToYuan(t.amount).includes(q);
        const dateMatch = t.date.includes(q);
        return noteMatch || catMatch || acctMatch || amtMatch || dateMatch;
      });
    }

    return list;
  }, [transactions, searchTransactions, effectiveFilter, searchQuery, catMap, acctMap, majorThresholdYuan]);

  const groups = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      if (!acc[tx.date]) acc[tx.date] = [];
      acc[tx.date].push(tx);
      return acc;
    }, {} as Record<string, Transaction[]>);
  }, [filteredTransactions]);

  const sortedDates = useMemo(() => {
    return Object.keys(groups).sort((a, b) => b.localeCompare(a));
  }, [groups]);

  const visibleDates = useMemo(() => {
    return sortedDates.slice(0, visibleGroupCount);
  }, [sortedDates, visibleGroupCount]);

  const hasMore = visibleGroupCount < sortedDates.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore) {
          setPagination((prev) => {
            const base = prev.key === scopeKey ? prev.count : pageSize;
            return { key: scopeKey, count: Math.min(sortedDates.length, base + pageSize) };
          });
        }
      },
      { rootMargin: '350px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, sortedDates.length, pageSize, scopeKey]);

  const renderEmptyOrLoading = () => {
    if (effectiveLoading) {
      return (
        <div
          className={cn(
            contained ? 'mx-0' : 'mx-4',
            'my-2 bg-(--paper-sheet) rounded-(--radius-sm) shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.12)] border border-(--rule-hairline) overflow-hidden select-none animate-pulse'
          )}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-dashed border-(--rule-hairline) bg-(--paper-sunken)/30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-4 rounded-xs bg-(--paper-sunken)" />
              <div className="w-10 h-3 rounded-xs bg-(--paper-sunken)/70" />
              <div className="w-8 h-3 rounded-xs bg-(--paper-sunken)/50" />
            </div>
            <div className="w-14 h-3.5 rounded-xs bg-(--paper-sunken)" />
          </div>

          <div className="divide-y divide-dashed divide-(--rule-hairline)/60">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-3.5 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-6.5 h-6.5 rounded-xs bg-(--paper-sunken)" />
                  <div className="space-y-1.5">
                    <div className={cn('h-3.5 rounded-xs bg-(--paper-sunken)', i === 2 ? 'w-24' : 'w-18')} />
                    <div className="w-28 h-2.5 rounded-xs bg-(--paper-sunken)/60" />
                  </div>
                </div>
                <div className="w-14 h-4 rounded-xs bg-(--paper-sunken)" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          contained ? 'mx-0' : 'mx-4',
          'my-4 p-6 bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-sm) shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.12)] text-center select-none'
        )}
      >
        <div className="border border-dashed border-(--rule-hairline) py-8 px-4 rounded-xs">
          <p className="text-xs font-semibold text-(--ink-tertiary)">
            {searchQuery ? '未找到匹配的记账流水' : '暂无符合条件的记账流水'}
          </p>
          <p className="text-[11px] text-(--ink-faint) mt-1 font-mono">
            {searchQuery ? '请尝试更换关键词' : '本周期暂无流水记录'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className={cn(contained ? 'px-0 pt-1 pb-1 mt-0' : 'px-4 pt-3 pb-1 mt-2', 'space-y-2 select-none')}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-(--ink-tertiary)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索备注、分类、账户..."
              className="w-full h-7.5 pl-7 pr-7 text-xs font-mono rounded-(--input-radius) bg-(--paper-sunken)/70 text-(--ink-primary) placeholder:text-(--ink-faint) outline-none focus:bg-(--paper-sunken) transition-colors border-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-(--ink-tertiary) hover:text-(--ink-primary) p-0.5 cursor-pointer"
                title="清空搜索"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="shrink-0">
            <SegToggle
              options={filterOptions}
              value={effectiveFilter}
              onChange={(val) => setFilter(val as 'all' | 'reimbursable' | 'major')}
              size="sm"
              fullWidth={false}
            />
          </div>
        </div>
      </div>

      {sortedDates.length === 0 ? (
        renderEmptyOrLoading()
      ) : (
        <section className={cn('relative mt-2', contained ? 'pb-4' : 'pb-20')} id="ledgerSurface">
          {uiStyle === 'modern' ? (
            <ModernTransactionGroup
              visibleDates={visibleDates}
              groups={groups}
              offsetMap={offsetMap}
              expenseNoteMap={expenseNoteMap}
              catMap={catMap}
              acctMap={acctMap}
              activeFreshId={activeFreshId}
              contained={contained}
              isSearching={isSearching}
              onSelectTransaction={onSelectTransaction}
            />
          ) : (
            <PaperTransactionGroup
              visibleDates={visibleDates}
              groups={groups}
              offsetMap={offsetMap}
              expenseNoteMap={expenseNoteMap}
              catMap={catMap}
              acctMap={acctMap}
              activeFreshId={activeFreshId}
              contained={contained}
              isSearching={isSearching}
              onSelectTransaction={onSelectTransaction}
            />
          )}

          <div ref={sentinelRef} className="h-6 flex items-center justify-center mt-2">
            {hasMore ? (
              <span className="text-[11px] text-(--ink-faint) opacity-60">
                正在加载更多流水...
              </span>
            ) : (
              sortedDates.length > 0 && (
                <span className="text-[10px] text-(--ink-tertiary)/40 font-mono tracking-widest uppercase">
                  END OF JOURNAL
                </span>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default TransactionGroup;
