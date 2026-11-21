import React, { useEffect, useState, useMemo } from 'react';
import { PaperModal } from '../ui/PaperModal';
import { AmountInput } from '../ui/AmountInput';
import { SegToggle } from '../ui/SegToggle';
import { PaperSwitch } from '../ui/PaperSwitch';
import type { Account, AccountType, AccountCategory } from '../../types/account';
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
    accountCategory?: AccountCategory;
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

const SAVINGS_ACCOUNT_TYPES: { value: AccountType; label: string; defaultIcon: string }[] = [
  { value: 'bank', label: '储蓄卡', defaultIcon: 'landmark' },
  { value: 'ewallet', label: '电子钱包', defaultIcon: 'wallet' },
  { value: 'cash', label: '现金', defaultIcon: 'banknote' },
  { value: 'investment', label: '投资理财', defaultIcon: 'trending-up' },
  { value: 'other', label: '其他', defaultIcon: 'coins' },
];

const CREDIT_ACCOUNT_TYPES: { value: AccountType; label: string; defaultIcon: string }[] = [
  { value: 'credit', label: '信用卡', defaultIcon: 'credit-card' },
  { value: 'other', label: '信用消费', defaultIcon: 'credit-card' },
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
  accounts = [],
  onSubmit,
  onUpdate,
}) => {
  const isEditing = Boolean(editingAccount);
  const [accountCategory, setAccountCategory] = useState<AccountCategory>('savings');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [icon, setIcon] = useState('landmark');
  const [balanceStr, setBalanceStr] = useState('');
  const [creditLimitStr, setCreditLimitStr] = useState('');
  const [billDay, setBillDay] = useState<number | undefined>(undefined);
  const [repaymentDay, setRepaymentDay] = useState<number | undefined>(undefined);
  const [repaymentAccountId, setRepaymentAccountId] = useState<string | undefined>(undefined);
  const [autoRepay, setAutoRepay] = useState(false);
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableSavingsAccounts = useMemo(() => {
    return accounts.filter((a) => !isCreditAccount(a) && a.id !== editingAccount?.id);
  }, [accounts, editingAccount?.id]);

  const resetForm = () => {
    setAccountCategory('savings');
    setName('');
    setType('bank');
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
      const isCredit = isCreditAccount(editingAccount);
      setAccountCategory(isCredit ? 'credit' : 'savings');
      setName(editingAccount.name);
      setType(editingAccount.type);
      setIcon(editingAccount.icon || (isCredit ? 'credit-card' : 'wallet'));
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

  const handleCategoryChange = (nextCategory: AccountCategory) => {
    setAccountCategory(nextCategory);
    if (nextCategory === 'credit') {
      setType('credit');
      setIcon('credit-card');
    } else {
      setType('bank');
      setIcon('landmark');
    }
  };

  const handleSelectType = (nextType: AccountType) => {
    setType(nextType);
    const activeList =
      accountCategory === 'credit' ? CREDIT_ACCOUNT_TYPES : SAVINGS_ACCOUNT_TYPES;
    const matched = activeList.find((item) => item.value === nextType);
    if (matched) {
      setIcon(matched.defaultIcon);
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
          accountCategory,
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
        accountCategory === 'credit'
          ? -Math.round(Math.abs(parsedBalance) * 100)
          : Math.round(parsedBalance * 100);

      await onSubmit({
        name: trimmed,
        type,
        accountCategory,
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

  const typeOptions =
    accountCategory === 'credit' ? CREDIT_ACCOUNT_TYPES : SAVINGS_ACCOUNT_TYPES;

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
            value={accountCategory}
            onChange={handleCategoryChange}
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
              accountCategory === 'credit'
                ? '例如：招行信用卡、花呗'
                : '例如：微信零钱、工行卡、日常活钱'
            }
            maxLength={24}
            autoFocus
            className="h-10 w-full rounded-(--input-radius) border border-(--rule-hairline) bg-(--paper-sunken) px-3 text-sm text-(--ink-primary) transition-colors outline-none placeholder:text-(--ink-faint) focus:border-(--ink-tertiary)"
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-mono text-xs text-(--ink-tertiary)">账户标签</label>
          <div className="flex flex-wrap gap-1.5">
            {typeOptions.map((item) => {
              const isSelected = type === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleSelectType(item.value)}
                  className={cn(
                    'cursor-pointer rounded-(--btn-radius) border px-3 py-1.5 text-xs transition-all',
                    isSelected
                      ? 'border-transparent bg-(--btn-primary-bg) font-semibold text-(--btn-primary-fg)'
                      : 'border-(--rule-hairline) bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary)'
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
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

        {accountCategory === 'credit' && (
          <div className="space-y-3 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sunken)/40 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-mono text-xs text-(--ink-tertiary)">每月还款日</label>
                <select
                  value={repaymentDay ?? ''}
                  onChange={(e) =>
                    setRepaymentDay(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="h-9 w-full rounded-(--input-radius) border border-(--rule-hairline) bg-(--paper-sunken) px-2.5 text-xs text-(--ink-primary) outline-none focus:border-(--ink-tertiary)"
                >
                  <option value="">未设置</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      每月 {d} 日
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs text-(--ink-tertiary)">每月账单日</label>
                <select
                  value={billDay ?? ''}
                  onChange={(e) =>
                    setBillDay(e.target.value ? Number(e.target.value) : undefined)
                  }
                  className="h-9 w-full rounded-(--input-radius) border border-(--rule-hairline) bg-(--paper-sunken) px-2.5 text-xs text-(--ink-primary) outline-none focus:border-(--ink-tertiary)"
                >
                  <option value="">未设置</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      每月 {d} 日
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-xs text-(--ink-tertiary)">关联还款账户</label>
              <select
                value={repaymentAccountId ?? ''}
                onChange={(e) => setRepaymentAccountId(e.target.value || undefined)}
                className="h-9 w-full rounded-(--input-radius) border border-(--rule-hairline) bg-(--paper-sunken) px-2.5 text-xs text-(--ink-primary) outline-none focus:border-(--ink-tertiary)"
              >
                <option value="">未关联还款账户</option>
                {availableSavingsAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} (余额: ¥{centsToYuan(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-medium text-(--ink-primary)">配置自动还款</span>
              <PaperSwitch
                checked={autoRepay}
                onChange={setAutoRepay}
                aria-label="配置自动还款"
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
              {accountCategory === 'credit' ? '当前欠款 (元)' : '初始余额 (元)'}
            </label>
            <AmountInput
              value={balanceStr}
              onChange={setBalanceStr}
              placeholder="0.00"
              size="sm"
              variant="sunken"
              aria-label={accountCategory === 'credit' ? '初始欠款' : '初始余额'}
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
