import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConfirmStore } from '../../stores/useConfirmStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { PaperButton } from './PaperButton';
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
          'relative z-10 w-full max-w-85 scale-100 p-5 shadow-2xl transition-all duration-200',
          'paper-card rounded-(--radius-lg) border border-(--rule-hairline) bg-(--paper-sheet)'
        )}
      >
        {/* Paper mode washi tape decoration */}
        {isPaper && (
          <div
            className="washi-tape pointer-events-none absolute -top-3 left-1/2 h-4.5 w-20 -translate-x-1/2"
            aria-hidden="true"
          />
        )}

        <div className="space-y-2 pt-1">
          <h3
            id="confirm-dialog-title"
            className="text-base font-bold tracking-tight text-(--ink-solid)"
          >
            {options.title || '操作确认'}
          </h3>
          <p
            id="confirm-dialog-message"
            className="text-[13px] leading-relaxed text-(--ink-secondary)"
          >
            {options.message}
          </p>
        </div>

        <div className="mt-1 flex items-center gap-2.5 border-t border-dashed border-(--rule-hairline)/60 pt-4">
          <PaperButton
            type="button"
            variant="sunken"
            size="sm"
            className="flex-1"
            onClick={() => handleResolve(false)}
          >
            {options.cancelText || '取消'}
          </PaperButton>
          <PaperButton
            type="button"
            variant={options.isDestructive ? 'danger' : 'primary'}
            size="sm"
            className="flex-1"
            onClick={() => handleResolve(true)}
          >
            {options.confirmText || '确定'}
          </PaperButton>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
