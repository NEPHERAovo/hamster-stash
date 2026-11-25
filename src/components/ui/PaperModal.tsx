import React from 'react';
import { createPortal } from 'react-dom';
import { XIcon as X } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';
import { useSheetDismissGesture } from '../../hooks/useSheetDismissGesture';

export interface PaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  showHandle?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const PaperModal: React.FC<PaperModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerExtra,
  showHandle = true,
  children,
  className,
}) => {
  const { shouldRender, backdropRef, sheetRef, closeWithAnimation } = useSheetDismissGesture({
    isOpen,
    onClose,
    maxThreshold: 100,
    lockBodyScroll: true,
  });

  if (typeof document === 'undefined' || !shouldRender) return null;

  return createPortal(
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
        className="fixed inset-0 bg-black/40 opacity-0 backdrop-blur-[2px] will-change-[opacity]"
        onClick={() => closeWithAnimation(240)}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        className={cn(
          'paper-modal-sheet relative flex max-h-[92dvh] w-full max-w-full flex-col overflow-hidden will-change-transform sm:max-w-lg md:max-w-xl',
          'rounded-t-(--radius-lg) rounded-b-none border-t border-(--rule-hairline) bg-(--paper-sheet) shadow-2xl sm:rounded-b-(--radius-lg) sm:border',
          className
        )}
      >
        {showHandle && (
          <div
            className="flex cursor-pointer items-center justify-center py-2.5 select-none"
            onClick={() => closeWithAnimation(240)}
            title="关闭"
          >
            <div className="h-1 w-9 rounded-full bg-(--ink-tertiary)/30" />
          </div>
        )}

        {(title || subtitle || headerExtra) && (
          <div className="flex shrink-0 items-start justify-between border-b border-(--rule-hairline)/60 px-4 pt-3.5 pb-2.5">
            <div>
              {title && (
                <h3 className="text-base font-semibold text-(--ink-primary)">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="mt-0.5 font-mono text-xs text-(--ink-tertiary)">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {headerExtra}
              <button
                type="button"
                onClick={() => closeWithAnimation(240)}
                className="cursor-pointer rounded-full p-1 text-(--ink-tertiary) transition-colors hover:bg-(--paper-sunken) hover:text-(--ink-primary)"
                title="关闭"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaperModal;
