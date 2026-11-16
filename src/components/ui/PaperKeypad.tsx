import React, { useState } from 'react';
import { Delete, Trash2 } from 'lucide-react';
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
    'h-11 font-mono text-base font-semibold flex items-center justify-center transition-all cursor-pointer',
    'rounded-(--keypad-radius) border border-(--keypad-digit-border) bg-(--keypad-digit-bg) text-(--ink-primary) shadow-2xs hover:opacity-90 active:scale-[0.96]'
  );

  const opBtnClass = cn(
    'h-11 font-mono text-sm font-semibold flex items-center justify-center transition-all cursor-pointer',
    'rounded-(--keypad-radius) border border-(--keypad-op-border) bg-(--keypad-op-bg) text-(--ink-secondary) hover:text-(--ink-primary) active:scale-[0.96]'
  );

  return (
    <div
      className={cn(
        'grid grid-cols-4 gap-1.5 p-2 pb-[calc(10px+var(--safe-bottom))] select-none transition-colors duration-200',
        'bg-(--paper-sheet) paper-glass-blur border-t border-(--rule-hairline)',
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
            'h-11 text-xs font-semibold flex items-center justify-center transition-all cursor-pointer',
            'rounded-(--keypad-radius) border border-(--keypad-digit-border) bg-(--keypad-digit-bg) text-(--ink-primary) active:scale-[0.96]'
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
            'rounded-(--keypad-radius) border border-[rgba(189,88,64,0.25)] bg-(--color-expense-bg) text-(--color-expense) active:scale-[0.96]'
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
          'rounded-(--keypad-radius) bg-(--keypad-action-bg) text-(--keypad-action-fg) active:scale-[0.96]'
        )}
      >
        {mode === 'create' ? 'OK' : 'SAVE'}
      </button>
    </div>
  );
};

export default PaperKeypad;
