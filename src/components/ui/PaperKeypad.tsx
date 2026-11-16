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

  return (
    <div
      className={cn(
        'grid grid-cols-4 gap-1 p-2 pb-[calc(10px+var(--safe-bottom))] bg-(--bg-sunken) select-none border-t border-(--border-hairline)',
        className
      )}
    >
      <button
        type="button"
        onClick={() => handleDigitPress('7')}
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
      >
        7
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('8')}
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
      >
        8
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('9')}
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
      >
        9
      </button>
      <button
        type="button"
        onClick={handlePlusMinus}
        title="加/减运算符"
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-hover) text-(--ink-secondary) font-mono text-sm font-semibold flex items-center justify-center active:bg-(--bg-sunken) active:scale-[0.97] transition-transform cursor-pointer"
      >
        {useMinus ? '−' : '+'}
      </button>

      <button
        type="button"
        onClick={() => handleDigitPress('4')}
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
      >
        4
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('5')}
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
      >
        5
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('6')}
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
      >
        6
      </button>
      <button
        type="button"
        onClick={handleMultiplyDivide}
        title="乘/除运算符"
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-hover) text-(--ink-secondary) font-mono text-sm font-semibold flex items-center justify-center active:bg-(--bg-sunken) active:scale-[0.97] transition-transform cursor-pointer"
      >
        {useDivide ? '÷' : '×'}
      </button>

      <button
        type="button"
        onClick={() => handleDigitPress('1')}
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
      >
        1
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('2')}
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
      >
        2
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('3')}
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
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
          className="h-11 rounded-xs border border-(--border-default) bg-(--bg-surface) text-(--ink-primary) text-xs font-semibold flex items-center justify-center active:bg-(--bg-hover) active:scale-[0.97] transition-transform cursor-pointer"
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
          className="h-11 rounded-xs border border-[rgba(189,88,64,0.25)] bg-(--color-expense-bg) text-(--color-expense) text-xs font-semibold flex items-center justify-center gap-1 active:scale-[0.97] transition-transform cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 stroke-2" />
          <span>删除</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => handleDigitPress('.')}
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) font-mono text-lg font-bold flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
      >
        .
      </button>
      <button
        type="button"
        onClick={() => handleDigitPress('0')}
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
      >
        0
      </button>
      <button
        type="button"
        onClick={handleBackspacePress}
        title="退格"
        className="h-11 rounded-xs border border-(--border-hairline) bg-(--bg-surface) text-(--ink-primary) flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] active:bg-(--bg-sunken) transition-transform cursor-pointer"
      >
        <Delete className="w-4.5 h-4.5 stroke-[1.8]" />
      </button>
      <button
        type="button"
        onClick={handleFinishPress}
        disabled={!canFinish}
        className="h-11 rounded-xs border-none bg-(--ink-primary) text-(--bg-surface) text-xs font-mono font-semibold tracking-wider uppercase flex items-center justify-center shadow-(--shadow-xs) active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-transform cursor-pointer"
      >
        {mode === 'create' ? 'OK' : 'SAVE'}
      </button>
    </div>
  );
};

export default PaperKeypad;
