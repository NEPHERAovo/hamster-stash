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
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[350] pointer-events-none transition-all duration-300">
      <div
        className={cn(
          'flex items-center gap-1.5 px-4 py-2 rounded-full shadow-(--shadow-lg) text-xs font-semibold select-none',
          'bg-(--ink-primary) text-(--bg-base)',
          'animate-[toastSlideDown_0.25s_cubic-bezier(0.32,0.72,0,1)_forwards]'
        )}
      >
        <Icon className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
        <span className="whitespace-pre-line leading-tight">{currentToast.text}</span>
      </div>
    </div>
  );
};

export default Toast;
