import React, { useMemo } from 'react';
import { Scale, Trash2 } from 'lucide-react';
import type { Account } from '../../types/account';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { TransactionItem } from '../ledger/TransactionItem';
import { toast } from '../../stores/useToastStore';
import { cn } from '../../utils/cn';

export interface AccountDetailSubPageProps {
  account: Account;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onOpenReconcile?: () => void;
  onDeleteAccount?: (account: Account) => void;
  onSelectTransaction?: (tx: Transaction) => void;
}

export const AccountDetailSubPage: React.FC<AccountDetailSubPageProps> = ({
  account,
  transactions,
  categories,
  accounts,
  onOpenReconcile,
  onDeleteAccount,
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

  const handleDeleteClick = () => {
    if (accounts.length <= 1) {
      toast.error('系统至少需保留一个资金账户');
      return;
    }
    const hasTxs = accountTxs.length > 0;
    const msg = hasTxs
      ? `该账户下已有 ${accountTxs.length} 条交易流水，删除账户将同时清除关联流水，是否确认删除？`
      : `确认删除账户「${account.name}」吗？`;
    if (window.confirm(msg)) {
      onDeleteAccount?.(account);
    }
  };

  const isNetPositive = netFlow >= 0;

  return (
    <div className="w-full pb-6 pt-1 px-4">
      <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) shadow-xs p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-(--badge-radius) bg-(--paper-sunken) text-(--color-income) flex items-center justify-center shrink-0">
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

        <div className="grid grid-cols-3 text-center py-3 border-y border-dashed border-(--rule-hairline) mb-3.5">
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

        {onOpenReconcile && (
          <button
            type="button"
            className="w-full h-9 rounded-(--btn-radius) inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-hover) active:scale-[0.98] transition-all cursor-pointer border border-(--rule-hairline)"
            onClick={onOpenReconcile}
          >
            <Scale className="w-4 h-4 stroke-[1.85]" />
            <span>平账校准</span>
          </button>
        )}
      </div>

      <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) p-4 mb-4 text-xs font-mono">
        <div className="text-[10px] text-(--ink-tertiary) uppercase tracking-wider mb-2 font-semibold">
          账户属性信息
        </div>
        <div className="divide-y divide-(--rule-hairline)">
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
