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
import { useAccountStore } from '../../stores/useAccountStore';
import { toast } from '../../stores/useToastStore';
import { PaperModal } from '../ui/PaperModal';
import { PaperButton } from '../ui/PaperButton';
import { PaperEmptyState } from '../ui/PaperEmptyState';
import { SegToggle } from '../ui/SegToggle';
import { cn } from '../../utils/cn';

export interface LoanChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTransaction?: (transaction: Transaction) => void;
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
  onSelectTransaction,
}) => {
  const {
    settlementSummary,
    settleLoanOrigin,
    settleReimbursement,
  } = useLedgerStore();
  const { accounts } = useAccountStore();

  const [filterKind, setFilterKind] = useState<'all' | 'loan' | 'reimb' | 'installment'>('all');
  const [loading, setLoading] = useState(false);

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
      list.push({
        id: l.id,
        kind: 'loan',
        title,
        subtitle: l.note ? `${l.note} · ${l.date}` : l.date,
        amount: rem,
        isExpenseOrDebt: !isLend,
        statusLabel,
        transaction: l,
      });
    }

    for (const r of settlementSummary.pendingReimbursements) {
      const target = r.reimburseTarget ? ` · 报销给 ${r.reimburseTarget}` : '';
      list.push({
        id: r.id,
        kind: 'reimb',
        title: r.note || '公费垫付',
        subtitle: `${r.date}${target}${r.voucher ? ' · 📎 凭证已附' : ''}`,
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
        subtitle: `剩余 ${inst.remainingMonths}/${inst.months} 期 · 每月约 ¥${centsToYuan(inst.monthlyAmount)}`,
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

  const handleSettle = async (item: HubItem) => {
    if (accounts.length === 0) return;
    setLoading(true);
    try {
      const defaultAcctId = accounts[0].id;
      if (item.kind === 'loan') {
        await settleLoanOrigin(item.transaction.id, defaultAcctId);
      } else if (item.kind === 'reimb') {
        await settleReimbursement(item.transaction.id, defaultAcctId);
      }
      onClose();
      toast.success(item.kind === 'loan' ? '借贷流水核销成功' : '报销待收结算成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '结算失败');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="py-8">
            <PaperEmptyState
              title={getEmptyTitle()}
              variant="dashed"
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredItems.map((entry) => (
              <div
                key={entry.id}
                className="paper-card flex items-center justify-between gap-3 rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sheet) p-3 shadow-xs select-none"
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

                <div className="flex shrink-0 items-center gap-2.5">
                  <div className="text-right">
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

                  {entry.kind === 'installment' ? (
                    <PaperButton
                      variant="secondary"
                      size="xs"
                      onClick={() => {
                        onClose();
                        onSelectTransaction?.(entry.transaction);
                      }}
                    >
                      查看流水
                    </PaperButton>
                  ) : (
                    <PaperButton
                      variant="secondary"
                      size="xs"
                      disabled={loading}
                      onClick={() => handleSettle(entry)}
                    >
                      {entry.kind === 'reimb' ? '报销到账' : '一键结清'}
                    </PaperButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PaperModal>
  );
};

export default LoanChainModal;
