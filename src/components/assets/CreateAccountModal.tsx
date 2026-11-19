import React, { useEffect, useState } from 'react';
import { PaperModal } from '../ui/PaperModal';
import type { Account, AccountType } from '../../types/account';
import type { UpdateAccountInput } from '../../domain/account/accountService';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { toast } from '../../stores/useToastStore';
import { cn } from '../../utils/cn';

export interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount?: Account | null;
  onSubmit: (input: {
    name: string;
    type: AccountType;
    initialBalance: number;
    icon: string;
    includeInNetWorth: boolean;
  }) => Promise<void>;
  onUpdate?: (id: string, patch: UpdateAccountInput) => Promise<void>;
}

const ACCOUNT_TYPES: { value: AccountType; label: string; defaultIcon: string }[] = [
  { value: 'bank', label: '储蓄卡', defaultIcon: 'landmark' },
  { value: 'ewallet', label: '电子钱包', defaultIcon: 'wallet' },
  { value: 'credit', label: '信用卡', defaultIcon: 'credit-card' },
  { value: 'cash', label: '现金', defaultIcon: 'banknote' },
  { value: 'investment', label: '投资理财', defaultIcon: 'trending-up' },
  { value: 'other', label: '其他', defaultIcon: 'coins' },
];

const ACCOUNT_ICONS = [
  'landmark',
  'wallet',
  'credit-card',
  'banknote',
  'trending-up',
  'coins',
  'smartphone',
  'briefcase',
];

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  editingAccount,
  onSubmit,
  onUpdate,
}) => {
  const isEditing = Boolean(editingAccount);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [icon, setIcon] = useState('landmark');
  const [balanceStr, setBalanceStr] = useState('');
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setType('bank');
    setIcon('landmark');
    setBalanceStr('');
    setIncludeInNetWorth(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editingAccount) {
      setName(editingAccount.name);
      setType(editingAccount.type);
      setIcon(editingAccount.icon || 'wallet');
      setIncludeInNetWorth(editingAccount.includeInNetWorth !== false);
      setBalanceStr('');
    } else {
      resetForm();
    }
  }, [isOpen, editingAccount]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelectType = (nextType: AccountType) => {
    setType(nextType);
    const matched = ACCOUNT_TYPES.find((item) => item.value === nextType);
    if (matched) {
      setIcon(matched.defaultIcon);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('请输入账户名称');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount && onUpdate) {
        await onUpdate(editingAccount.id, {
          name: trimmed,
          type,
          icon,
          includeInNetWorth,
        });
        resetForm();
        onClose();
        return;
      }

      const parsedBalance = balanceStr.trim() === '' ? 0 : Number(balanceStr.trim());
      if (!Number.isFinite(parsedBalance)) {
        toast.error('请输入有效的初始余额');
        return;
      }

      await onSubmit({
        name: trimmed,
        type,
        initialBalance: Math.round(parsedBalance * 100),
        icon,
        includeInNetWorth,
      });
      resetForm();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : isEditing ? '更新账户失败' : '创建账户失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? '编辑账户' : '新建账户'}
    >
      <form onSubmit={handleConfirm} className="p-4 space-y-4 select-none">
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-(--ink-tertiary)">账户名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入账户名称"
            maxLength={24}
            autoFocus
            className="w-full h-10 px-3 text-sm rounded-(--input-radius) bg-(--paper-sunken) border border-(--rule-hairline) text-(--ink-primary) placeholder:text-(--ink-faint) outline-none focus:border-(--ink-tertiary) transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-(--ink-tertiary)">账户类型</label>
          <div className="flex flex-wrap gap-1.5">
            {ACCOUNT_TYPES.map((item) => {
              const isSelected = type === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleSelectType(item.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-(--btn-radius) border transition-all cursor-pointer',
                    isSelected
                      ? 'bg-(--btn-primary-bg) text-(--btn-primary-fg) border-transparent font-semibold'
                      : 'bg-(--paper-sunken) text-(--ink-secondary) border-(--rule-hairline) hover:text-(--ink-primary)'
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-(--ink-tertiary)">账户图标</label>
          <div className="grid grid-cols-8 gap-1.5">
            {ACCOUNT_ICONS.map((iconName) => {
              const IconComp = getCategoryIcon(iconName);
              const isSelected = icon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  className={cn(
                    'h-9 rounded-(--badge-radius) border flex items-center justify-center transition-all cursor-pointer',
                    isSelected
                      ? 'bg-(--btn-primary-bg) text-(--btn-primary-fg) border-transparent'
                      : 'bg-(--paper-sunken) text-(--ink-secondary) border-(--rule-hairline) hover:text-(--ink-primary)'
                  )}
                >
                  <IconComp className="w-4 h-4 stroke-[1.8]" />
                </button>
              );
            })}
          </div>
        </div>

        {!isEditing && (
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-(--ink-tertiary)">初始余额</label>
            <div className="flex items-center gap-2 px-3 h-10 rounded-(--input-radius) bg-(--paper-sunken) border border-(--rule-hairline)">
              <span className="font-mono text-sm text-(--ink-tertiary)">¥</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={balanceStr}
                onChange={(e) => setBalanceStr(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-sm font-mono font-semibold text-(--ink-primary) placeholder:text-(--ink-faint) outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between py-2.5 px-3 rounded-(--input-radius) bg-(--paper-sunken)/70 border border-(--rule-hairline)">
          <span className="text-xs font-medium text-(--ink-primary)">计入净资产</span>
          <button
            type="button"
            role="switch"
            aria-checked={includeInNetWorth}
            onClick={() => setIncludeInNetWorth((prev) => !prev)}
            className={cn(
              'w-9 h-5 rounded-full border transition-colors relative cursor-pointer shrink-0',
              includeInNetWorth
                ? 'bg-(--ink-primary) border-(--ink-primary)'
                : 'bg-(--paper-sheet) border-(--rule-hairline)'
            )}
          >
            <span
              className={cn(
                'block w-3.5 h-3.5 rounded-full bg-(--paper-sheet) shadow-2xs absolute top-0.5 transition-transform duration-200',
                includeInNetWorth ? 'left-4.5' : 'left-0.5 bg-(--ink-tertiary)'
              )}
            />
          </button>
        </div>

        <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 h-10 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) cursor-pointer"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 h-10 rounded-(--btn-radius) bg-(--btn-primary-bg) text-(--btn-primary-fg) text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? '保存中...' : isEditing ? '保存修改' : '确认创建'}
          </button>
        </div>
      </form>
    </PaperModal>
  );
};

export default CreateAccountModal;
