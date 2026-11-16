import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import type { Account } from '../../types/account';
import { TransactionItem } from './TransactionItem';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { cn } from '../../utils/cn';

export interface TransactionGroupProps {
  transactions: Transaction[];
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
  const [visibleGroupCount, setVisibleGroupCount] = useState<number>(pageSize);
  const [localFreshTxId, setLocalFreshTxId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const activeFreshId = externalFreshTxId || localFreshTxId;

  useEffect(() => {
    if (activeFreshId) {
      const timer = setTimeout(() => {
        setLocalFreshTxId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [activeFreshId]);

  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (filter === 'reimbursable') {
      list = list.filter((t) => t.isReimbursable);
    } else if (filter === 'major') {
      list = list.filter((t) => t.amount >= 20000);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
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
  }, [transactions, filter, searchQuery, catMap, acctMap]);

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

  const hasMore = visibleGroupCount < sortedDates.length;
  const visibleDates = sortedDates.slice(0, visibleGroupCount);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleGroupCount((prev) => Math.min(sortedDates.length, prev + pageSize));
        }
      },
      { rootMargin: '350px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, sortedDates.length, pageSize]);

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

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
              className="w-full h-7.5 pl-7 pr-7 text-xs font-mono rounded-xs bg-(--paper-sunken)/70 text-(--ink-primary) placeholder:text-(--ink-faint) outline-none focus:bg-(--paper-sunken) transition-colors border-none"
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

          <div className="flex gap-1 shrink-0 font-mono text-[11px]">
            <button
              type="button"
              className={cn(
                'px-2 py-1 rounded-xs text-[10px] transition-all cursor-pointer select-none',
                filter === 'all'
                  ? 'bg-(--ink-solid) text-(--paper-sheet) font-semibold shadow-xs'
                  : 'text-(--ink-tertiary) bg-(--paper-sunken)/50 hover:text-(--ink-primary)'
              )}
              onClick={() => setFilter('all')}
            >
              全部
            </button>
            <button
              type="button"
              className={cn(
                'px-2 py-1 rounded-xs text-[10px] transition-all cursor-pointer select-none',
                filter === 'reimbursable'
                  ? 'bg-(--ink-solid) text-(--paper-sheet) font-semibold shadow-xs'
                  : 'text-(--ink-tertiary) bg-(--paper-sunken)/50 hover:text-(--ink-primary)'
              )}
              onClick={() => setFilter('reimbursable')}
            >
              待报销
            </button>
            <button
              type="button"
              className={cn(
                'px-2 py-1 rounded-xs text-[10px] transition-all cursor-pointer select-none',
                filter === 'major'
                  ? 'bg-(--ink-solid) text-(--paper-sheet) font-semibold shadow-xs'
                  : 'text-(--ink-tertiary) bg-(--paper-sunken)/50 hover:text-(--ink-primary)'
              )}
              onClick={() => setFilter('major')}
            >
              大额 (&gt;¥200)
            </button>
          </div>
        </div>
      </div>

      {sortedDates.length === 0 ? (
        effectiveLoading ? (
          <div
            className={cn(
              contained ? 'mx-0' : 'mx-4',
              'my-2 bg-(--paper-sheet) rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25)] border border-(--rule-hairline) overflow-hidden select-none animate-pulse'
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
        ) : (
          <div
            className={cn(
              contained ? 'mx-0' : 'mx-4',
              'my-4 p-6 bg-(--paper-sheet) border border-(--rule-hairline) rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-center select-none'
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
        )
      ) : (
        <section className={cn('relative mt-2', contained ? 'pb-4' : 'pb-20')} id="ledgerSurface">
          {visibleDates.map((date) => {
            const txList = groups[date];

            let dayNet = 0;
            for (const t of txList) {
              if (t.type === 'expense') {
                const offset = offsetMap.get(t.id) || 0;
                dayNet -= Math.max(0, t.amount - offset);
              }
              if (t.type === 'income' && !t.offsetTransactionId) {
                dayNet += t.amount;
              }
            }

            const d = new Date(date + 'T00:00:00');
            const dayCode = isNaN(d.getTime())
              ? date
              : `${String(d.getDate()).padStart(2, '0')} ${dayNames[d.getDay()]}`;

            const daySumFormatted =
              dayNet >= 0
                ? `+¥${centsToYuan(dayNet)}`
                : `-¥${centsToYuan(Math.abs(dayNet))}`;

            const dayNum = dayCode.slice(0, 2);
            const dayWeek = dayCode.slice(3);

            return (
              <div
                key={date}
                className={cn(
                  contained ? 'mx-0' : 'mx-4',
                  'mb-3.5 bg-(--paper-sheet) rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.25)] border border-(--rule-hairline) overflow-hidden select-none'
                )}
              >
                <div className="day-divider flex items-baseline justify-between px-3.5 py-2.5 border-b border-dashed border-(--rule-hairline) select-none bg-(--paper-sunken)/30">
                  <div className="flex items-baseline gap-1.5 font-mono">
                    <span className="text-sm font-bold text-(--ink-solid) leading-none">
                      {dayNum}
                    </span>
                    <span className="text-[10px] font-semibold text-(--ink-tertiary) tracking-wider uppercase leading-none">
                      {dayWeek}
                    </span>
                    <span className="text-[10px] text-(--ink-faint)">
                      · {txList.length}笔
                    </span>
                  </div>
                  <span
                    className={cn(
                      'font-mono text-[11px] tabular-nums font-semibold shrink-0',
                      dayNet >= 0 ? 'text-(--color-income)' : 'text-(--ink-tertiary)'
                    )}
                  >
                    {daySumFormatted}
                  </span>
                </div>

                <div>
                  {txList.map((tx, idx) => (
                    <TransactionItem
                      key={tx.id}
                      transaction={tx}
                      category={catMap.get(tx.categoryId)}
                      account={acctMap.get(tx.accountId)}
                      toAccount={tx.toAccountId ? acctMap.get(tx.toAccountId) : undefined}
                      isFresh={activeFreshId === tx.id}
                      isLastInGroup={idx === txList.length - 1}
                      offsetAmount={offsetMap.get(tx.id)}
                      offsetTargetNote={tx.offsetTransactionId ? expenseNoteMap.get(tx.offsetTransactionId) : undefined}
                      onClick={() => onSelectTransaction?.(tx)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          <div ref={sentinelRef} className="h-6 flex items-center justify-center mt-2">
            {hasMore ? (
              <span className="text-[11px] text-(--ink-faint) opacity-60">
                正在加载更多流水...
              </span>
            ) : sortedDates.length > pageSize ? (
              <span className="text-[10px] text-(--ink-faint) tracking-wider uppercase opacity-50">
                已显示全部 {filteredTransactions.length} 笔流水
              </span>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
};

export default TransactionGroup;
