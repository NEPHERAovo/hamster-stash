import React from 'react';
import { CheckCircle as CheckCircle2, WarningCircle as AlertCircle, Info, Warning as AlertTriangle } from '@phosphor-icons/react';
import { useToastStore } from '../../stores/useToastStore';
import { cn } from '../../utils/cn';

export const Toast: React.FC = () => {
  const currentToast = useToastStore((state) => state.currentToast);

  if (!currentToast) return null;

  const Icon = (() => {
    switch (currentToast.type) {
      case 'error':
        return AlertCircle;
      case 'warning':
        return AlertTriangle;
      case 'info':
        return Info;
      case 'success':
      default:
        return CheckCircle2;
    }
  })();

  return (
    <div className="fixed top-0 inset-x-0 z-[350] flex justify-center pointer-events-none px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
      <div
        className={cn(
          'flex items-center gap-2 max-w-[88vw] sm:max-w-[360px] px-3.5 py-2 rounded-full backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.14)] text-xs font-medium select-none',
          'bg-(--ink-solid)/90 text-(--paper-sheet)',
          'animate-[toastSlideDown_0.22s_cubic-bezier(0.16,1,0.3,1)_forwards]'
        )}
      >
        <Icon className="w-3.5 h-3.5 stroke-[2] shrink-0" />
        <span className="whitespace-pre-line leading-tight truncate">{currentToast.text}</span>
      </div>
    </div>
  );
};

export default Toast;
