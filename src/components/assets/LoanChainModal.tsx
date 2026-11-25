import React, { useState, useMemo } from 'react';
import {
  ReceiptIcon as ReceiptText,
  CreditCardIcon as CreditCard,
  ArrowUpRightIcon as ArrowUpRight,
  ArrowDownLeftIcon as ArrowDownLeft,
} from '@phosphor-icons/react';
import type { Transaction } from '../../types/transaction';
import type { ActiveInstallment } from '../../domain/finance/amortization';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { PaperModal } from '../ui/PaperModal';
import { PaperCard } from '../ui/PaperCard';
import { PaperEmptyState } from '../ui/PaperEmptyState';
import { SegToggle } from '../ui/SegToggle';
import { cn } from '../../utils/cn';

export interface LoanChainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HubItem {
  id: string;
  kind: 'loan' | 'reimb' | 'installment';
  title: string;
  subtitle: string;
  amount: number;
  isExpenseOrDebt: boolean;
  statusLabel: string;
  transaction: Transaction;
  installment?: ActiveInstallment;
}

export const LoanChainModal: React.FC<LoanChainModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settlementSummary } = useLedgerStore();

  const [filterKind, setFilterKind] = useState<'all' | 'loan' | 'reimb' | 'installment'>('all');

  const allItems = useMemo(() => {
    const list: HubItem[] = [];

    for (const l of settlementSummary.pendingLoans) {
      const isLend = l.loanDirection === 'lend';
      const repaid = l.repaidAmount || 0;
      const rem = l.amount - repaid;
      const percent = l.amount > 0 ? Math.round((repaid / l.amount) * 100) : 0;
      let statusLabel = isLend ? '待收回' : '待偿还';
      if (repaid > 0) {
        statusLabel = `已还 ${percent}%`;
      }
      let title = isLend ? '借出本金' : '借入借款';
      if (l.loanParty) {
        title = isLend ? `借给 ${l.loanParty}` : `向 ${l.loanParty} 借入`;
      }
      const notePrefix = l.note ? `${l.note} · ` : '';
      const repaidText = repaid > 0 ? ` · 已还 ¥${centsToYuan(repaid)}` : '';
      const subtitle = `${notePrefix}本金 ¥${centsToYuan(l.amount)}${repaidText} · ${l.date}`;

      list.push({
        id: l.id,
        kind: 'loan',
        title,
        subtitle,
        amount: rem,
        isExpenseOrDebt: !isLend,
        statusLabel,
        transaction: l,
      });
    }

    for (const r of settlementSummary.pendingReimbursements) {
      const target = r.reimburseTarget ? ` · 报销给 ${r.reimburseTarget}` : '';
      const voucherText = r.voucher ? ' · 📎 凭证已附' : '';
      list.push({
        id: r.id,
        kind: 'reimb',
        title: r.note || '公费垫付',
        subtitle: `${r.date}${target}${voucherText}`,
        amount: r.amount,
        isExpenseOrDebt: false,
        statusLabel: '待报销',
        transaction: r,
      });
    }

    for (const inst of settlementSummary.pendingInstallments || []) {
      list.push({
        id: inst.transaction.id,
        kind: 'installment',
        title: inst.transaction.note || '分期消费',
        subtitle: `剩余 ${inst.remainingMonths}/${inst.months} 期 · 月供约 ¥${centsToYuan(inst.monthlyAmount)} · 总额 ¥${centsToYuan(inst.totalAmount)}`,
        amount: inst.remainingDebt,
        isExpenseOrDebt: true,
        statusLabel: '分期待还',
        transaction: inst.transaction,
        installment: inst,
      });
    }

    return list;
  }, [settlementSummary]);

  const filteredItems = useMemo(() => {
    if (filterKind === 'all') return allItems;
    return allItems.filter((i) => i.kind === filterKind);
  }, [allItems, filterKind]);

  const getEmptyTitle = () => {
    if (filterKind === 'loan') return '暂无未结借贷记录';
    if (filterKind === 'reimb') return '暂无待报销记录';
    if (filterKind === 'installment') return '暂无待还分期记录';
    return '暂无借贷与分期记录';
  };

  const renderEntryIcon = (entry: HubItem) => {
    if (entry.kind === 'installment') {
      return <CreditCard className="size-4" />;
    }
    if (entry.kind === 'reimb') {
      return <ReceiptText className="size-4" />;
    }
    if (entry.isExpenseOrDebt) {
      return <ArrowDownLeft className="size-4" />;
    }
    return <ArrowUpRight className="size-4" />;
  };

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={onClose}
      title="借贷与分期"
    >
      <div className="space-y-3.5 p-4 select-none">
        <SegToggle
          options={[
            { value: 'all', label: '全部' },
            { value: 'loan', label: '借贷' },
            { value: 'reimb', label: '报销' },
            { value: 'installment', label: '分期' },
          ]}
          value={filterKind}
          onChange={(val) => setFilterKind(val as typeof filterKind)}
          size="sm"
          fullWidth
        />

        {filteredItems.length === 0 ? (
          <PaperEmptyState
            title={getEmptyTitle()}
            variant="dashed"
          />
        ) : (
          <div className="space-y-2.5">
            {filteredItems.map((entry) => (
              <PaperCard
                key={entry.id}
                rounded="sm"
                padding="sm"
                className="flex items-center justify-between gap-3 shadow-xs select-none"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-(--badge-radius) bg-(--paper-sunken)',
                      entry.isExpenseOrDebt ? 'text-(--color-expense)' : 'text-(--color-income)'
                    )}
                  >
                    {renderEntryIcon(entry)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-xs font-bold text-(--ink-primary)">
                        {entry.title}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold',
                          entry.isExpenseOrDebt
                            ? 'bg-(--color-expense-bg) text-(--color-expense)'
                            : 'bg-(--color-income-bg) text-(--color-income)'
                        )}
                      >
                        {entry.statusLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-(--ink-tertiary)">
                      {entry.subtitle}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div
                    className={cn(
                      'font-mono text-xs font-bold tabular-nums',
                      entry.isExpenseOrDebt ? 'text-(--color-expense)' : 'text-(--color-income)'
                    )}
                  >
                    {entry.isExpenseOrDebt ? `-¥${centsToYuan(entry.amount)}` : `+¥${centsToYuan(entry.amount)}`}
                  </div>
                  <div className="font-mono text-[10px] text-(--ink-faint)">
                    {entry.isExpenseOrDebt ? '待还欠款' : '待收资产'}
                  </div>
                </div>
              </PaperCard>
            ))}
          </div>
        )}
      </div>
    </PaperModal>
  );
};

export default LoanChainModal;
