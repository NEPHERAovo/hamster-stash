import React from 'react';
import type { Transaction } from '../../types/transaction';
import type { Category } from '../../types/category';
import type { Account } from '../../types/account';
import { TransactionItem } from './TransactionItem';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { cn } from '../../utils/cn';
import { parseLocalDate } from '../../utils/date';

export interface SkinTransactionGroupProps {
  visibleDates: string[];
  groups: Record<string, Transaction[]>;
  offsetMap: Map<string, number>;
  expenseNoteMap: Map<string, string>;
  catMap: Map<string, Category>;
  acctMap: Map<string, Account>;
  activeFreshId?: string | null;
  contained?: boolean;
  onSelectTransaction?: (tx: Transaction) => void;
}

const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const PaperTransactionGroup: React.FC<SkinTransactionGroupProps> = ({
  visibleDates,
  groups,
  offsetMap,
  expenseNoteMap,
  catMap,
  acctMap,
  activeFreshId,
  contained = false,
  onSelectTransaction,
}) => {
  return (
    <>
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

        const d = parseLocalDate(date);
        const dayCode = !d.isValid()
          ? date
          : `${d.format('DD')} ${dayNames[d.day()]}`;

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
              'mb-3.5 bg-(--paper-sheet) rounded-[2px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.12)] border border-(--rule-hairline) overflow-hidden select-none'
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
    </>
  );
};

export default PaperTransactionGroup;
