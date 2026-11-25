import React, { useState, useEffect, useRef, useMemo } from 'react';
import { XIcon as X, TrashIcon as Trash2 } from '@phosphor-icons/react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { evaluateArithmetic } from '../../utils/math';
import { yuanToCents, centsToYuan } from '../../domain/finance/balanceCalculator';
import { predictFrequentCategory } from '../../domain/category/categoryPredictor';
import type { VoucherAttachment, Transaction } from '../../types/transaction';
import { toast } from '../../stores/useToastStore';
import { confirmAction } from '../../stores/useConfirmStore';
import { TransactionKeypad } from './TransactionKeypad';
import { VoucherPreviewModal } from './VoucherPreviewModal';
import { CategoryStampGrid } from './CategoryStampGrid';
import { LOAN_FLOW_OPTIONS } from './loanFlowOptions';
import { TransactionMetaBar } from './TransactionMetaBar';
import { useCalculatorInput, triggerHaptic } from './useCalculatorInput';
import { SegToggle } from '../ui/SegToggle';
import { PaperButton } from '../ui/PaperButton';
import { PaperIconButton } from '../ui/PaperIconButton';
import { PaperInput } from '../ui/PaperInput';
import { PaperDatePickerModal } from '../ui/PaperDatePickerModal';
import { cn } from '../../utils/cn';
import { useSheetDismissGesture } from '../../hooks/useSheetDismissGesture';
import { readVoucherFile } from '../../utils/voucherFile';
import {
  addDaysToDate,
  combineLocalDateTimeToIso,
  formatTime,
  nowTime,
  todayDate,
} from '../../utils/date';

export interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTransaction?: Transaction | null;
  initialExt?: Record<string, unknown>;
  onSuccess?: (txId: string) => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  editingTransaction,
  initialExt,
  onSuccess,
}) => {
  const { recordTransaction, updateTransaction, deleteTransaction, settlementSummary } = useLedgerStore();
  const allTransactions = useLedgerStore((s) => s.transactions);
  const { categories } = useCategoryStore();
  const { accounts } = useAccountStore();

  const [txType, setTxType] = useState<'expense' | 'income' | 'loan'>('expense');
  const {
    expr,
    setExpr,
    hasOperator,
    evaluatedVal,
    handleDigit,
    handleOperator,
    handleBackspace,
    handleEqual,
    handleClear,
  } = useCalculatorInput('0');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedAcctId, setSelectedAcctId] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [timeStr, setTimeStr] = useState<string>(nowTime);
  const [note, setNote] = useState<string>('');
  const [isReimbursable, setIsReimbursable] = useState(false);
  const [offsetTransactionId, setOffsetTransactionId] = useState<string | undefined>(undefined);
  const [voucher, setVoucher] = useState<VoucherAttachment | null>(null);
  const [relatedLoanId, setRelatedLoanId] = useState<string>('none');
  const [ext, setExt] = useState<Record<string, unknown>>({});
  const isReimbursementEnabled = usePreferenceStore((s) => s.isReimbursementEnabled);
  const isAmortizationEnabled = usePreferenceStore((s) => s.isAmortizationEnabled);
  const [amortizeMonths, setAmortizeMonths] = useState<number | null>(null);
  const [isAmortizeTrayOpen, setIsAmortizeTrayOpen] = useState(false);
  const [isCustomAmortize, setIsCustomAmortize] = useState(false);
  const [customAmortizeInput, setCustomAmortizeInput] = useState('');

  const [isDateTimePickerOpen, setIsDateTimePickerOpen] = useState(false);
  const [isAcctTrayOpen, setIsAcctTrayOpen] = useState(false);
  const [isOffsetTrayOpen, setIsOffsetTrayOpen] = useState(false);
  const [isVoucherTrayOpen, setIsVoucherTrayOpen] = useState(false);
  const [isVoucherPreviewOpen, setIsVoucherPreviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  const {
    shouldRender,
    backdropRef,
    sheetRef,
    isClosingRef,
    closeWithAnimation,
  } = useSheetDismissGesture({
    isOpen,
    onClose,
    maxThreshold: 110,
    onAfterClose: () => {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    },
  });

  const offsetSummaryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of allTransactions) {
      if (t.type === 'income' && t.offsetTransactionId) {
        if (editingTransaction && t.id === editingTransaction.id) continue;
        const cur = map.get(t.offsetTransactionId) || 0;
        map.set(t.offsetTransactionId, cur + t.amount);
      }
    }
    return map;
  }, [allTransactions, editingTransaction]);

  const candidateExpenses = useMemo(() => {
    if (txType !== 'income') return [];

    const baseDate = dateStr || todayDate();
    const startDate = addDaysToDate(baseDate, -30);
    const endDate = addDaysToDate(baseDate, 30);

    return allTransactions
      .filter((t) => {
        if (t.type !== 'expense') return false;

        if (offsetTransactionId && t.id === offsetTransactionId) return true;

        const alreadyOffset = offsetSummaryMap.get(t.id) || 0;
        const remaining = Math.max(0, t.amount - alreadyOffset);

        if (remaining <= 0) return false;

        if (t.isReimbursable) return true;

        return typeof t.date === 'string' && t.date >= startDate && t.date <= endDate;
      })
      .sort((a, b) => {
        if (offsetTransactionId) {
          if (a.id === offsetTransactionId) return -1;
          if (b.id === offsetTransactionId) return 1;
        }

        if (a.isReimbursable && !b.isReimbursable) return -1;
        if (!a.isReimbursable && b.isReimbursable) return 1;

        return (b.date || '').localeCompare(a.date || '');
      });
  }, [allTransactions, txType, dateStr, offsetTransactionId, offsetSummaryMap]);

  const selectedOffsetTx = useMemo(() => {
    if (!offsetTransactionId) return null;
    return allTransactions.find((t) => t.id === offsetTransactionId) || null;
  }, [offsetTransactionId, allTransactions]);

  const handleSelectOffsetExpense = (expenseTx: Transaction) => {
    setOffsetTransactionId(expenseTx.id);
    setIsOffsetTrayOpen(false);

    const expenseCat = categories.find((c) => c.id === expenseTx.categoryId);
    const originTitle = expenseTx.note || expenseCat?.name || '支出';
    if (!note.trim()) {
      setNote(expenseTx.isReimbursable ? `报销回款 · ${originTitle}` : `AA回款 · ${originTitle}`);
    }

    const alreadyOffset = offsetSummaryMap.get(expenseTx.id) || 0;
    const remaining = Math.max(0, expenseTx.amount - alreadyOffset);

    const currentVal = evaluateArithmetic(expr);
    if ((!currentVal || currentVal === 0) && remaining > 0) {
      setExpr(centsToYuan(remaining));
    }
  };

  const handleClearOffsetExpense = () => {
    setOffsetTransactionId(undefined);
    setIsOffsetTrayOpen(false);
  };

  const prevIsOpenRef = useRef(false);
  const prevEditingIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;
    const currentEditingId = editingTransaction?.id;
    const editingChanged = currentEditingId !== prevEditingIdRef.current;
    prevEditingIdRef.current = currentEditingId;

    if (isOpen && (!wasOpen || editingChanged)) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setIsDateTimePickerOpen(false);
      setIsAcctTrayOpen(false);
      setIsVoucherTrayOpen(false);
      setIsVoucherPreviewOpen(false);
      setIsAmortizeTrayOpen(false);

      if (editingTransaction) {
        let initialType: 'expense' | 'income' | 'loan' = 'expense';
        if (editingTransaction.type === 'loan') {
          initialType = 'loan';
        } else if (editingTransaction.type === 'income') {
          initialType = 'income';
        }
        setTxType(initialType);
        setExpr(centsToYuan(editingTransaction.amount));
        setSelectedCatId(editingTransaction.categoryId);
        setSelectedAcctId(editingTransaction.accountId);
        setDateStr(editingTransaction.date);
        setExt({ ...(editingTransaction.ext || {}) });

        const existingAmortize = editingTransaction.ext?.amortize as { enabled?: boolean; months?: number } | undefined;
        const initialMonths = existingAmortize?.enabled && existingAmortize.months ? existingAmortize.months : null;
        setAmortizeMonths(initialMonths);
        const isStandard = initialMonths === null || [3, 6, 12, 24, 36].includes(initialMonths);
        setIsCustomAmortize(!isStandard && initialMonths !== null);
        setCustomAmortizeInput(initialMonths && !isStandard ? String(initialMonths) : '');

        setTimeStr(formatTime(editingTransaction.createdAt) || '12:00');

        setNote(editingTransaction.note || '');
        setIsReimbursable(Boolean(editingTransaction.isReimbursable));
        setOffsetTransactionId(editingTransaction.offsetTransactionId);
        setVoucher(editingTransaction.voucher || null);
        setRelatedLoanId(editingTransaction.relatedLoanId || 'none');
      } else {
        setDateStr(todayDate());
        setTimeStr(nowTime());
        setTxType('expense');
        setExpr('0');
        setNote('');
        setIsReimbursable(false);
        setOffsetTransactionId(undefined);
        setIsOffsetTrayOpen(false);
        setVoucher(null);
        setRelatedLoanId('none');
        setAmortizeMonths(null);
        setIsCustomAmortize(false);
        setCustomAmortizeInput('');
        setExt({ ...(initialExt || {}) });
        setSelectedCatId('');
      }
    }
  }, [isOpen, editingTransaction, initialExt, setExpr]);

  const currentCategories = useMemo(() => {
    if (txType === 'loan') return [];
    return categories
      .filter((c) => c.type === txType && !c.isArchived)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [categories, txType]);

  const selectedLoanFlow = useMemo(() => {
    return LOAN_FLOW_OPTIONS.find((item) => item.id === selectedCatId) || LOAN_FLOW_OPTIONS[0];
  }, [selectedCatId]);

  useEffect(() => {
    if (txType === 'loan') {
      const isValidLoan = LOAN_FLOW_OPTIONS.some((item) => item.id === selectedCatId);
      if (!isValidLoan) {
        setSelectedCatId(LOAN_FLOW_OPTIONS[0].id);
      }
      return;
    }

    if (currentCategories.length > 0) {
      const exists = currentCategories.some((c) => c.id === selectedCatId);
      if (!exists && (!editingTransaction || editingTransaction.type !== txType)) {
        const predictedCatId = predictFrequentCategory({
          transactions: allTransactions,
          categories: currentCategories,
          txType,
          targetTime: timeStr,
        });
        setSelectedCatId(predictedCatId || currentCategories[0].id);
      }
    }
  }, [txType, currentCategories, selectedCatId, editingTransaction, allTransactions, timeStr]);

  useEffect(() => {
    setExt((prev) => {
      if (!('owned-items' in prev)) return prev;
      const owned = prev['owned-items'] as { itemRole?: string; createNewItem?: boolean } | undefined;
      let incompatible = false;
      if (txType === 'loan') {
        incompatible = true;
      } else if (txType === 'expense') {
        incompatible = owned?.itemRole === 'sell' || owned?.itemRole === 'profit';
      } else if (txType === 'income') {
        incompatible =
          Boolean(owned?.createNewItem) ||
          owned?.itemRole === 'buy' ||
          owned?.itemRole === 'maintenance';
      }
      if (!incompatible) return prev;
      const rest = { ...prev };
      delete rest['owned-items'];
      return rest;
    });
  }, [txType]);

  useEffect(() => {
    if (accounts.length > 0 && (!selectedAcctId || !accounts.some((a) => a.id === selectedAcctId))) {
      setSelectedAcctId(accounts[0].id);
    }
  }, [accounts, selectedAcctId]);

  const handleSubmit = async (keepOpen = false) => {
    if (isSubmittingRef.current || isClosingRef.current) return;
    triggerHaptic();
    const finalAmountYuan = evaluateArithmetic(expr);
    const amountCents = yuanToCents(finalAmountYuan);

    if (amountCents <= 0) {
      toast.warning('请输入有效的记账金额');
      return;
    }

    if (!selectedAcctId) {
      toast.warning('请选择结算资金账户');
      return;
    }

    if (!selectedCatId) {
      toast.warning('请选择账单分类');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    let closing = false;
    try {
      const createdAtISO = combineLocalDateTimeToIso(dateStr, timeStr);
      const loanPayload =
        txType === 'loan'
          ? {
              loanDirection: selectedLoanFlow.direction,
              loanRole: selectedLoanFlow.role,
              relatedLoanId:
                selectedLoanFlow.role === 'repayment' && relatedLoanId !== 'none'
                  ? relatedLoanId
                  : undefined,
            }
          : {
              loanDirection: undefined,
              loanRole: undefined,
              relatedLoanId: undefined,
            };

      const finalExt: Record<string, unknown> = { ...ext };
      if (txType === 'expense' && amortizeMonths && amortizeMonths > 1) {
        finalExt.amortize = {
          enabled: true,
          months: amortizeMonths,
          startMonth: dateStr.slice(0, 7),
        };
      } else {
        delete finalExt.amortize;
      }

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, {
          type: txType,
          amount: amountCents,
          accountId: selectedAcctId,
          categoryId: selectedCatId,
          date: dateStr,
          note: note.trim() || undefined,
          isReimbursable: txType === 'expense' ? isReimbursable : undefined,
          offsetTransactionId: txType === 'income' ? offsetTransactionId : undefined,
          voucher: voucher || undefined,
          ...loanPayload,
          ext: Object.keys(finalExt).length > 0 ? finalExt : undefined,
          createdAt: createdAtISO,
        });

        onSuccess?.(editingTransaction.id);
        closing = true;
        closeWithAnimation(240);
        return;
      }

      const newTx = await recordTransaction({
        type: txType,
        amount: amountCents,
        accountId: selectedAcctId,
        categoryId: selectedCatId,
        date: dateStr,
        note: note.trim() || undefined,
        isReimbursable: txType === 'expense' ? isReimbursable : undefined,
        offsetTransactionId: txType === 'income' ? offsetTransactionId : undefined,
        voucher: voucher || undefined,
        ...loanPayload,
        ext: Object.keys(finalExt).length > 0 ? finalExt : undefined,
        createdAt: createdAtISO,
      });

      onSuccess?.(newTx.id);

      if (keepOpen) {
        setExpr('0');
        setNote('');
        setOffsetTransactionId(undefined);
        setIsOffsetTrayOpen(false);
        setVoucher(null);
        setExt({});
        setIsReimbursable(false);
        setAmortizeMonths(null);
        setIsCustomAmortize(false);
        setCustomAmortizeInput('');
      } else {
        closing = true;
        closeWithAnimation(240);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      if (!closing) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction) return;
    const confirmed = await confirmAction({
      title: '删除便签',
      message: '确定要删除这笔便签记录吗？',
      confirmText: '确认删除',
      isDestructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteTransaction(editingTransaction.id);
      closeWithAnimation(240);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const nextVoucher = await readVoucherFile(file);
      setVoucher(nextVoucher);
      setIsVoucherTrayOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '读取凭证失败');
    }
  };

  if (!shouldRender) return null;

  const formattedDateStr = dateStr ? dateStr.slice(5) : '';

  const isAnyTrayOpen =
    isDateTimePickerOpen ||
    isAcctTrayOpen ||
    (isVoucherTrayOpen && Boolean(voucher)) ||
    (txType === 'expense' && isAmortizeTrayOpen) ||
    (txType === 'income' && isOffsetTrayOpen) ||
    Boolean((ext?.['owned-items'] as { isTrayOpen?: boolean } | undefined)?.isTrayOpen);

  const modalContext = {
    txType,
    dateStr,
    timeStr,
    amountCents: (() => {
      const evalResult = evaluateArithmetic(expr);
      return typeof evalResult === 'number' && evalResult > 0 ? yuanToCents(evalResult) : 0;
    })(),
    ext,
    setExt,
    setExtKey: (key: string, value: unknown) => {
      setExt((prev) => ({ ...prev, [key]: value }));
    },
    accounts,
    categories,
    selectedAcctId,
    selectedCatId,
    closeOtherTrays: () => {
      setIsAcctTrayOpen(false);
      setIsDateTimePickerOpen(false);
      setIsOffsetTrayOpen(false);
      setIsVoucherTrayOpen(false);
    },
    isOpen,
    editingTransaction,
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center select-none',
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      )}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-stone-900/25 backdrop-blur-[2px] will-change-[opacity]"
        onClick={() => closeWithAnimation(240)}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        className={cn(
          'transaction-sheet relative flex w-full max-w-[430px] flex-col will-change-transform',
          'paper-sawtooth-top border-t border-(--rule-hairline) bg-(--paper-sheet) shadow-2xl'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="washi-tape absolute -top-3 left-1/2 z-30 -translate-x-1/2 shadow-xs" />

        <div className="flex items-center justify-between border-b border-(--rule-hairline)/60 px-3.5 pt-3 pb-1">
          <div className="shrink-0">
            <SegToggle
              options={[
                { value: 'expense', label: '支出' },
                { value: 'income', label: '收入' },
                { value: 'loan', label: '借贷' },
              ]}
              value={txType}
              onChange={setTxType}
              size="sm"
              fullWidth={false}
            />
          </div>

          <div className="flex items-center gap-2">
            {editingTransaction && (
              <PaperButton
                type="button"
                variant="danger-ghost"
                size="xs"
                leftIcon={<Trash2 className="stroke-1.8 size-3.5" />}
                onClick={handleDelete}
                title="删除此笔账单"
              >
                删除
              </PaperButton>
            )}

            <PaperIconButton
              icon={X}
              size="sm"
              variant="ghost"
              onClick={() => closeWithAnimation(240)}
              title="收拢便签"
              aria-label="收拢便签"
            />
          </div>
        </div>

        <div className="border-y border-dashed border-(--rule-hairline) px-4 py-2">
          <div className="h-4 text-right font-mono text-xs text-(--ink-tertiary) tabular-nums">
            {hasOperator ? `${expr} = ¥ ${evaluatedVal.toFixed(2)}` : ''}
          </div>

          <div className="flex items-baseline justify-end gap-1">
            <span
              className={cn(
                'font-mono text-lg font-bold select-none',
                txType === 'income' ? 'text-(--color-income)' : 'text-(--ink-tertiary)'
              )}
            >
              ¥
            </span>
            <span className="font-mono text-3xl font-bold tracking-tight text-(--ink-primary) tabular-nums sm:text-4xl">
              {expr}
            </span>
            <span className="ml-0.5 inline-block h-7 w-0.5 animate-pulse bg-(--ink-secondary)" />
          </div>
        </div>

        <CategoryStampGrid
          txType={txType}
          categories={currentCategories}
          selectedCatId={selectedCatId}
          selectedLoanFlowId={selectedLoanFlow.id}
          isCompact={isAnyTrayOpen}
          onSelectCategory={setSelectedCatId}
        />

        <TransactionMetaBar
          txType={txType}
          expr={expr}
          accounts={accounts}
          categories={categories}
          selectedAcctId={selectedAcctId}
          onSelectAccount={(acctId) => {
            setSelectedAcctId(acctId);
            setIsAcctTrayOpen(false);
          }}
          formattedDateStr={formattedDateStr}
          timeStr={timeStr}
          isReimbursementEnabled={isReimbursementEnabled}
          isReimbursable={isReimbursable}
          onToggleReimbursable={() => {
            setIsReimbursable((prev) => {
              const next = !prev;
              if (!next) {
                setVoucher(null);
              }
              return next;
            });
          }}
          isAmortizationEnabled={isAmortizationEnabled}
          amortizeMonths={amortizeMonths}
          isCustomAmortize={isCustomAmortize}
          customAmortizeInput={customAmortizeInput}
          onSelectAmortizeMonths={(optMonths) => {
            setAmortizeMonths(optMonths);
            setIsCustomAmortize(false);
            setCustomAmortizeInput('');
            setIsAmortizeTrayOpen(false);
          }}
          onCustomAmortizeToggle={(active, initVal) => {
            setIsCustomAmortize(active);
            setCustomAmortizeInput(initVal);
          }}
          onCustomAmortizeChange={(val) => {
            setCustomAmortizeInput(val);
            const num = parseInt(val, 10);
            if (Number.isFinite(num) && num > 1) {
              setAmortizeMonths(num);
            } else {
              setAmortizeMonths(null);
            }
          }}
          voucher={voucher}
          onRemoveVoucher={() => {
            setVoucher(null);
            setIsVoucherTrayOpen(false);
          }}
          onOpenVoucherPreview={() => setIsVoucherPreviewOpen(true)}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          offsetTransactionId={offsetTransactionId}
          selectedOffsetTx={selectedOffsetTx}
          candidateExpenses={candidateExpenses}
          offsetSummaryMap={offsetSummaryMap}
          onSelectOffsetExpense={handleSelectOffsetExpense}
          onClearOffsetExpense={handleClearOffsetExpense}
          loanRole={selectedLoanFlow.role}
          settlementSummary={settlementSummary}
          relatedLoanId={relatedLoanId}
          onChangeRelatedLoanId={setRelatedLoanId}
          isAcctTrayOpen={isAcctTrayOpen}
          onToggleAcctTray={() => {
            setIsAcctTrayOpen((prev) => !prev);
            setIsDateTimePickerOpen(false);
            setIsAmortizeTrayOpen(false);
            setIsVoucherTrayOpen(false);
            setIsOffsetTrayOpen(false);
          }}
          isDateTimePickerOpen={isDateTimePickerOpen}
          onOpenDateTimePicker={() => {
            setIsDateTimePickerOpen(true);
            setIsAcctTrayOpen(false);
            setIsAmortizeTrayOpen(false);
            setIsVoucherTrayOpen(false);
            setIsOffsetTrayOpen(false);
          }}
          isVoucherTrayOpen={isVoucherTrayOpen}
          onToggleVoucherTray={() => {
            setIsVoucherTrayOpen((prev) => !prev);
            setIsAcctTrayOpen(false);
            setIsDateTimePickerOpen(false);
            setIsAmortizeTrayOpen(false);
          }}
          isAmortizeTrayOpen={isAmortizeTrayOpen}
          onToggleAmortizeTray={() => {
            setIsAmortizeTrayOpen((prev) => !prev);
            setIsAcctTrayOpen(false);
            setIsDateTimePickerOpen(false);
            setIsVoucherTrayOpen(false);
          }}
          isOffsetTrayOpen={isOffsetTrayOpen}
          onToggleOffsetTray={() => {
            setIsOffsetTrayOpen((prev) => !prev);
            setIsAcctTrayOpen(false);
            setIsDateTimePickerOpen(false);
          }}
          modalContext={modalContext}
        />

        <div className="px-4 py-2">
          <PaperInput
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加备注..."
            variant="ghost"
            size="sm"
            className="rounded-none border-0 border-b border-dashed border-(--rule-hairline) px-0 py-1 transition-colors focus-within:border-(--ink-tertiary)"
            inputClassName="text-xs text-(--ink-primary) placeholder:text-(--ink-faint)"
          />
        </div>

        <TransactionKeypad
          onDigit={handleDigit}
          onOperator={handleOperator}
          onBackspace={handleBackspace}
          onClear={handleClear}
          onEqual={handleEqual}
          onSubmit={handleSubmit}
          hasOperator={hasOperator}
          isEditing={Boolean(editingTransaction)}
          isSubmitting={isSubmitting}
        />
      </div>

      {isVoucherPreviewOpen && voucher && (
        <VoucherPreviewModal
          voucher={voucher}
          onClose={() => setIsVoucherPreviewOpen(false)}
        />
      )}

      <PaperDatePickerModal
        isOpen={isDateTimePickerOpen}
        onClose={() => setIsDateTimePickerOpen(false)}
        mode="datetime"
        value={dateStr && timeStr ? `${dateStr} ${timeStr}` : (dateStr || '')}
        onChange={(val) => {
          const parts = val.split(' ');
          if (parts[0]) setDateStr(parts[0]);
          if (parts[1]) setTimeStr(parts[1]);
        }}
      />
    </div>
  );
};

export default AddTransactionModal;
