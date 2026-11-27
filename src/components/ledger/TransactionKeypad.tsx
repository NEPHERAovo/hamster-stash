import React, { useEffect, useRef } from 'react';
import { BackspaceIcon as Delete } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';

const LONG_PRESS_CLEAR_MS = 450;

export interface TransactionKeypadProps {
  onDigit: (digit: string) => void;
  onOperator: (op: '+' | '-' | '×' | '÷' | 'add-mul' | 'sub-div') => void;
  onBackspace: () => void;
  onClear: () => void;
  onEqual?: () => void;
  onSubmit: (continueAdding: boolean) => void;
  hasOperator?: boolean;
  isEditing?: boolean;
  isSubmitting?: boolean;
  className?: string;
}

export const TransactionKeypad: React.FC<TransactionKeypadProps> = ({
  onDigit,
  onOperator,
  onBackspace,
  onClear,
  onSubmit,
  isEditing = false,
  isSubmitting = false,
  className,
}) => {
  const longPressTimerRef = useRef<number | null>(null);
  const didLongPressRef = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => cancelLongPress, []);

  const handleDeletePointerDown = () => {
    cancelLongPress();
    didLongPressRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      didLongPressRef.current = true;
      onClear();
    }, LONG_PRESS_CLEAR_MS);
  };

  const handleDeleteClick = () => {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    onBackspace();
  };

  return (
    <div className={cn('keypad-container w-full bg-(--paper-sheet) select-none', className)}>
      <div className="keypad-tray grid touch-manipulation grid-cols-4 gap-[0.5px] bg-(--rule-hairline) pt-[0.5px]">
        <button
          type="button"
          onClick={() => onDigit('1')}
          className="flex h-13 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-lg font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => onDigit('2')}
          className="flex h-13 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-lg font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => onDigit('3')}
          className="flex h-13 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-lg font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
        >
          3
        </button>
        <button
          type="button"
          onClick={() => onOperator('add-mul')}
          className="keypad-op-btn flex h-13 cursor-pointer items-center justify-center bg-(--paper-sunken) font-mono text-sm font-bold text-(--ink-secondary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
          title="加法与乘法运算"
          aria-label="加或乘"
        >
          + / ×
        </button>

        <button
          type="button"
          onClick={() => onDigit('4')}
          className="flex h-13 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-lg font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => onDigit('5')}
          className="flex h-13 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-lg font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => onDigit('6')}
          className="flex h-13 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-lg font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
        >
          6
        </button>
        <button
          type="button"
          onClick={() => onOperator('sub-div')}
          className="keypad-op-btn flex h-13 cursor-pointer items-center justify-center bg-(--paper-sunken) font-mono text-sm font-bold text-(--ink-secondary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
          title="减法与除法运算"
          aria-label="减或除"
        >
          − / ÷
        </button>

        <button
          type="button"
          onClick={() => onDigit('7')}
          className="flex h-13 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-lg font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => onDigit('8')}
          className="flex h-13 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-lg font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => onDigit('9')}
          className="flex h-13 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-lg font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
        >
          9
        </button>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => onSubmit(true)}
            disabled={isSubmitting}
            className="keypad-op-btn flex h-13 cursor-pointer items-center justify-center bg-(--paper-sunken) text-xs font-semibold text-(--ink-secondary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
            title="保存并继续记录下一笔"
          >
            再记一笔
          </button>
        ) : (
          <button
            type="button"
            onClick={onClear}
            className="keypad-op-btn flex h-13 cursor-pointer items-center justify-center bg-(--paper-sunken) font-mono text-xs font-semibold text-(--ink-tertiary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
            title="清空重置"
          >
            C
          </button>
        )}

        <button
          type="button"
          onClick={() => onDigit('.')}
          className="flex h-13 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-xl font-bold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
        >
          .
        </button>
        <button
          type="button"
          onClick={() => onDigit('0')}
          className="flex h-13 cursor-pointer items-center justify-center bg-(--paper-sheet) font-mono text-lg font-semibold text-(--ink-primary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDeleteClick}
          onPointerDown={handleDeletePointerDown}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onContextMenu={(e) => e.preventDefault()}
          className="keypad-op-btn flex h-13 cursor-pointer items-center justify-center bg-(--paper-sunken) text-(--ink-secondary) transition-colors hover:bg-(--paper-hover) active:bg-(--paper-sunken)"
          title="退格"
          aria-label="退格"
        >
          <Delete className="stroke-1.8 size-4.5" />
        </button>

        <button
          type="button"
          onClick={() => onSubmit(false)}
          disabled={isSubmitting}
          className="active:scale-0.98 flex h-13 cursor-pointer items-center justify-center bg-(--btn-primary-bg) font-mono text-xs font-bold tracking-wider text-(--btn-primary-fg) uppercase shadow-xs transition-all hover:opacity-95"
        >
          {isEditing ? '保存' : '完成'}
        </button>
      </div>
      <div className="keypad-safe-bottom h-(--safe-bottom) w-full bg-(--paper-sheet)" />
    </div>
  );
};

export default TransactionKeypad;
