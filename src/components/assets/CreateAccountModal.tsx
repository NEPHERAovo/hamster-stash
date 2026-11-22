import React, { useEffect, useState, useMemo } from 'react';
import { CalendarBlankIcon as CalendarBlank, CaretDownIcon as CaretDown } from '@phosphor-icons/react';
import { PaperModal } from '../ui/PaperModal';
import { AmountInput } from '../ui/AmountInput';
import { SegToggle } from '../ui/SegToggle';
import { PaperSwitch } from '../ui/PaperSwitch';
import { PaperDayPicker } from '../ui/PaperDayPicker';
import { PaperInput } from '../ui/PaperInput';
import { PaperChip } from '../ui/PaperChip';
import { PaperButton } from '../ui/PaperButton';
import { PaperIconButton } from '../ui/PaperIconButton';
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
    note?: string;
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
  const [note, setNote] = useState('');
  const [icon, setIcon] = useState('landmark');
  const [balanceStr, setBalanceStr] = useState('');
  const [creditLimitStr, setCreditLimitStr] = useState('');
  const [billDay, setBillDay] = useState<number | undefined>(undefined);
  const [repaymentDay, setRepaymentDay] = useState<number | undefined>(undefined);
  const [repaymentAccountId, setRepaymentAccountId] = useState<string | undefined>(undefined);
  const [autoRepay, setAutoRepay] = useState(false);
  const [includeInNetWorth, setIncludeInNetWorth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRepaymentDayPickerOpen, setIsRepaymentDayPickerOpen] = useState(false);

  const isCredit = type === 'credit';

  const availableSavingsAccounts = useMemo(() => {
    return accounts.filter((a) => !isCreditAccount(a) && a.id !== editingAccount?.id);
  }, [accounts, editingAccount?.id]);

  const resetForm = () => {
    setIsRepaymentDayPickerOpen(false);
    setType('savings');
    setName('');
    setNote('');
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
      setNote(editingAccount.note || '');
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
          note: note.trim() || undefined,
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
        note: note.trim() || undefined,
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
          <PaperInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              isCredit
                ? '输入信用账户名称'
                : '输入储蓄账户名称'
            }
            maxLength={24}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-mono text-xs text-(--ink-tertiary)">账户备注</label>
          <PaperInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加备注"
            maxLength={30}
          />
        </div>

        <div className="space-y-1.5">
          <label className="font-mono text-xs text-(--ink-tertiary)">账户图标</label>
          <div className="flex items-center justify-between">
            {ACCOUNT_ICONS.map((iconName) => {
              const IconComp = getCategoryIcon(iconName);
              const isSelected = icon === iconName;
              return (
                <PaperIconButton
                  key={iconName}
                  icon={IconComp}
                  size="md"
                  variant={isSelected ? 'primary' : 'sunken'}
                  onClick={() => setIcon(iconName)}
                />
              );
            })}
          </div>
        </div>

        {isCredit && (
          <div className="picker-fade-enter space-y-3 rounded-(--radius-md) border border-(--rule-hairline) bg-(--paper-sunken)/40 p-3">
            <div className="space-y-1">
              <label className="font-mono text-xs text-(--ink-tertiary)">每月还款日</label>
              <PaperButton
                variant="sunken"
                size="compact"
                fullWidth
                onClick={() => setIsRepaymentDayPickerOpen((curr) => !curr)}
                className="justify-between"
                leftIcon={<CalendarBlank className="size-3.5 text-(--ink-tertiary)" />}
                rightIcon={
                  <CaretDown
                    className={cn(
                      'size-3 text-(--ink-tertiary) transition-transform',
                      isRepaymentDayPickerOpen && 'rotate-180'
                    )}
                  />
                }
              >
                <span
                  className={cn(
                    'truncate',
                    repaymentDay ? 'font-mono text-(--ink-primary)' : 'text-(--ink-tertiary)'
                  )}
                >
                  {repaymentDay ? `每月 ${repaymentDay} 日` : '未设置'}
                </span>
              </PaperButton>
            </div>

            {isRepaymentDayPickerOpen && (
              <PaperDayPicker
                title="选择每月还款日"
                selectedDay={repaymentDay}
                onSelectDay={(d) => {
                  setRepaymentDay(d);
                  setIsRepaymentDayPickerOpen(false);
                }}
                onClear={() => {
                  setRepaymentDay(undefined);
                  setIsRepaymentDayPickerOpen(false);
                }}
              />
            )}

            <div className="space-y-1.5">
              <label className="font-mono text-xs text-(--ink-tertiary)">关联还款账户</label>
              {availableSavingsAccounts.length === 0 ? (
                <div className="text-xs text-(--ink-tertiary)">暂无可用储蓄账户</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <PaperChip
                    selected={!repaymentAccountId}
                    onClick={() => setRepaymentAccountId(undefined)}
                  >
                    未关联
                  </PaperChip>
                  {availableSavingsAccounts.map((a) => (
                    <PaperChip
                      key={a.id}
                      selected={repaymentAccountId === a.id}
                      onClick={() => setRepaymentAccountId(a.id)}
                    >
                      {a.name}
                    </PaperChip>
                  ))}
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
              <label className="font-mono text-xs text-(--ink-tertiary)">信用额度</label>
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
              {isCredit ? '当前欠款' : '初始余额'}
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
          <PaperButton
            type="button"
            variant="sunken"
            className="flex-1"
            onClick={handleClose}
          >
            取消
          </PaperButton>
          <PaperButton
            type="submit"
            variant="primary"
            className="flex-1"
            disabled={isSubmitting}
            loading={isSubmitting}
          >
            {submitLabel}
          </PaperButton>
        </div>
      </form>
    </PaperModal>
  );
};

export default CreateAccountModal;
