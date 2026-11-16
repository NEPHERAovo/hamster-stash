import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Trash2,
  Paperclip,
  Delete,
} from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { evaluateArithmetic } from '../../utils/math';
import { yuanToCents, centsToYuan } from '../../domain/finance/balanceCalculator';
import type { VoucherAttachment, Transaction } from '../../types/transaction';
import { toast } from '../../stores/useToastStore';
import { DrumWheelPicker } from './DrumWheelPicker';
import { PluginSlot } from '../../plugin-sdk/components/PluginSlot';
import { SegToggle } from '../ui/SegToggle';
import { cn } from '../../utils/cn';

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
  const allTransactions = useLedgerStore((s) => s.allTransactions);
  const { categories } = useCategoryStore();
  const { accounts } = useAccountStore();

  const [txType, setTxType] = useState<'expense' | 'income' | 'loan'>('expense');
  const [expr, setExpr] = useState('0');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedAcctId, setSelectedAcctId] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [timeStr, setTimeStr] = useState<string>('12:00');
  const [note, setNote] = useState<string>('');
  const [isReimbursable, setIsReimbursable] = useState(false);
  const [offsetTransactionId, setOffsetTransactionId] = useState<string | undefined>(undefined);
  const [voucher, setVoucher] = useState<VoucherAttachment | null>(null);
  const [relatedLoanId, setRelatedLoanId] = useState<string>('none');
  const [ext, setExt] = useState<Record<string, unknown>>({});

  const [isDtTrayOpen, setIsDtTrayOpen] = useState(false);
  const [isAcctTrayOpen, setIsAcctTrayOpen] = useState(false);
  const [isOffsetTrayOpen, setIsOffsetTrayOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const recentExpenses = useMemo(() => {
    return allTransactions
      .filter((t) => t.type === 'expense')
      .slice(0, 30);
  }, [allTransactions]);

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
      setNote(`AA回款 · ${originTitle}`);
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

  const setDateDelta = (daysFromToday: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    setDateStr(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const beforeYesterdayStr = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - 2);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        void 0;
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsDtTrayOpen(false);
      setIsAcctTrayOpen(false);

      if (editingTransaction) {
        const initialType =
          editingTransaction.type === 'loan'
            ? 'loan'
            : editingTransaction.type === 'income'
            ? 'income'
            : 'expense';
        setTxType(initialType);
        setExpr(centsToYuan(editingTransaction.amount));
        setSelectedCatId(editingTransaction.categoryId);
        setSelectedAcctId(editingTransaction.accountId);
        setDateStr(editingTransaction.date);
        setExt({ ...(editingTransaction.ext || {}) });

        if (editingTransaction.createdAt) {
          try {
            const d = new Date(editingTransaction.createdAt);
            if (!isNaN(d.getTime())) {
              const h = String(d.getHours()).padStart(2, '0');
              const m = String(d.getMinutes()).padStart(2, '0');
              setTimeStr(`${h}:${m}`);
            }
          } catch {
            setTimeStr('12:00');
          }
        } else {
          setTimeStr('12:00');
        }

        setNote(editingTransaction.note || '');
        setIsReimbursable(Boolean(editingTransaction.isReimbursable));
        setOffsetTransactionId(editingTransaction.offsetTransactionId);
        setVoucher(editingTransaction.voucher || null);
        setRelatedLoanId(editingTransaction.relatedLoanId || 'none');
      } else {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const curTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        setDateStr(today);
        setTimeStr(curTime);
        setExpr('0');
        setNote('');
        setIsReimbursable(false);
        setOffsetTransactionId(undefined);
        setIsOffsetTrayOpen(false);
        setVoucher(null);
        setRelatedLoanId('none');
        setExt({ ...(initialExt || {}) });
      }
    }
  }, [isOpen, editingTransaction, accounts, initialExt]);

  const currentCategories = useMemo(() => {
    return categories.filter((c) => (txType === 'income' ? c.type === 'income' : c.type === 'expense') && !c.isArchived);
  }, [categories, txType]);

  useEffect(() => {
    if (currentCategories.length > 0) {
      const exists = currentCategories.some((c) => c.id === selectedCatId);
      if (!exists && !editingTransaction) {
        setSelectedCatId(currentCategories[0].id);
      }
    }
  }, [txType, currentCategories, selectedCatId, editingTransaction]);

  useEffect(() => {
    if (accounts.length > 0 && (!selectedAcctId || !accounts.some((a) => a.id === selectedAcctId))) {
      setSelectedAcctId(accounts[0].id);
    }
  }, [accounts, selectedAcctId]);

  const hasOperator = useMemo(() => /[+-]/.test(expr), [expr]);

  const evaluatedVal = useMemo(() => {
    return evaluateArithmetic(expr);
  }, [expr]);

  const handleDigit = (digit: string) => {
    triggerHaptic();
    setExpr((prev) => {
      if (prev === '0' && digit !== '.') return digit;
      if (digit === '.') {
        const segs = prev.split(/[+-]/);
        const curSeg = segs[segs.length - 1] || '';
        if (curSeg.includes('.')) return prev;
      }
      return prev + digit;
    });
  };

  const handleOperator = (op: '+' | '-') => {
    triggerHaptic();
    setExpr((prev) => {
      const trimmed = prev.trim();
      if (/[+-]$/.test(trimmed)) {
        return trimmed.slice(0, -1) + op;
      }
      if (trimmed === '' || trimmed === '0') return '0';
      return `${trimmed} ${op} `;
    });
  };

  const handleBackspace = () => {
    triggerHaptic();
    setExpr((prev) => {
      const trimmed = prev.trim();
      if (trimmed.length <= 1) return '0';
      if (/[+-]$/.test(trimmed)) {
        return trimmed.slice(0, -1).trim();
      }
      return trimmed.slice(0, -1).trim();
    });
  };

  const handleEqual = () => {
    triggerHaptic();
    const result = evaluateArithmetic(expr);
    const cleanNum = Math.round(result * 100) / 100;
    setExpr(String(cleanNum));
  };

  const handleClear = () => {
    triggerHaptic();
    setExpr('0');
  };

  const handleSubmit = async (keepOpen = false) => {
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

    setIsSubmitting(true);
    try {
      const createdAtISO = `${dateStr}T${timeStr}:00.000Z`;

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
          relatedLoanId: relatedLoanId !== 'none' ? relatedLoanId : undefined,
          ext: Object.keys(ext).length > 0 ? ext : undefined,
          createdAt: createdAtISO,
        });

        toast.success('便签流水已更新');
        onSuccess?.(editingTransaction.id);
        onClose();
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
        relatedLoanId: relatedLoanId !== 'none' ? relatedLoanId : undefined,
        ext: Object.keys(ext).length > 0 ? ext : undefined,
        createdAt: createdAtISO,
      });

      toast.success(`${txType === 'expense' ? '支出' : '收入'}入账成功`);
      onSuccess?.(newTx.id);

      if (keepOpen) {
        setExpr('0');
        setNote('');
        setOffsetTransactionId(undefined);
        setIsOffsetTrayOpen(false);
        setVoucher(null);
        setExt({});
      } else {
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction) return;
    if (window.confirm('确定要删除这笔便签记录吗？')) {
      try {
        await deleteTransaction(editingTransaction.id);
        toast.info('流水已撕下删除');
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '删除失败');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeKb = Math.round(file.size / 1024);
    const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

    setVoucher({
      name: file.name,
      size: sizeStr,
      title: '票据凭证',
    });
  };

  if (!isOpen) return null;

  const activeAccount = accounts.find((a) => a.id === selectedAcctId);

  const formattedDateStr = dateStr ? dateStr.slice(5) : '';

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
      setIsDtTrayOpen(false);
      setIsOffsetTrayOpen(false);
    },
    isOpen,
    editingTransaction,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/18 backdrop-blur-[1px] transition-opacity duration-200 select-none"
      onClick={onClose}
    >
      <div
        className={cn(
          'transaction-sheet w-full max-w-[430px] flex flex-col sheet-slide-up relative transition-all duration-300',
          'bg-(--paper-sheet) paper-sawtooth-top border-t border-(--rule-hairline) shadow-2xl'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="washi-tape absolute -top-3 left-1/2 -translate-x-1/2 z-30 shadow-xs" />

        <div className="flex items-center justify-between px-3.5 pt-3 pb-1 border-b border-(--rule-hairline)/60">
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
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1 text-[11px] font-mono text-(--color-expense) hover:bg-(--color-expense-bg) px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer"
                title="删除此笔账单"
              >
                <Trash2 className="w-3.5 h-3.5 stroke-[1.8]" />
                <span>删除</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-(--ink-tertiary) hover:text-(--ink-primary) p-1 rounded-xs hover:bg-(--paper-sunken) transition-colors cursor-pointer"
              title="收拢便签"
            >
              <X className="w-4 h-4 stroke-2" />
            </button>
          </div>
        </div>

        <div className="px-4 py-2 border-t border-b border-dashed border-(--rule-hairline)">
          <div className="font-mono text-xs text-(--ink-tertiary) h-4 text-right tabular-nums">
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
            <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-(--ink-primary) tabular-nums">
              {expr}
            </span>
            <span className="inline-block w-0.5 h-7 bg-(--ink-secondary) ml-0.5 animate-pulse" />
          </div>
        </div>

        <div className="px-3.5 py-1.5">
          <div
            className={cn(
              'category-grid py-0.5 select-none',
              currentCategories.length <= 8
                ? 'grid grid-cols-4 gap-0'
                : 'grid grid-rows-2 grid-flow-col auto-cols-[calc(25%-6px)] gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
            )}
          >
            {currentCategories.map((cat, idx) => {
              const isSelected = selectedCatId === cat.id;
              const IconComp = getCategoryIcon(cat.icon);
              const col = idx % 4;
              const row = Math.floor(idx / 4);
              const hasRightBorder = currentCategories.length <= 8 && col < 3;
              const hasBottomBorder = currentCategories.length <= 8 && row === 0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={cn(
                    'flex flex-col items-center justify-center py-2 px-1 transition-all cursor-pointer select-none relative',
                    hasRightBorder && 'border-r border-dotted border-(--rule-hairline)',
                    hasBottomBorder && 'border-b border-dotted border-(--rule-hairline)',
                    isSelected
                      ? 'bg-(--paper-sunken) text-(--ink-solid) font-semibold shadow-2xs z-10'
                      : 'text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-hover)/50'
                  )}
                >
                  <div className="w-6 h-6 flex items-center justify-center mb-0.5">
                    <IconComp
                      className="w-4 h-4 stroke-[1.8]"
                      style={{ color: isSelected ? 'var(--ink-solid)' : cat.color }}
                    />
                  </div>
                  <span className="text-[10px] leading-tight truncate w-full text-center">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-1.5 border-t border-b border-dashed border-(--rule-hairline) space-y-1.5">
          <div className="metadata-bar flex items-center justify-between gap-1 text-xs font-mono select-none overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-nowrap min-w-0">
            <button
              type="button"
              onClick={() => {
                setIsAcctTrayOpen((prev) => !prev);
                setIsDtTrayOpen(false);
              }}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-(--btn-radius) bg-(--paper-sunken) transition-colors cursor-pointer shrink-0',
                isAcctTrayOpen
                  ? 'text-(--ink-solid) font-semibold shadow-2xs'
                  : 'text-(--ink-secondary) hover:text-(--ink-primary)'
              )}
            >
              <span className="max-w-[76px] truncate">{activeAccount?.name || '选择账户'}</span>
              <span className="text-[9px] opacity-60">▾</span>
            </button>

            <span className="metadata-sep text-(--ink-faint) shrink-0 select-none">·</span>

            <button
              type="button"
              onClick={() => {
                setIsDtTrayOpen((prev) => !prev);
                setIsAcctTrayOpen(false);
              }}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-(--btn-radius) bg-(--paper-sunken) transition-colors cursor-pointer shrink-0',
                isDtTrayOpen
                  ? 'text-(--ink-solid) font-semibold shadow-2xs'
                  : 'text-(--ink-secondary) hover:text-(--ink-primary)'
              )}
            >
              <span className="shrink-0">{formattedDateStr} {timeStr}</span>
              <span className="text-[9px] opacity-60">▾</span>
            </button>

            {txType === 'expense' && (
              <>
                <span className="metadata-sep text-(--ink-faint) shrink-0 select-none">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsReimbursable((prev) => {
                      const next = !prev;
                      if (!next) {
                        setVoucher(null);
                      }
                      return next;
                    });
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-(--btn-radius) transition-colors cursor-pointer shrink-0',
                    isReimbursable
                      ? 'bg-(--color-expense-bg) text-(--color-expense) font-semibold'
                      : 'bg-(--paper-sunken) text-(--ink-tertiary) hover:text-(--ink-secondary)'
                  )}
                >
                  {isReimbursable ? '待报销 ✓' : '报销'}
                </button>

                {isReimbursable && (
                  <>
                    <span className="metadata-sep text-(--ink-faint) shrink-0 select-none">·</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-(--btn-radius) bg-(--paper-sunken) transition-colors cursor-pointer shrink-0',
                        voucher ? 'text-(--brass-metal) font-semibold' : 'text-(--ink-tertiary) hover:text-(--ink-secondary)'
                      )}
                      title={voucher ? voucher.name : '添加凭证附件'}
                    >
                      <Paperclip className="w-3 h-3 stroke-2" />
                      <span className="shrink-0">{voucher ? '已附凭证' : '凭证'}</span>
                    </button>
                  </>
                )}
              </>
            )}

            {txType === 'income' && (
              <>
                <span className="metadata-sep text-(--ink-faint) shrink-0 select-none">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOffsetTrayOpen((prev) => !prev);
                    setIsAcctTrayOpen(false);
                    setIsDtTrayOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-(--btn-radius) transition-colors cursor-pointer shrink-0',
                    offsetTransactionId
                      ? 'bg-(--color-income-bg) text-(--color-income) font-semibold shadow-2xs'
                      : isOffsetTrayOpen
                        ? 'bg-(--paper-sunken) text-(--ink-solid) font-semibold shadow-2xs'
                        : 'bg-(--paper-sunken) text-(--ink-tertiary) hover:text-(--ink-secondary)'
                  )}
                >
                  <span className="max-w-[88px] truncate">
                    {selectedOffsetTx
                      ? `抵扣 · ${selectedOffsetTx.note || categories.find((c) => c.id === selectedOffsetTx.categoryId)?.name || '支出'}`
                      : '抵扣支出'}
                  </span>
                  <span className="text-[9px] opacity-60">▾</span>
                </button>
              </>
            )}

            <PluginSlot name="tx.modal.metaBar" context={modalContext} />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf"
          />

          {isAcctTrayOpen && (
            <div className="pt-1.5 pb-0.5 border-t border-dashed border-(--rule-hairline)/60">
              <div className="grid grid-cols-3 gap-1">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedAcctId(a.id);
                      setIsAcctTrayOpen(false);
                    }}
                    className={cn(
                      'px-2 py-1 text-xs font-mono rounded-[3px] text-left truncate transition-all cursor-pointer border',
                      selectedAcctId === a.id
                        ? 'bg-(--paper-sunken) text-(--ink-solid) font-bold shadow-2xs border-(--rule-hairline) -rotate-1'
                        : 'text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-hover)/50 border-transparent'
                    )}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isDtTrayOpen && (
            <div className="pt-2 pb-1 border-t border-dashed border-(--rule-hairline)/60 space-y-1.5 select-none font-mono text-xs">
              <div className="flex items-center gap-1.5 text-[11px] text-(--ink-tertiary) px-0.5">
                <span className="text-[10px] text-(--ink-faint)">快捷:</span>
                <button
                  type="button"
                  onClick={() => setDateDelta(0)}
                  className={cn(
                    'px-2.5 py-0.5 rounded-[3px] transition-colors cursor-pointer',
                    dateStr === todayStr
                      ? 'bg-(--ink-solid) text-(--paper-sheet) font-semibold shadow-2xs'
                      : 'bg-(--paper-sunken) text-(--ink-tertiary) hover:text-(--ink-primary)'
                  )}
                >
                  今天
                </button>
                <button
                  type="button"
                  onClick={() => setDateDelta(-1)}
                  className={cn(
                    'px-2.5 py-0.5 rounded-[3px] transition-colors cursor-pointer',
                    dateStr === yesterdayStr
                      ? 'bg-(--ink-solid) text-(--paper-sheet) font-semibold shadow-2xs'
                      : 'bg-(--paper-sunken) text-(--ink-tertiary) hover:text-(--ink-primary)'
                  )}
                >
                  昨天
                </button>
                <button
                  type="button"
                  onClick={() => setDateDelta(-2)}
                  className={cn(
                    'px-2.5 py-0.5 rounded-[3px] transition-colors cursor-pointer',
                    dateStr === beforeYesterdayStr
                      ? 'bg-(--ink-solid) text-(--paper-sheet) font-semibold shadow-2xs'
                      : 'bg-(--paper-sunken) text-(--ink-tertiary) hover:text-(--ink-primary)'
                  )}
                >
                  前天
                </button>
              </div>

              <DrumWheelPicker
                dateStr={dateStr}
                timeStr={timeStr}
                onChangeDate={(d) => setDateStr(d)}
                onChangeTime={(t) => setTimeStr(t)}
              />
            </div>
          )}

          {txType === 'income' && isOffsetTrayOpen && (
            <div className="pt-2 pb-1 border-t border-dashed border-(--rule-hairline)/60 space-y-1.5 select-none font-mono text-xs">
              <div className="flex items-center justify-between text-[11px] text-(--ink-tertiary) px-0.5">
                <span>选择要抵扣的原支出流水:</span>
                {offsetTransactionId && (
                  <button
                    type="button"
                    onClick={handleClearOffsetExpense}
                    className="text-(--color-expense) hover:underline cursor-pointer"
                  >
                    取消抵扣 (独立收入)
                  </button>
                )}
              </div>

              {recentExpenses.length === 0 ? (
                <div className="py-4 text-center text-xs text-(--ink-tertiary)">
                  暂无可选的支出记录
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1 divide-y divide-dashed divide-(--rule-hairline)/40 pr-0.5">
                  {recentExpenses.map((exp) => {
                    const alreadyOffset = offsetSummaryMap.get(exp.id) || 0;
                    const remaining = Math.max(0, exp.amount - alreadyOffset);
                    const isSelected = offsetTransactionId === exp.id;
                    const cat = categories.find((c) => c.id === exp.categoryId);
                    const isFullyOffset = remaining <= 0;

                    return (
                      <button
                        key={exp.id}
                        type="button"
                        onClick={() => handleSelectOffsetExpense(exp)}
                        className={cn(
                          'w-full px-2 py-1.5 rounded-[2px] flex items-center justify-between text-left transition-all cursor-pointer',
                          isSelected
                            ? 'bg-(--paper-sunken) shadow-2xs'
                            : 'hover:bg-(--paper-hover)/50'
                        )}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-(--ink-primary) truncate text-xs">
                              {exp.note || cat?.name || '支出'}
                            </span>
                            <span className="text-[10px] text-(--ink-tertiary)">{exp.date}</span>
                            {isFullyOffset && (
                              <span className="text-[9px] px-1 rounded-xs bg-(--color-income-bg) text-(--color-income)">
                                已全额分摊
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-(--ink-faint) truncate">
                            {cat?.name || '支出'} · 原金额 ¥{centsToYuan(exp.amount)}
                          </div>
                        </div>

                        <div className="shrink-0 text-right font-mono">
                          <div className="text-xs text-(--ink-secondary)">
                            待冲减: <span className="font-semibold text-(--ink-primary)">¥{centsToYuan(remaining)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <PluginSlot name="tx.modal.metaTray" context={modalContext} />

          {txType === 'loan' && settlementSummary && (
            <div className="pt-1 text-[11px] font-mono text-(--ink-secondary)">
              <div className="flex items-center gap-1.5">
                <span className="text-(--ink-tertiary)">关联借据:</span>
                <select
                  value={relatedLoanId}
                  onChange={(e) => setRelatedLoanId(e.target.value)}
                  className="bg-(--paper-sunken) text-(--ink-primary) rounded-xs px-1.5 py-0.5 text-xs outline-none cursor-pointer"
                >
                  <option value="none">无关联 (单笔独立借贷)</option>
                  {settlementSummary.pendingLoans.map((l: Transaction) => (
                    <option key={l.id} value={l.id}>
                      {l.note || l.loanParty || '借款'} (¥{((l.amount - (l.repaidAmount || 0)) / 100).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加备注..."
            className="w-full py-1 text-xs bg-transparent border-b border-dashed border-(--rule-hairline) focus:border-(--ink-tertiary) text-(--ink-primary) placeholder:text-(--ink-faint) outline-none transition-colors"
          />
        </div>

        <div className="keypad-tray grid grid-cols-4 gap-[0.5px] bg-(--rule-hairline) pt-[0.5px] select-none">
          <button
            type="button"
            onClick={() => handleDigit('7')}
            className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            7
          </button>
          <button
            type="button"
            onClick={() => handleDigit('8')}
            className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            8
          </button>
          <button
            type="button"
            onClick={() => handleDigit('9')}
            className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            9
          </button>
          <button
            type="button"
            onClick={() => handleOperator('+')}
            className="h-11 bg-(--paper-sunken) hover:bg-(--paper-hover) text-(--ink-secondary) font-mono text-base font-bold flex items-center justify-center transition-colors cursor-pointer"
            title="加法运算"
          >
            +
          </button>

          <button
            type="button"
            onClick={() => handleDigit('4')}
            className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            4
          </button>
          <button
            type="button"
            onClick={() => handleDigit('5')}
            className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            5
          </button>
          <button
            type="button"
            onClick={() => handleDigit('6')}
            className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            6
          </button>
          <button
            type="button"
            onClick={() => handleOperator('-')}
            className="h-11 bg-(--paper-sunken) hover:bg-(--paper-hover) text-(--ink-secondary) font-mono text-base font-bold flex items-center justify-center transition-colors cursor-pointer"
            title="减法运算"
          >
            −
          </button>

          <button
            type="button"
            onClick={() => handleDigit('1')}
            className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => handleDigit('2')}
            className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => handleDigit('3')}
            className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            3
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-11 bg-(--paper-sunken) hover:bg-(--paper-hover) text-(--ink-secondary) flex items-center justify-center transition-colors cursor-pointer"
            title="退格"
          >
            <Delete className="w-4 h-4 stroke-[1.8]" />
          </button>

          <button
            type="button"
            onClick={() => handleDigit('.')}
            className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-lg font-bold flex items-center justify-center transition-colors cursor-pointer"
          >
            .
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
          >
            0
          </button>

          {!editingTransaction ? (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
              className="h-11 bg-(--paper-sunken) hover:bg-(--paper-hover) text-(--ink-secondary) text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
              title="保存并继续记录下一笔"
            >
              再记一笔
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClear}
              className="h-11 bg-(--paper-sunken) hover:bg-(--paper-hover) text-(--ink-tertiary) font-mono text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
              title="清空重置"
            >
              C
            </button>
          )}

          {hasOperator ? (
            <button
              type="button"
              onClick={handleEqual}
              className="h-11 bg-(--color-accent-bg) hover:opacity-90 active:scale-[0.98] text-(--color-accent) font-mono text-lg font-bold flex items-center justify-center transition-all cursor-pointer"
              title="计算结果"
            >
              =
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="h-11 bg-(--btn-primary-bg) hover:opacity-95 active:scale-[0.98] text-(--btn-primary-fg) font-mono text-xs font-bold tracking-wider uppercase flex items-center justify-center transition-all cursor-pointer shadow-xs"
            >
              {editingTransaction ? '保存' : '完成'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddTransactionModal;
