import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { XIcon as X, TrashIcon as Trash2, PaperclipIcon as Paperclip, CaretDownIcon as CaretDown } from '@phosphor-icons/react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCategoryStore } from '../../stores/useCategoryStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { usePreferenceStore } from '../../stores/usePreferenceStore';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { evaluateArithmetic } from '../../utils/math';
import { yuanToCents, centsToYuan } from '../../domain/finance/balanceCalculator';
import type { VoucherAttachment, Transaction } from '../../types/transaction';
import { toast } from '../../stores/useToastStore';
import { confirmAction } from '../../stores/useConfirmStore';
import { DrumWheelPicker } from './DrumWheelPicker';
import { TransactionKeypad } from './TransactionKeypad';
import { OffsetTrayPanel } from './OffsetTrayPanel';
import { AmortizeTrayPanel } from './AmortizeTrayPanel';
import { VoucherPreviewModal } from './VoucherPreviewModal';
import { PluginSlot } from '../../plugin-sdk/components/PluginSlot';
import { SegToggle } from '../ui/SegToggle';
import { PaperButton } from '../ui/PaperButton';
import { PaperIconButton } from '../ui/PaperIconButton';
import { PaperChip } from '../ui/PaperChip';
import { PaperSelect } from '../ui/PaperSelect';
import { PaperInput } from '../ui/PaperInput';
import { cn } from '../../utils/cn';
import { useCloseWatcher } from '../../hooks/useCloseWatcher';
import { readVoucherFile } from '../../utils/voucherFile';
import {
  GestureSmoother,
  SHEET_SPRING_EASE,
  VelocityTracker,
  computeSettleDuration,
  rubberBand,
  shouldDismissGesture,
} from '../../utils/gesturePhysics';
import {
  addDaysToDate,
  addDaysToToday,
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

const LOAN_FLOW_OPTIONS = [
  {
    id: 'cat_lend_out',
    label: '借给他人',
    flowHint: '流出',
    icon: 'arrow-up-right',
    direction: 'lend' as const,
    role: 'origin' as const,
    isInflow: false,
  },
  {
    id: 'cat_borrow_in',
    label: '向人借款',
    flowHint: '流入',
    icon: 'arrow-down-left',
    direction: 'borrow' as const,
    role: 'origin' as const,
    isInflow: true,
  },
  {
    id: 'cat_loan_repay',
    label: '收回还款',
    flowHint: '流入',
    icon: 'check-circle-2',
    direction: 'lend' as const,
    role: 'repayment' as const,
    isInflow: true,
  },
  {
    id: 'cat_debt_clear',
    label: '偿还欠款',
    flowHint: '流出',
    icon: 'corner-down-right',
    direction: 'borrow' as const,
    role: 'repayment' as const,
    isInflow: false,
  },
];

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
  const isReimbursementEnabled = usePreferenceStore((s) => s.isReimbursementEnabled);
  const isAmortizationEnabled = usePreferenceStore((s) => s.isAmortizationEnabled);
  const [amortizeMonths, setAmortizeMonths] = useState<number | null>(null);
  const [isAmortizeTrayOpen, setIsAmortizeTrayOpen] = useState(false);
  const [isCustomAmortize, setIsCustomAmortize] = useState(false);
  const [customAmortizeInput, setCustomAmortizeInput] = useState('');

  const [isDtTrayOpen, setIsDtTrayOpen] = useState(false);
  const [isAcctTrayOpen, setIsAcctTrayOpen] = useState(false);
  const [isOffsetTrayOpen, setIsOffsetTrayOpen] = useState(false);
  const [isVoucherTrayOpen, setIsVoucherTrayOpen] = useState(false);
  const [isVoucherPreviewOpen, setIsVoucherPreviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const isClosingRef = useRef(false);
  const dragYRef = useRef(0);
  const smootherRef = useRef<GestureSmoother | null>(null);
  const sheetVelocityRef = useRef(new VelocityTracker(100));

  const closeWithAnimation = useCallback(
    (duration = 240) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      smootherRef.current?.stop();

      const el = sheetRef.current;
      const bd = backdropRef.current;
      if (el) {
        el.style.transition = `transform ${duration}ms ${SHEET_SPRING_EASE}`;
        el.style.transform = 'translate3d(0, 100%, 0)';
      }
      if (bd) {
        bd.style.transition = `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;
        bd.style.opacity = '0';
        bd.style.pointerEvents = 'none';
      }
      window.setTimeout(() => {
        onClose();
        setShouldRender(false);
        isClosingRef.current = false;
        dragYRef.current = 0;
        smootherRef.current?.reset(0);
      }, duration);
    },
    [onClose]
  );

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

  const setDateDelta = (daysFromToday: number) => {
    setDateStr(addDaysToToday(daysFromToday));
  };

  const todayStr = todayDate();
  const yesterdayStr = addDaysToToday(-1);
  const beforeYesterdayStr = addDaysToToday(-2);

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
      }
    }
  }, [isOpen, editingTransaction, accounts, initialExt]);

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
        setSelectedCatId(currentCategories[0].id);
      }
    }
  }, [txType, currentCategories, selectedCatId, editingTransaction]);

  useEffect(() => {
    if (txType !== 'expense') {
      setExt((prev) => {
        if (!('owned-items' in prev)) return prev;
        const rest = { ...prev };
        delete rest['owned-items'];
        return rest;
      });
    }
  }, [txType]);

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
      } else {
        closeWithAnimation(240);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSubmitting(false);
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

  if (isOpen && !shouldRender) {
    setShouldRender(true);
  }

  useEffect(() => {
    if (!isOpen && shouldRender && !isClosingRef.current) {
      closeWithAnimation(240);
    }
  }, [isOpen, shouldRender, closeWithAnimation]);

  useEffect(() => {
    if (!shouldRender || !isOpen) return;

    const el = sheetRef.current;
    const bd = backdropRef.current;
    if (!el) return;

    isClosingRef.current = false;
    el.style.transition = 'none';
    el.style.transform = 'translate3d(0, 100%, 0)';
    if (bd) {
      bd.style.transition = 'none';
      bd.style.opacity = '0';
      bd.style.pointerEvents = 'auto';
    }
    void el.offsetHeight;

    const animFrame = requestAnimationFrame(() => {
      el.style.transition = `transform 280ms ${SHEET_SPRING_EASE}`;
      el.style.transform = 'translate3d(0, 0, 0)';
      if (bd) {
        bd.style.transition = 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)';
        bd.style.opacity = '1';
      }
    });

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [shouldRender, isOpen]);

  useCloseWatcher({
    isOpen: shouldRender && isOpen && !isClosingRef.current,
    onClose: () => closeWithAnimation(240),
  });

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !shouldRender || !isOpen) return;

    const smoother = new GestureSmoother(
      (smoothedY) => {
        if (isClosingRef.current) return;
        const clampedY = Math.max(0, smoothedY);
        el.style.transform = `translate3d(0, ${clampedY}px, 0)`;
        const bd = backdropRef.current;
        if (bd) {
          const height = el.getBoundingClientRect().height || 500;
          const progress = Math.max(0, Math.min(1, 1 - clampedY / (height * 1.2)));
          bd.style.opacity = String(progress);
        }
      },
      0,
      26
    );
    smootherRef.current = smoother;

    let tracking = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;

    const isInsideScrollable = (target: EventTarget | null): boolean => {
      let node = target as HTMLElement | null;
      while (node && node !== el) {
        if (node.dataset?.drumWheel === 'true') return true;
        const style = window.getComputedStyle(node);
        const canScrollY =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          node.scrollHeight > node.clientHeight + 1;
        if (canScrollY && node.scrollTop > 0) return true;
        node = node.parentElement;
      }
      return false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isClosingRef.current || e.touches.length !== 1) return;
      if (isInsideScrollable(e.target)) return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      dragging = false;
      dragYRef.current = 0;
      smoother.reset(0);
      sheetVelocityRef.current.reset(0, performance.now());
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!tracking || e.touches.length !== 1 || isClosingRef.current) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (!dragging) {
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
          tracking = false;
          return;
        }
        if (deltaY > 8) {
          dragging = true;
          el.style.transition = 'none';
          if (backdropRef.current) backdropRef.current.style.transition = 'none';
        }
      }

      if (dragging) {
        e.preventDefault();
        const mappedY = deltaY >= 0 ? deltaY : rubberBand(deltaY, 72, 0.25);
        dragYRef.current = mappedY;
        sheetVelocityRef.current.push(mappedY, performance.now());
        smoother.setTarget(mappedY);
      }
    };

    const handleTouchEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging || isClosingRef.current) return;
      dragging = false;

      smoother.stop();
      const height = Math.max(200, el.getBoundingClientRect().height);
      const vy = sheetVelocityRef.current.getVelocity(performance.now());
      const dist = smoother.getCurrent();

      if (shouldDismissGesture(dist, vy, Math.min(110, height * 0.22), 0.45)) {
        const duration = computeSettleDuration(height - dist, vy, 180, 280);
        closeWithAnimation(duration);
      } else {
        const duration = computeSettleDuration(dist, vy, 200, 300);
        el.style.transition = `transform ${duration}ms ${SHEET_SPRING_EASE}`;
        el.style.transform = 'translate3d(0, 0, 0)';
        const bd = backdropRef.current;
        if (bd) {
          bd.style.transition = `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;
          bd.style.opacity = '1';
        }
        dragYRef.current = 0;
        smoother.reset(0);
      }
    };

    const handleTouchCancel = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging || isClosingRef.current) return;
      dragging = false;

      smoother.stop();
      el.style.transition = `transform 240ms ${SHEET_SPRING_EASE}`;
      el.style.transform = 'translate3d(0, 0, 0)';
      const bd = backdropRef.current;
      if (bd) {
        bd.style.transition = 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)';
        bd.style.opacity = '1';
      }
      dragYRef.current = 0;
      smoother.reset(0);
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      smoother.stop();
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [shouldRender, isOpen, closeWithAnimation]);

  if (!shouldRender) return null;

  const activeAccount = accounts.find((a) => a.id === selectedAcctId);

  const formattedDateStr = dateStr ? dateStr.slice(5) : '';

  const isAnyTrayOpen =
    isDtTrayOpen ||
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
      setIsDtTrayOpen(false);
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

        <div className="px-3.5 py-1.5">
          {txType === 'loan' ? (
            <div className="category-grid grid grid-cols-4 gap-0 py-0.5 select-none">
              {LOAN_FLOW_OPTIONS.map((flow, idx) => {
                const isSelected = selectedLoanFlow.id === flow.id;
                const IconComp = getCategoryIcon(flow.icon);
                const hasRightBorder = idx < 3;

                return (
                  <PaperButton
                    key={flow.id}
                    variant={isSelected ? 'sunken' : 'ghost'}
                    onClick={() => setSelectedCatId(flow.id)}
                    className={cn(
                      'relative flex h-auto flex-col items-center justify-center rounded-none px-1 py-2 font-normal',
                      hasRightBorder && 'border-r border-dotted border-(--rule-hairline)',
                      isSelected && 'z-10 font-semibold text-(--ink-solid) shadow-2xs'
                    )}
                  >
                    <div className="mb-0.5 flex size-6 items-center justify-center">
                      <IconComp
                        className={cn(
                          'stroke-1.8 size-4',
                          flow.isInflow ? 'text-(--color-income)' : 'text-(--color-expense)'
                        )}
                      />
                    </div>
                    <span className="w-full truncate text-center text-[10px] leading-tight">
                      {flow.label}
                    </span>
                    <span className="mt-0.5 font-mono text-[9px] leading-none text-(--ink-faint)">
                      {flow.flowHint}
                    </span>
                  </PaperButton>
                );
              })}
            </div>
          ) : (
            <div
              className={cn(
                '[scrollbar-width:thin] overflow-x-hidden overflow-y-auto pr-0.5 transition-[max-height] duration-200 ease-out',
                isAnyTrayOpen ? 'max-h-[16vh]' : 'max-h-[38vh]'
              )}
            >
              <div className="category-grid grid grid-cols-4 gap-0 py-0.5 select-none">
                {currentCategories.map((cat, idx) => {
                  const isSelected = selectedCatId === cat.id;
                  const IconComp = getCategoryIcon(cat.icon);
                  const col = idx % 4;
                  const row = Math.floor(idx / 4);
                  const totalRows = Math.ceil(currentCategories.length / 4);
                  const hasRightBorder = col < 3;
                  const hasBottomBorder = row < totalRows - 1;
                  let iconColor = 'text-(--ink-secondary)';
                  if (isSelected) {
                    iconColor = 'text-(--ink-solid)';
                  } else if (txType === 'income') {
                    iconColor = 'text-(--color-income)';
                  }

                  return (
                    <PaperButton
                      key={cat.id}
                      variant={isSelected ? 'sunken' : 'ghost'}
                      onClick={() => {
                        setSelectedCatId(cat.id);
                      }}
                      className={cn(
                        'relative flex h-auto flex-col items-center justify-center rounded-none px-1 py-2 font-normal',
                        hasRightBorder && 'border-r border-dotted border-(--rule-hairline)',
                        hasBottomBorder && 'border-b border-dotted border-(--rule-hairline)',
                        isSelected && 'z-10 font-semibold text-(--ink-solid) shadow-2xs'
                      )}
                    >
                      <div className="mb-0.5 flex size-6 items-center justify-center">
                        <IconComp
                          className={cn(
                            'stroke-1.8 size-4',
                            iconColor
                          )}
                        />
                      </div>
                      <span className="w-full truncate text-center text-[10px] leading-tight">
                        {cat.name}
                      </span>
                    </PaperButton>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5 border-y border-dashed border-(--rule-hairline) px-4 py-1.5">
          <div className="metadata-bar flex min-w-0 [scrollbar-width:none] flex-nowrap items-center justify-between gap-1 overflow-x-auto font-mono text-xs select-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <PaperChip
              selected={isAcctTrayOpen}
              rightIcon={<CaretDown className="size-3.5 shrink-0 opacity-70" weight="bold" />}
              onClick={() => {
                setIsAcctTrayOpen((prev) => !prev);
                setIsDtTrayOpen(false);
                setIsAmortizeTrayOpen(false);
                setIsVoucherTrayOpen(false);
                setIsOffsetTrayOpen(false);
              }}
            >
              <span className="max-w-19 truncate">{activeAccount?.name || '选择账户'}</span>
            </PaperChip>

            <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>

            <PaperChip
              selected={isDtTrayOpen}
              rightIcon={<CaretDown className="size-3.5 shrink-0 opacity-70" weight="bold" />}
              onClick={() => {
                setIsDtTrayOpen((prev) => !prev);
                setIsAcctTrayOpen(false);
                setIsAmortizeTrayOpen(false);
                setIsVoucherTrayOpen(false);
                setIsOffsetTrayOpen(false);
              }}
            >
              <span className="shrink-0">{formattedDateStr} {timeStr}</span>
            </PaperChip>

            {txType === 'expense' && (
              <>
                <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>
                {(isReimbursementEnabled || isReimbursable) && (
                  <PaperChip
                    variant="expense"
                    selected={isReimbursable}
                    onClick={() => {
                      setIsReimbursable((prev) => {
                        const next = !prev;
                        if (!next) {
                          setVoucher(null);
                        }
                        return next;
                      });
                    }}
                  >
                    {isReimbursable ? '待报销 ✓' : '报销'}
                  </PaperChip>
                )}

                {(isReimbursable || Boolean(voucher)) && (
                  <>
                    <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>
                    <PaperChip
                      variant={voucher ? 'brass' : 'default'}
                      selected={Boolean(voucher)}
                      leftIcon={<Paperclip className="size-3 stroke-2" />}
                      title={voucher ? voucher.name : '添加凭证附件'}
                      onClick={() => {
                        if (voucher) {
                          setIsVoucherTrayOpen((prev) => !prev);
                          setIsAcctTrayOpen(false);
                          setIsDtTrayOpen(false);
                          setIsAmortizeTrayOpen(false);
                        } else {
                          fileInputRef.current?.click();
                        }
                      }}
                    >
                      <span className="shrink-0">{voucher ? '已附凭证' : '凭证'}</span>
                    </PaperChip>
                  </>
                )}

                {(isAmortizationEnabled || Boolean(amortizeMonths)) && (
                  <>
                    <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>
                    <PaperChip
                      selected={Boolean(amortizeMonths) || isAmortizeTrayOpen}
                      rightIcon={<CaretDown className="size-3.5 shrink-0 opacity-70" weight="bold" />}
                      onClick={() => {
                        setIsAmortizeTrayOpen((prev) => !prev);
                        setIsAcctTrayOpen(false);
                        setIsDtTrayOpen(false);
                        setIsVoucherTrayOpen(false);
                      }}
                    >
                      <span className="shrink-0">{amortizeMonths ? `分期: ${amortizeMonths}期` : '分期'}</span>
                    </PaperChip>
                  </>
                )}
              </>
            )}

            {txType === 'income' && (
              <>
                <span className="metadata-sep shrink-0 text-(--ink-faint) select-none">·</span>
                <PaperChip
                  variant="income"
                  selected={Boolean(offsetTransactionId) || isOffsetTrayOpen}
                  rightIcon={<CaretDown className="size-3.5 shrink-0 opacity-70" weight="bold" />}
                  onClick={() => {
                    setIsOffsetTrayOpen((prev) => !prev);
                    setIsAcctTrayOpen(false);
                    setIsDtTrayOpen(false);
                  }}
                >
                  <span className="max-w-22 truncate">
                    {selectedOffsetTx
                      ? `抵扣 · ${selectedOffsetTx.note || categories.find((c) => c.id === selectedOffsetTx.categoryId)?.name || '支出'}`
                      : '抵扣支出'}
                  </span>
                </PaperChip>
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

          {isVoucherTrayOpen && voucher && (
            <div className="flex items-center justify-between gap-2 border-t border-dashed border-(--rule-hairline)/60 pt-2 pb-1 font-mono text-xs">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-(--ink-primary)">{voucher.name}</div>
                <div className="text-[10px] text-(--ink-tertiary)">{voucher.size}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <PaperButton
                  variant="primary"
                  size="xs"
                  onClick={() => setIsVoucherPreviewOpen(true)}
                >
                  查看
                </PaperButton>
                <PaperButton
                  variant="secondary"
                  size="xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  更换
                </PaperButton>
                <PaperButton
                  variant="danger"
                  size="xs"
                  onClick={() => {
                    setVoucher(null);
                    setIsVoucherTrayOpen(false);
                  }}
                >
                  移除
                </PaperButton>
              </div>
            </div>
          )}

          {isAcctTrayOpen && (
            <div className="picker-fade-enter border-t border-dashed border-(--rule-hairline)/60 pt-2 pb-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {accounts.map((a) => (
                  <PaperChip
                    key={a.id}
                    selected={selectedAcctId === a.id}
                    onClick={() => {
                      setSelectedAcctId(a.id);
                      setIsAcctTrayOpen(false);
                    }}
                    className="max-w-35"
                  >
                    {a.name}
                  </PaperChip>
                ))}
              </div>
            </div>
          )}

          {txType === 'expense' && isAmortizeTrayOpen && (
            <AmortizeTrayPanel
              expr={expr}
              amortizeMonths={amortizeMonths}
              isCustomAmortize={isCustomAmortize}
              customAmortizeInput={customAmortizeInput}
              onSelectMonths={(optMonths) => {
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
            />
          )}

          {isDtTrayOpen && (
            <div className="space-y-1.5 border-t border-dashed border-(--rule-hairline)/60 pt-2 pb-1 font-mono text-xs select-none">
              <div className="flex items-center gap-1.5 px-0.5 text-[11px] text-(--ink-tertiary)">
                <PaperChip
                  size="sm"
                  selected={dateStr === todayStr}
                  onClick={() => setDateDelta(0)}
                >
                  今天
                </PaperChip>
                <PaperChip
                  size="sm"
                  selected={dateStr === yesterdayStr}
                  onClick={() => setDateDelta(-1)}
                >
                  昨天
                </PaperChip>
                <PaperChip
                  size="sm"
                  selected={dateStr === beforeYesterdayStr}
                  onClick={() => setDateDelta(-2)}
                >
                  前天
                </PaperChip>
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
            <OffsetTrayPanel
              candidateExpenses={candidateExpenses}
              categories={categories}
              offsetTransactionId={offsetTransactionId}
              offsetSummaryMap={offsetSummaryMap}
              onSelectOffsetExpense={handleSelectOffsetExpense}
              onClearOffsetExpense={handleClearOffsetExpense}
            />
          )}

          <PluginSlot name="tx.modal.metaTray" context={modalContext} />

          {txType === 'loan' && selectedLoanFlow.role === 'repayment' && settlementSummary && (
            <div className="pt-1 font-mono text-[11px] text-(--ink-secondary)">
              <div className="flex items-center gap-1.5">
                <span className="text-(--ink-tertiary)">关联借据:</span>
                <PaperSelect
                  value={relatedLoanId}
                  onChange={(e) => setRelatedLoanId(e.target.value)}
                  className="py-1 text-xs"
                >
                  <option value="none">无关联 (单笔独立借贷)</option>
                  {settlementSummary.pendingLoans.map((l: Transaction) => (
                    <option key={l.id} value={l.id}>
                      {l.note || l.loanParty || '借款'} (¥{((l.amount - (l.repaidAmount || 0)) / 100).toFixed(2)})
                    </option>
                  ))}
                </PaperSelect>
              </div>
            </div>
          )}
        </div>

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
    </div>
  );
};

export default AddTransactionModal;
