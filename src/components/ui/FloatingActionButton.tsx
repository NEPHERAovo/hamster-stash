import React from 'react';
import { PlusIcon as Plus, type Icon } from '@phosphor-icons/react';
import { cn } from '../../utils/cn';

export interface FloatingActionButtonProps {
  icon?: Icon;
  onClick: () => void;
  title: string;
  rotated?: boolean;
  placement?: 'dock' | 'corner';
  className?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  icon: IconComp = Plus,
  onClick,
  title,
  rotated = false,
  placement = 'dock',
  className,
}) => {
  return (
    <div
      className={cn(
        'pointer-events-none fixed left-1/2 w-full max-w-[430px] -translate-x-1/2',
        placement === 'dock' ? 'floating-action-dock' : 'bottom-6 z-40'
      )}
    >
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className={cn(
          'floating-action-btn pointer-events-auto absolute bottom-0 flex cursor-pointer items-center justify-center transition-all',
          className
        )}
      >
        <IconComp
          className={cn(
            'floating-action-icon transition-transform duration-200',
            rotated && 'rotate-45'
          )}
        />
      </button>
    </div>
  );
};

export default FloatingActionButton;
