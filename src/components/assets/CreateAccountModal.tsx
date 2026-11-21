import React, { useEffect, useState, useMemo } from 'react';
import { CalendarBlankIcon as CalendarBlank, CaretDownIcon as CaretDown } from '@phosphor-icons/react';
import { PaperModal } from '../ui/PaperModal';
import { AmountInput } from '../ui/AmountInput';
import { SegToggle } from '../ui/SegToggle';
import { PaperSwitch } from '../ui/PaperSwitch';
import type { Account, AccountType } from '../../types/account';
import { isCreditAccount } from '../../types/account';
import type { UpdateAccountInput } from '../../domain/account/accountService';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { centsToYuan } from '../../domain/finance/balanceCalculator';
import { toast } from '../../stores/useToastStore';
import { cn } from '../../utils/cn';

export interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount?: Account | null;
  accounts?: Account[];
  onSubmit: (input: {
    name: string;
    type: AccountType;
    initialBalance: number;
    icon: string;
    includeInNetWorth: boolean;
    creditLimit?: number;
    billDay?: number;
    repaymentDay?: number;
    repaymentAccountId?: string;
    autoRepay?: boolean;
  }) => Promise<void>;
  onUpdate?: (id: string, patch: UpdateAccountInput) => Promise<void>;
}

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
  accounts = [],
  onSubmit,
  onUpdate,
}) => {
  const isEditing = Boolean(editingAccount);
  const [type, setType] = useState<AccountType>('savings');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('landmark');
  const [balanceStr, setBalanceStr] = useState('');
  const [creditLimitStr, setCreditLimitStr] = useState('');
  const [billDay, setBillDay] = useState<number | undefined>(undefined);
  const [repaymentDay, setRepaymentDay] = useState<number | undefined>(undefined);
  const [repaymentAccountId, setRepaymentAccountId] = useState<string | undefined>(undefined);
  const [autoRepay, setAutoRepay] = useState(false);
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDayPicker, setActiveDayPicker] = useState<'repayment' | 'bill' | null>(null);

  const isCredit = type === 'credit';

  const availableSavingsAccounts = useMemo(() => {
    return accounts.filter((a) => !isCreditAccount(a) && a.id !== editingAccount?.id);
  }, [accounts, editingAccount?.id]);

  const resetForm = () => {
    setActiveDayPicker(null);
    setType('savings');
    setName('');
    setIcon('landmark');
    setBalanceStr('');
    setCreditLimitStr('');
    setBillDay(undefined);
    setRepaymentDay(undefined);
    setRepaymentAccountId(undefined);
    setAutoRepay(false);
    setIncludeInNetWorth(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editingAccount) {
      const isCreditAcct = isCreditAccount(editingAccount);
      setType(isCreditAcct ? 'credit' : 'savings');
      setName(editingAccount.name);
      setIcon(editingAccount.icon || (isCreditAcct ? 'credit-card' : 'wallet'));
      setIncludeInNetWorth(editingAccount.includeInNetWorth !== false);
      setCreditLimitStr(
        editingAccount.creditLimit ? centsToYuan(editingAccount.creditLimit) : ''
      );
      setBillDay(editingAccount.billDay);
      setRepaymentDay(editingAccount.repaymentDay);
      setRepaymentAccountId(editingAccount.repaymentAccountId);
      setAutoRepay(Boolean(editingAccount.autoRepay));
      setBalanceStr('');
    } else {
      resetForm();
    }
  }, [isOpen, editingAccount]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTypeChange = (nextType: AccountType) => {
    setType(nextType);
    if (nextType === 'credit') {
      setIcon('credit-card');
    } else {
      setIcon('landmark');
    }
  };

  const handleConfirm = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('请输入账户名称');
      return;
    }

    const parsedCreditLimit =
      creditLimitStr.trim() === '' ? undefined : Math.round(Number(creditLimitStr.trim()) * 100);

    setIsSubmitting(true);
    try {
      if (editingAccount && onUpdate) {
        await onUpdate(editingAccount.id, {
          name: trimmed,
          type,
          icon,
          includeInNetWorth,
          creditLimit: parsedCreditLimit,
          billDay,
          repaymentDay,
          repaymentAccountId,
          autoRepay,
        });
        resetForm();
        onClose();
        return;
      }

      const parsedBalance = balanceStr.trim() === '' ? 0 : Number(balanceStr.trim());
      if (!Number.isFinite(parsedBalance)) {
        toast.error('请输入有效的金额');
        return;
      }

      const initialCents =
        isCredit
          ? -Math.round(Math.abs(parsedBalance) * 100)
          : Math.round(parsedBalance * 100);

      await onSubmit({
        name: trimmed,
        type,
        initialBalance: initialCents,
        icon,
        includeInNetWorth,
        creditLimit: parsedCreditLimit,
        billDay,
        repaymentDay,
        repaymentAccountId,
        autoRepay,
      });
      resetForm();
      onClose();
    } catch (err) {
      const fallbackMsg = isEditing ? '更新账户失败' : '创建账户失败';
      toast.error(err instanceof Error ? err.message : fallbackMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  let submitLabel = '确认创建';
  if (isSubmitting) {
    submitLabel = '保存中...';
  } else if (isEditing) {
    submitLabel = '保存修改';
  }

  return (
    <PaperModal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? '编辑账户' : '新建账户'}
    >
      <form onSubmit={handleConfirm} className="space-y-4 p-4 select-none">
        <div className="space-y-1.5">
          <label className="font-mono text-xs text-(--ink-tertiary)">账户类型</label>
          <SegToggle
            options={[
              { value: 'savings', label: '储蓄账户' },
              { value: 'credit', label: '信用账户' },
            ]}
            value={type}
            onChange={handleTypeChange}
            size="sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-mono text-xs text-(--ink-tertiary)">账户名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              isCredit
                ? '输入信用账户名称'
                : '输入储蓄账户名称'
            }
            maxLength={24}
            autoFocus
            className="h-10 w-full rounded-(--input-radius) border border-(--rule-hairline) bg-(--paper-sunken) px-3 text-sm text-(--ink-primary) transition-colors outline-none placeholder:text-(--ink-faint) focus:border-(--ink-tertiary)"
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-mono text-xs text-(--ink-tertiary)">账户图标</label>
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
                    'flex h-9 cursor-pointer items-center justify-center rounded-(--badge-radius) border transition-all',
                    isSelected
                      ? 'border-transparent bg-(--btn-primary-bg) text-(--btn-primary-fg)'
                      : 'border-(--rule-hairline) bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary)'
                  )}
                >
                  <IconComp className="stroke-1.8 size-4" />
                </button>
              );
            })}
          </div>
        </div>

        {isCredit && (
          <div className="space-y-3 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sunken)/40 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-mono text-xs text-(--ink-tertiary)">每月还款日</label>
                <button
                  type="button"
                  onClick={() =>
                    setActiveDayPicker((curr) => (curr === 'repayment' ? null : 'repayment'))
                  }
                  className={cn(
                    'flex h-9 w-full cursor-pointer items-center justify-between rounded-(--input-radius) border bg-(--paper-sunken) px-2.5 text-xs font-medium transition-all',
                    activeDayPicker === 'repayment'
                      ? 'border-(--ink-primary) text-(--ink-primary) ring-1 ring-(--ink-primary)/20'
                      : 'border-(--rule-hairline) text-(--ink-secondary) hover:text-(--ink-primary)'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <CalendarBlank className="size-3.5 shrink-0 text-(--ink-tertiary)" />
                    <span
                      className={cn(
                        'truncate',
                        repaymentDay ? 'font-mono text-(--ink-primary)' : 'text-(--ink-tertiary)'
                      )}
                    >
                      {repaymentDay ? `每月 ${repaymentDay} 日` : '未设置'}
                    </span>
                  </div>
                  <CaretDown
                    className={cn(
                      'size-3 shrink-0 text-(--ink-tertiary) transition-transform',
                      activeDayPicker === 'repayment' && 'rotate-180'
                    )}
                  />
                </button>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs text-(--ink-tertiary)">每月账单日</label>
                <button
                  type="button"
                  onClick={() =>
                    setActiveDayPicker((curr) => (curr === 'bill' ? null : 'bill'))
                  }
                  className={cn(
                    'flex h-9 w-full cursor-pointer items-center justify-between rounded-(--input-radius) border bg-(--paper-sunken) px-2.5 text-xs font-medium transition-all',
                    activeDayPicker === 'bill'
                      ? 'border-(--ink-primary) text-(--ink-primary) ring-1 ring-(--ink-primary)/20'
                      : 'border-(--rule-hairline) text-(--ink-secondary) hover:text-(--ink-primary)'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <CalendarBlank className="size-3.5 shrink-0 text-(--ink-tertiary)" />
                    <span
                      className={cn(
                        'truncate',
                        billDay ? 'font-mono text-(--ink-primary)' : 'text-(--ink-tertiary)'
                      )}
                    >
                      {billDay ? `每月 ${billDay} 日` : '未设置'}
                    </span>
                  </div>
                  <CaretDown
                    className={cn(
                      'size-3 shrink-0 text-(--ink-tertiary) transition-transform',
                      activeDayPicker === 'bill' && 'rotate-180'
                    )}
                  />
                </button>
              </div>
            </div>

            {activeDayPicker && (
              <div className="space-y-2 rounded-(--radius-sm) border border-(--rule-hairline) bg-(--paper-sheet) p-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-(--ink-tertiary)">
                    {activeDayPicker === 'repayment' ? '选择每月还款日' : '选择每月账单日'} (1-31日)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeDayPicker === 'repayment') {
                        setRepaymentDay(undefined);
                      } else {
                        setBillDay(undefined);
                      }
                      setActiveDayPicker(null);
                    }}
                    className="cursor-pointer text-[11px] font-medium text-(--ink-tertiary) hover:text-(--ink-primary)"
                  >
                    清除设置
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                    const isSelected =
                      activeDayPicker === 'repayment' ? repaymentDay === d : billDay === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          if (activeDayPicker === 'repayment') {
                            setRepaymentDay(d);
                          } else {
                            setBillDay(d);
                          }
                          setActiveDayPicker(null);
                        }}
                        className={cn(
                          'flex h-7 cursor-pointer items-center justify-center rounded-(--radius-xs) font-mono text-xs transition-all',
                          isSelected
                            ? 'bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg) shadow-2xs'
                            : 'bg-(--paper-sunken)/60 text-(--ink-secondary) hover:bg-(--paper-sunken) hover:text-(--ink-primary)'
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-mono text-xs text-(--ink-tertiary)">关联还款账户</label>
              {availableSavingsAccounts.length === 0 ? (
                <div className="text-xs text-(--ink-tertiary)">暂无可用储蓄账户</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRepaymentAccountId(undefined)}
                    className={cn(
                      'cursor-pointer rounded-(--btn-radius) border px-2.5 py-1 text-xs transition-all',
                      !repaymentAccountId
                        ? 'border-transparent bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg)'
                        : 'border-(--rule-hairline) bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary)'
                    )}
                  >
                    未关联
                  </button>
                  {availableSavingsAccounts.map((a) => {
                    const isSelected = repaymentAccountId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setRepaymentAccountId(a.id)}
                        className={cn(
                          'cursor-pointer truncate rounded-(--btn-radius) border px-2.5 py-1 text-xs transition-all',
                          isSelected
                            ? 'border-transparent bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg)'
                            : 'border-(--rule-hairline) bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary)'
                        )}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-medium text-(--ink-primary)">自动还款</span>
              <PaperSwitch
                checked={autoRepay}
                onChange={setAutoRepay}
                aria-label="自动还款"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-xs text-(--ink-tertiary)">信用额度 (元)</label>
              <AmountInput
                value={creditLimitStr}
                onChange={setCreditLimitStr}
                placeholder="0.00"
                size="sm"
                variant="sunken"
                aria-label="信用额度"
              />
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="space-y-1.5">
            <label className="font-mono text-xs text-(--ink-tertiary)">
              {isCredit ? '当前欠款 (元)' : '初始余额 (元)'}
            </label>
            <AmountInput
              value={balanceStr}
              onChange={setBalanceStr}
              placeholder="0.00"
              size="sm"
              variant="sunken"
              aria-label={isCredit ? '初始欠款' : '初始余额'}
            />
          </div>
        )}

        <div className="flex items-center justify-between rounded-(--input-radius) border border-(--rule-hairline) bg-(--paper-sunken)/70 px-3 py-2.5">
          <span className="text-xs font-medium text-(--ink-primary)">计入净资产</span>
          <PaperSwitch
            checked={includeInNetWorth}
            onChange={setIncludeInNetWorth}
            aria-label="计入净资产"
          />
        </div>

        <div className="flex items-center gap-2 pt-1 pb-(--safe-bottom)">
          <button
            type="button"
            onClick={handleClose}
            className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary)"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 flex-1 cursor-pointer rounded-(--btn-radius) bg-(--btn-primary-bg) text-xs font-semibold text-(--btn-primary-fg) disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </PaperModal>
  );
};

export default CreateAccountModal;
