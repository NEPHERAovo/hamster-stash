import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Scales as Scale, Trash as Trash2, ArrowsLeftRight as ArrowLeftRight } from '@phosphor-icons/react';
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
    <div className="w-full pb-6 pt-1 px-4">
      <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) shadow-xs p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-(--badge-radius) bg-(--paper-sunken) text-(--color-income) flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 stroke-[1.85]" />
          </div>
          <div>
            <div className="font-bold text-sm text-(--ink-primary)">{account.name}</div>
            <div className="text-[11px] font-mono text-(--ink-tertiary)">
              {isCredit ? '信用账户 · ' : '储蓄账户 · '}
              {getAccountTypeName(account.type)}
            </div>
          </div>
        </div>

        <div className="mb-3.5">
          <div className="text-[10px] font-semibold text-(--ink-tertiary) uppercase tracking-wider mb-0.5 font-mono">
            {balanceLabel}
          </div>
          <div
            className={cn(
              'text-3xl font-bold tracking-tight tabular-nums font-mono',
              isNegative ? 'text-(--color-expense)' : 'text-(--ink-primary)'
            )}
          >
            {isNegative ? `-¥${centsToYuan(Math.abs(account.balance))}` : `¥${centsToYuan(account.balance)}`}
          </div>
          {isCredit && account.creditLimit && (
            <div className="text-[11px] font-mono text-(--ink-tertiary) mt-1">
              额度 ¥{centsToYuan(account.creditLimit)} · 剩余可用 ¥
              {centsToYuan(Math.max(0, account.creditLimit + account.balance))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 text-center py-3 border-y border-dashed border-(--rule-hairline) mb-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-(--ink-tertiary) uppercase tracking-wider">收入</span>
            <span className="text-[13px] font-bold font-mono tabular-nums text-(--color-income)">+¥{centsToYuan(monthIn)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-(--ink-tertiary) uppercase tracking-wider">支出</span>
            <span className="text-[13px] font-bold font-mono tabular-nums text-(--color-expense)">-¥{centsToYuan(monthOut)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-(--ink-tertiary) uppercase tracking-wider">结余</span>
            <span className={cn('text-[13px] font-bold font-mono tabular-nums', isNetPositive ? 'text-(--color-income)' : 'text-(--color-expense)')}>
              {isNetPositive ? `+¥${centsToYuan(netFlow)}` : `-¥${centsToYuan(Math.abs(netFlow))}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenTransfer && accounts.length >= 2 && (
            <button
              type="button"
              className="flex-1 h-9 rounded-(--btn-radius) inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-(--btn-primary-bg) text-(--btn-primary-fg) hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
              onClick={() => onOpenTransfer(account)}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 stroke-[1.85]" />
              <span>{isCredit ? '账户还款' : '资金划转'}</span>
            </button>
          )}

          {onOpenReconcile && (
            <button
              type="button"
              className={cn(
                'h-9 rounded-(--btn-radius) inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-hover) active:scale-[0.98] transition-all cursor-pointer border border-(--rule-hairline)',
                onOpenTransfer && accounts.length >= 2 ? 'flex-1' : 'w-full'
              )}
              onClick={onOpenReconcile}
            >
              <Scale className="w-4 h-4 stroke-[1.85]" />
              <span>平账校准</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) p-4 mb-4 text-xs font-mono">
        <div className="text-[10px] text-(--ink-tertiary) uppercase tracking-wider mb-2 font-semibold">
          账户属性信息
        </div>
        <div className="divide-y divide-(--rule-hairline)">
          <div className="flex justify-between py-2">
            <span className="text-(--ink-tertiary)">账户分类</span>
            <span className="text-(--ink-primary) font-medium">
              {isCredit ? '信用账户' : '储蓄账户'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-(--ink-tertiary)">账户类型</span>
            <span className="text-(--ink-primary) font-medium">{getAccountTypeName(account.type)}</span>
          </div>

          {isCredit && (
            <>
              <div className="flex justify-between py-2">
                <span className="text-(--ink-tertiary)">每月还款日</span>
                <span className="text-(--ink-primary) font-medium">
                  {account.repaymentDay ? `每月 ${account.repaymentDay} 日` : '未设置'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-(--ink-tertiary)">每月账单日</span>
                <span className="text-(--ink-primary) font-medium">
                  {account.billDay ? `每月 ${account.billDay} 日` : '未设置'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-(--ink-tertiary)">关联还款账户</span>
                <span className="text-(--ink-primary) font-medium">
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
                  <span className="text-(--ink-primary) font-medium">
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

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-(--ink-secondary)">账户流水</span>
          <span className="text-[11px] font-mono text-(--ink-tertiary)">共 {accountTxs.length} 笔</span>
        </div>

        <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) overflow-hidden">
          {accountTxs.length === 0 ? (
            <div className="py-8 text-center text-xs text-(--ink-tertiary)">
              此账户暂无收支明细
            </div>
          ) : (
            monthGroups.map((group, groupIdx) => (
              <div key={group.monthKey}>
                <div
                  className={cn(
                    'flex items-center justify-between px-3.5 py-1.5 bg-(--paper-sunken)/45 border-b border-dashed border-(--rule-hairline) text-[11px] font-mono text-(--ink-tertiary) select-none',
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
          <div ref={sentinelRef} className="h-6 flex items-center justify-center pt-1">
            {hasMore ? (
              <span className="text-[11px] text-(--ink-faint) opacity-70">
                正在加载更多流水...
              </span>
            ) : (
              <span className="text-[10px] text-(--ink-tertiary)/50 font-mono tracking-wider">
                已加载全部 {accountTxs.length} 笔流水
              </span>
            )}
          </div>
        )}
      </div>

      {onDeleteAccount && (
        <div className="pt-2 pb-6 flex justify-center">
          <button
            type="button"
            onClick={handleDeleteClick}
            className="text-xs text-(--color-expense) hover:underline cursor-pointer opacity-80 hover:opacity-100 transition-opacity flex items-center gap-1.5 py-1.5 px-3 rounded-(--btn-radius) hover:bg-(--color-expense-bg)/40"
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[1.8]" />
            <span>删除此账户</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AccountDetailSubPage;
