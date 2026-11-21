import React from 'react';
import { CheckCircleIcon as CheckCircle2, WarningCircleIcon as AlertCircle, InfoIcon as Info, WarningIcon as AlertTriangle } from '@phosphor-icons/react';
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
    <div className="pointer-events-none fixed inset-x-0 top-0 z-350 flex justify-center px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
      <div
        className={cn(
          'flex max-w-[88vw] items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium shadow-[0_4px_16px_rgba(0,0,0,0.14)] backdrop-blur-md select-none sm:max-w-90',
          'bg-(--ink-solid)/90 text-(--paper-sheet)',
          'animate-[toastSlideDown_0.22s_cubic-bezier(0.16,1,0.3,1)_forwards]'
        )}
      >
        <Icon className="size-3.5 shrink-0 stroke-2" />
        <span className="truncate leading-tight whitespace-pre-line">{currentToast.text}</span>
      </div>
    </div>
  );
};

export default Toast;
