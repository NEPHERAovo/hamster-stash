import React from 'react';
import type { Account } from '../../types/account';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { cn } from '../../utils/cn';

export interface AccountListProps {
  accounts: Account[];
  onSelectAccount: (account: Account) => void;
  onAddAccount?: () => void;
}

export const AccountList: React.FC<AccountListProps> = ({
  accounts,
  onSelectAccount,
}) => {
  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'ewallet':
        return '电子钱包';
      case 'bank':
        return '储蓄卡';
      case 'credit':
        return '信用卡';
      case 'cash':
        return '现金';
      case 'investment':
        return '投资理财';
      default:
        return '账户';
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-1 pb-1.5 select-none">
        <span className="text-xs font-mono text-(--ink-tertiary) uppercase tracking-wider">
          账户资产
        </span>
        <span className="text-[11px] font-mono text-(--ink-faint)">
          共 {accounts.length} 笔
        </span>
      </div>

      <div className="bg-(--paper-sheet) paper-card border border-(--rule-hairline) select-none transition-all duration-200 rounded-(--radius-md) overflow-hidden shadow-xs">
        {accounts.map((acct) => {
          const Icon = getCategoryIcon(acct.icon || 'wallet');
          const isNegative = acct.balance < 0;

          return (
            <div
              key={acct.id}
              onClick={() => onSelectAccount(acct)}
              className="entry-row flex items-center justify-between px-3.5 py-2.5 cursor-pointer transition-all duration-150 border-b border-dashed border-(--rule-hairline)/60 last:border-b-0 hover:bg-(--paper-hover)/50 active:bg-(--paper-sunken)/40"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-7 h-7 flex items-center justify-center text-(--ink-secondary) shrink-0 rounded-(--badge-radius) bg-(--paper-sunken)">
                  <Icon className="w-3.5 h-3.5 stroke-[1.8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-(--ink-primary) truncate">
                    {acct.name}
                  </div>
                  <div className="text-[10px] font-mono text-(--ink-tertiary)">
                    {getAccountTypeLabel(acct.type)}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right ml-2.5">
                <span
                  className={cn(
                    'font-mono text-sm font-semibold tabular-nums',
                    isNegative ? 'text-(--color-expense)' : 'text-(--ink-solid)'
                  )}
                >
                  ¥ {centsToYuan(acct.balance)}
                </span>
                <div className="text-[10px] font-mono text-(--ink-tertiary)">
                  {acct.currency}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AccountList;
