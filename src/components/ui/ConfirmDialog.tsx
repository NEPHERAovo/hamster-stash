import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { cn } from '../../utils/cn';

export const ConfirmDialog: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const isOpen = useConfirmStore((s) => s.isOpen);
  const options = useConfirmStore((s) => s.options);
  const handleResolve = useConfirmStore((s) => s.handleResolve);
  const uiStyle = useThemeStore((s) => s.uiStyle);
  const isPaper = uiStyle === 'paper';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleResolve(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleResolve(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleResolve]);

  if (!mounted || !isOpen || !options) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 select-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200"
        onClick={() => handleResolve(false)}
        aria-hidden="true"
      />

      {/* Dialog box */}
      <div
        className={cn(
          'relative z-10 w-full max-w-[340px] p-5 shadow-2xl transition-all duration-200 scale-100',
          'bg-(--paper-sheet) paper-card border border-(--rule-hairline) rounded-(--radius-lg)'
        )}
      >
        {/* Paper mode washi tape decoration */}
        {isPaper && (
          <div
            className="washi-tape absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-4.5 pointer-events-none"
            aria-hidden="true"
          />
        )}

        <div className="space-y-2 pt-1">
          <h3
            id="confirm-dialog-title"
            className="text-base font-bold text-(--ink-solid) tracking-tight"
          >
            {options.title || '操作确认'}
          </h3>
          <p
            id="confirm-dialog-message"
            className="text-[13px] text-(--ink-secondary) leading-relaxed"
          >
            {options.message}
          </p>
        </div>

        <div className="flex items-center gap-2.5 pt-4 mt-1 border-t border-dashed border-(--rule-hairline)/60">
          <button
            type="button"
            onClick={() => handleResolve(false)}
            className="flex-1 h-9 rounded-(--btn-radius) border border-(--rule-hairline) bg-(--paper-sunken) text-(--ink-secondary) hover:text-(--ink-primary) hover:bg-(--paper-sunken)/80 active:scale-95 transition-all text-xs font-semibold cursor-pointer"
          >
            {options.cancelText || '取消'}
          </button>
          <button
            type="button"
            onClick={() => handleResolve(true)}
            className={cn(
              'flex-1 h-9 rounded-(--btn-radius) text-xs font-semibold active:scale-95 transition-all shadow-xs cursor-pointer',
              options.isDestructive
                ? 'bg-(--color-expense) text-(--paper-sheet) hover:opacity-90'
                : 'bg-(--btn-primary-bg) text-(--btn-primary-fg)'
            )}
          >
            {options.confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
