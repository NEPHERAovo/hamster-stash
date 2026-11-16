import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { cn } from '../../utils/cn';

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
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const uiStyle = useThemeStore((s) => s.uiStyle);
  const isModern = uiStyle === 'modern';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const timer = setTimeout(() => {
        document.body.style.overflow = '';
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || (!isOpen && !visible)) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-300',
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={cn(
          'relative w-full max-w-full sm:max-w-lg md:max-w-xl max-h-[92vh] flex flex-col overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          isModern
            ? 'bg-(--paper-sheet) backdrop-blur-2xl rounded-t-[28px] sm:rounded-b-[28px] border-t sm:border border-(--rule-hairline) shadow-2xl'
            : 'bg-(--bg-base) rounded-t-sm sm:rounded-b-sm sm:mb-6 shadow-(--shadow-lg) sm:shadow-2xl',
          visible ? 'translate-y-0' : 'translate-y-full',
          className
        )}
      >
        {showHandle && (
          isModern ? (
            <div
              className="py-2.5 flex items-center justify-center cursor-pointer select-none"
              onClick={onClose}
              title="关闭"
            >
              <div className="w-9 h-1 rounded-full bg-(--ink-tertiary)/30" />
            </div>
          ) : (
            <div
              className="bg-[#2D2A26] dark:bg-[#181716] text-[#F7F6F3] py-1.5 px-4 flex items-center justify-between cursor-pointer select-none border-b border-[#383531]"
              onClick={onClose}
              title="关闭便笺"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-none bg-(--color-accent) opacity-80" />
                <span className="font-mono text-[10px] tracking-widest text-[#EAE7E1] uppercase">
                  便签
                </span>
              </div>
              <div className="w-8 h-1 rounded-xs bg-[#6E6A63] opacity-50" />
            </div>
          )
        )}

        {(title || headerExtra) && (
          <div
            className={cn(
              'flex items-center justify-between px-4 py-2 select-none',
              isModern
                ? 'border-b border-(--rule-hairline) bg-transparent'
                : 'border-b border-(--border-hairline) bg-(--bg-surface)'
            )}
          >
            <div className="flex flex-col">
              {title && (
                <h3
                  className={cn(
                    'text-sm font-semibold',
                    isModern ? 'text-(--ink-primary) font-bold' : 'text-(--ink-primary)'
                  )}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <span className="text-[11px] font-mono text-(--ink-tertiary)">{subtitle}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {headerExtra}
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'w-6 h-6 flex items-center justify-center text-(--ink-tertiary) hover:text-(--ink-primary) cursor-pointer transition-colors',
                  isModern
                    ? 'rounded-full bg-(--paper-sunken)/70 hover:bg-(--paper-sunken)'
                    : 'rounded-xs hover:bg-(--bg-hover) border border-transparent hover:border-(--border-hairline)'
                )}
                aria-label="关闭"
              >
                <X className="w-4 h-4 stroke-2" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaperModal;
