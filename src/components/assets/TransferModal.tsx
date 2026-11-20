import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Trash2 } from 'lucide-react';
import { PaperModal } from '../ui/PaperModal';
import { PaperButton } from '../ui/PaperButton';
import { AmountInput } from '../ui/AmountInput';
import type { Account } from '../../types/account';
import type { Transaction } from '../../types/transaction';
import { centsToYuan, yuanToCents } from '../../domain/finance/balanceCalculator';
import { todayDate } from '../../utils/date';
import { toast } from '../../stores/useToastStore';
import { confirmAction } from '../../stores/useConfirmStore';

export interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  editingTransaction?: Transaction | null;
  defaultFromAccountId?: string;
  defaultToAccountId?: string;
  onConfirm: (input: {
    fromAccountId: string;
    toAccountId: string;
    amountCents: number;
    date: string;
    note?: string;
  }) => Promise<void>;
  onDelete?: (txId: string) => Promise<void>;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  accounts,
  editingTransaction,
  defaultFromAccountId,
  defaultToAccountId,
  onConfirm,
  onDelete,
}) => {
  const isEditing = Boolean(editingTransaction);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amountYuan, setAmountYuan] = useState('');
  const [dateStr, setDateStr] = useState(todayDate());
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (editingTransaction && editingTransaction.type === 'transfer') {
      setFromAccountId(editingTransaction.accountId);
      setToAccountId(editingTransaction.toAccountId || '');
      setAmountYuan(centsToYuan(editingTransaction.amount));
      setDateStr(editingTransaction.date || todayDate());
      setNote(editingTransaction.note || '');
    } else {
      const activeAccounts = accounts.filter((a) => !a.isArchived);
      const initialFrom =
        defaultFromAccountId ||
        activeAccounts[0]?.id ||
        '';
      const initialTo =
        defaultToAccountId ||
        activeAccounts.find((a) => a.id !== initialFrom)?.id ||
        '';

      setFromAccountId(initialFrom);
      setToAccountId(initialTo);
      setAmountYuan('');
      setDateStr(todayDate());
      setNote('');
    }
  }, [isOpen, editingTransaction, defaultFromAccountId, defaultToAccountId, accounts]);

  const handleSwapAccounts = () => {
    setFromAccountId(toAccountId);
    setToAccountId(fromAccountId);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!fromAccountId || !toAccountId) {
      toast.error('请选择转出与转入账户');
      return;
    }
    if (fromAccountId === toAccountId) {
      toast.error('转入账户与转出账户不能相同');
      return;
    }
    const cents = yuanToCents(amountYuan || '0');
    if (cents <= 0) {
      toast.error('转账金额必须大于 0');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        fromAccountId,
        toAccountId,
        amountCents: cents,
        date: dateStr || todayDate(),
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '划转保存失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction || !onDelete) return;
    const confirmed = await confirmAction({
      title: '删除转账记录',
      message: '确定要删除此笔转账记录吗？删除后相关账户的余额将自动回滚恢复。',
      confirmText: '确认删除',
      isDestructive: true,
    });
    if (confirmed) {
      setIsSubmitting(true);
      try {
        await onDelete(editingTransaction.id);
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '删除失败');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const activeAccounts = accounts.filter((a) => !a.isArchived);

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? '编辑资金划转' : '资金划转'}
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4 select-none">
        <div className="p-3 bg-(--paper-sunken) rounded-(--radius-md) border border-(--rule-hairline) flex items-center justify-between gap-2.5">
          <div className="flex-1 min-w-0">
            <label className="text-[10px] font-mono text-(--ink-tertiary) uppercase tracking-wider block mb-1">
              转出账户
            </label>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full bg-(--paper-sheet) text-xs font-semibold text-(--ink-primary) py-1.5 px-2 rounded-(--radius-xs) border border-(--rule-hairline) outline-none cursor-pointer"
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (¥{centsToYuan(a.balance)})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSwapAccounts}
            className="w-8 h-8 mt-4.5 rounded-full bg-(--paper-sheet) border border-(--rule-hairline) flex items-center justify-center shrink-0 text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-hover) active:scale-90 transition-all cursor-pointer shadow-2xs"
            title="互换转出与转入账户"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 stroke-[1.8]" />
          </button>

          <div className="flex-1 min-w-0">
            <label className="text-[10px] font-mono text-(--ink-tertiary) uppercase tracking-wider block mb-1">
              转入账户
            </label>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full bg-(--paper-sheet) text-xs font-semibold text-(--ink-primary) py-1.5 px-2 rounded-(--radius-xs) border border-(--rule-hairline) outline-none cursor-pointer"
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (¥{centsToYuan(a.balance)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-(--ink-tertiary)">划转金额</label>
          <AmountInput
            value={amountYuan}
            onChange={setAmountYuan}
            placeholder="0.00"
            variant="surface"
            size="lg"
            autoFocus={!isEditing}
            aria-label="划转金额"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-(--ink-tertiary)">划转日期</label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full h-10 px-3 text-xs font-mono rounded-(--input-radius) bg-(--paper-sunken) border border-(--rule-hairline) text-(--ink-primary) outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-(--ink-tertiary)">划转备注 (选填)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如：定期储蓄/定投"
              maxLength={30}
              className="w-full h-10 px-3 text-xs rounded-(--input-radius) bg-(--paper-sunken) border border-(--rule-hairline) text-(--ink-primary) placeholder:text-(--ink-faint) outline-none"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center gap-2">
          {isEditing && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="h-10 px-3 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--color-expense-bg) text-(--color-expense) hover:opacity-90 active:scale-95 transition-all text-xs font-mono cursor-pointer flex items-center justify-center shrink-0"
              title="删除此笔划转"
            >
              <Trash2 className="w-4 h-4 stroke-[1.8]" />
            </button>
          )}

          <PaperButton
            type="button"
            variant="ghost"
            onClick={onClose}
            className="flex-1"
            disabled={isSubmitting}
          >
            取消
          </PaperButton>

          <PaperButton
            type="submit"
            variant="ink"
            className="flex-1"
            loading={isSubmitting}
            disabled={!amountYuan || parseFloat(amountYuan) <= 0 || fromAccountId === toAccountId}
          >
            {isEditing ? '更新划转' : '确认划转'}
          </PaperButton>
        </div>
      </form>
    </PaperModal>
  );
};

export default TransferModal;
