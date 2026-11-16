import React, { useMemo } from 'react';
import { Scale, Plus } from 'lucide-react';
import type { Account } from '../../types/account';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { TransactionItem } from '../ledger/TransactionItem';
import { cn } from '../../utils/cn';

export interface AccountDetailSubPageProps {
  account: Account;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onOpenReconcile: () => void;
  onRecordForAccount: () => void;
  onSelectTransaction?: (tx: Transaction) => void;
}

export const AccountDetailSubPage: React.FC<AccountDetailSubPageProps> = ({
  account,
  transactions,
  categories,
  accounts,
  onOpenReconcile,
  onRecordForAccount,
  onSelectTransaction,
}) => {
  const Icon = getCategoryIcon(account.icon || 'wallet');
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const acctMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const accountTxs = useMemo(() => {
    return transactions.filter(
      (t) => t.accountId === account.id || t.toAccountId === account.id
    );
  }, [transactions, account.id]);

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

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'ewallet': return '电子钱包 · CNY';
      case 'bank': return '储蓄卡 · CNY';
      case 'credit': return '信用卡 · 信用额度';
      case 'cash': return '现金钱包 · CNY';
      case 'investment': return '投资账户 · CNY';
      default: return '账户 · CNY';
    }
  };

  const getAccountTypeName = (type: string) => {
    switch (type) {
      case 'ewallet': return '电子钱包';
      case 'bank': return '储蓄卡';
      case 'credit': return '信用卡';
      case 'cash': return '现金钱包';
      case 'investment': return '投资理财账户';
      default: return '普通资金账户';
    }
  };

  const isNetPositive = netFlow >= 0;

  return (
    <div className="w-full page-slide-in pb-6 pt-1 px-4">
      <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-md shadow-xs p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-[rgba(63,130,86,0.13)] text-(--color-income) border border-[rgba(63,130,86,0.22)] flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 stroke-[1.85]" />
            </div>
            <div>
              <div className="font-bold text-sm text-(--ink-primary)">{account.name}</div>
              <div className="text-[11px] font-mono text-(--ink-tertiary)">{getAccountTypeLabel(account.type)}</div>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-(--color-income-bg) text-(--color-income) font-mono">
            正常计入
          </span>
        </div>

        <div className="mb-3.5">
          <div className="text-[10px] font-semibold text-(--ink-tertiary) uppercase tracking-wider mb-0.5 font-mono">
            当前账面余额
          </div>
          <div className="text-3xl font-bold tracking-tight text-(--ink-primary) tabular-nums font-mono">
            ¥{centsToYuan(account.balance)}
          </div>
        </div>

        <div className="grid grid-cols-3 text-center py-3 border-y border-dashed border-(--border-hairline) mb-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-(--ink-tertiary) uppercase tracking-wider">本月流入</span>
            <span className="text-[13px] font-bold font-mono tabular-nums text-(--color-income)">+¥{centsToYuan(monthIn)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-(--ink-tertiary) uppercase tracking-wider">本月流出</span>
            <span className="text-[13px] font-bold font-mono tabular-nums text-(--color-expense)">-¥{centsToYuan(monthOut)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-(--ink-tertiary) uppercase tracking-wider">净变动</span>
            <span className={cn('text-[13px] font-bold font-mono tabular-nums', isNetPositive ? 'text-(--color-income)' : 'text-(--color-expense)')}>
              {isNetPositive ? `+¥${centsToYuan(netFlow)}` : `-¥${centsToYuan(Math.abs(netFlow))}`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            className="h-9.5 rounded-sm inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-(--bg-sunken) text-(--ink-primary) border border-(--border-hairline) hover:bg-(--bg-hover) active:scale-[0.98] transition-all cursor-pointer"
            onClick={onOpenReconcile}
          >
            <Scale className="w-4 h-4 stroke-[1.85]" />
            <span>平账校准</span>
          </button>
          <button
            type="button"
            className="h-9.5 rounded-sm inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-(--bg-surface) text-(--ink-secondary) border border-(--border-hairline) hover:bg-(--bg-hover) hover:text-(--ink-primary) active:scale-[0.98] transition-all cursor-pointer"
            onClick={onRecordForAccount}
          >
            <Plus className="w-4 h-4 stroke-2" />
            <span>记一笔</span>
          </button>
        </div>
      </div>

      <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-md p-4 mb-4 text-xs font-mono">
        <div className="text-[10px] text-(--ink-tertiary) uppercase tracking-wider mb-2 font-semibold">
          账户属性信息
        </div>
        <div className="divide-y divide-(--border-hairline)">
          <div className="flex justify-between py-2">
            <span className="text-(--ink-tertiary)">账户类型</span>
            <span className="text-(--ink-primary) font-medium">{getAccountTypeName(account.type)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-(--ink-tertiary)">结算币种</span>
            <span className="text-(--ink-primary) font-medium">{account.currency || 'CNY'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-(--ink-tertiary)">净资产统计</span>
            <span className="text-(--color-income) font-medium">计入个人净资产</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-(--ink-secondary)">账户流水</span>
          <span className="text-[11px] font-mono text-(--ink-tertiary)">共 {accountTxs.length} 笔</span>
        </div>

        <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-md overflow-hidden">
          {accountTxs.length === 0 ? (
            <div className="py-8 text-center text-xs text-(--ink-tertiary)">
              此账户暂无收支明细
            </div>
          ) : (
            accountTxs.map((tx, idx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                category={catMap.get(tx.categoryId)}
                account={acctMap.get(tx.accountId)}
                toAccount={tx.toAccountId ? acctMap.get(tx.toAccountId) : undefined}
                isLastInGroup={idx === accountTxs.length - 1}
                onClick={() => onSelectTransaction?.(tx)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountDetailSubPage;
