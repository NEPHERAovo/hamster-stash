import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import type { PendingSettlementSummary } from '../../domain/transaction/transactionService';
import { useThemeStore } from '../../stores/useThemeStore';
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
  const uiStyle = useThemeStore((s) => s.uiStyle);
  const isModern = uiStyle === 'modern';

  return (
    <div
      className={cn(
        'relative w-full p-4 sm:p-5 bg-(--paper-sheet) border border-(--rule-hairline) select-none transition-all duration-200',
        isModern
          ? 'rounded-[22px] backdrop-blur-xl shadow-md rotate-0'
          : 'border-b-0 -rotate-[0.2deg] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.25)] paper-deckle-bottom',
        className
      )}
    >
      {!isModern && <div className="washi-tape absolute -top-2 left-1/2 -translate-x-1/2 z-10" />}

      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-mono font-medium text-(--ink-tertiary)">净资产总额</span>
        <span className="real-stamp stamp-income text-(--color-income) text-[9px] px-1 py-0.5">
          资产稳健
        </span>
      </div>

      <div className="font-mono text-2xl sm:text-3xl font-bold text-(--ink-solid) tracking-tight tabular-nums leading-tight mb-2">
        ¥ {centsToYuan(netWorthCents)}
      </div>

      {summary && (
        <div
          onClick={onClickLoanHub}
          className={cn(
            'pt-2.5 mt-1 border-t flex items-center justify-between cursor-pointer transition-all -mx-1 px-1',
            isModern
              ? 'border-(--rule-hairline) rounded-xl hover:bg-(--paper-sunken)/70 p-2'
              : 'border-dashed border-(--rule-hairline) hover:bg-(--paper-hover)/50 active:scale-[0.99] rounded-xs'
          )}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'w-6 h-6 flex items-center justify-center text-(--color-accent) shrink-0',
                isModern ? 'rounded-full bg-(--paper-sunken)' : 'rounded-xs bg-(--paper-sunken)'
              )}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 stroke-[1.8]" />
            </div>
            <div>
              <div className="text-xs font-semibold text-(--ink-primary)">借贷与报销</div>
              <div className="text-[10px] font-mono text-(--ink-tertiary)">
                待收款 ¥{centsToYuan(summary.lendPendingAmount)} · 待报销 ¥{centsToYuan(summary.reimbPendingAmount)}
              </div>
            </div>
          </div>
          <span
            className={cn(
              'font-mono text-[11px] font-semibold px-2 py-0.5 bg-(--paper-sunken) text-(--color-accent) shrink-0',
              isModern ? 'rounded-full' : 'rounded-[3px]'
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
