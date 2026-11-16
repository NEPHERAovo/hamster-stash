import React from 'react';
import { cn } from '../../utils/cn';

export interface AppShellProps {
  children: React.ReactNode;
  className?: string;
  showGrid?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  className,
  showGrid = true,
}) => {
  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full min-h-[100dvh] flex flex-col items-center bg-(--paper-base) text-(--ink-primary) relative overflow-hidden select-none">
      <div className="paper-grain" aria-hidden="true" />

      {showGrid && <div className="grid-layer" aria-hidden="true" />}

      <div
        className={cn(
          'w-full max-w-[430px] mx-auto h-full max-h-[100dvh] min-h-[100dvh] relative z-1 bg-transparent shadow-[-1px_0_0_var(--rule-hairline),1px_0_0_var(--rule-hairline)] flex flex-col overflow-hidden transition-colors duration-300',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
};

export default AppShell;
