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
    <div className="fixed inset-0 flex size-full flex-col items-center overflow-hidden bg-(--paper-base) text-(--ink-primary) select-none">
      <div className="paper-grain" aria-hidden="true" />

      {showGrid && <div className="grid-layer" aria-hidden="true" />}

      <div
        className={cn(
          'relative mx-auto flex size-full min-h-0 max-w-[430px] flex-1 flex-col overflow-hidden bg-transparent shadow-[-1px_0_0_var(--rule-hairline),1px_0_0_var(--rule-hairline)] transition-colors duration-300',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
};

export default AppShell;
