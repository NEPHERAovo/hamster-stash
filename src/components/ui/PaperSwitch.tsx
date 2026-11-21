import React from 'react';
import { cn } from '../../utils/cn';

export interface PaperSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  title?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
  'aria-checked'?: boolean;
}

export const PaperSwitch: React.FC<PaperSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  title,
  id,
  className,
  'aria-label': ariaLabel,
}) => {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title || ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
      className={cn(
        'relative inline-flex items-center w-9 h-5 rounded-full border transition-colors cursor-pointer shrink-0 select-none',
        checked
          ? 'bg-(--color-income) border-(--color-income)'
          : 'bg-(--paper-sunken) border-(--rule-hairline)',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
    >
      <span
        className={cn(
          'block w-3.5 h-3.5 rounded-full bg-(--paper-sheet) shadow-2xs absolute top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none',
          checked ? 'left-[18px]' : 'left-0.5'
        )}
      />
    </button>
  );
};

export default PaperSwitch;
