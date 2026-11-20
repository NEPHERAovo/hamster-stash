import React from 'react';
import type { SkinTransactionGroupProps } from './PaperTransactionGroup';
import { TransactionItem } from './TransactionItem';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { cn } from '../../utils/cn';
import { parseLocalDate } from '../../utils/date';

const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export const ModernTransactionGroup: React.FC<SkinTransactionGroupProps> = ({
  visibleDates,
  groups,
  offsetMap,
  expenseNoteMap,
  catMap,
  acctMap,
  activeFreshId,
  contained = false,
  isSearching = false,
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
        let dayNum = date;
        if (d.isValid()) {
          dayNum = isSearching ? d.format('YYYY年M月D日') : `${d.format('DD')}日`;
        }
        const dayWeek = d.isValid() ? dayNames[d.day()] || '' : '';

        const daySumFormatted =
          dayNet >= 0
            ? `+¥${centsToYuan(dayNet)}`
            : `-¥${centsToYuan(Math.abs(dayNet))}`;

        return (
          <div key={date} className={cn(contained ? 'mx-0' : 'mx-4', 'mb-4 select-none')}>
            <div className="day-divider flex items-center justify-between px-1 pb-1.5 text-xs text-(--ink-secondary)">
              <div className="flex items-center gap-1.5 font-sans font-semibold">
                <span className="text-[13px] font-bold text-(--ink-primary)">
                  {dayNum}
                </span>
                <span className="text-xs text-(--ink-tertiary)">
                  {dayWeek}
                </span>
                <span className="text-[11px] text-(--ink-tertiary)">
                  · {txList.length}笔
                </span>
              </div>
              <span
                className={cn(
                  'font-mono text-xs tabular-nums font-semibold shrink-0',
                  dayNet >= 0 ? 'text-(--color-income)' : 'text-(--ink-tertiary)'
                )}
              >
                {daySumFormatted}
              </span>
            </div>

            <div className="bg-(--paper-sheet) rounded-[22px] backdrop-blur-xl shadow-sm overflow-hidden border-none">
              {txList.map((tx, idx) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  category={catMap.get(tx.categoryId)}
                  account={acctMap.get(tx.accountId)}
                  toAccount={tx.toAccountId ? acctMap.get(tx.toAccountId) : undefined}
                  isFresh={activeFreshId === tx.id}
                  isLastInGroup={idx === txList.length - 1}
                  showDate={isSearching}
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

export default ModernTransactionGroup;
