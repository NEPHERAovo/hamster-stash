import React, { useState } from 'react';
import { Delete, Trash2 } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { cn } from '../../utils/cn';

export interface PaperKeypadProps {
  mode?: 'create' | 'edit';
  onDigit: (digit: string) => void;
  onOperator: (op: '+' | '-' | '×' | '÷') => void;
  onBackspace: () => void;
  onFinish: () => void;
  onSaveAnother?: () => void;
  onDelete?: () => void;
  canFinish?: boolean;
  className?: string;
}

export const PaperKeypad: React.FC<PaperKeypadProps> = ({
  mode = 'create',
  onDigit,
  onOperator,
  onBackspace,
  onFinish,
  onSaveAnother,
  onDelete,
  canFinish = true,
  className,
}) => {
  const [useMinus, setUseMinus] = useState(false);
  const [useDivide, setUseDivide] = useState(false);
  const uiStyle = useThemeStore((s) => s.uiStyle);
  const isModern = uiStyle === 'modern';

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        void 0;
      }
    }
  };

  const handleDigitPress = (d: string) => {
    triggerHaptic();
    onDigit(d);
  };

  const handlePlusMinus = () => {
    triggerHaptic();
    const nextOp = useMinus ? '+' : '-';
    onOperator(nextOp);
    setUseMinus(!useMinus);
  };

  const handleMultiplyDivide = () => {
    triggerHaptic();
    const nextOp = useDivide ? '×' : '÷';
    onOperator(nextOp);
    setUseDivide(!useDivide);
  };

  const handleBackspacePress = () => {
    triggerHaptic();
    onBackspace();
  };

  const handleFinishPress = () => {
    triggerHaptic();
    onFinish();
  };

  const digitBtnClass = cn(
    'h-11 font-mono text-base font-semibold flex items-center justify-center transition-all cursor-pointer',
    isModern
      ? 'rounded-2xl border border-(--rule-hairline) bg-(--paper-sheet) text-(--ink-primary) shadow-2xs hover:bg-(--paper-sunken)/80 active:scale-[0.95]'
      : 'rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken)'
  );

  const opBtnClass = cn(
    'h-11 font-mono text-sm font-semibold flex items-center justify-center transition-all cursor-pointer',
    isModern
      ? 'rounded-2xl border border-(--rule-hairline) bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary) active:scale-[0.95]'
      : 'rounded-xs border border-(--border-hairline) bg-(--bg-hover) text-(--ink-secondary) active:bg-(--bg-sunken) active:scale-[0.97]'
  );

  return (
    <div
      className={cn(
        'grid grid-cols-4 gap-1.5 p-2 pb-[calc(10px+var(--safe-bottom))] select-none transition-colors duration-200',
        isModern
          ? 'bg-(--paper-sheet)/60 backdrop-blur-xl border-t border-(--rule-hairline)'
          : 'bg-(--bg-sunken) border-t border-(--border-hairline)',
        className
      )}
    >
      <button
        type="button"
        onClick={() => handleDigitPress('7')}
        className={digitBtnClass}
      >
        7
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('8')}
        className={digitBtnClass}
      >
        8
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('9')}
        className={digitBtnClass}
      >
        9
      </button>
      <button
        type="button"
        onClick={handlePlusMinus}
        title="加/减运算符"
        className={opBtnClass}
      >
        {useMinus ? '−' : '+'}
      </button>

      <button
        type="button"
        onClick={() => handleDigitPress('4')}
        className={digitBtnClass}
      >
        4
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('5')}
        className={digitBtnClass}
      >
        5
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('6')}
        className={digitBtnClass}
      >
        6
      </button>
      <button
        type="button"
        onClick={handleMultiplyDivide}
        title="乘/除运算符"
        className={opBtnClass}
      >
        {useDivide ? '÷' : '×'}
      </button>

      <button
        type="button"
        onClick={() => handleDigitPress('1')}
        className={digitBtnClass}
      >
        1
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('2')}
        className={digitBtnClass}
      >
        2
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('3')}
        className={digitBtnClass}
      >
        3
      </button>
      {mode === 'create' ? (
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            onSaveAnother?.();
          }}
          className={cn(
            'h-11 text-xs font-semibold flex items-center justify-center transition-all cursor-pointer',
            isModern
              ? 'rounded-2xl border border-(--rule-hairline) bg-(--paper-sunken) text-(--ink-primary) active:scale-[0.95]'
              : 'rounded-xs border border-(--border-default) bg-(--bg-surface) text-(--ink-primary) active:bg-(--bg-hover) active:scale-[0.97]'
          )}
        >
          再记一笔
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            onDelete?.();
          }}
          className={cn(
            'h-11 text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer',
            isModern
              ? 'rounded-2xl border border-[rgba(189,88,64,0.25)] bg-(--color-expense-bg) text-(--color-expense) active:scale-[0.95]'
              : 'rounded-xs border border-[rgba(189,88,64,0.25)] bg-(--color-expense-bg) text-(--color-expense) active:scale-[0.97]'
          )}
        >
          <Trash2 className="w-3.5 h-3.5 stroke-2" />
          <span>删除</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => handleDigitPress('.')}
        className={cn(digitBtnClass, 'text-lg font-bold')}
      >
        .
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('0')}
        className={digitBtnClass}
      >
        0
      </button>
      <button
        type="button"
        onClick={handleBackspacePress}
        title="退格"
        className={cn(digitBtnClass, 'text-base')}
      >
        <Delete className="w-4.5 h-4.5 stroke-[1.8]" />
      </button>
      <button
        type="button"
        onClick={handleFinishPress}
        disabled={!canFinish}
        className={cn(
          'h-11 text-xs font-mono font-semibold tracking-wider uppercase flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
          isModern
            ? 'rounded-2xl border-none bg-[#1677ff] text-white dark:bg-[#4d94ff] dark:text-[#0d0f17] shadow-[0_4px_14px_rgba(22,119,255,0.4)] active:scale-[0.95]'
            : 'rounded-xs border-none bg-(--ink-primary) text-(--bg-surface) shadow-(--shadow-xs) active:scale-[0.97]'
        )}
      >
        {mode === 'create' ? 'OK' : 'SAVE'}
      </button>
    </div>
  );
};

export default PaperKeypad;
