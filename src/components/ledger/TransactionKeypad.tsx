import React from 'react';
import { Backspace as Delete } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';

export interface TransactionKeypadProps {
  onDigit: (digit: string) => void;
  onOperator: (op: '+' | '-') => void;
  onBackspace: () => void;
  onClear: () => void;
  onEqual: () => void;
  onSubmit: (continueAdding: boolean) => void;
  hasOperator: boolean;
  isEditing?: boolean;
  isSubmitting?: boolean;
  className?: string;
}

export const TransactionKeypad: React.FC<TransactionKeypadProps> = ({
  onDigit,
  onOperator,
  onBackspace,
  onClear,
  onEqual,
  onSubmit,
  hasOperator,
  isEditing = false,
  isSubmitting = false,
  className,
}) => {
  return (
    <div className={cn('keypad-tray grid grid-cols-4 gap-[0.5px] bg-(--rule-hairline) pt-[0.5px] select-none', className)}>
      <button
        type="button"
        onClick={() => onDigit('7')}
        className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
      >
        7
      </button>
      <button
        type="button"
        onClick={() => onDigit('8')}
        className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
      >
        8
      </button>
      <button
        type="button"
        onClick={() => onDigit('9')}
        className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
      >
        9
      </button>
      <button
        type="button"
        onClick={() => onOperator('+')}
        className="h-11 keypad-op-btn bg-(--paper-sunken) hover:bg-(--paper-hover) text-(--ink-secondary) font-mono text-base font-bold flex items-center justify-center transition-colors cursor-pointer"
        title="加法运算"
      >
        +
      </button>

      <button
        type="button"
        onClick={() => onDigit('4')}
        className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
      >
        4
      </button>
      <button
        type="button"
        onClick={() => onDigit('5')}
        className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
      >
        5
      </button>
      <button
        type="button"
        onClick={() => onDigit('6')}
        className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
      >
        6
      </button>
      <button
        type="button"
        onClick={() => onOperator('-')}
        className="h-11 keypad-op-btn bg-(--paper-sunken) hover:bg-(--paper-hover) text-(--ink-secondary) font-mono text-base font-bold flex items-center justify-center transition-colors cursor-pointer"
        title="减法运算"
      >
        −
      </button>

      <button
        type="button"
        onClick={() => onDigit('1')}
        className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
      >
        1
      </button>
      <button
        type="button"
        onClick={() => onDigit('2')}
        className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
      >
        2
      </button>
      <button
        type="button"
        onClick={() => onDigit('3')}
        className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
      >
        3
      </button>
      <button
        type="button"
        onClick={onBackspace}
        className="h-11 keypad-op-btn bg-(--paper-sunken) hover:bg-(--paper-hover) text-(--ink-secondary) flex items-center justify-center transition-colors cursor-pointer"
        title="退格"
      >
        <Delete className="w-4 h-4 stroke-[1.8]" />
      </button>

      <button
        type="button"
        onClick={() => onDigit('.')}
        className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-lg font-bold flex items-center justify-center transition-colors cursor-pointer"
      >
        .
      </button>
      <button
        type="button"
        onClick={() => onDigit('0')}
        className="h-11 bg-(--paper-sheet) hover:bg-(--paper-hover) active:bg-(--paper-sunken) text-(--ink-primary) font-mono text-base font-semibold flex items-center justify-center transition-colors cursor-pointer"
      >
        0
      </button>

      {!isEditing ? (
        <button
          type="button"
          onClick={() => onSubmit(true)}
          disabled={isSubmitting}
          className="h-11 keypad-op-btn bg-(--paper-sunken) hover:bg-(--paper-hover) text-(--ink-secondary) text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
          title="保存并继续记录下一笔"
        >
          再记一笔
        </button>
      ) : (
        <button
          type="button"
          onClick={onClear}
          className="h-11 keypad-op-btn bg-(--paper-sunken) hover:bg-(--paper-hover) text-(--ink-tertiary) font-mono text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
          title="清空重置"
        >
          C
        </button>
      )}

      {hasOperator ? (
        <button
          type="button"
          onClick={onEqual}
          className="h-11 bg-(--color-accent-bg) hover:opacity-90 active:scale-[0.98] text-(--color-accent) font-mono text-lg font-bold flex items-center justify-center transition-all cursor-pointer"
          title="计算结果"
        >
          =
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSubmit(false)}
          disabled={isSubmitting}
          className="h-11 bg-(--btn-primary-bg) hover:opacity-95 active:scale-[0.98] text-(--btn-primary-fg) font-mono text-xs font-bold tracking-wider uppercase flex items-center justify-center transition-all cursor-pointer shadow-xs"
        >
          {isEditing ? '保存' : '完成'}
        </button>
      )}
    </div>
  );
};

export default TransactionKeypad;
