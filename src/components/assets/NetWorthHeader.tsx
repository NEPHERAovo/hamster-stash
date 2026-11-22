import React from 'react';
import { ArrowsLeftRightIcon as ArrowLeftRight } from '@phosphor-icons/react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { PendingSettlementSummary } from '../../domain/transaction/transactionService';
import { cn } from '../../utils/cn';

export interface NetWorthHeaderProps {
  netWorthCents: number;
  summary?: PendingSettlementSummary | null;
  onClickLoanHub?: () => void;
  className?: string;
}

export const NetWorthHeader: React.FC<NetWorthHeaderProps> = ({
  netWorthCents,
  summary,
  onClickLoanHub,
  className,
}) => {
  return (
    <div
      className={cn(
        'relative w-full border border-(--rule-hairline) bg-(--paper-sheet) p-4 transition-all duration-200 select-none sm:p-5',
        'paper-deckle-bottom paper-summary-card',
        className
      )}
    >
      <div className="washi-tape absolute -top-2 left-1/2 z-10 -translate-x-1/2" />

      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[11px] font-medium text-(--ink-tertiary)">净资产总额</span>
        <span className="real-stamp stamp-income px-1 py-0.5 text-[9px] text-(--color-income)">
          资产稳健
        </span>
      </div>

      <div className="mb-2 font-mono text-2xl leading-tight font-bold tracking-tight text-(--ink-solid) tabular-nums sm:text-3xl">
        ¥ {centsToYuan(netWorthCents)}
      </div>

      {summary && (
        <div
          onClick={onClickLoanHub}
          className="-mx-1 mt-1 flex cursor-pointer items-center justify-between rounded-(--radius-sm) border-t border-dashed border-(--rule-hairline) px-1 pt-2.5 transition-all hover:bg-(--paper-hover)/50"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken) text-(--color-accent)">
              <ArrowLeftRight className="stroke-1.8 size-3.5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-(--ink-primary)">借贷与分期</div>
              <div className="font-mono text-[10px] text-(--ink-tertiary)">
                待收款 ¥{centsToYuan(summary.lendPendingAmount + summary.reimbPendingAmount)} · 待还款 ¥{centsToYuan(summary.borrowPendingAmount + (summary.installmentPendingAmount || 0))}
              </div>
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-(--btn-radius) bg-(--paper-sunken) px-2 py-0.5 font-mono text-[11px] font-semibold',
              summary.netPendingAmount > 0 && 'text-(--color-income)',
              summary.netPendingAmount < 0 && 'text-(--color-expense)',
              summary.netPendingAmount === 0 && 'text-(--color-accent)'
            )}
          >
            待结算 {summary.netPendingAmount >= 0 ? `+¥${centsToYuan(summary.netPendingAmount)}` : `-¥${centsToYuan(Math.abs(summary.netPendingAmount))}`}
          </span>
        </div>
      )}
    </div>
  );
};

export default NetWorthHeader;
