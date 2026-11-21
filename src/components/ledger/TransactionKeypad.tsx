import React from 'react';
import { BackspaceIcon as Delete } from '@phosphor-icons/react';
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
    <div className={cn('keypad-tray grid touch-manipulation grid-cols-4 gap-[0.5px] bg-(--rule-hairline) pt-[0.5px] select-none', className)}>
      <button
        type="button"
        onClick={() => onDigit('7')}
        className="flex h-11 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-base font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      >
        7
      </button>
      <button
        type="button"
        onClick={() => onDigit('8')}
        className="flex h-11 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-base font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      >
        8
      </button>
      <button
        type="button"
        onClick={() => onDigit('9')}
        className="flex h-11 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-base font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      >
        9
      </button>
      <button
        type="button"
        onClick={() => onOperator('+')}
        className="keypad-op-btn flex h-11 cursor-pointer items-center justify-center bg-(--paper-sunken) font-mono text-base font-bold text-(--ink-secondary) transition-colors hover:bg-(--paper-hover)"
        title="加法运算"
      >
        +
      </button>

      <button
        type="button"
        onClick={() => onDigit('4')}
        className="flex h-11 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-base font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      >
        4
      </button>
      <button
        type="button"
        onClick={() => onDigit('5')}
        className="flex h-11 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-base font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      >
        5
      </button>
      <button
        type="button"
        onClick={() => onDigit('6')}
        className="flex h-11 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-base font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      >
        6
      </button>
      <button
        type="button"
        onClick={() => onOperator('-')}
        className="keypad-op-btn flex h-11 cursor-pointer items-center justify-center bg-(--paper-sunken) font-mono text-base font-bold text-(--ink-secondary) transition-colors hover:bg-(--paper-hover)"
        title="减法运算"
      >
        −
      </button>

      <button
        type="button"
        onClick={() => onDigit('1')}
        className="flex h-11 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-base font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      >
        1
      </button>
      <button
        type="button"
        onClick={() => onDigit('2')}
        className="flex h-11 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-base font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      >
        2
      </button>
      <button
        type="button"
        onClick={() => onDigit('3')}
        className="flex h-11 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-base font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      >
        3
      </button>
      <button
        type="button"
        onClick={onBackspace}
        className="keypad-op-btn flex h-11 cursor-pointer items-center justify-center bg-(--paper-sunken) text-(--ink-secondary) transition-colors hover:bg-(--paper-hover)"
        title="退格"
      >
        <Delete className="stroke-1.8 size-4" />
      </button>

      <button
        type="button"
        onClick={() => onDigit('.')}
        className="flex h-11 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-lg font-bold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      >
        .
      </button>
      <button
        type="button"
        onClick={() => onDigit('0')}
        className="flex h-11 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-base font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
      >
        0
      </button>

      {!isEditing ? (
        <button
          type="button"
          onClick={() => onSubmit(true)}
          disabled={isSubmitting}
          className="keypad-op-btn flex h-11 cursor-pointer items-center justify-center bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) transition-colors hover:bg-(--paper-hover)"
          title="保存并继续记录下一笔"
        >
          再记一笔
        </button>
      ) : (
        <button
          type="button"
          onClick={onClear}
          className="keypad-op-btn flex h-11 cursor-pointer items-center justify-center bg-(--paper-sunken) font-mono text-xs font-semibold text-(--ink-tertiary) transition-colors hover:bg-(--paper-hover)"
          title="清空重置"
        >
          C
        </button>
      )}

      {hasOperator ? (
        <button
          type="button"
          onClick={onEqual}
          className="active:scale-0.98 flex h-11 cursor-pointer items-center justify-center bg-(--color-accent-bg) font-mono text-lg font-bold text-(--color-accent) transition-all hover:opacity-90"
          title="计算结果"
        >
          =
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSubmit(false)}
          disabled={isSubmitting}
          className="active:scale-0.98 flex h-11 cursor-pointer items-center justify-center bg-(--btn-primary-bg) font-mono text-xs font-bold tracking-wider text-(--btn-primary-fg) uppercase shadow-xs transition-all hover:opacity-95"
        >
          {isEditing ? '保存' : '完成'}
        </button>
      )}
    </div>
  );
};

export default TransactionKeypad;
