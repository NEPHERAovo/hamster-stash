import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
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
          'bg-(--paper-sheet) paper-card border-t sm:border border-(--rule-hairline) shadow-2xl rounded-t-(--radius-lg) sm:rounded-b-(--radius-lg)',
          visible ? 'translate-y-0' : 'translate-y-full',
          className
        )}
      >
        {showHandle && (
          <div
            className="py-2.5 flex items-center justify-center cursor-pointer select-none"
            onClick={onClose}
            title="关闭"
          >
            <div className="w-9 h-1 rounded-full bg-(--ink-tertiary)/30" />
          </div>
        )}

        {(title || subtitle || headerExtra) && (
          <div className="px-4 pt-3.5 pb-2.5 flex items-start justify-between shrink-0 border-b border-(--rule-hairline)/60">
            <div>
              {title && (
                <h3 className="text-base text-(--ink-primary) font-semibold">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-(--ink-tertiary) mt-0.5 font-mono">
                  {subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {headerExtra}
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-(--ink-tertiary) hover:text-(--ink-primary) hover:bg-(--paper-sunken) transition-colors cursor-pointer"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaperModal;
