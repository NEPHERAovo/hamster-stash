import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ScalesIcon as Scale, TrashIcon as Trash2, ArrowsLeftRightIcon as ArrowLeftRight } from '@phosphor-icons/react';
import type { Account } from '../../types/account';
import { isCreditAccount } from '../../types/account';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { TransactionItem } from '../ledger/TransactionItem';
import { toast } from '../../stores/useToastStore';
import { confirmAction } from '../../stores/useConfirmStore';
import { cn } from '../../utils/cn';
import { parseLocalDate, currentYearMonth, stepYearMonth } from '../../utils/date';
import { computeAccountMonthlyBalanceTrends } from '../../domain/finance/periodStats';
import { MonthlyTrendBar } from '../stats/MonthlyTrendBar';
import { PaperSwitch } from '../ui/PaperSwitch';

export interface AccountDetailSubPageProps {
  account: Account;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onOpenReconcile?: () => void;
  onOpenTransfer?: (account: Account) => void;
  onToggleIncludeInNetWorth?: (account: Account, nextValue: boolean) => Promise<void>;
  onDeleteAccount?: (account: Account) => void;
  onSelectTransaction?: (tx: Transaction) => void;
}

export const AccountDetailSubPage: React.FC<AccountDetailSubPageProps> = ({
  account,
  transactions,
  categories,
  accounts,
  onOpenReconcile,
  onOpenTransfer,
  onToggleIncludeInNetWorth,
  onDeleteAccount,
  onSelectTransaction,
}) => {
  const isCredit = isCreditAccount(account);
  const Icon = getCategoryIcon(account.icon || (isCredit ? 'credit-card' : 'wallet'));
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const acctMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const accountTxs = useMemo(() => {
    return transactions.filter(
      (t) => t.accountId === account.id || t.toAccountId === account.id
    );
  }, [transactions, account.id]);

  const [trendOffset, setTrendOffset] = useState<number>(0);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setTrendOffset(0);
  }, [account.id]);

  const currentMonthKey = useMemo(() => currentYearMonth(), []);
  const trendTargetMonth = useMemo(
    () => stepYearMonth(currentMonthKey, trendOffset),
    [currentMonthKey, trendOffset]
  );

  const accountTrends = useMemo(() => {
    return computeAccountMonthlyBalanceTrends(account, transactions, trendTargetMonth, 6);
  }, [account, transactions, trendTargetMonth]);

  const handleStepTrendPrev = () => {
    setTrendOffset((prev) => prev - 1);
  };

  const handleStepTrendNext = () => {
    setTrendOffset((prev) => Math.min(0, prev + 1));
  };

  const canStepTrendNext = trendOffset < 0;

  const visibleTxs = useMemo(
    () => accountTxs.slice(0, visibleCount),
    [accountTxs, visibleCount]
  );

  const monthTotalCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tx of accountTxs) {
      const ym = tx.date.slice(0, 7);
      counts.set(ym, (counts.get(ym) || 0) + 1);
    }
    return counts;
  }, [accountTxs]);

  const monthGroups = useMemo(() => {
    const groups: { monthKey: string; label: string; items: Transaction[] }[] = [];
    for (const tx of visibleTxs) {
      const monthKey = tx.date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (last && last.monthKey === monthKey) {
        last.items.push(tx);
      } else {
        const parsed = parseLocalDate(`${monthKey}-01`);
        const label = parsed.isValid() ? `${parsed.year()}年${parsed.month() + 1}月` : monthKey;
        groups.push({ monthKey, label, items: [tx] });
      }
    }
    return groups;
  }, [visibleTxs]);

  const hasMore = visibleCount < accountTxs.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore) {
          setVisibleCount((prev) => Math.min(accountTxs.length, prev + PAGE_SIZE));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, accountTxs.length]);

  const { monthIn, monthOut, netFlow } = useMemo(() => {
    let monthIn = 0;
    let monthOut = 0;

    for (const t of accountTxs) {
      if (t.accountId === account.id) {
        if (t.type === 'expense') monthOut += t.amount;
        if (t.type === 'income') monthIn += t.amount;
        if (t.type === 'transfer') monthOut += t.amount;
        if (t.type === 'loan') {
          if (t.loanDirection === 'lend' && t.loanRole === 'origin') monthOut += t.amount;
          if (t.loanDirection === 'borrow' && t.loanRole === 'origin') monthIn += t.amount;
          if (t.loanDirection === 'lend' && t.loanRole === 'repayment') monthIn += t.amount;
          if (t.loanDirection === 'borrow' && t.loanRole === 'repayment') monthOut += t.amount;
        }
      } else if (t.toAccountId === account.id && t.type === 'transfer') {
        monthIn += t.amount;
      }
    }

    return {
      monthIn,
      monthOut,
      netFlow: monthIn - monthOut,
    };
  }, [accountTxs, account.id]);

  const getAccountTypeName = (type: string) => {
    switch (type) {
      case 'ewallet': return '电子钱包';
      case 'bank': return '储蓄卡';
      case 'credit': return '信用卡';
      case 'cash': return '现金钱包';
      case 'investment': return '投资理财';
      default: return '普通账户';
    }
  };

  const handleDeleteClick = async () => {
    if (accounts.length <= 1) {
      toast.error('系统至少需保留一个资金账户');
      return;
    }
    const hasTxs = accountTxs.length > 0;
    const msg = hasTxs
      ? `该账户下已有 ${accountTxs.length} 条交易流水，删除账户将同时清除关联流水，是否确认删除？`
      : `确认删除账户「${account.name}」吗？`;
    const confirmed = await confirmAction({
      title: '删除账户',
      message: msg,
      confirmText: '确认删除',
      isDestructive: true,
    });
    if (confirmed) {
      onDeleteAccount?.(account);
    }
  };

  const isNetPositive = netFlow >= 0;
  const isIncludedInNetWorth = account.includeInNetWorth !== false;
  const isNegative = account.balance < 0;

  const handleToggleNetWorth = async () => {
    if (!onToggleIncludeInNetWorth) return;
    try {
      await onToggleIncludeInNetWorth(account, !isIncludedInNetWorth);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新设置失败');
    }
  };

  const linkedRepaymentAccount = account.repaymentAccountId
    ? acctMap.get(account.repaymentAccountId)
    : undefined;

  let balanceLabel = '当前余额';
  if (isCredit && isNegative) {
    balanceLabel = '当前欠款';
  }

  return (
    <div className="w-full px-4 pt-1 pb-6">
      <div className="mb-4 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-4 shadow-xs">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--color-income)">
            <Icon className="stroke-1.85 size-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-(--ink-primary)">{account.name}</div>
            <div className="font-mono text-[11px] text-(--ink-tertiary)">
              {isCredit ? '信用账户 · ' : '储蓄账户 · '}
              {getAccountTypeName(account.type)}
            </div>
          </div>
        </div>

        <div className="mb-3.5">
          <div className="mb-0.5 font-mono text-[10px] font-semibold tracking-wider text-(--ink-tertiary) uppercase">
            {balanceLabel}
          </div>
          <div
            className={cn(
              'font-mono text-3xl font-bold tracking-tight tabular-nums',
              isNegative ? 'text-(--color-expense)' : 'text-(--ink-primary)'
            )}
          >
            {isNegative ? `-¥${centsToYuan(Math.abs(account.balance))}` : `¥${centsToYuan(account.balance)}`}
          </div>
          {isCredit && account.creditLimit && (
            <div className="mt-1 font-mono text-[11px] text-(--ink-tertiary)">
              额度 ¥{centsToYuan(account.creditLimit)} · 剩余可用 ¥
              {centsToYuan(Math.max(0, account.creditLimit + account.balance))}
            </div>
          )}
        </div>

        <div className="mb-3.5 grid grid-cols-3 border-y border-dashed border-(--rule-hairline) py-3 text-center">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold tracking-wider text-(--ink-tertiary) uppercase">收入</span>
            <span className="font-mono text-[13px] font-bold text-(--color-income) tabular-nums">+¥{centsToYuan(monthIn)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold tracking-wider text-(--ink-tertiary) uppercase">支出</span>
            <span className="font-mono text-[13px] font-bold text-(--color-expense) tabular-nums">-¥{centsToYuan(monthOut)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold tracking-wider text-(--ink-tertiary) uppercase">结余</span>
            <span className={cn('font-mono text-[13px] font-bold tabular-nums', isNetPositive ? 'text-(--color-income)' : 'text-(--color-expense)')}>
              {isNetPositive ? `+¥${centsToYuan(netFlow)}` : `-¥${centsToYuan(Math.abs(netFlow))}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenTransfer && accounts.length >= 2 && (
            <button
              type="button"
              className="active:scale-0.98 inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-(--btn-radius) bg-(--btn-primary-bg) text-xs font-semibold text-(--btn-primary-fg) shadow-2xs transition-all hover:opacity-90"
              onClick={() => onOpenTransfer(account)}
            >
              <ArrowLeftRight className="stroke-1.85 size-3.5" />
              <span>{isCredit ? '账户还款' : '资金划转'}</span>
            </button>
          )}

          {onOpenReconcile && (
            <button
              type="button"
              className={cn(
                'active:scale-0.98 inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) transition-all hover:bg-(--paper-hover) hover:text-(--ink-primary)',
                onOpenTransfer && accounts.length >= 2 ? 'flex-1' : 'w-full'
              )}
              onClick={onOpenReconcile}
            >
              <Scale className="stroke-1.85 size-4" />
              <span>平账校准</span>
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-4 font-mono text-xs">
        <div className="mb-2 text-[10px] font-semibold tracking-wider text-(--ink-tertiary) uppercase">
          账户属性信息
        </div>
        <div className="divide-y divide-(--rule-hairline)">
          <div className="flex justify-between py-2">
            <span className="text-(--ink-tertiary)">账户分类</span>
            <span className="font-medium text-(--ink-primary)">
              {isCredit ? '信用账户' : '储蓄账户'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-(--ink-tertiary)">账户类型</span>
            <span className="font-medium text-(--ink-primary)">{getAccountTypeName(account.type)}</span>
          </div>

          {isCredit && (
            <>
              <div className="flex justify-between py-2">
                <span className="text-(--ink-tertiary)">每月还款日</span>
                <span className="font-medium text-(--ink-primary)">
                  {account.repaymentDay ? `每月 ${account.repaymentDay} 日` : '未设置'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-(--ink-tertiary)">每月账单日</span>
                <span className="font-medium text-(--ink-primary)">
                  {account.billDay ? `每月 ${account.billDay} 日` : '未设置'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-(--ink-tertiary)">关联还款账户</span>
                <span className="font-medium text-(--ink-primary)">
                  {linkedRepaymentAccount ? linkedRepaymentAccount.name : '未关联'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-(--ink-tertiary)">自动还款</span>
                <span
                  className={cn(
                    'font-medium',
                    account.autoRepay ? 'text-(--color-income)' : 'text-(--ink-tertiary)'
                  )}
                >
                  {account.autoRepay ? '已开启' : '未开启'}
                </span>
              </div>
              {account.creditLimit !== undefined && (
                <div className="flex justify-between py-2">
                  <span className="text-(--ink-tertiary)">信用额度</span>
                  <span className="font-medium text-(--ink-primary)">
                    ¥{centsToYuan(account.creditLimit)}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between py-2">
            <span className="text-(--ink-tertiary)">计入净资产</span>
            {onToggleIncludeInNetWorth ? (
              <PaperSwitch
                checked={isIncludedInNetWorth}
                onChange={handleToggleNetWorth}
                aria-label="计入净资产"
              />
            ) : (
              <span
                className={cn(
                  'font-medium',
                  isIncludedInNetWorth ? 'text-(--color-income)' : 'text-(--ink-tertiary)'
                )}
              >
                {isIncludedInNetWorth ? '计入' : '不计入'}
              </span>
            )}
          </div>
        </div>
      </div>

      <MonthlyTrendBar
        title="月度资产走势"
        trends={accountTrends}
        barColor="var(--color-income)"
        onStepPrev={handleStepTrendPrev}
        onStepNext={handleStepTrendNext}
        canStepNext={canStepTrendNext}
        className="mb-4"
      />

      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-(--ink-secondary)">账户流水</span>
          <span className="font-mono text-[11px] text-(--ink-tertiary)">共 {accountTxs.length} 笔</span>
        </div>

        <div className="overflow-hidden rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet)">
          {accountTxs.length === 0 ? (
            <div className="py-8 text-center text-xs text-(--ink-tertiary)">
              此账户暂无收支明细
            </div>
          ) : (
            monthGroups.map((group, groupIdx) => (
              <div key={group.monthKey}>
                <div
                  className={cn(
                    'flex items-center justify-between border-b border-dashed border-(--rule-hairline) bg-(--paper-sunken)/45 px-3.5 py-1.5 font-mono text-[11px] text-(--ink-tertiary) select-none',
                    groupIdx > 0 && 'border-t'
                  )}
                >
                  <span className="font-semibold text-(--ink-secondary)">{group.label}</span>
                  <span>{monthTotalCountMap.get(group.monthKey) || group.items.length} 笔</span>
                </div>
                {group.items.map((tx, idx) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    category={catMap.get(tx.categoryId)}
                    account={acctMap.get(tx.accountId)}
                    toAccount={tx.toAccountId ? acctMap.get(tx.toAccountId) : undefined}
                    isLastInGroup={idx === group.items.length - 1}
                    showDate
                    hideAccountName
                    onClick={() => onSelectTransaction?.(tx)}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {accountTxs.length > 0 && (
          <div ref={sentinelRef} className="flex h-6 items-center justify-center pt-1">
            {hasMore ? (
              <span className="text-[11px] text-(--ink-faint) opacity-70">
                正在加载更多流水...
              </span>
            ) : (
              <span className="font-mono text-[10px] tracking-wider text-(--ink-tertiary)/50">
                已加载全部 {accountTxs.length} 笔流水
              </span>
            )}
          </div>
        )}
      </div>

      {onDeleteAccount && (
        <div className="flex justify-center pt-2 pb-6">
          <button
            type="button"
            onClick={handleDeleteClick}
            className="flex cursor-pointer items-center gap-1.5 rounded-(--btn-radius) px-3 py-1.5 text-xs text-(--color-expense) opacity-80 transition-opacity hover:bg-(--color-expense-bg)/40 hover:underline hover:opacity-100"
          >
            <Trash2 className="stroke-1.8 size-3.5" />
            <span>删除此账户</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountDetailSubPage;
