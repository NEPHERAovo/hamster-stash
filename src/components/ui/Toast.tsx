import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
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
    <div className="fixed inset-0 z-[350] flex items-center justify-center pointer-events-none px-8 pb-[8vh]">
      <div
        className={cn(
          'flex items-center gap-2 max-w-[78vw] sm:max-w-[320px] px-4 py-2.5 rounded-(--radius-lg) backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.16)] text-[13px] font-medium select-none',
          'bg-(--ink-solid)/90 text-(--paper-sheet)',
          'animate-[toastPopIn_0.2s_cubic-bezier(0.22,1,0.36,1)_forwards]'
        )}
      >
        <Icon className="w-4 h-4 stroke-[2.2] shrink-0" />
        <span className="whitespace-pre-line leading-snug">{currentToast.text}</span>
      </div>
    </div>
  );
};

export default Toast;
