import React, { useState } from 'react';
import { BackspaceIcon as Delete, TrashIcon as Trash2 } from '@phosphor-icons/react';
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
    'flex h-11 cursor-pointer items-center justify-center font-mono text-base font-semibold transition-all',
    'active:scale-0.96 rounded-(--keypad-radius) border border-(--keypad-digit-border) bg-(--keypad-digit-bg) text-(--ink-primary) shadow-2xs hover:opacity-90'
  );

  const opBtnClass = cn(
    'flex h-11 cursor-pointer items-center justify-center font-mono text-sm font-semibold transition-all',
    'active:scale-0.96 rounded-(--keypad-radius) border border-(--keypad-op-border) bg-(--keypad-op-bg) text-(--ink-secondary) hover:text-(--ink-primary)'
  );

  return (
    <div
      className={cn(
        'grid grid-cols-4 gap-1.5 p-2 pb-[calc(10px+var(--safe-bottom))] transition-colors duration-200 select-none',
        'paper-glass-blur border-t border-(--rule-hairline) bg-(--paper-sheet)',
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
        className={opBtnClass}
        title="加减运算符"
      >
        {useMinus ? '-' : '+'}
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
        className={opBtnClass}
        title="乘除运算符"
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
            'flex h-11 cursor-pointer items-center justify-center text-xs font-semibold transition-all',
            'active:scale-0.96 rounded-(--keypad-radius) border border-(--keypad-digit-border) bg-(--keypad-digit-bg) text-(--ink-primary)'
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
            'flex h-11 cursor-pointer items-center justify-center gap-1 text-xs font-semibold transition-all',
            'active:scale-0.96 rounded-(--keypad-radius) border border-(--color-expense)/25 bg-(--color-expense-bg) text-(--color-expense)'
          )}
        >
          <Trash2 className="size-3.5 stroke-2" />
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
        <Delete className="stroke-1.8 size-4.5" />
      </button>
      <button
        type="button"
        onClick={handleFinishPress}
        disabled={!canFinish}
        className={cn(
          'flex h-11 cursor-pointer items-center justify-center font-mono text-xs font-semibold tracking-wider uppercase transition-all disabled:cursor-not-allowed disabled:opacity-40',
          'active:scale-0.96 rounded-(--keypad-radius) bg-(--keypad-action-bg) text-(--keypad-action-fg)'
        )}
      >
        {mode === 'create' ? 'OK' : 'SAVE'}
      </button>
    </div>
  );
};

export default PaperKeypad;
