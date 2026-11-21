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
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors select-none',
        checked
          ? 'border-(--color-income) bg-(--color-income)'
          : 'border-(--rule-hairline) bg-(--paper-sunken)',
        disabled && 'cursor-not-allowed opacity-40',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute top-1/2 block size-3.5 -translate-y-1/2 rounded-full bg-(--paper-sheet) shadow-2xs transition-all duration-200',
          checked ? 'left-[18px]' : 'left-0.5'
        )}
      />
    </button>
  );
};

export default PaperSwitch;
