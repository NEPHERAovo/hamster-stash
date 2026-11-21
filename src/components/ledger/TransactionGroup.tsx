import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MagnifyingGlassIcon as Search, XIcon as X } from '@phosphor-icons/react';
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
    const grouped = Object.groupBy(filteredTransactions, (tx) => tx.date);
    return (grouped as Record<string, Transaction[]>) || {};
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
            'my-2 animate-pulse overflow-hidden rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sheet) shadow-[0_1px_2px_rgba(0,0,0,0.02)] select-none dark:shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
          )}
        >
          <div className="flex items-center justify-between border-b border-dashed border-(--rule-hairline) bg-(--paper-sunken)/30 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="h-4 w-7 rounded-xs bg-(--paper-sunken)" />
              <div className="h-3 w-10 rounded-xs bg-(--paper-sunken)/70" />
              <div className="h-3 w-8 rounded-xs bg-(--paper-sunken)/50" />
            </div>
            <div className="h-3.5 w-14 rounded-xs bg-(--paper-sunken)" />
          </div>

          <div className="divide-y divide-dashed divide-(--rule-hairline)/60">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="size-6.5 rounded-xs bg-(--paper-sunken)" />
                  <div className="space-y-1.5">
                    <div className={cn('h-3.5 rounded-xs bg-(--paper-sunken)', i === 2 ? 'w-24' : 'w-18')} />
                    <div className="h-2.5 w-28 rounded-xs bg-(--paper-sunken)/60" />
                  </div>
                </div>
                <div className="h-4 w-14 rounded-xs bg-(--paper-sunken)" />
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
          'my-4 rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sheet) p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] select-none dark:shadow-[0_1px_4px_rgba(0,0,0,0.12)]'
        )}
      >
        <div className="rounded-xs border border-dashed border-(--rule-hairline) px-4 py-8">
          <p className="text-xs font-semibold text-(--ink-tertiary)">
            {searchQuery ? '未找到匹配的流水' : '暂无流水记录'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className={cn(contained ? 'mt-0 px-0 py-1' : 'mt-2 px-4 pt-3 pb-1', 'space-y-2 select-none')}>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-(--ink-tertiary)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索备注、分类、账户..."
              className="h-7.5 w-full rounded-(--input-radius) border-none bg-(--paper-sunken)/70 px-7 font-mono text-xs text-(--ink-primary) transition-colors outline-none placeholder:text-(--ink-faint) focus:bg-(--paper-sunken)"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer p-0.5 text-(--ink-tertiary) hover:text-(--ink-primary)"
                title="清空搜索"
              >
                <X className="size-3.5" />
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
        <section key={effectiveFilter} className={cn('filter-fade-enter relative mt-2', contained ? 'pb-4' : 'pb-20')} id="ledgerSurface">
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

          <div ref={sentinelRef} className="mt-2 flex h-6 items-center justify-center">
            {hasMore ? (
              <span className="text-[11px] text-(--ink-faint) opacity-60">
                正在加载更多流水...
              </span>
            ) : (
              sortedDates.length > 0 && (
                <span className="font-mono text-[10px] tracking-widest text-(--ink-tertiary)/40 uppercase">
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
