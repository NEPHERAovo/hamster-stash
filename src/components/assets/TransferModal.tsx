import React, { useState, useEffect } from 'react';
import { ArrowsLeftRightIcon as ArrowLeftRight, TrashIcon as Trash2 } from '@phosphor-icons/react';
import { PaperModal } from '../ui/PaperModal';
import { PaperButton } from '../ui/PaperButton';
import { PaperSelect } from '../ui/PaperSelect';
import { PaperInput } from '../ui/PaperInput';
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

  const handleSubmit = async (e?: React.SyntheticEvent) => {
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
      <form onSubmit={handleSubmit} className="space-y-4 p-4 select-none">
        <div className="flex items-center justify-between gap-2.5 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sunken) p-3">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block font-mono text-[10px] tracking-wider text-(--ink-tertiary) uppercase">
              转出账户
            </label>
            <PaperSelect
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (¥{centsToYuan(a.balance)})
                </option>
              ))}
            </PaperSelect>
          </div>

          <button
            type="button"
            onClick={handleSwapAccounts}
            className="mt-4.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--rule-hairline) bg-(--paper-sheet) text-(--ink-secondary) shadow-2xs transition-all hover:bg-(--paper-hover) hover:text-(--ink-primary) active:scale-90"
            title="互换转出与转入账户"
          >
            <ArrowLeftRight className="stroke-1.8 size-3.5" />
          </button>

          <div className="min-w-0 flex-1">
            <label className="mb-1 block font-mono text-[10px] tracking-wider text-(--ink-tertiary) uppercase">
              转入账户
            </label>
            <PaperSelect
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} (¥{centsToYuan(a.balance)})
                </option>
              ))}
            </PaperSelect>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="font-mono text-xs text-(--ink-tertiary)">划转金额</label>
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

        <div className="space-y-1.5">
          <label className="font-mono text-xs text-(--ink-tertiary)">划转日期</label>
          <PaperInput
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            inputClassName="font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-mono text-xs text-(--ink-tertiary)">划转备注</label>
          <PaperInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加备注"
            maxLength={30}
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          {isEditing && onDelete && (
            <PaperButton
              type="button"
              variant="danger"
              size="icon"
              onClick={handleDelete}
              disabled={isSubmitting}
              title="删除此笔划转"
              leftIcon={<Trash2 className="stroke-1.8 size-4" />}
            />
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
