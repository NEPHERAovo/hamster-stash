import React, { useState, useMemo } from 'react';
import { Receipt as ReceiptText, CheckCircle as CheckCircle2, Calendar, Eye } from '@phosphor-icons/react';
import type { Transaction } from '../../types/transaction';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { toast } from '../../stores/useToastStore';
import { PaperModal } from '../ui/PaperModal';
import { cn } from '../../utils/cn';

export interface LoanChainModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoanChainModal: React.FC<LoanChainModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    settlementSummary,
    settleLoanOrigin,
    settleReimbursement,
    transactions,
  } = useLedgerStore();
  const { accounts } = useAccountStore();

  const [activeTabId, setActiveTabId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const allItems = useMemo(() => {
    const list: Array<{
      id: string;
      kind: 'loan' | 'reimb';
      item: Transaction;
      title: string;
      remainingAmount: number;
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

    return list;
  }, [settlementSummary]);

  const activeEntry = useMemo(() => {
    if (allItems.length === 0) return null;
    const found = allItems.find((e) => e.id === activeTabId);
    return found || allItems[0];
  }, [allItems, activeTabId]);

  const currentItem = activeEntry?.item;
  const isLoan = activeEntry?.kind === 'loan';
  const totalAmount = currentItem ? currentItem.amount : 0;
  const repaidAmount = currentItem ? (currentItem.repaidAmount || 0) : 0;
  let remainingAmount = 0;
  if (currentItem) {
    remainingAmount = isLoan ? totalAmount - repaidAmount : totalAmount;
  }

  const progressPercent = totalAmount > 0 ? Math.round((repaidAmount / totalAmount) * 100) : 0;

  const getLoanBadgeText = () => {
    if (!isLoan) return '待报销垫付';
    if (currentItem?.loanStatus === 'settled') return '已结清';
    return `还款中 (${progressPercent}%)`;
  };

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
      title="借贷与报销结算"
    >
      <div className="p-4 space-y-3.5 select-none">
        {allItems.length === 0 ? (
          <div className="py-12 text-center text-xs text-(--ink-tertiary) space-y-2">
            <CheckCircle2 className="w-8 h-8 text-(--color-income) mx-auto opacity-75" />
            <p className="text-sm font-medium text-(--ink-secondary)">暂无待收或待报销记录</p>
          </div>
        ) : (
          <>
            <div className="flex bg-(--paper-sunken) p-1 rounded-(--radius-sm) gap-1 overflow-x-auto no-scrollbar">
              {allItems.map((entry) => {
                const isSelected = activeEntry?.id === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setActiveTabId(entry.id)}
                    className={cn(
                      'flex-1 min-w-[130px] py-1.5 px-2.5 text-xs rounded-(--btn-radius) font-medium transition-all cursor-pointer truncate',
                      isSelected
                        ? 'bg-(--paper-sheet) text-(--ink-primary) font-bold shadow-xs'
                        : 'text-(--ink-tertiary) hover:text-(--ink-primary)'
                    )}
                  >
                    {entry.title} (待收 ¥{centsToYuan(entry.remainingAmount)})
                  </button>
                );
              })}
            </div>

            {currentItem && (
              <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-md) p-3.5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-(--ink-primary)">
                      {isLoan
                        ? `借给${currentItem.loanParty || '朋友'} · 临时周转`
                        : `${currentItem.note || '公费垫付'} · 发票报销`}
                    </h3>
                    <p className="text-[11px] font-mono text-(--ink-tertiary) mt-0.5">
                      发起日期：{currentItem.date}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-bold font-mono px-2 py-0.5 rounded-full',
                      isLoan && currentItem.loanStatus === 'settled'
                        ? 'bg-(--color-income-bg) text-(--color-income)'
                        : 'bg-(--color-accent-bg) text-(--color-accent)'
                    )}
                  >
                    {getLoanBadgeText()}
                  </span>
                </div>

                <div className="w-full h-1.5 bg-(--paper-sunken) rounded-full overflow-hidden">
                  <div
                    className="h-full bg-(--color-income) transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 text-center pt-2 border-t border-dashed border-(--rule-hairline) font-mono">
                  <div>
                    <span className="text-[10px] font-semibold text-(--ink-tertiary) block uppercase tracking-wider">
                      {isLoan ? '借出本金' : '垫付总额'}
                    </span>
                    <span className="text-sm font-bold text-(--ink-primary) tabular-nums mt-0.5 block">
                      ¥{centsToYuan(totalAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-(--ink-tertiary) block uppercase tracking-wider">
                      {isLoan ? '已还金额' : '已报金额'}
                    </span>
                    <span className="text-sm font-bold text-(--color-income) tabular-nums mt-0.5 block">
                      ¥{centsToYuan(repaidAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-(--ink-tertiary) block uppercase tracking-wider">
                      待收结余
                    </span>
                    <span className="text-sm font-bold text-(--color-accent) tabular-nums mt-0.5 block">
                      ¥{centsToYuan(remainingAmount)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {currentItem?.voucher && (
              <div className="flex items-center justify-between p-2.5 bg-(--paper-sunken) border border-(--rule-hairline) rounded-(--radius-sm) text-xs">
                <div className="flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-(--color-accent)" />
                  <div>
                    <div className="font-semibold text-(--ink-primary)">{currentItem.voucher.name}</div>
                    <div className="text-[10px] font-mono text-(--ink-tertiary)">{currentItem.voucher.size} · 原始凭证</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toast(`查验凭证：${currentItem.voucher?.name}`)}
                  className="px-2 py-1 rounded-(--btn-radius) bg-(--paper-sheet) border border-(--rule-hairline) flex items-center gap-1 text-(--ink-secondary) text-[11px] hover:text-(--ink-primary) cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>查验凭证</span>
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-(--ink-tertiary) block">
                关联记录与结算时间轴
              </span>
              <div className="bg-(--paper-sheet) border border-(--rule-hairline) rounded-(--radius-sm) p-2.5 space-y-2 text-xs">
                {relatedTxs.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-1 border-b border-(--rule-hairline) last:border-none">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-(--ink-tertiary)" />
                      <div>
                        <span className="font-medium text-(--ink-primary)">
                          {t.note || (t.loanRole === 'repayment' ? '收回还款' : '初始借出款')}
                        </span>
                        <span className="text-[10px] font-mono text-(--ink-tertiary) block">{t.date}</span>
                      </div>
                    </div>
                    <span className={cn('font-bold font-mono tabular-nums', t.loanRole === 'repayment' ? 'text-(--color-income)' : 'text-(--ink-primary)')}>
                      {t.loanRole === 'repayment' ? `+¥${centsToYuan(t.amount)}` : `¥${centsToYuan(t.amount)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {remainingAmount > 0 && (
              <div className="pt-2 pb-(--safe-bottom)">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSettle}
                  className="w-full h-10 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>一键结清剩余 ¥{centsToYuan(remainingAmount)}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PaperModal>
  );
};

export default LoanChainModal;
