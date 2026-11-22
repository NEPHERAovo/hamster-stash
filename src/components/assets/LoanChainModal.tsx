import React, { useState, useMemo } from 'react';
import { ReceiptIcon as ReceiptText, CheckCircleIcon as CheckCircle2, CalendarIcon as Calendar, EyeIcon as Eye } from '@phosphor-icons/react';
import type { Transaction } from '../../types/transaction';
import type { ActiveInstallment } from '../../domain/finance/amortization';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { toast } from '../../stores/useToastStore';
import { PaperModal } from '../ui/PaperModal';
import { PaperButton } from '../ui/PaperButton';
import { PaperChip } from '../ui/PaperChip';
import { SegToggle } from '../ui/SegToggle';
import { cn } from '../../utils/cn';

export interface LoanChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTransaction?: (transaction: Transaction) => void;
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
    transactions,
  } = useLedgerStore();
  const { accounts } = useAccountStore();

  const [filterKind, setFilterKind] = useState<'all' | 'loan' | 'reimb' | 'installment'>('all');
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const allItems = useMemo(() => {
    const list: Array<{
      id: string;
      kind: 'loan' | 'reimb' | 'installment';
      item: Transaction;
      title: string;
      remainingAmount: number;
      installment?: ActiveInstallment;
    }> = [];

    for (const l of settlementSummary.pendingLoans) {
      const rem = l.amount - (l.repaidAmount || 0);
      list.push({
        id: l.id,
        kind: 'loan',
        item: l,
        title: `${l.loanParty || '借款'} · 借据`,
        remainingAmount: rem,
      });
    }

    for (const r of settlementSummary.pendingReimbursements) {
      list.push({
        id: r.id,
        kind: 'reimb',
        item: r,
        title: `${r.note || r.reimburseTarget || '垫付'} · 发票`,
        remainingAmount: r.amount,
      });
    }

    for (const inst of settlementSummary.pendingInstallments || []) {
      list.push({
        id: inst.transaction.id,
        kind: 'installment',
        item: inst.transaction,
        title: `${inst.transaction.note || '分期消费'} · 分期`,
        remainingAmount: inst.remainingDebt,
        installment: inst,
      });
    }

    return list;
  }, [settlementSummary]);

  const filteredItems = useMemo(() => {
    if (filterKind === 'all') return allItems;
    return allItems.filter((i) => i.kind === filterKind);
  }, [allItems, filterKind]);

  const activeEntry = useMemo(() => {
    if (filteredItems.length === 0) return null;
    const found = filteredItems.find((e) => e.id === activeTabId);
    return found || filteredItems[0];
  }, [filteredItems, activeTabId]);

  const currentItem = activeEntry?.item;
  const isLoan = activeEntry?.kind === 'loan';
  const isReimb = activeEntry?.kind === 'reimb';
  const isInstallment = activeEntry?.kind === 'installment';
  const activeInstallment = activeEntry?.installment;

  let totalAmount = 0;
  let repaidAmount = 0;
  let remainingAmount = 0;

  if (isInstallment && activeInstallment) {
    totalAmount = activeInstallment.totalAmount;
    remainingAmount = activeInstallment.remainingDebt;
    repaidAmount = totalAmount - remainingAmount;
  } else if (currentItem) {
    totalAmount = currentItem.amount;
    repaidAmount = currentItem.repaidAmount || 0;
    remainingAmount = isLoan ? totalAmount - repaidAmount : totalAmount;
  }

  const progressPercent = totalAmount > 0 ? Math.round((repaidAmount / totalAmount) * 100) : 0;

  const getBadgeText = () => {
    if (isInstallment && activeInstallment) {
      return `已还 ${activeInstallment.elapsedMonths}/${activeInstallment.months} 期 (${progressPercent}%)`;
    }
    if (isReimb) return '待报销垫付';
    if (currentItem?.loanStatus === 'settled') return '已结清';
    return `还款中 (${progressPercent}%)`;
  };

  let detailTitle = `${currentItem?.note || '公费垫付'} · 发票报销`;
  if (isInstallment) {
    detailTitle = `${currentItem?.note || '分期消费'} · 消费分期`;
  } else if (isLoan) {
    detailTitle = `借给${currentItem?.loanParty || '朋友'} · 临时周转`;
  }

  const badgeClass =
    isLoan && currentItem?.loanStatus === 'settled'
      ? 'bg-(--color-income-bg) text-(--color-income)'
      : 'bg-(--color-accent-bg) text-(--color-accent)';

  let totalLabel = '垫付总额';
  let repaidLabel = '已报金额';
  let remainingLabel = '待收结余';
  if (isInstallment) {
    totalLabel = '分期总额';
    repaidLabel = '已摊金额';
    remainingLabel = '待还欠款';
  } else if (isLoan) {
    totalLabel = '借出本金';
    repaidLabel = '已还金额';
    remainingLabel = '待收结余';
  }

  const relatedTxs = transactions.filter(
    (t) =>
      t.id === currentItem?.id ||
      t.relatedLoanId === currentItem?.id
  );

  const handleSettle = async () => {
    if (!currentItem || accounts.length === 0) return;
    setLoading(true);
    try {
      const defaultAcctId = accounts[0].id;
      if (isLoan) {
        await settleLoanOrigin(currentItem.id, defaultAcctId);
      } else {
        await settleReimbursement(currentItem.id, defaultAcctId);
      }
      onClose();
      toast.success(isLoan ? '借贷流水核销成功' : '报销待收结算成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '结算失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={onClose}
      title="往来借贷与分期结算"
    >
      <div className="space-y-3.5 p-4 select-none">
        {allItems.length === 0 ? (
          <div className="space-y-2 py-12 text-center text-xs text-(--ink-tertiary)">
            <CheckCircle2 className="mx-auto size-8 text-(--color-income) opacity-75" />
            <p className="text-sm font-medium text-(--ink-secondary)">暂无往来待收、待还或分期记录</p>
          </div>
        ) : (
          <>
            <div className="mx-auto max-w-72">
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
              />
            </div>

            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-(--ink-tertiary)">
                该分类下暂无记录
              </div>
            ) : (
              <>
                <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-(--radius-sm) bg-(--paper-sunken) p-1">
                  {filteredItems.map((entry) => {
                    const isSelected = activeEntry?.id === entry.id;
                    return (
                      <PaperChip
                        key={entry.id}
                        selected={isSelected}
                        onClick={() => setActiveTabId(entry.id)}
                        className="min-w-[130px] flex-1"
                      >
                        {entry.title} ({entry.kind === 'installment' ? '待还' : '待收'} ¥{centsToYuan(entry.remainingAmount)})
                      </PaperChip>
                    );
                  })}
                </div>

                {currentItem && (
                  <div className="space-y-3 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sheet) p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-(--ink-primary)">
                          {detailTitle}
                        </h3>
                        <p className="mt-0.5 font-mono text-[11px] text-(--ink-tertiary)">
                          发起日期：{currentItem.date}
                          {isInstallment && activeInstallment && ` · 期限 ${activeInstallment.months} 期`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 font-mono text-[10px] font-bold',
                          badgeClass
                        )}
                      >
                        {getBadgeText()}
                      </span>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--paper-sunken)">
                      <div
                        className="h-full bg-(--color-income) transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 border-t border-dashed border-(--rule-hairline) pt-2 text-center font-mono">
                      <div>
                        <span className="block text-[10px] font-semibold tracking-wider text-(--ink-tertiary) uppercase">
                          {totalLabel}
                        </span>
                        <span className="mt-0.5 block text-sm font-bold text-(--ink-primary) tabular-nums">
                          ¥{centsToYuan(totalAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-semibold tracking-wider text-(--ink-tertiary) uppercase">
                          {repaidLabel}
                        </span>
                        <span className="mt-0.5 block text-sm font-bold text-(--color-income) tabular-nums">
                          ¥{centsToYuan(repaidAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] font-semibold tracking-wider text-(--ink-tertiary) uppercase">
                          {remainingLabel}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 block text-sm font-bold tabular-nums',
                            isInstallment ? 'text-(--color-expense)' : 'text-(--color-accent)'
                          )}
                        >
                          ¥{centsToYuan(remainingAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {isInstallment && activeInstallment && (
                  <div className="flex items-center justify-between rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sunken) p-2.5 text-xs">
                    <div>
                      <div className="font-semibold text-(--ink-primary)">
                        每月月供约 ¥{centsToYuan(activeInstallment.monthlyAmount)}
                      </div>
                      <div className="font-mono text-[10px] text-(--ink-tertiary)">
                        剩余 {activeInstallment.remainingMonths} 期待摊还款
                      </div>
                    </div>
                  </div>
                )}

                {currentItem?.voucher && (
                  <div className="flex items-center justify-between rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sunken) p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="size-4 text-(--color-accent)" />
                      <div>
                        <div className="font-semibold text-(--ink-primary)">{currentItem.voucher.name}</div>
                        <div className="font-mono text-[10px] text-(--ink-tertiary)">{currentItem.voucher.size} · 原始凭证</div>
                      </div>
                    </div>
                    <PaperButton
                      variant="secondary"
                      size="xs"
                      leftIcon={<Eye className="size-3" />}
                      onClick={() => toast(`查验凭证：${currentItem.voucher?.name}`)}
                    >
                      查验凭证
                    </PaperButton>
                  </div>
                )}

                {!isInstallment && relatedTxs.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-(--ink-tertiary)">
                      关联记录与结算时间轴
                    </span>
                    <div className="space-y-2 rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sheet) p-2.5 text-xs">
                      {relatedTxs.map((t) => (
                        <div key={t.id} className="flex items-center justify-between border-b border-(--rule-hairline) py-1 last:border-none">
                          <div className="flex items-center gap-2">
                            <Calendar className="size-3.5 text-(--ink-tertiary)" />
                            <div>
                              <span className="font-medium text-(--ink-primary)">
                                {t.note || (t.loanRole === 'repayment' ? '收回还款' : '初始借出款')}
                              </span>
                              <span className="block font-mono text-[10px] text-(--ink-tertiary)">{t.date}</span>
                            </div>
                          </div>
                          <span className={cn('font-mono font-bold tabular-nums', t.loanRole === 'repayment' ? 'text-(--color-income)' : 'text-(--ink-primary)')}>
                            {t.loanRole === 'repayment' ? `+¥${centsToYuan(t.amount)}` : `¥${centsToYuan(t.amount)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {remainingAmount > 0 && (
                  <div className="pt-2 pb-(--safe-bottom)">
                    {isInstallment ? (
                      <PaperButton
                        variant="primary"
                        size="md"
                        fullWidth
                        leftIcon={<Eye className="size-3.5" />}
                        onClick={() => {
                          onClose();
                          if (currentItem) onSelectTransaction?.(currentItem);
                        }}
                      >
                        查看分期账单流水
                      </PaperButton>
                    ) : (
                      <PaperButton
                        variant="primary"
                        size="md"
                        fullWidth
                        disabled={loading}
                        leftIcon={<CheckCircle2 className="size-3.5" />}
                        onClick={handleSettle}
                      >
                        一键结清剩余 ¥{centsToYuan(remainingAmount)}
                      </PaperButton>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </PaperModal>
  );
};

export default LoanChainModal;
