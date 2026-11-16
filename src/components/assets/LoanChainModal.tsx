import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowLeftRight,
  ReceiptText,
  CheckCircle2,
  Calendar,
  Eye,
} from 'lucide-react';
import type { Transaction } from '../../types/transaction';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { toast } from '../../stores/useToastStore';
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

  if (!isOpen) return null;

  const currentItem = activeEntry?.item;
  const isLoan = activeEntry?.kind === 'loan';
  const totalAmount = currentItem ? currentItem.amount : 0;
  const repaidAmount = currentItem ? (currentItem.repaidAmount || 0) : 0;
  const remainingAmount = currentItem
    ? isLoan
      ? totalAmount - repaidAmount
      : totalAmount
    : 0;

  const progressPercent = totalAmount > 0 ? Math.round((repaidAmount / totalAmount) * 100) : 0;

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] modal-backdrop-fade"
      onClick={onClose}
    >
      <div
        className="w-full max-w-full sm:max-w-lg md:max-w-xl max-h-[90vh] bg-(--bg-base) rounded-t-sm sm:rounded-b-sm sm:mb-6 shadow-(--shadow-lg) sm:shadow-2xl flex flex-col overflow-hidden sheet-slide-up border-t border-(--border-default)"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="notepad-spine py-1 px-4 flex items-center justify-between cursor-pointer select-none"
          onClick={onClose}
          title="关闭"
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-none bg-(--color-accent) opacity-80" />
            <span className="font-mono text-[10px] tracking-widest text-[#EAE7E1] uppercase">
              Settlement Ledger · 核销中心
            </span>
          </div>
          <div className="w-8 h-1 rounded-xs bg-[#6E6A63] opacity-50" />
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-b border-(--border-hairline) bg-(--bg-surface)">
          <div className="flex items-center gap-2 font-semibold text-sm text-(--ink-primary)">
            <ArrowLeftRight className="w-4 h-4 text-(--color-accent)" />
            <span>借贷与报销结算</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-xs text-(--ink-tertiary) hover:text-(--ink-primary) hover:bg-(--bg-hover) cursor-pointer border border-transparent hover:border-(--border-hairline) transition-colors"
          >
            <X className="w-3.5 h-3.5 stroke-2" />
          </button>
        </div>

        {allItems.length === 0 ? (
          <div className="py-16 text-center text-xs text-(--ink-tertiary) space-y-1">
            <CheckCircle2 className="w-8 h-8 text-(--color-income) mx-auto opacity-70 mb-2" />
            <p className="font-semibold text-sm text-(--ink-primary)">所有借款与垫付已结清</p>
            <p className="opacity-70">暂无待收或待报销记录</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            <div className="flex bg-(--bg-sunken) p-1 rounded-(--radius-sm) gap-1 overflow-x-auto no-scrollbar">
              {allItems.map((entry) => {
                const isSelected = (activeEntry?.id === entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setActiveTabId(entry.id)}
                    className={cn(
                      'flex-1 min-w-[130px] py-1.5 px-2.5 text-xs rounded-[calc(var(--radius-sm)-2px)] font-medium transition-all cursor-pointer truncate',
                      isSelected
                        ? 'bg-(--bg-surface) text-(--ink-primary) font-bold shadow-(--shadow-xs)'
                        : 'text-(--ink-tertiary) hover:text-(--ink-primary)'
                    )}
                  >
                    {entry.title} (待收 ¥{centsToYuan(entry.remainingAmount)})
                  </button>
                );
              })}
            </div>

            {currentItem && (
              <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-(--radius-md) p-3.5 space-y-3 shadow-(--shadow-xs)">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-(--ink-primary)">
                      {isLoan
                        ? `借给${currentItem.loanParty || '朋友'} · 临时周转`
                        : `${currentItem.note || '公费垫付'} · 发票报销`}
                    </h3>
                    <p className="text-[0.6875rem] text-(--ink-tertiary) mt-0.5">
                      发起日期：{currentItem.date}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'text-[0.625rem] font-bold px-2 py-0.5 rounded-full',
                      isLoan
                        ? currentItem.loanStatus === 'settled'
                          ? 'bg-(--color-income-bg) text-(--color-income)'
                          : 'bg-(--color-accent-bg) text-(--color-accent)'
                        : 'bg-[rgba(186,110,56,0.12)] text-[#BA6E38]'
                    )}
                  >
                    {isLoan
                      ? currentItem.loanStatus === 'settled'
                        ? '已结清'
                        : `还款中 (${progressPercent}%)`
                      : '待报销垫付'}
                  </span>
                </div>

                <div className="w-full h-1.5 bg-(--bg-sunken) rounded-full overflow-hidden">
                  <div
                    className="h-full bg-(--color-income) transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 text-center pt-1 border-t border-dashed border-(--border-hairline)">
                  <div>
                    <span className="text-[0.625rem] font-semibold text-(--ink-tertiary) block">
                      {isLoan ? '借出本金' : '垫付总额'}
                    </span>
                    <span className="text-sm font-bold text-(--ink-primary) tabular-nums mt-0.5 block">
                      ¥{centsToYuan(totalAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[0.625rem] font-semibold text-(--ink-tertiary) block">
                      {isLoan ? '已还金额' : '已报金额'}
                    </span>
                    <span className="text-sm font-bold text-(--color-income) tabular-nums mt-0.5 block">
                      ¥{centsToYuan(repaidAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[0.625rem] font-semibold text-(--ink-tertiary) block">
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
              <div className="flex items-center justify-between p-2.5 bg-(--bg-surface) border border-(--border-hairline) rounded-(--radius-sm) text-xs">
                <div className="flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-[#BA6E38]" />
                  <div>
                    <div className="font-semibold text-(--ink-primary)">{currentItem.voucher.name}</div>
                    <div className="text-[0.625rem] text-(--ink-tertiary)">{currentItem.voucher.size} · 原始凭证</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toast(`查验凭证：${currentItem.voucher?.name}`)}
                  className="px-2 py-1 rounded bg-(--bg-sunken) border border-(--border-hairline) flex items-center gap-1 text-(--ink-secondary) text-[0.6875rem]"
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
              <div className="bg-(--bg-surface) border border-(--border-hairline) rounded-(--radius-sm) p-2.5 space-y-2 text-xs">
                {relatedTxs.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-1 border-b border-(--border-hairline) last:border-none">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-(--ink-tertiary)" />
                      <div>
                        <span className="font-medium text-(--ink-primary)">
                          {t.note || (t.loanRole === 'repayment' ? '收回还款' : '初始借出款')}
                        </span>
                        <span className="text-[0.625rem] text-(--ink-tertiary) block">{t.date}</span>
                      </div>
                    </div>
                    <span className={cn('font-bold tabular-nums', t.loanRole === 'repayment' ? 'text-(--color-income)' : 'text-(--ink-primary)')}>
                      {t.loanRole === 'repayment' ? `+¥${centsToYuan(t.amount)}` : `¥${centsToYuan(t.amount)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {remainingAmount > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSettle}
                  className="w-full h-11 rounded-(--radius-sm) bg-(--ink-primary) text-(--bg-surface) font-semibold text-sm flex items-center justify-center gap-2 shadow-(--shadow-sm) active:scale-98 transition-transform cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>一键结清剩余 ¥{centsToYuan(remainingAmount)}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanChainModal;
